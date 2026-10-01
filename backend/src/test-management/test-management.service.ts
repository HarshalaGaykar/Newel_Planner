import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionResult, TestRunStatus } from '@prisma/client';
import { CreateSuiteDto } from './dto/create-suite.dto';
import { UpdateSuiteDto } from './dto/update-suite.dto';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { CreateRunDto } from './dto/create-run.dto';
import { UpdateRunDto } from './dto/update-run.dto';
import { UpdateExecutionDto } from './dto/update-execution.dto';
import { AddCasesToRunDto } from './dto/add-cases-to-run.dto';
import { SuiteQueryDto, CaseQueryDto, RunQueryDto } from './dto/query.dto';

@Injectable()
export class TestManagementService {
  constructor(private prisma: PrismaService) {}

  // ── SUITES ──────────────────────────────────────────────────────────────────

  findAllSuites(query: SuiteQueryDto) {
    const where: any = {};
    if (query.projectId) where.projectId = query.projectId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.testSuite.findMany({
      where,
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { cases: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneSuite(id: string) {
    const suite = await this.prisma.testSuite.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        cases: {
          include: {
            assignedTo: { select: { id: true, firstName: true, lastName: true } },
            _count: { select: { executions: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!suite) throw new NotFoundException('Test suite not found');
    return suite;
  }

  createSuite(dto: CreateSuiteDto, userId: string) {
    return this.prisma.testSuite.create({
      data: { ...dto, createdById: userId },
    });
  }

  async updateSuite(id: string, dto: UpdateSuiteDto) {
    await this.findOneSuite(id);
    return this.prisma.testSuite.update({ where: { id }, data: dto });
  }

  async removeSuite(id: string) {
    await this.findOneSuite(id);
    return this.prisma.testSuite.delete({ where: { id } });
  }

  // ── CASES ────────────────────────────────────────────────────────────────────

  findAllCases(query: CaseQueryDto) {
    const where: any = {};
    if (query.suiteId) where.suiteId = query.suiteId;
    if (query.priority) where.priority = query.priority;
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.category) where.category = query.category;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.testCase.findMany({
      where,
      include: {
        suite: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneCase(id: string) {
    const testCase = await this.prisma.testCase.findUnique({
      where: { id },
      include: {
        suite: { select: { id: true, name: true, projectId: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        executions: {
          include: {
            run: { select: { id: true, name: true } },
            executedBy: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!testCase) throw new NotFoundException('Test case not found');
    return testCase;
  }

  createCase(dto: CreateCaseDto, userId: string) {
    return this.prisma.testCase.create({
      data: { ...dto, createdById: userId },
    });
  }

  async updateCase(id: string, dto: UpdateCaseDto) {
    await this.findOneCase(id);
    return this.prisma.testCase.update({ where: { id }, data: dto });
  }

  async removeCase(id: string) {
    await this.findOneCase(id);
    return this.prisma.testCase.delete({ where: { id } });
  }

  // ── RUNS ─────────────────────────────────────────────────────────────────────

  findAllRuns(query: RunQueryDto) {
    const where: any = {};
    if (query.projectId) where.projectId = query.projectId;
    if (query.sprintId) where.sprintId = query.sprintId;
    if (query.status) where.status = query.status;
    return this.prisma.testRun.findMany({
      where,
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        sprint: { select: { id: true, name: true } },
        _count: { select: { executions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneRun(id: string) {
    const run = await this.prisma.testRun.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        sprint: { select: { id: true, name: true } },
        executions: {
          include: {
            case: true,
            executedBy: { select: { id: true, firstName: true, lastName: true } },
            defectTicket: { select: { id: true, title: true, status: true } },
          },
          orderBy: { case: { title: 'asc' } },
        },
      },
    });
    if (!run) throw new NotFoundException('Test run not found');
    return run;
  }

  async createRun(dto: CreateRunDto, userId: string) {
    const { caseIds, plannedAt, ...runData } = dto;
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.testRun.create({
        data: {
          ...runData,
          ...(plannedAt ? { plannedAt: new Date(plannedAt) } : {}),
          createdById: userId,
        },
      });
      if (caseIds?.length) {
        await tx.testExecution.createMany({
          data: caseIds.map((caseId) => ({
            runId: run.id,
            caseId,
            result: ExecutionResult.NOT_RUN,
          })),
        });
      }
      return tx.testRun.findUnique({
        where: { id: run.id },
        include: { _count: { select: { executions: true } } },
      });
    });
  }

  async updateRun(id: string, dto: UpdateRunDto) {
    const run = await this.findOneRun(id);
    const data: any = { ...dto };
    if (dto.status === TestRunStatus.IN_PROGRESS && !run.startedAt) {
      data.startedAt = new Date();
    }
    if (
      (dto.status === TestRunStatus.COMPLETED || dto.status === TestRunStatus.ABORTED) &&
      !run.completedAt
    ) {
      data.completedAt = new Date();
    }
    return this.prisma.testRun.update({ where: { id }, data });
  }

  async removeRun(id: string) {
    await this.findOneRun(id);
    return this.prisma.testRun.delete({ where: { id } });
  }

  async addCasesToRun(runId: string, dto: AddCasesToRunDto) {
    await this.findOneRun(runId);
    const existing = await this.prisma.testExecution.findMany({
      where: { runId, caseId: { in: dto.caseIds } },
      select: { caseId: true },
    });
    const existingIds = new Set(existing.map((e) => e.caseId));
    const newCaseIds = dto.caseIds.filter((id) => !existingIds.has(id));
    if (!newCaseIds.length) return { added: 0 };
    await this.prisma.testExecution.createMany({
      data: newCaseIds.map((caseId) => ({
        runId,
        caseId,
        result: ExecutionResult.NOT_RUN,
      })),
    });
    return { added: newCaseIds.length };
  }

  // ── EXECUTIONS ───────────────────────────────────────────────────────────────

  async updateExecution(id: string, dto: UpdateExecutionDto, userId: string) {
    const execution = await this.prisma.testExecution.findUnique({
      where: { id },
      select: { caseId: true, runId: true },
    });
    if (!execution) throw new NotFoundException('Test execution not found');

    // Validate defectTicketId FK before entering transaction
    const { defectTicketId, ...restDto } = dto;
    if (defectTicketId) {
      const ticket = await this.prisma.ticket.findUnique({ where: { id: defectTicketId }, select: { id: true } });
      if (!ticket) throw new NotFoundException(`Ticket with id '${defectTicketId}' not found. Cannot link defect.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.testExecution.update({
        where: { id },
        data: {
          ...restDto,
          ...(defectTicketId !== undefined ? { defectTicketId } : {}),
          executedById: userId,
          executedAt: new Date(),
        },
        include: {
          case: { include: { suite: true } },
          executedBy: { select: { id: true, firstName: true, lastName: true } },
          defectTicket: { select: { id: true, title: true, status: true } },
        },
      });

      // Clear retestRequired if a new result is posted
      if (dto.result && dto.result !== ExecutionResult.NOT_RUN) {
        await tx.testExecution.update({
          where: { id },
          data: { retestRequired: false },
        });
      }

      // Denormalize to test case for monitoring
      await tx.testCase.update({
        where: { id: execution.caseId },
        data: {
          lastResult: dto.result,
          lastActualResult: dto.actualResult,
          lastExecutedAt: new Date(),
        },
      });

      // Automated Run Status transition: PLANNED -> IN_PROGRESS
      const run = await tx.testRun.findUnique({
        where: { id: execution.runId },
        select: { status: true, startedAt: true },
      });

      if (run && run.status === TestRunStatus.PLANNED) {
        await tx.testRun.update({
          where: { id: execution.runId },
          data: {
            status: TestRunStatus.IN_PROGRESS,
            startedAt: run.startedAt || new Date(),
          },
        });
      }

      return updated;
    });
  }

  async getRunSummary(runId: string) {
    await this.findOneRun(runId);
    const grouped = await this.prisma.testExecution.groupBy({
      by: ['result'],
      where: { runId },
      _count: { result: true },
    });
    const summary: Record<string, number> = Object.fromEntries(
      Object.values(ExecutionResult).map((r) => [r, 0]),
    );
    for (const row of grouped) {
      summary[row.result] = row._count.result;
    }
    return summary;
  }

  async createBugFromExecution(executionId: string, userId: string) {
    const execution = await this.prisma.testExecution.findUnique({
      where: { id: executionId },
      include: {
        case: true,
        run: true,
      },
    });

    if (!execution) throw new NotFoundException('Execution not found');
    if (execution.defectTicketId) return { ticketId: execution.defectTicketId };

    const stepsStr = Array.isArray(execution.case.steps)
      ? execution.case.steps
          .map((s: any, i: number) => `${i + 1}. ${s.step || s}`)
          .join('\n')
      : '';

    const description = `
**Test Case:** ${execution.case.title}
**Preconditions:** ${execution.case.preconditions || 'N/A'}

**Steps to Reproduce:**
${stepsStr}

**Expected Result:**
${execution.case.expectedResult || 'N/A'}

**Actual Result:**
${execution.actualResult || 'N/A'}

**Execution Notes:**
${execution.notes || 'N/A'}

**Environment:** ${execution.run.environment}
**Test Run:** ${execution.run.name}
    `.trim();

    return this.prisma.$transaction(async (tx) => {
      // Create the ticket
      const ticket = await tx.ticket.create({
        data: {
          title: `Bug: ${execution.case.title}`,
          description,
          priority: execution.case.priority === 'CRITICAL' ? 'CRITICAL'
            : execution.case.priority === 'HIGH' ? 'HIGH'
            : 'MEDIUM',
          type: 'BUG',
          projectId: execution.run.projectId,
          // Assignee could be the case creator or run creator, or left null
        },
      });

      // Link execution to ticket
      await tx.testExecution.update({
        where: { id: executionId },
        data: { defectTicketId: ticket.id },
      });

      // Find the TL allocated to this project to create a Task (mimic TicketsService logic)
      const tlAllocation = await tx.allocation.findFirst({
        where: {
          projectId: execution.run.projectId,
          user: { role: { name: 'TL' } },
        },
      });

      await tx.task.create({
        data: {
          title: `Fix: ${ticket.title}`,
          description: `Auto-created from test failure.\n\n${description}`,
          status: 'TODO',
          priority: ticket.priority,
          projectId: execution.run.projectId,
          assigneeId: tlAllocation?.userId ?? null,
          ticketId: ticket.id,
          taskType: 'OBSERVATION',
          complexity: 3,
        },
      });

      return ticket;
    });
  }
}
