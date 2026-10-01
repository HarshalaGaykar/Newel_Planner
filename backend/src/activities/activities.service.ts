import {
  Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActivityActionType, ActivityStatus, EmploymentStatus, NotificationType,
  RecurrenceFrequency, RecurrenceStatus,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../notifications/email.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { PostponeActivityDto } from './dto/postpone-activity.dto';
import { ActivityActionDto } from './dto/activity-action.dto';
import { QueryActivitiesDto } from './dto/query-activities.dto';
import { CreateRecurringActivityDto, QueryRecurrencesDto } from './dto/create-recurring-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { UpdateActivityStatusDto } from './dto/update-activity-status.dto';
import { AddActivityRemarkDto } from './dto/add-activity-remark.dto';
import {
  RecurrenceRule, describeRecurrence, expandOccurrences, isFullyGenerated, normaliseWeekdays,
} from './recurrence.util';
import dayjs from 'dayjs';

type Actor = { id: string; role: string };

/**
 * How far ahead occurrences are materialised. A rolling horizon keeps an
 * open-ended daily series from writing thousands of rows up front while leaving
 * every list query a plain range scan over real rows.
 */
export const GENERATION_HORIZON_DAYS = 90;

const RECURRENCE_INCLUDE = {
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
  assignees: {
    select: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
    },
  },
} as const;

// ToDo/Activity notifications are in-app only. Assignees get a bell entry for
// every state change, and the recurrence cron fires these unattended at night,
// so the email channel is switched off here rather than left to each user's
// notification preferences. Both notify paths below honour this flag — flip it
// back to true to restore the emails (and their pre-rendered templates).
const ACTIVITY_EMAIL_ENABLED = false;

