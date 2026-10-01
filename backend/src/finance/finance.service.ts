import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NumberSeriesService } from '../admin-config/number-series.service';

@Injectable()
export class FinanceService {
  constructor(
    private prisma: PrismaService,
    private seriesService: NumberSeriesService,
  ) {}

  // ── Client PO ────────────────────────────────────────────────────────────

  findAllClientPOs(projectId?: string) {
    return this.prisma.clientPO.findMany({
      where: projectId ? { projectId } : {},
      include: {
        project: { select: { id: true, name: true, type: true } },
        milestones: {
          select: { id: true, name: true, amount: true, status: true, completion: true, dueDate: true },
        },
        invoices: {
          select: { id: true, total: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneClientPO(id: string) {
    const po = await this.prisma.clientPO.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        milestones: { include: { invoices: true } },
        invoices: { include: { payments: true } },
      },
    });
    if (!po) throw new NotFoundException(`Client PO "${id}" not found`);
    return po;
  }

  async updateClientPO(id: string, data: { amount?: number; placeOfSupply?: string; status?: string }) {
    await this.findOneClientPO(id);
    return this.prisma.clientPO.update({ where: { id }, data });
  }

  async removeClientPO(id: string) {
    const po = await this.findOneClientPO(id);
    if (po.invoices.length > 0) {
      throw new BadRequestException('Cannot delete a Client PO that has invoices');
    }
    return this.prisma.clientPO.delete({ where: { id } });
  }

  // ── Invoice ───────────────────────────────────────────────────────────────

  findAllInvoices(clientPoId?: string, status?: string, projectId?: string) {
    return this.prisma.invoice.findMany({
      where: {
        ...(clientPoId ? { clientPoId } : {}),
        ...(status ? { status } : {}),
        ...(projectId ? {
          OR: [
            { clientPo: { projectId } },
            { projectId },
          ],
        } : {}),
      },
      include: {
        clientPo: {
          include: {
            project: { select: { id: true, name: true, type: true } },
          },
        },
        milestone: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        payments: true,
        tmBillingRun: { select: { id: true, periodStart: true, periodEnd: true, totalHours: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneInvoice(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        clientPo: { include: { project: { select: { id: true, name: true } } } },
        milestone: true,
        project: { select: { id: true, name: true } },
        payments: true,
        tmBillingRun: true,
      },
    });
    if (!invoice) throw new NotFoundException(`Invoice "${id}" not found`);
    return invoice;
  }

  async voidInvoice(id: string) {
    const invoice = await this.findOneInvoice(id);
    if (invoice.status === 'PAID') {
      throw new BadRequestException('Cannot void a paid invoice');
    }
    return this.prisma.$transaction(async (tx) => {
      if (invoice.milestoneId) {
        await tx.milestone.update({
          where: { id: invoice.milestoneId },
          data: { status: 'PENDING' },
        });
      }
      if (invoice.tmBillingRun) {
        await tx.tmBillingRun.update({
          where: { id: invoice.tmBillingRun.id },
          data: { status: 'DRAFT', invoiceId: null },
        });
      }
      return tx.invoice.update({ where: { id }, data: { status: 'VOID' } });
    });
  }

  // ── Payments ──────────────────────────────────────────────────────────────

  findAllPayments(invoiceId?: string) {
    return this.prisma.payment.findMany({
      where: invoiceId ? { invoiceId } : {},
      include: { invoice: { select: { id: true, invoiceNo: true } } },
      orderBy: { paymentDate: 'desc' },
    });
  }

  async createClientPO(projectId: string, amount: number, poNumber: string) {
    return this.prisma.clientPO.create({
      data: { projectId, amount, poNumber },
    });
  }

  async createMilestone(projectId: string, amount: number, name: string, clientPoId?: string) {
    if (clientPoId) {
      const po = await this.prisma.clientPO.findUnique({
        where: { id: clientPoId },
        include: { milestones: true },
      });

      if (!po) throw new NotFoundException('Client PO not found');

      const currentMilestoneTotal = po.milestones.reduce((sum, m) => sum + m.amount, 0);
      if (currentMilestoneTotal + amount > po.amount) {
        throw new BadRequestException(`Milestone total exceeds Client PO budget ($${po.amount})`);
      }
    }

    return this.prisma.milestone.create({
      data: { projectId, amount, name, clientPoId },
    });
  }

  findAllMilestones(projectId?: string, clientPoId?: string) {
    return this.prisma.milestone.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(clientPoId ? { clientPoId } : {}),
      },
      include: {
        project: { select: { id: true, name: true } },
        clientPo: { select: { id: true, poNumber: true } },
        invoices: { select: { id: true, total: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async generateInvoice(milestoneId: string, billingAmount: number) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        invoices: true,
        clientPo: { include: { invoices: true } },
        project: true,
      },
    });

    if (!milestone) throw new NotFoundException('Milestone not found');
    if (!milestone.clientPoId) throw new BadRequestException('Milestone is not linked to a Client PO');

    const currentMilestoneInvoiced = milestone.invoices.reduce((sum, inv) => sum + inv.subTotal, 0);
    if (currentMilestoneInvoiced + billingAmount > milestone.amount) {
      throw new BadRequestException(`Invoice amount exceeds remaining milestone balance ($${milestone.amount - currentMilestoneInvoiced})`);
    }

    const { cgst, sgst, igst, taxTotal } = this.calculateGst(billingAmount, milestone.clientPo?.placeOfSupply ?? null);
    const total = billingAmount + taxTotal;

    const newMilestoneStatus = (currentMilestoneInvoiced + billingAmount >= milestone.amount)
      ? 'FULLY_INVOICED'
      : 'PARTIAL';

    return this.prisma.$transaction(async (tx) => {
      await tx.milestone.update({
        where: { id: milestoneId },
        data: { status: newMilestoneStatus },
      });

      return tx.invoice.create({
        data: {
          milestoneId,
          clientPoId: milestone.clientPoId as string,
          invoiceNo: await this.seriesService.generateCode('INVOICE'),
          invoiceType: 'MILESTONE',
          subTotal: billingAmount,
          cgst,
          sgst,
          igst,
          tax: taxTotal,
          total,
          status: 'DRAFT',
        },
      });
    });
  }

  // ── T&M Invoice Generation ────────────────────────────────────────────────

  async generateTmInvoice(
    projectId: string,
    periodStart: Date,
    periodEnd: Date,
    generatedById: string,
  ) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.billingModel !== 'TM') {
      throw new BadRequestException('Project billing model is not T&M');
    }

    // Fetch approved employee entries in period
    const employeeEntries = await this.prisma.timesheetEntry.findMany({
      where: {
        projectId,
        date: { gte: periodStart, lte: periodEnd },
        timesheet: { status: 'PM_APPROVED', userId: { not: null } },
      },
      include: { timesheet: { include: { user: true } } },
    });

    // Fetch approved freelancer entries in period
    const freelancerEntries = await this.prisma.timesheetEntry.findMany({
      where: {
        projectId,
        date: { gte: periodStart, lte: periodEnd },
        timesheet: { status: 'PM_APPROVED', freelancerId: { not: null } },
      },
      include: { timesheet: { include: { freelancer: true } } },
    });

    const linesByResource = new Map<string, { resourceName: string; hours: number; rate: number; amount: number }>();
    const addLine = (key: string, resourceName: string, hours: number, rate: number) => {
      const line = linesByResource.get(key) ?? { resourceName, hours: 0, rate, amount: 0 };
      line.hours += hours;
      line.amount += hours * rate;
      linesByResource.set(key, line);
    };

    for (const entry of employeeEntries) {
      const user = entry.timesheet.user;
      if (!user) continue;
      addLine(
        `employee:${user.id}`,
        `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
        entry.hours,
        user.billingRatePerHour,
      );
    }

    for (const entry of freelancerEntries) {
      const freelancer = entry.timesheet.freelancer;
      if (!freelancer) continue;
      addLine(
        `freelancer:${freelancer.id}`,
        freelancer.fullName,
        entry.hours,
        freelancer.billingRate,
      );
    }

    const lines = Array.from(linesByResource.values());
    const subTotal = lines.reduce((s, l) => s + l.amount, 0);
    if (subTotal === 0) {
      throw new BadRequestException('No approved timesheet hours found for the given period');
    }

    const totalHours = lines.reduce((s, l) => s + l.hours, 0);

    // Determine GST from first PO if available
    const firstPo = await this.prisma.clientPO.findFirst({ where: { projectId } });
    const { cgst, sgst, igst, taxTotal } = this.calculateGst(subTotal, firstPo?.placeOfSupply ?? null);
    const total = subTotal + taxTotal;

    return this.prisma.$transaction(async (tx) => {
      const run = await tx.tmBillingRun.create({
        data: {
          projectId,
          periodStart,
          periodEnd,
          totalHours,
          totalAmount: subTotal,
          status: 'DRAFT',
          generatedById,
        },
      });

      const invoice = await tx.invoice.create({
        data: {
          invoiceNo: await this.seriesService.generateCode('INVOICE'),
          invoiceType: 'TM',
          projectId,
          subTotal,
          cgst,
          sgst,
          igst,
          tax: taxTotal,
          total,
          status: 'DRAFT',
          metadata: lines,
        },
      });

      await tx.tmBillingRun.update({
        where: { id: run.id },
        data: { invoiceId: invoice.id, status: 'INVOICED' },
      });

      return { run, invoice };
    });
  }

  // ── Retainer Invoice Generation ───────────────────────────────────────────

  async generateRetainerInvoice(projectId: string, month: number, year: number) {
    const config = await this.prisma.retainerConfig.findUnique({ where: { projectId } });
    if (!config) throw new NotFoundException('Retainer config not found for project');
    if (!config.isActive) throw new BadRequestException('Retainer config is inactive');

    const subTotal = config.monthlyAmount;

    const firstPo = await this.prisma.clientPO.findFirst({ where: { projectId } });
    const { cgst, sgst, igst, taxTotal } = this.calculateGst(subTotal, firstPo?.placeOfSupply ?? null);
    const total = subTotal + taxTotal;

    // Due date = billing day of next month
    const dueDate = new Date(year, month, config.billingDay); // month is 0-indexed; month param is 1-indexed, so month = next month index

    return this.prisma.invoice.create({
      data: {
        invoiceNo: await this.seriesService.generateCode('INVOICE'),
        invoiceType: 'RETAINER',
        projectId,
        subTotal,
        cgst,
        sgst,
        igst,
        tax: taxTotal,
        total,
        status: 'DRAFT',
        metadata: { month, year, monthlyAmount: config.monthlyAmount, dueDate },
      },
    });
  }

  // ── Retainer Config ───────────────────────────────────────────────────────

  async upsertRetainerConfig(
    projectId: string,
    data: { monthlyAmount: number; billingDay?: number; currency?: string; isActive?: boolean },
  ) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.retainerConfig.upsert({
      where: { projectId },
      create: { projectId, ...data },
      update: data,
    });
  }

  async getRetainerConfig(projectId: string) {
    return this.prisma.retainerConfig.findUnique({ where: { projectId } });
  }

  // ── Project Expenses ──────────────────────────────────────────────────────

  async createProjectExpense(data: {
    projectId: string;
    description: string;
    amount: number;
    category: string;
    expenseDate: Date;
    vendorId?: string;
    invoiceRef?: string;
    addedById: string;
  }) {
    const project = await this.prisma.project.findUnique({ where: { id: data.projectId } });
    if (!project) throw new NotFoundException('Project not found');
    return this.prisma.projectExpense.create({ data });
  }

  findProjectExpenses(projectId?: string) {
    return this.prisma.projectExpense.findMany({
      where: projectId ? { projectId } : {},
      include: {
        project: { select: { id: true, name: true } },
        vendor: { select: { id: true, vendorName: true } },
        addedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { expenseDate: 'desc' },
    });
  }

  // ── Project Margin Calculation ────────────────────────────────────────────

  async calculateProjectMargin(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        clientPOs: { include: { invoices: { include: { payments: true } } } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');

    // Employee cost
    const employeeEntries = await this.prisma.timesheetEntry.findMany({
      where: { projectId, timesheet: { status: 'PM_APPROVED', userId: { not: null } } },
      include: { timesheet: { include: { user: true } } },
    });
    const employeeCost = employeeEntries.reduce((sum, entry) => {
      const rate = entry.timesheet.user?.baseCostPerHour ?? 0;
      return sum + entry.hours * rate;
    }, 0);

    // Freelancer cost
    const freelancerEntries = await this.prisma.timesheetEntry.findMany({
      where: { projectId, timesheet: { status: 'PM_APPROVED', freelancerId: { not: null } } },
      include: { timesheet: { include: { freelancer: true } } },
    });
    const freelancerCost = freelancerEntries.reduce((sum, entry) => {
      const rate = entry.timesheet.freelancer?.costPerHour ?? 0;
      return sum + entry.hours * rate;
    }, 0);

    // Overhead / expenses
    const expenseRows = await this.prisma.projectExpense.findMany({
      where: { projectId },
      select: { amount: true },
    });
    const expenses = expenseRows.reduce((s, e) => s + e.amount, 0);

    const totalCost = employeeCost + freelancerCost + expenses;

    // Revenue: use project.revenue if set, else sum PAID invoice totals
    let revenue = project.revenue ?? 0;
    if (!revenue) {
      revenue = project.clientPOs.reduce(
        (sum, po) =>
          sum +
          po.invoices
            .filter((inv) => inv.status === 'PAID')
            .reduce((s, inv) => s + inv.total, 0),
        0,
      );

      // Also include direct (TM/Retainer) invoices
      const directPaidInvoices = await this.prisma.invoice.findMany({
        where: { projectId, status: 'PAID' },
        select: { total: true },
      });
      revenue += directPaidInvoices.reduce((s, inv) => s + inv.total, 0);
    }

    const margin = revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : 0;

    return { totalCost, employeeCost, freelancerCost, expenses, revenue, margin };
  }

  // ── Cost Breakdown for a Project ──────────────────────────────────────────

  async getProjectCostBreakdown(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { budgetCost: true, revenue: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const margin = await this.calculateProjectMargin(projectId);

    const budgetCost = project.budgetCost ?? 0;
    const variancePct = budgetCost > 0 ? ((margin.totalCost - budgetCost) / budgetCost) * 100 : 0;

    return {
      employeeCost: margin.employeeCost,
      freelancerCost: margin.freelancerCost,
      expenses: margin.expenses,
      totalCost: margin.totalCost,
      budgetCost,
      variancePct,
      revenue: margin.revenue,
      margin: margin.margin,
    };
  }

  // ── Margin Summary (all projects) ─────────────────────────────────────────

  async getMarginSummary() {
    const projects = await this.prisma.project.findMany({
      where: { status: { in: ['ACTIVE', 'CLOSED'] } },
      select: { id: true, name: true },
    });

    const results = await Promise.all(
      projects.map(async (p) => {
        try {
          const m = await this.calculateProjectMargin(p.id);
          return { projectId: p.id, projectName: p.name, ...m };
        } catch {
          return { projectId: p.id, projectName: p.name, totalCost: 0, employeeCost: 0, freelancerCost: 0, expenses: 0, revenue: 0, margin: 0 };
        }
      }),
    );

    return results;
  }

  // ── Retainer Auto-Billing Cron ────────────────────────────────────────────

  @Cron('0 7 * * *')
  async retainerAutoBilling() {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const month = today.getMonth() + 1; // 1-indexed
    const year = today.getFullYear();

    const configs = await this.prisma.retainerConfig.findMany({
      where: { isActive: true, billingDay: dayOfMonth },
    });

    for (const config of configs) {
      try {
        await this.generateRetainerInvoice(config.projectId, month, year);
      } catch (err) {
        // Log and continue; don't let one failure block others
        console.error(`Retainer auto-billing failed for project ${config.projectId}:`, err);
      }
    }
  }

  // ── Existing Analytics ────────────────────────────────────────────────────

  async calculateProjectProfitability(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        clientPOs: { include: { invoices: true } },
      },
    });

    if (!project) throw new NotFoundException('Project not found');

    const totalRevenue = project.clientPOs.reduce((sum, po) =>
      sum + po.invoices.reduce((invSum, inv) => invSum + inv.subTotal, 0), 0,
    );

    const entries = await this.prisma.timesheetEntry.findMany({
      where: { projectId, timesheet: { status: 'PM_APPROVED' } },
      include: { timesheet: { include: { user: true } } },
    });

    const totalCost = entries.reduce((sum, entry) => {
      const userRate = entry.timesheet.user?.baseCostPerHour || 0;
      return sum + entry.hours * userRate;
    }, 0);

    return {
      totalRevenue,
      totalCost,
      grossProfit: totalRevenue - totalCost,
      profitMargin: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0,
    };
  }

  async recordPayment(invoiceId: string, amount: number, method: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
    if (totalPaid + amount > invoice.total) {
      throw new BadRequestException(`Payment exceeds invoice total. Remaining: $${invoice.total - totalPaid}`);
    }

    const newStatus = totalPaid + amount >= invoice.total ? 'PAID' : 'PARTIAL';

    return this.prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: { invoiceId, amount, method, status: 'SUCCESS', paymentDate: new Date() },
      });

      return tx.invoice.update({
        where: { id: invoiceId },
        data: { status: newStatus },
      });
    });
  }

  async approveInvoice(invoiceId: string, role: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const updateData: any = {};
    if (role === 'FINANCE_MANAGER') updateData.financeApproved = true;
    if (role === 'CFO') updateData.cfoApproved = true;

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
    });
  }

  async sendInvoice(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const HIGH_VALUE_THRESHOLD = 10000;

    if (!invoice.financeApproved) {
      throw new BadRequestException('Invoice must be approved by Finance before sending');
    }

    if (invoice.total > HIGH_VALUE_THRESHOLD && !invoice.cfoApproved) {
      throw new BadRequestException(`High-value invoice (>$${HIGH_VALUE_THRESHOLD}) requires CFO approval`);
    }

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'SENT' },
    });
  }

  async getDashboardSummary() {
    const [clientPOs, invoices, payments] = await Promise.all([
      this.prisma.clientPO.findMany({ select: { amount: true } }),
      this.prisma.invoice.findMany({
        select: { id: true, subTotal: true, status: true, createdAt: true, invoiceNo: true, total: true, invoiceType: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.findMany({
        select: { id: true, amount: true, createdAt: true, paymentDate: true, invoice: { select: { invoiceNo: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalPOAmount = clientPOs.reduce((sum, po) => sum + po.amount, 0);
    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.subTotal, 0);
    const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);
    const outstandingAmount = totalInvoiced - totalReceived;

    const totalPendingApproval = invoices
      .filter((inv) => inv.status === 'DRAFT')
      .reduce((sum, inv) => sum + inv.subTotal, 0);

    const statusBreakdown = invoices.reduce((acc, inv) => {
      acc[inv.status] = (acc[inv.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Monthly trends for last 6 months
    const now = new Date();
    const monthlyTrends = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleString('default', { month: 'short', year: '2-digit' });

      const monthInvoiced = invoices
        .filter(
          (inv) =>
            inv.createdAt.getMonth() === d.getMonth() &&
            inv.createdAt.getFullYear() === d.getFullYear(),
        )
        .reduce((sum, inv) => sum + inv.subTotal, 0);

      const monthReceived = payments
        .filter(
          (p) =>
            p.paymentDate.getMonth() === d.getMonth() &&
            p.paymentDate.getFullYear() === d.getFullYear(),
        )
        .reduce((sum, p) => sum + p.amount, 0);

      return { month: monthLabel, invoiced: monthInvoiced, received: monthReceived };
    }).reverse();

    // Invoice type breakdown
    const typeBreakdown = invoices.reduce((acc, inv) => {
      const t = (inv as any).invoiceType ?? 'MILESTONE';
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      metrics: {
        totalPOAmount,
        totalInvoiced,
        totalReceived,
        outstandingAmount,
        totalPendingApproval,
      },
      statusBreakdown,
      typeBreakdown,
      monthlyTrends,
      recentInvoices: invoices.slice(0, 5),
      recentPayments: payments.slice(0, 5),
    };
  }

  // ── Private Helpers ───────────────────────────────────────────────────────

  private calculateGst(subTotal: number, placeOfSupply: string | null) {
    const COMPANY_STATE = 'Maharashtra';
    const isInterState = placeOfSupply !== COMPANY_STATE;
    const taxRate = 0.18;
    const taxTotal = subTotal * taxRate;

    let cgst = 0, sgst = 0, igst = 0;
    if (isInterState) {
      igst = taxTotal;
    } else {
      cgst = taxTotal / 2;
      sgst = taxTotal / 2;
    }

    return { cgst, sgst, igst, taxTotal };
  }
}
