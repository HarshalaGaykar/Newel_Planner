import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectType } from '@prisma/client';

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  async create(createTicketDto: CreateTicketDto, user: { id: string; role: string }) {
    if (!['ADMIN', 'PM', 'TL'].includes(user.role)) {
      throw new ForbiddenException('Only PMs, TLs, and Admins can create tickets');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: createTicketDto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${createTicketDto.projectId} not found`);
    }

    /* 
    if (project.type !== ProjectType.MAINTENANCE) {
      throw new BadRequestException('Tickets can only be created for MAINTENANCE projects');
    }
    */

    // Multiple assignees (drawn from project allocations). Primary assigneeId is
    // kept in sync with the first entry unless one was passed explicitly.
    const { assigneeIds, ...ticketData } = createTicketDto;
    const uniqueAssigneeIds = assigneeIds ? [...new Set(assigneeIds)] : undefined;
    if (uniqueAssigneeIds?.length) {
      await this.validateAssigneesAllocated(createTicketDto.projectId, uniqueAssigneeIds);
    }
    const primaryAssigneeId = ticketData.assigneeId ?? uniqueAssigneeIds?.[0];

    // Create the ticket
    const ticket = await this.prisma.ticket.create({
      data: {
        ...ticketData,
        assigneeId: primaryAssigneeId,
        ...(uniqueAssigneeIds?.length
          ? { ticketAssignees: { create: uniqueAssigneeIds.map((userId) => ({ userId })) } }
          : {}),
      },
      include: { project: true },
    });

    // Find the TL allocated to this project
    const tlAllocation = await this.prisma.allocation.findFirst({
      where: {
        projectId: createTicketDto.projectId,
        user: { role: { name: 'TL' } },
      },
      include: { user: true },
    });

    // Auto-create a linked Task assigned to the TL
    await this.prisma.task.create({
      data: {
        title: `Fix: ${createTicketDto.title}`,
        description: createTicketDto.description
          ? `Auto-created from ticket.\n\n${createTicketDto.description}`
          : 'Auto-created from ticket.',
        status: 'BACKLOG',
        priority: createTicketDto.priority === 'CRITICAL' ? 'CRITICAL'
          : createTicketDto.priority === 'HIGH' ? 'HIGH'
          : createTicketDto.priority === 'LOW' ? 'LOW'
          : 'MEDIUM',
        projectId: createTicketDto.projectId,
        assigneeId: tlAllocation?.userId ?? null,
        ticketId: ticket.id,
        taskType: 'OBSERVATION',
        complexity: 3,
      },
    });

    return ticket;
  }

  // Ensure each user is an allocated resource on the project before assigning.
  private async validateAssigneesAllocated(projectId: string, userIds: string[]) {
    if (!userIds.length) return;
    const allocations = await this.prisma.allocation.findMany({
      where: { projectId, userId: { in: userIds } },
      select: { userId: true },
    });
    const allocated = new Set(allocations.map((a) => a.userId));
    const missing = userIds.filter((uid) => !allocated.has(uid));
    if (missing.length) {
      throw new BadRequestException(
        `User(s) not allocated to this project cannot be assigned: ${missing.join(', ')}`,
      );
    }
  }

  findAll(user: { id: string; role: string }, projectId?: string) {
    const where: any = {
      projectId: projectId || undefined,
    };

    // If not ADMIN, PM, or TL, only show tickets assigned to user (primary or additional).
    if (user.role !== 'ADMIN' && user.role !== 'PM' && user.role !== 'TL') {
      where.OR = [
        { assigneeId: user.id },
        { ticketAssignees: { some: { userId: user.id } } },
      ];
    }

    return this.prisma.ticket.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
        ticketAssignees: { select: { user: { select: { id: true, firstName: true, lastName: true } } } },
        tasks: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        project: true,
        assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
        ticketAssignees: { select: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        tasks: {
          include: {
            assignee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }

    return ticket;
  }

  async update(id: string, updateTicketDto: UpdateTicketDto) {
    const ticket = await this.findOne(id);

    const { assigneeIds, ...ticketData } = updateTicketDto as { assigneeIds?: string[] } & Record<string, any>;

    // Replace the assignee set when assigneeIds is provided; keep primary in sync.
    if (assigneeIds !== undefined) {
      const uniqueAssigneeIds = [...new Set(assigneeIds)];
      await this.validateAssigneesAllocated(ticket.projectId, uniqueAssigneeIds);
      await this.prisma.ticketAssignee.deleteMany({ where: { ticketId: id } });
      if (uniqueAssigneeIds.length > 0) {
        await this.prisma.ticketAssignee.createMany({
          data: uniqueAssigneeIds.map((userId) => ({ ticketId: id, userId })),
        });
      }
      if (ticketData.assigneeId === undefined) {
        ticketData.assigneeId = uniqueAssigneeIds[0] ?? null;
      }
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: ticketData,
    });

    // Regression Trigger: If a BUG is closed/resolved, flag related test executions for re-testing
    if (
      ticket.type === 'BUG' &&
      (updated.status === 'CLOSED' || updated.status === 'RESOLVED' || updated.status === 'FIXED') &&
      ticket.status !== updated.status
    ) {
      await this.prisma.testExecution.updateMany({
        where: { defectTicketId: id },
        data: { retestRequired: true },
      });
    }

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.ticket.delete({
      where: { id },
    });
  }
}