const ACTIVITY_INCLUDE = {
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
  assignees: {
    select: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
    },
  },
  actions: {
    orderBy: { createdAt: 'desc' as const },
    take: 20,
    select: {
      id: true, type: true, remarks: true, createdAt: true,
      fromStartAt: true, fromEndAt: true, toStartAt: true, toEndAt: true,
      actor: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} as const;

@Injectable()
export class ActivitiesService {
  private readonly logger = new Logger(ActivitiesService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private emailService: EmailService,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private displayName(user?: { firstName?: string | null; lastName?: string | null; email?: string } | null) {
    if (!user) return '';
    return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || '';
  }

  /**
   * Validates the window and normalises it. An all-day activity is stored as the
   * full day so range queries need no special-casing for it later.
   */
  private resolveWindow(startAtInput: string, endAtInput: string, allDay?: boolean) {
    let startAt = dayjs(startAtInput);
    let endAt = dayjs(endAtInput);

    if (!startAt.isValid()) throw new BadRequestException('Invalid startAt');
    if (!endAt.isValid()) throw new BadRequestException('Invalid endAt');

    if (allDay) {
      startAt = startAt.startOf('day');
      endAt = endAt.endOf('day');
    }

    if (endAt.isBefore(startAt)) {
      throw new BadRequestException('endAt must be the same as or after startAt');
    }

    return { startAt: startAt.toDate(), endAt: endAt.toDate(), allDay: Boolean(allDay) };
  }

  private formatWindow(startAt: Date, endAt: Date, allDay: boolean) {
    if (allDay) {
      const start = dayjs(startAt).format('DD MMM YYYY');
      const end = dayjs(endAt).format('DD MMM YYYY');
      return start === end ? `${start} (all day)` : `${start} – ${end} (all day)`;
    }

    const sameDay = dayjs(startAt).isSame(endAt, 'day');
    const start = dayjs(startAt).format('DD MMM YYYY, hh:mm A');
    const end = sameDay ? dayjs(endAt).format('hh:mm A') : dayjs(endAt).format('DD MMM YYYY, hh:mm A');
    return `${start} – ${end}`;
  }

  private async loadOwnedActivity(id: string, actor: Actor) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      include: ACTIVITY_INCLUDE,
    });

    if (!activity) throw new NotFoundException('Activity not found');

    // Only creator or admin can modify core schedule or structure
    if (activity.createdById !== actor.id && !['ADMIN'].includes(actor.role)) {
      throw new ForbiddenException('Only the creator of an activity can act on it');
    }

    return activity;
  }

  private async loadActivityForAction(id: string, actor: Actor) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      include: ACTIVITY_INCLUDE,
    });

    if (!activity) throw new NotFoundException('Activity not found');

    const isCreator = activity.createdById === actor.id;
    const isAssignee = activity.assignees.some((a) => a.user.id === actor.id);

    if (!isCreator && !isAssignee && !['ADMIN'].includes(actor.role)) {
      throw new ForbiddenException('Only the creator or an assigned user can update this activity');
    }

    return activity;
  }

  /**
   * No scope restriction — anyone may assign to anyone. Kept in step with
   * getAssigneeOptions on purpose: if this filtered more tightly than the
   * dropdown, the UI would offer people the API then rejects.
   */
  private async assertAssigneesValid(userIds: string[]) {
    const existing = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
        employmentStatus: EmploymentStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (existing.length !== userIds.length) {
      throw new BadRequestException('One or more assignees are invalid or no longer active');
    }
  }

  private assertPending(activity: { status: ActivityStatus }) {
    if (activity.status !== ActivityStatus.PENDING) {
      throw new BadRequestException(
        `This activity is already ${activity.status.toLowerCase()} and can no longer be changed`,
      );
    }
  }

  /**
   * Fans a state change out to the assignees and creator. The actor is skipped — nobody
   * needs a notification about their own click.
   */
  private async notifyAssignees(
    activity: {
      id: string;
      name: string;
      createdById?: string;
      startAt: Date;
      endAt: Date;
      allDay: boolean;
      createdBy: { id?: string; firstName: string | null; lastName: string | null; email: string };
      assignees: { user: { id: string; firstName: string | null; lastName: string | null; email: string } }[];
    },
    actorId: string,
    options: { type: NotificationType; headline: string; intro: string; remarks?: string | null },
  ) {
    const creatorName = this.displayName(activity.createdBy);
    const window = this.formatWindow(activity.startAt, activity.endAt, activity.allDay);
    const creatorUserId = activity.createdById || activity.createdBy.id;
    const allCandidates = [
      ...(creatorUserId && creatorUserId !== actorId ? [{ id: creatorUserId, ...activity.createdBy }] : []),
      ...activity.assignees.map(a => a.user).filter(u => u.id !== actorId && u.id !== creatorUserId),
    ];
    const recipients = Array.from(new Map(allCandidates.map(u => [u.id, u])).values());

    if (recipients.length === 0) {
      this.logger.log(`Activity ${activity.id}: ${options.type} — no other assignees to notify`);
      return;
    }

    const results = await Promise.all(
      recipients.map(async (recipient) => {
        try {
          const emailContent = ACTIVITY_EMAIL_ENABLED
            ? this.emailService.buildActivityEmail({
                recipientName: recipient.firstName || recipient.email,
                headline: options.headline,
                intro: options.intro,
                activityName: activity.name,
                window,
                creatorName,
                remarks: options.remarks,
              })
            : undefined;

          await this.notificationsService.send(
            recipient.id,
            options.type,
            `${options.headline}: ${activity.name}`,
            `${options.intro}\n${window}`,
            { entityType: 'ACTIVITY', entityId: activity.id, link: '/todo' },
            ACTIVITY_EMAIL_ENABLED,
            emailContent,
          );
          return true;
        } catch (error) {
          // A failed notification must not roll back the action the user took —
          // but it must be visible, or a broken mail server looks like a missing
          // feature.
          this.logger.error(
            `Activity ${activity.id}: ${options.type} notification to ${recipient.email} failed — ` +
              `${error instanceof Error ? error.message : String(error)}`,
          );
          return false;
        }
      }),
    );

    const delivered = results.filter(Boolean).length;
    this.logger.log(
      `Activity ${activity.id}: ${options.type} notified ${delivered}/${recipients.length} assignee(s)`,
    );
  }

  // ── Reads ─────────────────────────────────────────────────────────────────

  /**
   * Every colleague available in the New Activity dropdown.
   *
   * Deliberately NOT restricted by the caller's data scope: a personal to-do
   * list is not org-hierarchy work, so anyone may assign an activity to anyone.
   *
   * Filtered on employmentStatus alone, not `isActive`. In this database 87 of
   * 95 employed users carry isActive=false with only one genuine lockout among
   * them, so gating on that flag would hide nearly everybody. Employees who have
   * actually left (INACTIVE / RESIGNED / TERMINATED) are still excluded.
   */
  async getAssigneeOptions(actor: Actor) {
    const users = await this.prisma.user.findMany({
      where: {
        employmentStatus: EmploymentStatus.ACTIVE,
      },
      select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }, { email: 'asc' }],
    });

    return users.map(user => ({
      userId: user.id,
      name: this.displayName(user),
      email: user.email,
      avatarUrl: user.avatarUrl,
      isSelf: user.id === actor.id,
    }));
  }

  /** Activities the actor created — the actionable "My Activities" tab. */
  async findMine(actor: Actor, query: QueryActivitiesDto) {
    return this.paginate({ createdById: actor.id }, query, actor.id);
  }

  /**
   * Activities assigned to the actor by somebody else — view only. Self-assigned
   * items are excluded so they appear under "My Activities" alone.
   */
  async findAssigned(actor: Actor, query: QueryActivitiesDto) {
    return this.paginate(
      {
        assignees: { some: { userId: actor.id } },
        createdById: { not: actor.id },
      },
      query,
      actor.id,
    );
  }

  private async paginate(baseWhere: any, query: QueryActivitiesDto, actorId: string) {
    const { status, search, from, to, page = 1, limit = 6 } = query;
    const skip = (page - 1) * limit;

    const where: any = { ...baseWhere };
    if (status) where.status = status;
    if (search?.trim()) where.name = { contains: search.trim(), mode: 'insensitive' };

    // Overlap, not containment: an activity spanning the filtered day should
    // match even when it started earlier or ends later.
    if (from) {
      const fromDate = dayjs(from);
      if (!fromDate.isValid()) throw new BadRequestException('Invalid from date');
      where.endAt = { gte: fromDate.startOf('day').toDate() };
    }
    if (to) {
      const toDate = dayjs(to);
      if (!toDate.isValid()) throw new BadRequestException('Invalid to date');
      where.startAt = { lte: toDate.endOf('day').toDate() };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.activity.findMany({
        where,
        include: ACTIVITY_INCLUDE,
        // Pending ahead of closed items (enum order is PENDING, COMPLETED,
        // CANCELLED), then most recent first so the latest task leads.
        orderBy: [{ status: 'asc' }, { startAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.activity.count({ where }),
    ]);

    return {
      data: data.map(activity => this.format(activity, actorId)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, actor: Actor) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      include: ACTIVITY_INCLUDE,
    });

    if (!activity) throw new NotFoundException('Activity not found');

    const isCreator = activity.createdById === actor.id;
    const isAssignee = activity.assignees.some(a => a.user.id === actor.id);
    if (!isCreator && !isAssignee) {
      throw new ForbiddenException('You do not have access to this activity');
    }

    return this.format(activity, actor.id);
  }

  private format(activity: any, actorId?: string) {
    return {
      ...activity,
      assignees: activity.assignees.map((a: any) => ({
        userId: a.user.id,
        name: this.displayName(a.user),
        email: a.user.email,
        avatarUrl: a.user.avatarUrl,
      })),
      createdByName: this.displayName(activity.createdBy),
      window: this.formatWindow(activity.startAt, activity.endAt, activity.allDay),
      ...(actorId
        ? {
            canManage: activity.createdById === actorId,
            isCreator: activity.createdById === actorId,
            isAssignee: activity.assignees.some((a: any) => (a.user?.id || a.userId) === actorId),
          }
        : {}),
    };
  }

  // ── Writes ────────────────────────────────────────────────────────────────

  async create(dto: CreateActivityDto, actor: Actor) {
    const { startAt, endAt, allDay } = this.resolveWindow(dto.startAt, dto.endAt, dto.allDay);

    // The creator is NOT force-added: an activity lists exactly the people who
    // were picked, so one you assign to a colleague does not read as also being
    // yours. The "Self Created" tab keys off createdById, so your own work still
    // shows there regardless. Picking nobody falls back to yourself, which keeps
    // a purely personal to-do from having an empty assignee list.
    const picked = Array.from(new Set(dto.assigneeIds ?? []));
    const requested = picked.length > 0 ? picked : [actor.id];

    await this.assertAssigneesValid(requested);

    const created = await this.prisma.activity.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        createdById: actor.id,
        startAt,
        endAt,
        allDay,
        assignees: { create: requested.map(userId => ({ userId })) },
        actions: {
          create: {
            actorId: actor.id,
            type: ActivityActionType.CREATED,
            toStartAt: startAt,
            toEndAt: endAt,
          },
        },
      },
      include: ACTIVITY_INCLUDE,
    });

    void this.notifyAssignees(created, actor.id, {
      type: NotificationType.ACTIVITY_ASSIGNED,
      headline: 'New activity assigned',
      intro: `${this.displayName(created.createdBy)} assigned you an activity.`,
    });

    return this.format(created, actor.id);
  }

  async update(id: string, dto: UpdateActivityDto, actor: Actor) {
    const activity = await this.loadOwnedActivity(id, actor);
    this.assertPending(activity);

    const startAtRaw = dto.startAt ?? activity.startAt.toISOString();
    const endAtRaw = dto.endAt ?? activity.endAt.toISOString();
    const { startAt, endAt, allDay } = this.resolveWindow(
      startAtRaw,
      endAtRaw,
      dto.allDay ?? activity.allDay,
    );

    let assigneeUpdate: object | undefined;
    if (dto.assigneeIds !== undefined) {
      const picked = Array.from(new Set(dto.assigneeIds));
      const requested = picked.length > 0 ? picked : [actor.id];
      await this.assertAssigneesValid(requested);
      // Replace the full assignee set
      assigneeUpdate = {
        deleteMany: {},
        create: requested.map((userId) => ({ userId })),
      };
    }

    const updated = await this.prisma.activity.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        startAt,
        endAt,
        allDay,
        ...(assigneeUpdate ? { assignees: assigneeUpdate } : {}),
      },
      include: ACTIVITY_INCLUDE,
    });

    return this.format(updated, actor.id);
  }

  async postpone(id: string, dto: PostponeActivityDto, actor: Actor) {
    const activity = await this.loadOwnedActivity(id, actor);
    this.assertPending(activity);

    const { startAt, endAt, allDay } = this.resolveWindow(dto.startAt, dto.endAt, dto.allDay ?? activity.allDay);

    if (dayjs(startAt).isSame(activity.startAt) && dayjs(endAt).isSame(activity.endAt)) {
      throw new BadRequestException('Pick a different date or time to postpone this activity');
    }

    const updated = await this.prisma.activity.update({
      where: { id },
      data: {
        startAt,
        endAt,
        allDay,
        postponeCount: { increment: 1 },
        actions: {
          create: {
            actorId: actor.id,
            type: ActivityActionType.POSTPONED,
            fromStartAt: activity.startAt,
            fromEndAt: activity.endAt,
            toStartAt: startAt,
            toEndAt: endAt,
            remarks: dto.remarks?.trim() || null,
          },
        },
      },
      include: ACTIVITY_INCLUDE,
    });

    void this.notifyAssignees(updated, actor.id, {
      type: NotificationType.ACTIVITY_POSTPONED,
      headline: 'Activity postponed',
      intro: `${this.displayName(updated.createdBy)} moved an activity to a new time.`,
      remarks: dto.remarks,
    });

    return this.format(updated, actor.id);
  }

  async complete(id: string, dto: ActivityActionDto, actor: Actor) {
    const activity = await this.loadOwnedActivity(id, actor);
    this.assertPending(activity);

    const updated = await this.prisma.activity.update({
      where: { id },
      data: {
        status: ActivityStatus.COMPLETED,
        completedAt: new Date(),
        actions: {
          create: {
            actorId: actor.id,
            type: ActivityActionType.COMPLETED,
            remarks: dto?.remarks?.trim() || null,
          },
        },
      },
      include: ACTIVITY_INCLUDE,
    });

    const actorUser = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { firstName: true, lastName: true },
    });
    const actorName = this.displayName(actorUser) || 'A team member';

    void this.notifyAssignees(updated, actor.id, {
      type: NotificationType.ACTIVITY_COMPLETED,
      headline: 'Activity completed',
      intro: `${actorName} marked this activity as completed.`,
      remarks: dto?.remarks,
    });

    return this.format(updated, actor.id);
  }

  async cancel(id: string, dto: ActivityActionDto, actor: Actor) {
    const activity = await this.loadOwnedActivity(id, actor);
    this.assertPending(activity);

    const updated = await this.prisma.activity.update({
      where: { id },
      data: {
        status: ActivityStatus.CANCELLED,
        cancelledAt: new Date(),
        actions: {
          create: {
            actorId: actor.id,
            type: ActivityActionType.CANCELLED,
            remarks: dto?.remarks?.trim() || null,
          },
        },
      },
      include: ACTIVITY_INCLUDE,
    });

    const actorUser = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { firstName: true, lastName: true },
    });
    const actorName = this.displayName(actorUser) || 'A team member';

    void this.notifyAssignees(updated, actor.id, {
      type: NotificationType.ACTIVITY_CANCELLED,
      headline: 'Activity cancelled',
      intro: `${actorName} cancelled this activity.`,
      remarks: dto?.remarks,
    });

    return this.format(updated, actor.id);
  }

  async updateStatus(id: string, dto: UpdateActivityStatusDto, actor: Actor) {
    const activity = await this.loadOwnedActivity(id, actor);

    if (activity.status === dto.status) {
      throw new BadRequestException(`Activity is already ${dto.status.toLowerCase()}`);
    }

    const now = new Date();
    const actionType =
      dto.status === ActivityStatus.COMPLETED
        ? ActivityActionType.COMPLETED
        : dto.status === ActivityStatus.CANCELLED
          ? ActivityActionType.CANCELLED
          : ActivityActionType.POSTPONED;

    const updated = await this.prisma.activity.update({
      where: { id },
      data: {
        status: dto.status,
        completedAt: dto.status === ActivityStatus.COMPLETED ? now : null,
        cancelledAt: dto.status === ActivityStatus.CANCELLED ? now : null,
        actions: {
          create: {
            actorId: actor.id,
            type: actionType,
            remarks: dto.remarks?.trim() || null,
          },
        },
      },
      include: ACTIVITY_INCLUDE,
    });

    const actorUser = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { firstName: true, lastName: true },
    });
    const actorName = this.displayName(actorUser) || 'A team member';

    void this.notifyAssignees(updated, actor.id, {
      type:
        dto.status === ActivityStatus.COMPLETED
          ? NotificationType.ACTIVITY_COMPLETED
          : NotificationType.ACTIVITY_CANCELLED,
      headline: `Activity marked as ${dto.status.toLowerCase()}`,
      intro: `${actorName} updated activity status to ${dto.status.toLowerCase()}.`,
      remarks: dto.remarks,
    });

    return this.format(updated, actor.id);
  }

  /**
   * Remarks-only update — open to the creator, an assignee, or an admin, and
   * does not touch status. This is the only write an assignee gets on an
   * activity they didn't create: status changes stay with the creator/admin.
   */
  async addRemark(id: string, dto: AddActivityRemarkDto, actor: Actor) {
    const activity = await this.loadActivityForAction(id, actor);

    const updated = await this.prisma.activity.update({
      where: { id },
      data: {
        actions: {
          create: {
            actorId: actor.id,
            type: ActivityActionType.REMARK_ADDED,
            remarks: dto.remarks.trim(),
          },
        },
      },
      include: ACTIVITY_INCLUDE,
    });

    const actorUser = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { firstName: true, lastName: true },
    });
    const actorName = this.displayName(actorUser) || 'A team member';

    void this.notifyAssignees(updated, actor.id, {
      type: NotificationType.ACTIVITY_REMARK_ADDED,
      headline: 'New remark added',
      intro: `${actorName} added a remark on this activity.`,
      remarks: dto.remarks,
    });

    return this.format(updated, actor.id);
  }

  // ── Recurring series ──────────────────────────────────────────────────────

  private toRule(series: {
    frequency: RecurrenceFrequency;
    interval: number;
    byWeekday: number[];
    byMonthDay: number | null;
    byMonthDays?: number[];
    seriesStartAt: Date;
    durationMin: number;
    allDay: boolean;
    seriesEndDate: Date | null;
    maxOccurrences: number | null;
    skipNonWorkingDays: boolean;
  }): RecurrenceRule {
    return {
      frequency: series.frequency,
      interval: series.interval,
      byWeekday: series.byWeekday,
      byMonthDay: series.byMonthDay,
      byMonthDays: (series.byMonthDays && series.byMonthDays.length > 0)
        ? series.byMonthDays
        : (series.byMonthDay ? [series.byMonthDay] : []),
      seriesStartAt: series.seriesStartAt,
      durationMin: series.durationMin,
      allDay: series.allDay,
      seriesEndDate: series.seriesEndDate,
      maxOccurrences: series.maxOccurrences,
      skipNonWorkingDays: series.skipNonWorkingDays,
    };
  }

  /**
   * `yyyy-MM-dd` keys of the non-optional public holidays in a window.
   *
   * Optional holidays are deliberately included as working days, matching how
   * attendance decides what counts as a working day — an optional holiday is not
   * a day off for everyone.
   */
  private async loadHolidayDates(from: Date, to: Date): Promise<Set<string>> {
    const holidays = await this.prisma.publicHoliday.findMany({
      where: {
        isOptional: false,
        date: { gte: dayjs(from).startOf('day').toDate(), lte: dayjs(to).endOf('day').toDate() },
      },
      select: { date: true },
    });

    return new Set(holidays.map(holiday => dayjs(holiday.date).format('YYYY-MM-DD')));
  }

  private horizon(from: Date = new Date()) {
    return dayjs(from).add(GENERATION_HORIZON_DAYS, 'day').endOf('day').toDate();
  }

  /**
   * Frequency-specific validation. class-validator can only check each field on
   * its own, so the combinations live here.
   */
  private resolveRuleInput(dto: CreateRecurringActivityDto, startAt: Date, endAt: Date) {
    const interval = dto.interval ?? 1;
    const byWeekday = normaliseWeekdays(dto.byWeekday);

    if (dto.frequency === RecurrenceFrequency.WEEKLY && (dto.byWeekday?.length ?? 0) > 0
        && byWeekday.length === 0) {
      throw new BadRequestException('Weekdays must be between 0 (Sunday) and 6 (Saturday)');
    }

    // durationMin is what carries the window onto every later occurrence, so an
    // end before the start would silently generate inverted windows forever.
    const durationMin = dayjs(endAt).diff(dayjs(startAt), 'minute');
    if (durationMin < 0) {
      throw new BadRequestException('endAt must be the same as or after startAt');
    }

    let seriesEndDate: Date | null = null;
    if (dto.seriesEndDate) {
      const parsed = dayjs(dto.seriesEndDate);
      if (!parsed.isValid()) throw new BadRequestException('Invalid seriesEndDate');
      seriesEndDate = parsed.endOf('day').toDate();

      if (parsed.endOf('day').isBefore(dayjs(startAt))) {
        throw new BadRequestException('The repeat-until date cannot be before the first occurrence');
      }
    }

    const byMonthDays = (dto.byMonthDays && dto.byMonthDays.length > 0)
      ? Array.from(new Set(dto.byMonthDays.filter((d) => d >= 1 && d <= 31))).sort((a, b) => a - b)
      : dto.byMonthDay
        ? [dto.byMonthDay]
        : [dayjs(startAt).date()];

    return {
      frequency: dto.frequency,
      interval,
      // Only the frequency that uses a field gets it stored — keeping the unused
      // one blank means the series list can never render a contradictory rule.
      byWeekday: dto.frequency === RecurrenceFrequency.WEEKLY ? byWeekday : [],
      byMonthDay: dto.frequency === RecurrenceFrequency.MONTHLY
        ? (byMonthDays[0] ?? dayjs(startAt).date())
        : null,
      byMonthDays: dto.frequency === RecurrenceFrequency.MONTHLY
        ? byMonthDays
        : [],
      durationMin,
      seriesEndDate,
      maxOccurrences: dto.maxOccurrences ?? null,
      skipNonWorkingDays: dto.skipNonWorkingDays ?? false,
    };
  }

  /**
   * Creates the rule and materialises its first horizon of occurrences.
   *
   * Assignees are notified once about the series rather than once per generated
   * occurrence — a daily series would otherwise land ninety emails on somebody.
   */
  async createRecurring(dto: CreateRecurringActivityDto, actor: Actor) {
    const { startAt, endAt, allDay } = this.resolveWindow(dto.startAt, dto.endAt, dto.allDay);
    const rule = this.resolveRuleInput(dto, startAt, endAt);

    const picked = Array.from(new Set(dto.assigneeIds ?? []));
    const requested = picked.length > 0 ? picked : [actor.id];
    await this.assertAssigneesValid(requested);

    const series = await this.prisma.activityRecurrence.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        createdById: actor.id,
        seriesStartAt: startAt,
        allDay,
        ...rule,
        assignees: { create: requested.map(userId => ({ userId })) },
      },
      include: RECURRENCE_INCLUDE,
    });

    const generated = await this.generateOccurrences(series.id, this.horizon());

    if (generated === 0) {
      // A rule that produces nothing is always a mistake in the input, and
      // leaving the empty series behind would just confuse the list.
      await this.prisma.activityRecurrence.delete({ where: { id: series.id } });
      throw new BadRequestException(
        rule.skipNonWorkingDays
          ? 'This repeat setting produces no activities — every matching date falls on a weekend or holiday. '
            + 'Change the repeat days or turn off “Skip weekends & public holidays”.'
          : 'This repeat setting produces no activities — check the start date and the repeat-until date',
      );
    }

    void this.notifySeriesAssignees(series, actor.id, {
      type: NotificationType.ACTIVITY_SERIES_ASSIGNED,
      headline: 'New recurring activity assigned',
      intro: `${this.displayName(series.createdBy)} assigned you a repeating activity.`,
    });

    this.logger.log(`Recurrence ${series.id}: created with ${generated} occurrence(s)`);

    return this.findSeriesById(series.id, actor);
  }

  /**
   * Materialises every occurrence between the series watermark and `until`.
   *
   * Safe to re-run: occurrences already stored are filtered out first, and the
   * `(recurrenceId, occurrenceDate)` unique index rolls the whole transaction
   * back if a concurrent pass races it — the next run simply picks it up.
   */
  async generateOccurrences(seriesId: string, until: Date): Promise<number> {
    const series = await this.prisma.activityRecurrence.findUnique({
      where: { id: seriesId },
      include: { assignees: { select: { userId: true } } },
    });

    if (!series || series.status !== RecurrenceStatus.ACTIVE) return 0;

    const rule = this.toRule(series);

    // Only paid for when the rule actually skips. The window starts at the
    // watermark, since everything before it is already materialised.
    const holidayDates = rule.skipNonWorkingDays
      ? await this.loadHolidayDates(series.generatedUntil ?? series.seriesStartAt, until)
      : undefined;

    const occurrences = expandOccurrences(rule, {
      until,
      after: series.generatedUntil,
      alreadyGenerated: series.occurrenceCount,
      holidayDates,
    });

    if (occurrences.length === 0) {
      await this.prisma.activityRecurrence.update({
        where: { id: series.id },
        data: {
          generatedUntil: until,
          ...(isFullyGenerated(rule, until, series.occurrenceCount)
            ? { status: RecurrenceStatus.COMPLETED }
            : {}),
        },
      });
      return 0;
    }

    // createMany cannot write nested relations, so ids are minted up front and
    // the three tables are filled with one bulk insert each.
    const existing = await this.prisma.activity.findMany({
      where: {
        recurrenceId: series.id,
        occurrenceDate: { in: occurrences.map(o => o.occurrenceDate) },
      },
      select: { occurrenceDate: true },
    });
    const alreadyStored = new Set(existing.map(row => row.occurrenceDate!.getTime()));
    const fresh = occurrences.filter(o => !alreadyStored.has(o.occurrenceDate.getTime()));

    const assigneeIds = series.assignees.length > 0
      ? series.assignees.map(a => a.userId)
      : [series.createdById];

    const rows = fresh.map(occurrence => ({ id: randomUUID(), occurrence }));
    const totalGenerated = series.occurrenceCount + rows.length;

    await this.prisma.$transaction([
      this.prisma.activity.createMany({
        data: rows.map(({ id, occurrence }) => ({
          id,
          name: series.name,
          description: series.description,
          createdById: series.createdById,
          startAt: occurrence.startAt,
          endAt: occurrence.endAt,
          allDay: series.allDay,
          recurrenceId: series.id,
          occurrenceDate: occurrence.occurrenceDate,
        })),
      }),
      this.prisma.activityAssignee.createMany({
        data: rows.flatMap(({ id }) =>
          assigneeIds.map(userId => ({ activityId: id, userId })),
        ),
      }),
      this.prisma.activityAction.createMany({
        data: rows.map(({ id, occurrence }) => ({
          activityId: id,
          actorId: series.createdById,
          type: ActivityActionType.CREATED,
          toStartAt: occurrence.startAt,
          toEndAt: occurrence.endAt,
        })),
      }),
      this.prisma.activityRecurrence.update({
        where: { id: series.id },
        data: {
          generatedUntil: until,
          occurrenceCount: totalGenerated,
          ...(isFullyGenerated(rule, until, totalGenerated)
            ? { status: RecurrenceStatus.COMPLETED }
            : {}),
        },
      }),
    ]);

    return rows.length;
  }

  /** One notification per assignee about the series as a whole. */
  private async notifySeriesAssignees(
    series: {
      id: string;
      name: string;
      createdBy: { firstName: string | null; lastName: string | null; email: string };
      assignees: { user: { id: string; firstName: string | null; email: string } }[];
    },
    actorId: string,
    options: { type: NotificationType; headline: string; intro: string; remarks?: string | null },
    summary?: string,
  ) {
    const creatorName = this.displayName(series.createdBy);
    const recipients = series.assignees.map(a => a.user).filter(user => user.id !== actorId);

    if (recipients.length === 0) {
      this.logger.log(`Recurrence ${series.id}: ${options.type} — no other assignees to notify`);
      return;
    }

    const window = summary ?? '';

    await Promise.all(
      recipients.map(async (recipient) => {
        try {
          const emailContent = ACTIVITY_EMAIL_ENABLED
            ? this.emailService.buildActivityEmail({
                recipientName: recipient.firstName || recipient.email,
                headline: options.headline,
                intro: options.intro,
                activityName: series.name,
                window,
                creatorName,
                remarks: options.remarks,
              })
            : undefined;

          await this.notificationsService.send(
            recipient.id,
            options.type,
            `${options.headline}: ${series.name}`,
            `${options.intro}\n${window}`,
            {
              entityType: 'ACTIVITY_RECURRENCE',
              entityId: series.id,
              link: '/todo',
            },
            ACTIVITY_EMAIL_ENABLED,
            emailContent,
          );
        } catch (error) {
          // Same rule as the per-activity path: a broken mail server must not
          // roll back the user's action, but it must be visible in the logs.
          this.logger.error(
            `Recurrence ${series.id}: ${options.type} notification to ${recipient.email} failed — ` +
              `${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }),
    );
  }

  private formatSeries(
    series: any,
    stats?: { pending: number; completed: number; nextOccurrenceAt: Date | null },
    actorId?: string,
  ) {
    return {
      ...series,
      assignees: series.assignees.map((a: any) => ({
        userId: a.user.id,
        name: this.displayName(a.user),
        email: a.user.email,
        avatarUrl: a.user.avatarUrl,
      })),
      createdByName: this.displayName(series.createdBy),
      summary: describeRecurrence(this.toRule(series)),
      pendingCount: stats?.pending ?? 0,
      completedCount: stats?.completed ?? 0,
      nextOccurrenceAt: stats?.nextOccurrenceAt ?? null,
      ...(actorId ? { canManage: series.createdById === actorId } : {}),
    };
  }

  /** Per-series pending / completed counts and next due date, in two grouped queries. */
  private async seriesStats(seriesIds: string[]) {
    if (seriesIds.length === 0) return new Map<string, { pending: number; completed: number; nextOccurrenceAt: Date | null }>();

    const [byStatus, nextUp] = await Promise.all([
      this.prisma.activity.groupBy({
        by: ['recurrenceId', 'status'] as const,
        where: { recurrenceId: { in: seriesIds } },
        _count: { _all: true },
      }),
      this.prisma.activity.groupBy({
        by: ['recurrenceId'] as const,
        where: {
          recurrenceId: { in: seriesIds },
          status: ActivityStatus.PENDING,
          startAt: { gte: new Date() },
        },
        _min: { startAt: true },
      }),
    ]);

    const stats = new Map(
      seriesIds.map(id => [id, { pending: 0, completed: 0, nextOccurrenceAt: null as Date | null }]),
    );

    for (const row of byStatus) {
      const entry = stats.get(row.recurrenceId!);
      if (!entry) continue;
      if (row.status === ActivityStatus.PENDING) entry.pending = row._count._all;
      if (row.status === ActivityStatus.COMPLETED) entry.completed = row._count._all;
    }

    for (const row of nextUp) {
      const entry = stats.get(row.recurrenceId!);
      if (entry) entry.nextOccurrenceAt = row._min?.startAt ?? null;
    }

    return stats;
  }

  /** Recurring series the actor created — the only person who can manage one. */
  async findSeries(actor: Actor, query: QueryRecurrencesDto) {
    const { search, page = 1, limit = 6 } = query;
    const skip = (page - 1) * limit;

    const where: any = { createdById: actor.id };
    if (search?.trim()) where.name = { contains: search.trim(), mode: 'insensitive' };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.activityRecurrence.findMany({
        where,
        include: RECURRENCE_INCLUDE,
        // Active series first, newest first within each group.
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.activityRecurrence.count({ where }),
    ]);

    const stats = await this.seriesStats(data.map(series => series.id));

    return {
      data: data.map(series => this.formatSeries(series, stats.get(series.id), actor.id)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findSeriesById(id: string, actor: Actor) {
    const series = await this.prisma.activityRecurrence.findUnique({
      where: { id },
      include: RECURRENCE_INCLUDE,
    });

    if (!series) throw new NotFoundException('Recurring activity not found');

    const isCreator = series.createdById === actor.id;
    const isAssignee = series.assignees.some(a => a.user.id === actor.id);
    if (!isCreator && !isAssignee) {
      throw new ForbiddenException('You do not have access to this recurring activity');
    }

    const stats = await this.seriesStats([series.id]);
    return this.formatSeries(series, stats.get(series.id), actor.id);
  }

  /**
   * Stops the series and cancels every occurrence still ahead of it. Occurrences
   * already past — or already completed — are left exactly as they are: they are
   * history, not a schedule.
   */
  async cancelSeries(id: string, dto: ActivityActionDto, actor: Actor) {
    const series = await this.prisma.activityRecurrence.findUnique({
      where: { id },
      include: RECURRENCE_INCLUDE,
    });

    if (!series) throw new NotFoundException('Recurring activity not found');
    if (series.createdById !== actor.id) {
      throw new ForbiddenException('Only the creator of a recurring activity can cancel it');
    }
    if (series.status === RecurrenceStatus.CANCELLED) {
      throw new BadRequestException('This recurring activity is already cancelled');
    }

    const now = new Date();
    const upcoming = await this.prisma.activity.findMany({
      where: {
        recurrenceId: series.id,
        status: ActivityStatus.PENDING,
        startAt: { gte: now },
      },
      select: { id: true },
    });

    const remarks = dto?.remarks?.trim() || null;

    await this.prisma.$transaction([
      this.prisma.activity.updateMany({
        where: { id: { in: upcoming.map(a => a.id) } },
        data: { status: ActivityStatus.CANCELLED, cancelledAt: now },
      }),
      this.prisma.activityAction.createMany({
        data: upcoming.map(activity => ({
          activityId: activity.id,
          actorId: actor.id,
          type: ActivityActionType.SERIES_CANCELLED,
          remarks,
        })),
      }),
      this.prisma.activityRecurrence.update({
        where: { id: series.id },
        data: { status: RecurrenceStatus.CANCELLED, cancelledAt: now },
      }),
    ]);

    const summary = describeRecurrence(this.toRule(series));

    void this.notifySeriesAssignees(
      series,
      actor.id,
      {
        type: NotificationType.ACTIVITY_SERIES_CANCELLED,
        headline: 'Recurring activity cancelled',
        intro:
          `${this.displayName(series.createdBy)} cancelled a repeating activity. ` +
          `${upcoming.length} upcoming occurrence(s) were cancelled.`,
        remarks,
      },
      summary,
    );

    this.logger.log(
      `Recurrence ${series.id}: cancelled by ${actor.id}, ${upcoming.length} upcoming occurrence(s) cancelled`,
    );

    return this.findSeriesById(series.id, actor);
  }

  /**
   * Extends every active series to the rolling horizon. Driven by the nightly
   * cron; returns the totals so the caller can log them.
   */
  async extendAllHorizons() {
    const until = this.horizon();
    const due = await this.prisma.activityRecurrence.findMany({
      where: {
        status: RecurrenceStatus.ACTIVE,
        OR: [{ generatedUntil: null }, { generatedUntil: { lt: until } }],
      },
      select: { id: true },
    });

    let generated = 0;
    for (const series of due) {
      try {
        generated += await this.generateOccurrences(series.id, until);
      } catch (error) {
        // One bad series must not stop the rest of the sweep.
        this.logger.error(
          `Recurrence ${series.id}: horizon extension failed — ` +
            `${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return { seriesScanned: due.length, occurrencesCreated: generated };
  }
}
