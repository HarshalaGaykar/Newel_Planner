import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/rbac.decorator';
import { Permission } from '../auth/constants/rbac.constants';
import { FinanceService } from './finance.service';

@ApiTags('Finance')
@ApiBearerAuth()
@Controller({ path: 'finance', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // ── Client POs ────────────────────────────────────────────────────────────

  @Get('client-pos')
  @Permissions(Permission.FINANCIAL_PO_VIEW)
  @ApiOperation({ summary: 'Get all client purchase orders, optionally filtered by project' })
  findAllClientPOs(@Query('projectId') projectId?: string) {
    return this.financeService.findAllClientPOs(projectId);
  }

  @Get('client-po/:id')
  @Permissions(Permission.FINANCIAL_PO_VIEW)
  @ApiOperation({ summary: 'Get a single client purchase order by ID' })
  findOneClientPO(@Param('id') id: string) {
    return this.financeService.findOneClientPO(id);
  }

  @Post('client-po')
  @Permissions(Permission.FINANCIAL_PO_CREATE)
  @ApiOperation({ summary: 'Create a new client purchase order for a project' })
  createClientPO(@Body() body: { projectId: string; amount: number; poNumber: string; placeOfSupply?: string }) {
    return this.financeService.createClientPO(body.projectId, body.amount, body.poNumber);
  }

  @Patch('client-po/:id')
  @Permissions(Permission.FINANCIAL_PO_CREATE)
  @ApiOperation({ summary: 'Update an existing client purchase order by ID' })
  updateClientPO(
    @Param('id') id: string,
    @Body() body: { amount?: number; placeOfSupply?: string; status?: string },
  ) {
    return this.financeService.updateClientPO(id, body);
  }

  @Delete('client-po/:id')
  @Permissions(Permission.FINANCIAL_PO_CREATE)
  @ApiOperation({ summary: 'Delete a client purchase order by ID' })
  removeClientPO(@Param('id') id: string) {
    return this.financeService.removeClientPO(id);
  }

  // ── Milestones ───────────────────────────────────────────────────────────

  @Post('milestone')
  @Permissions(Permission.FINANCIAL_MILESTONE_CREATE)
  @ApiOperation({ summary: 'Create a new billing milestone for a project' })
  createMilestone(
    @Body() body: { projectId: string; amount: number; name: string; clientPoId?: string },
  ) {
    return this.financeService.createMilestone(body.projectId, body.amount, body.name, body.clientPoId);
  }

  @Get('milestones')
  @Permissions(Permission.FINANCIAL_MILESTONE_VIEW)
  @ApiOperation({ summary: 'Get all milestones, optionally filtered by project or client PO' })
  findAllMilestones(@Query('projectId') projectId?: string, @Query('clientPoId') clientPoId?: string) {
    return this.financeService.findAllMilestones(projectId, clientPoId);
  }

  // ── Invoices ──────────────────────────────────────────────────────────────

  @Get('invoices')
  @Permissions(Permission.FINANCIAL_INVOICE_VIEW)
  @ApiOperation({ summary: 'Get all invoices with optional client PO, status, and project filters' })
  findAllInvoices(
    @Query('clientPoId') clientPoId?: string,
    @Query('status') status?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.financeService.findAllInvoices(clientPoId, status, projectId);
  }

  @Get('invoices/:id')
  @Permissions(Permission.FINANCIAL_INVOICE_VIEW)
  @ApiOperation({ summary: 'Get a single invoice by ID' })
  findOneInvoice(@Param('id') id: string) {
    return this.financeService.findOneInvoice(id);
  }

  @Post('invoice/:milestoneId')
  @Permissions(Permission.FINANCIAL_INVOICE_CREATE)
  @ApiOperation({ summary: 'Generate an invoice for a given milestone' })
  generateInvoice(@Param('milestoneId') milestoneId: string, @Body('amount') amount: number) {
    return this.financeService.generateInvoice(milestoneId, amount);
  }

  @Patch('invoice/:id/approve')
  @Permissions(Permission.FINANCIAL_INVOICE_CREATE) // CFO/Finance role specific logic inside service
  @ApiOperation({ summary: 'Approve an invoice by ID based on the approver role' })
  approveInvoice(@Param('id') id: string, @Body('role') role: string) {
    return this.financeService.approveInvoice(id, role);
  }

  @Patch('invoice/:id/send')
  @Permissions(Permission.FINANCIAL_INVOICE_CREATE)
  @ApiOperation({ summary: 'Send an approved invoice to the client by ID' })
  sendInvoice(@Param('id') id: string) {
    return this.financeService.sendInvoice(id);
  }

  @Patch('invoice/:id/void')
  @Permissions(Permission.FINANCIAL_INVOICE_CREATE)
  @ApiOperation({ summary: 'Void an invoice by ID' })
  voidInvoice(@Param('id') id: string) {
    return this.financeService.voidInvoice(id);
  }

  // ── T&M Invoice ───────────────────────────────────────────────────────────

  @Post('projects/:id/tm-invoice')
  @Permissions(Permission.FINANCIAL_INVOICE_CREATE)
  @ApiOperation({ summary: 'Generate a time-and-materials invoice for a project over a billing period' })
  generateTmInvoice(
    @Param('id') projectId: string,
    @Body() body: { periodStart: string; periodEnd: string; generatedById: string },
  ) {
    return this.financeService.generateTmInvoice(
      projectId,
      new Date(body.periodStart),
      new Date(body.periodEnd),
      body.generatedById,
    );
  }

  // ── Retainer Invoice ──────────────────────────────────────────────────────

  @Post('projects/:id/retainer-invoice')
  @Permissions(Permission.FINANCIAL_INVOICE_CREATE)
  @ApiOperation({ summary: 'Generate a retainer invoice for a project for a given month and year' })
  generateRetainerInvoice(
    @Param('id') projectId: string,
    @Body() body: { month: number; year: number },
  ) {
    return this.financeService.generateRetainerInvoice(projectId, body.month, body.year);
  }

  // ── Retainer Config ───────────────────────────────────────────────────────

  @Get('projects/:id/retainer-config')
  @Permissions(Permission.FINANCIAL_INVOICE_VIEW)
  @ApiOperation({ summary: 'Get the retainer billing configuration for a project' })
  getRetainerConfig(@Param('id') projectId: string) {
    return this.financeService.getRetainerConfig(projectId);
  }

  @Post('projects/:id/retainer-config')
  @Permissions(Permission.FINANCIAL_INVOICE_CREATE)
  @ApiOperation({ summary: 'Create or update the retainer billing configuration for a project' })
  upsertRetainerConfig(
    @Param('id') projectId: string,
    @Body() body: { monthlyAmount: number; billingDay?: number; currency?: string; isActive?: boolean },
  ) {
    return this.financeService.upsertRetainerConfig(projectId, body);
  }

  // ── Project Margin ────────────────────────────────────────────────────────

  @Get('projects/:id/margin')
  @Permissions(Permission.FINANCIAL_DASHBOARD_VIEW)
  @ApiOperation({ summary: 'Calculate the profit margin for a project' })
  calculateProjectMargin(@Param('id') projectId: string) {
    return this.financeService.calculateProjectMargin(projectId);
  }

  @Get('projects/:id/cost-breakdown')
  @Permissions(Permission.FINANCIAL_DASHBOARD_VIEW)
  @ApiOperation({ summary: 'Get the detailed cost breakdown for a project' })
  getProjectCostBreakdown(@Param('id') projectId: string) {
    return this.financeService.getProjectCostBreakdown(projectId);
  }

  // ── Margin Summary (all projects) ─────────────────────────────────────────

  @Get('margin-summary')
  @Permissions(Permission.FINANCIAL_DASHBOARD_VIEW)
  @ApiOperation({ summary: 'Get a margin summary across all projects' })
  getMarginSummary() {
    return this.financeService.getMarginSummary();
  }

  // ── Expenses ──────────────────────────────────────────────────────────────

  @Post('expenses')
  @Permissions(Permission.FINANCIAL_PO_CREATE) // Or a specific EXPENSE_CREATE
  @ApiOperation({ summary: 'Record a new expense against a project' })
  createProjectExpense(
    @Body() body: {
      projectId: string;
      description: string;
      amount: number;
      category: string;
      expenseDate: string;
      vendorId?: string;
      invoiceRef?: string;
      addedById: string;
    },
  ) {
    return this.financeService.createProjectExpense({
      ...body,
      expenseDate: new Date(body.expenseDate),
    });
  }

  @Get('expenses')
  @Permissions(Permission.FINANCIAL_PO_VIEW)
  @ApiOperation({ summary: 'Get project expenses, optionally filtered by project' })
  findProjectExpenses(@Query('projectId') projectId?: string) {
    return this.financeService.findProjectExpenses(projectId);
  }

  // ── Payments ──────────────────────────────────────────────────────────────

  @Get('payments')
  @Permissions(Permission.FINANCIAL_PAYMENT_VIEW)
  @ApiOperation({ summary: 'Get all payments, optionally filtered by invoice' })
  findAllPayments(@Query('invoiceId') invoiceId?: string) {
    return this.financeService.findAllPayments(invoiceId);
  }

  @Post('payment')
  @Permissions(Permission.FINANCIAL_PAYMENT_VIEW)
  @ApiOperation({ summary: 'Record a payment received against an invoice' })
  recordPayment(@Body() body: { invoiceId: string; amount: number; method: string }) {
    return this.financeService.recordPayment(body.invoiceId, body.amount, body.method);
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  @Get('profitability/:projectId')
  @Permissions(Permission.FINANCIAL_DASHBOARD_VIEW)
  @ApiOperation({ summary: 'Calculate profitability analytics for a project' })
  calculateProjectProfitability(@Param('projectId') projectId: string) {
    return this.financeService.calculateProjectProfitability(projectId);
  }

  @Get('summary')
  @Permissions(Permission.FINANCIAL_DASHBOARD_VIEW)
  @ApiOperation({ summary: 'Get an aggregated financial dashboard summary' })
  getDashboardSummary() {
    return this.financeService.getDashboardSummary();
  }
}

