import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeliveryItemDto } from './dto/create-delivery-item.dto';
import { UpdateDeliveryItemDto } from './dto/update-delivery-item.dto';
import { CreateRemarkDto } from './dto/create-remark.dto';

const FIELD_LABELS: Record<string, string> = {
  srNo:         'Sr No',
  title:        'Title',
  plannedStart: 'Planned Start Date',
  plannedEnd:   'Planned End Date',
  actualStart:  'Actual Start Date',
  actualEnd:    'Actual End Date',
  stageId:      'Current Stage',
  status:       'Status',
};

@Injectable()
export class DeliveryTrackerService {
  constructor(private prisma: PrismaService) {}

  private includeAll() {
    return {
      remarks: { orderBy: { date: 'asc' as const } },
      history: { orderBy: { changedAt: 'asc' as const } },
      stage: { select: { id: true, name: true } },
    };
  }

  async findAll(projectId: string) {
    return this.prisma.deliveryItem.findMany({
      where: { projectId },
      include: this.includeAll(),
      orderBy: { srNo: 'asc' },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.deliveryItem.findUnique({
      where: { id },
      include: this.includeAll(),
    });
    if (!item) throw new NotFoundException(`Delivery item ${id} not found`);
    return item;
  }

  async create(projectId: string, dto: CreateDeliveryItemDto, userId: string) {
    const { remarks, ...rest } = dto;
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.deliveryItem.create({
        data: {
          projectId,
          srNo:         rest.srNo,
          title:        rest.title,
          plannedStart: rest.plannedStart ? new Date(rest.plannedStart) : null,
          plannedEnd:   rest.plannedEnd   ? new Date(rest.plannedEnd)   : null,
          actualStart:  rest.actualStart  ? new Date(rest.actualStart)  : null,
          actualEnd:    rest.actualEnd    ? new Date(rest.actualEnd)    : null,
          stageId:      rest.stageId ?? null,
          status:       rest.status       ?? 'OPEN',
        },
      });
      if (remarks?.trim()) {
        await tx.deliveryItemRemark.create({
          data: { deliveryItemId: item.id, date: new Date(), content: remarks.trim(), createdBy: userId },
        });
      }
      return tx.deliveryItem.findUnique({ where: { id: item.id }, include: this.includeAll() });
    });
  }

  async update(id: string, dto: UpdateDeliveryItemDto, userId: string) {
    const existing = await this.findOne(id);

    // Build field-level diff for history
    const historyRecords: { field: string; oldValue: string | null; newValue: string | null }[] = [];

    const fmt = (v: Date | string | number | null | undefined): string | null => {
      if (v === null || v === undefined) return null;
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return String(v);
    };

    const track = (
      field: keyof typeof FIELD_LABELS,
      oldRaw: Date | string | number | null | undefined,
      newRaw: Date | string | number | null | undefined,
    ) => {
      const oldVal = fmt(oldRaw);
      const newVal = fmt(newRaw);
      if (newRaw !== undefined && newVal !== oldVal) {
        historyRecords.push({ field: FIELD_LABELS[field], oldValue: oldVal, newValue: newVal });
      }
    };

    track('srNo',         existing.srNo,         dto.srNo);
    track('title',        existing.title,         dto.title);
    track('plannedStart', existing.plannedStart, dto.plannedStart ? new Date(dto.plannedStart) : undefined);
    track('plannedEnd',   existing.plannedEnd,   dto.plannedEnd   ? new Date(dto.plannedEnd)   : undefined);
    track('actualStart',  existing.actualStart,  dto.actualStart  ? new Date(dto.actualStart)  : undefined);
    track('actualEnd',    existing.actualEnd,    dto.actualEnd    ? new Date(dto.actualEnd)    : undefined);
    // History stores stage NAMES, not ids — an id in the audit trail is unreadable
    // and would break if the master row were ever renamed.
    track('stageId', existing.stage?.name ?? null, await this.resolveStageName(dto.stageId));
    track('status',       existing.status,        dto.status);

    const [updated] = await this.prisma.$transaction([
      this.prisma.deliveryItem.update({
        where: { id },
        data: {
          ...(dto.srNo         !== undefined && { srNo: dto.srNo }),
          ...(dto.title        !== undefined && { title: dto.title }),
          ...(dto.plannedStart !== undefined && { plannedStart: new Date(dto.plannedStart) }),
          ...(dto.plannedEnd   !== undefined && { plannedEnd: new Date(dto.plannedEnd) }),
          ...(dto.actualStart  !== undefined && { actualStart: new Date(dto.actualStart) }),
          ...(dto.actualEnd    !== undefined && { actualEnd: new Date(dto.actualEnd) }),
          ...(dto.stageId !== undefined && { stageId: dto.stageId || null }),
          ...(dto.status       !== undefined && { status: dto.status }),
        },
      }),
      ...historyRecords.map(h =>
        this.prisma.deliveryItemHistory.create({
          data: { deliveryItemId: id, changedBy: userId, ...h },
        }),
      ),
    ]);

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.deliveryItem.delete({ where: { id } });
  }

  async addRemark(deliveryItemId: string, dto: CreateRemarkDto, userId: string) {
    await this.findOne(deliveryItemId);
    return this.prisma.deliveryItemRemark.create({
      data: { deliveryItemId, date: new Date(dto.date), content: dto.content, createdBy: userId },
    });
  }

  async getRemarks(deliveryItemId: string) {
    return this.prisma.deliveryItemRemark.findMany({
      where: { deliveryItemId },
      orderBy: { date: 'asc' },
    });
  }

