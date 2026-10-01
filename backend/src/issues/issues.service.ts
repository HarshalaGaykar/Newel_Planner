import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { IssueSeverity, IssueStatus, NotificationType } from '@prisma/client';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';

const ISSUE_INCLUDE = {
  owner:   { select: { id: true, firstName: true, lastName: true } },
  raisedBy: { select: { id: true, firstName: true, lastName: true } },
  task: { select: { id: true, title: true, status: true } },
  ticket: { select: { id: true, title: true, status: true } },
} as const;

@Injectable()
export class IssuesService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateIssueDto, currentUserId: string) {
    const { eta, projectId, severity, status, ...rest } = dto;
    return this.prisma.issue.create({
      data: {
        ...rest,
        projectId,
        severity: severity as IssueSeverity,
        status: status as IssueStatus,
        raisedById: dto.raisedById || currentUserId,
        ...(eta ? { eta: new Date(eta) } : {}),
      },
      include: ISSUE_INCLUDE,
    });
  }

  findAll(projectId?: string, status?: string) {
    return this.prisma.issue.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: ISSUE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id },
      include: {
        ...ISSUE_INCLUDE,
        project: { select: { id: true, name: true, pmId: true } },
      },
    });
    if (!issue) throw new NotFoundException(`Issue ${id} not found`);
    return issue;
  }

  async update(id: string, dto: UpdateIssueDto) {
    await this.findOne(id);
    const { eta, projectId, severity, status, ...rest } = dto;
    const data: any = { 
      ...rest,
      ...(severity ? { severity: severity as IssueSeverity } : {}),
      ...(status ? { status: status as IssueStatus } : {}),
    };
    if (eta !== undefined) data.eta = eta ? new Date(eta) : null;
    if (status === 'RESOLVED' && !data.resolvedAt) data.resolvedAt = new Date();
    return this.prisma.issue.update({
      where: { id },
      data,
      include: ISSUE_INCLUDE,
    });
  }

  async escalate(id: string) {
    const issue = await this.findOne(id);
    const updated = await this.prisma.issue.update({
      where: { id },
      data: { status: 'ESCALATED' as any, escalatedAt: new Date() },
      include: ISSUE_INCLUDE,
    });

    const meta = { issueId: id, projectId: issue.projectId };

    if (issue.project?.pmId) {
      await this.notificationsService.send(
        issue.project.pmId,
        NotificationType.ISSUE_ESCALATED,
        'Issue Escalated',
        `Issue "${issue.title}" has been escalated and requires your immediate attention.`,
        meta,
      );
    }

    await this.notificationsService.sendToRole(
      'PMO',
      NotificationType.ISSUE_ESCALATED,
      'Issue Escalated',
      `Issue "${issue.title}" in project "${issue.project?.name}" has been escalated.`,
      meta,
    );

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.issue.delete({ where: { id } });
  }
}