  /**
   * Stage name for an id, for the history trail. `undefined` in means "field not
   * being changed" and must stay undefined so track() skips it; an empty string
   * means the stage is being cleared.
   */
  private async resolveStageName(stageId: string | undefined) {
    if (stageId === undefined) return undefined;
    if (!stageId) return null;
    const stage = await this.prisma.deliveryStageMaster.findUnique({
      where: { id: stageId },
      select: { name: true },
    });
    if (!stage) throw new NotFoundException(`Delivery stage "${stageId}" not found`);
    return stage.name;
  }

  async getHistory(deliveryItemId: string) {
    return this.prisma.deliveryItemHistory.findMany({
      where: { deliveryItemId },
      orderBy: { changedAt: 'desc' },
    });
  }

  private mapExportRow(item: Awaited<ReturnType<typeof this.findAll>>[number]) {
    // Collect old date values in chronological order for strike-through display
    const oldEndDates = item.history
      .filter(h => h.field === 'Planned End Date' && h.oldValue)
      .sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime())
      .map(h => new Date(h.oldValue!).toLocaleDateString('en-GB'));

    const oldActualEndDates = item.history
      .filter(h => h.field === 'Actual End Date' && h.oldValue)
      .sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime())
      .map(h => new Date(h.oldValue!).toLocaleDateString('en-GB'));

    return {
      srNo:               item.srNo,
      id:                 item.id,
      title:              item.title,
      startDate:          item.plannedStart ?? null,
      endDate:            item.plannedEnd   ?? null,
      actualStartDate:    item.actualStart  ?? null,
      actualEndDate:      item.actualEnd    ?? null,
      currentStage:       item.stage?.name ?? '',
      status:             item.status,
      remarks:            item.remarks.map(r => ({
        date:    r.date.toLocaleDateString('en-GB'),
        content: r.content,
      })),
      endDateHistory:       oldEndDates,
      actualEndDateHistory: oldActualEndDates,
    };
  }

  async getExportRows(projectId: string) {
    const items = await this.findAll(projectId);
    return items.map(item => this.mapExportRow(item));
  }

  /** Saved report header for a project, or nulls when it has never been edited. */
  async getReportSettings(projectId: string) {
    const saved = await this.prisma.deliveryReportSettings.findUnique({
      where: { projectId },
      include: { updatedBy: { select: { firstName: true, lastName: true, email: true } } },
    });
    return {
      reportDate: saved?.reportDate ?? null,
      preparedBy: saved?.preparedBy ?? null,
      statusSummary: saved?.statusSummary ?? null,
      updatedAt: saved?.updatedAt ?? null,
      updatedBy: saved?.updatedBy
        ? [saved.updatedBy.firstName, saved.updatedBy.lastName].filter(Boolean).join(' ') || saved.updatedBy.email
        : null,
    };
  }

  async saveReportSettings(
    projectId: string,
    dto: { reportDate?: string | null; preparedBy?: string | null; statusSummary?: string | null },
    userId: string,
  ) {
    const data = {
      reportDate: dto.reportDate ? new Date(dto.reportDate) : null,
      preparedBy: dto.preparedBy?.trim() || null,
      statusSummary: dto.statusSummary?.trim() || null,
      updatedById: userId,
    };
    await this.prisma.deliveryReportSettings.upsert({
      where: { projectId },
      create: { projectId, ...data },
      update: data,
    });
    return this.getReportSettings(projectId);
  }

  async recordReportSend(entry: {
    projectId: string;
    sentById: string;
    preparedBy: string;
    reportDate: Date;
    recipients: string[];
    cc: string[];
    subject: string;
    itemCount: number;
    status: 'SUCCESS' | 'FAILED';
    messageId?: string | null;
    error?: string | null;
  }) {
    return this.prisma.deliveryReportSend.create({ data: entry });
  }

  async getReportHistory(projectId: string) {
    const sends = await this.prisma.deliveryReportSend.findMany({
      where: { projectId },
      orderBy: { sentAt: 'desc' },
      take: 100,
      include: {
        sentBy: { select: { firstName: true, lastName: true, email: true } },
        project: { select: { name: true } },
      },
    });
    return sends.map(s => ({
      id: s.id,
      projectName: s.project.name,
      sentBy: [s.sentBy.firstName, s.sentBy.lastName].filter(Boolean).join(' ') || s.sentBy.email,
      sentByEmail: s.sentBy.email,
      preparedBy: s.preparedBy,
      reportDate: s.reportDate,
      recipients: s.recipients,
      cc: s.cc,
      subject: s.subject,
      itemCount: s.itemCount,
      status: s.status,
      error: s.error,
      sentAt: s.sentAt,
    }));
  }

  async getExportData(projectId: string, userId: string) {
    const [project, preparer, items, settings] = await Promise.all([
      this.prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } }),
      this.findAll(projectId),
      this.getReportSettings(projectId),
    ]);

    // Roll up every remark across all items into a chronological status summary,
    // most recent first — mirrors the dated-bullet "Status Summary" style.
    const statusSummary = items
      .flatMap(item => item.remarks.map(r => ({ date: r.date, text: `${r.date.toLocaleDateString('en-GB')}: ${r.content}` })))
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map(r => r.text)
      .join('\n\n');

    const currentUserName = preparer
      ? [preparer.firstName, preparer.lastName].filter(Boolean).join(' ') || preparer.email
      : '';

    // Saved values win; otherwise fall back to today / the current user / the
    // auto-generated rollup, so a project that has never been edited still
    // produces a sensible report.
    return {
      projectName:   project?.name ?? '',
      preparedBy:    settings.preparedBy ?? currentUserName,
      reportDate:    settings.reportDate ?? new Date(),
      statusSummary: settings.statusSummary ?? statusSummary,
      rows: items.map(item => this.mapExportRow(item)),
    };
  }
}
