import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: this.configService.get<number>('SMTP_PORT') === 465,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async send(
    to: string,
    subject: string,
    htmlBody: string,
    cc?: string | string[],
    // RFC 5322 threading headers. Supplying our own messageId on the first mail
    // lets a later reply reference it deterministically; inReplyTo/references
    // are what group the reply into the same conversation.
    thread?: { messageId?: string; inReplyTo?: string; references?: string | string[] },
    attachments?: { filename: string; content: Buffer; contentType?: string }[],
  ) {
    try {
      const info = await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM'),
        to,
        ...(cc && (Array.isArray(cc) ? cc.length : cc) ? { cc } : {}),
        subject,
        html: htmlBody,
        ...(thread?.messageId ? { messageId: thread.messageId } : {}),
        ...(thread?.inReplyTo ? { inReplyTo: thread.inReplyTo } : {}),
        ...(thread?.references ? { references: thread.references } : {}),
        ...(attachments?.length ? { attachments } : {}),
      });
      this.logger.log(`Email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  }

  private renderTemplate(templateName: string, data: Record<string, any>): string {
    const templatePath = path.join(__dirname, 'templates', `${templateName}.html`);
    let content = fs.readFileSync(templatePath, 'utf8');
    
    // Simple template engine: replace {{key}} with data[key]
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      content = content.replace(regex, data[key] ?? '');
    });
    
    return content;
  }

  async sendTimesheetReminder(user: any, weekLabel: string) {
    const html = this.renderTemplate('timesheet-reminder', {
      name: user.firstName || user.email,
      weekLabel,
      link: `${String(this.configService.get('FRONTEND_URL') ?? '').replace(/\/+$/, '')}/timesheets`,
    });
    return this.send(user.email, `Timesheet Reminder: ${weekLabel}`, html);
  }

  async sendApprovalPending(approver: any, entityType: string, entityId: string, requesterName: string) {
    const html = this.renderTemplate('approval-pending', {
      name: approver.firstName || approver.email,
      entityType,
      requesterName,
      link: `${this.configService.get('FRONTEND_URL')}/approvals/${entityId}`,
    });
    return this.send(approver.email, `Approval Pending: ${entityType}`, html);
  }

  async sendApprovalResult(requester: any, entityType: string, action: string, remarks: string) {
    const html = this.renderTemplate('approval-result', {
      name: requester.firstName || requester.email,
      entityType,
      action,
      remarks: remarks || 'No remarks provided.',
    });
    return this.send(requester.email, `Approval ${action}: ${entityType}`, html);
  }

  async sendContractExpiry(adminEmail: string, freelancerName: string, contractEnd: string, daysLeft: number) {
    const html = this.renderTemplate('contract-expiry', {
      freelancerName,
      contractEnd,
      daysLeft,
    });
    return this.send(adminEmail, `Contract Expiry Warning: ${freelancerName}`, html);
  }

  async sendPasswordReset(to: string, firstName: string, resetUrl: string) {
    const html = this.renderTemplate('password-reset', {
      firstName,
      resetUrl,
      expiryMinutes: 60,
    });
    return this.send(to, 'Reset your Newel Planner password', html);
  }

  async sendPasswordResetOtp(to: string, firstName: string, otp: string, expiryMinutes: number) {
    const html = this.renderTemplate('password-reset-otp', {
      firstName,
      otp,
      expiryMinutes,
    });
    return this.send(to, 'Your Newel Planner password reset code', html);
  }

  private attendanceUrl() {
    return `${this.configService.get('FRONTEND_URL')}/attendance`;
  }

  async sendCheckinMissingEmployee(
    to: string,
    name: string,
    date: string,
    shiftStart: string | null,
  ) {
    const html = this.renderTemplate('attendance-checkin-missing-employee', {
      name,
      date,
      shiftStart: shiftStart || 'N/A',
      appUrl: this.attendanceUrl(),
    });
    return this.send(to, `Missing check-in for ${date}`, html);
  }

  async sendCheckinMissingRA(
    to: string,
    raName: string,
    date: string,
    count: number,
    rowsHtml: string,
  ) {
    const html = this.renderTemplate('attendance-checkin-missing-ra', {
      raName,
      date,
      count,
      rows: rowsHtml,
      appUrl: this.attendanceUrl(),
    });
    return this.send(to, `Team missing check-ins on ${date}: ${count} employee(s)`, html);
  }

  async sendCheckinMissingHrDigest(
    to: string,
    date: string,
    count: number,
    rowsHtml: string,
  ) {
    const html = this.renderTemplate('attendance-checkin-missing-hr-digest', {
      date,
      count,
      rows: rowsHtml,
      appUrl: this.attendanceUrl(),
    });
    return this.send(to, `Missing check-ins on ${date}: ${count} employee(s)`, html);
  }

  async sendAssetAllocationConfirmation(
    to: string,
    data: {
      raName: string;
      monthLabel: string;
      assetCount: number;
      rowsHtml: string;
      reminderNote: string;
    },
    cc?: string | string[],
  ) {
    const html = this.renderTemplate('asset-allocation-confirmation', {
      raName: data.raName,
      monthLabel: data.monthLabel,
      count: data.assetCount,
      rows: data.rowsHtml,
      reminderNote: data.reminderNote,
      appUrl: `${this.configService.get('FRONTEND_URL')}/asset-confirmations`,
    });
    return this.send(
      to,
      `Action required: confirm your team's asset allocations (${data.monthLabel})`,
      html,
      cc,
    );
  }

  private appUrl(path: string) {
    return `${String(this.configService.get('FRONTEND_URL') ?? '').replace(/\/+$/, '')}${path}`;
  }

  /**
   * Deterministic Message-ID for an approval mail thread. Derived from the entity
   * id so a later decision mail can reference the original even if the value
   * returned by the transport was never captured.
   */
  threadMessageId(prefix: string, entityId: string) {
    return `<${prefix}-${entityId}@neweltechnologies.com>`;
  }

  regularizationMessageId(regularizationId: string) {
    return this.threadMessageId('attendance-reg', regularizationId);
  }

  leaveMessageId(leaveId: string) {
    return this.threadMessageId('leave', leaveId);
  }

  /** Subject shared by the leave request mail and its decision reply. */
  leaveSubject(employeeName: string, leaveTypeName: string, dateRange: string) {
    return `Leave request: ${employeeName} — ${leaveTypeName}, ${dateRange}`;
  }

  /** Subject shared by both mails — the decision reply prefixes it with "Re: ". */
  regularizationSubject(employeeName: string, dateLabel: string) {
    return `Regularization request: ${employeeName} — ${dateLabel}`;
  }

  /**
   * Request mail to the reporting authority. The employee is CC'd on purpose:
   * threading only groups a reply into a conversation the recipient already has,
   * so without this the decision mail would arrive standalone for them.
   */
  async sendRegularizationRequest(
    to: string,
    data: {
      regularizationId: string;
      approverName: string;
      employeeName: string;
      employeeCode?: string | null;
      department?: string | null;
      regularizationDate: string;
      missingSummary: string;
      reason: string;
      requestedIn: string;
      requestedOut: string;
      remarks?: string | null;
      submittedAt: string;
    },
    cc?: string | string[],
  ) {
    const html = this.renderTemplate('attendance-regularization-request', {
      approverName: data.approverName,
      employeeName: data.employeeName,
      employeeCodeSuffix: data.employeeCode ? ` (${data.employeeCode})` : '',
      department: data.department || '—',
      regularizationDate: data.regularizationDate,
      missingSummary: data.missingSummary,
      reason: data.reason,
      requestedIn: data.requestedIn,
      requestedOut: data.requestedOut,
      remarks: data.remarks || '—',
      submittedAt: data.submittedAt,
      link: this.appUrl('/attendance'),
    });

    return this.send(
      to,
      this.regularizationSubject(data.employeeName, data.regularizationDate),
      html,
      cc,
      { messageId: this.regularizationMessageId(data.regularizationId) },
    );
  }

  /** Decision mail back to the requester, threaded onto the request mail. */
  async sendRegularizationDecision(
    to: string,
    data: {
      approved: boolean;
      employeeName: string;
      approverName: string;
      regularizationDate: string;
      decidedAt: string;
      decisionRemarks?: string | null;
      reason: string;
      requestedIn: string;
      requestedOut: string;
      remarks?: string | null;
      /** Message-ID of the request mail; falls back to the deterministic form. */
      inReplyTo: string;
    },
    cc?: string | string[],
  ) {
    const outcome = data.approved ? 'Approved' : 'Rejected';

    const html = this.renderTemplate('attendance-regularization-decision', {
      outcome,
      verdictClass: data.approved ? 'approved' : 'rejected',
      employeeName: data.employeeName,
      approverName: data.approverName,
      regularizationDate: data.regularizationDate,
      decidedAt: data.decidedAt,
      decisionRemarksRow: data.decisionRemarks
        ? `<tr><td class="label">Approver remarks</td><td>${data.decisionRemarks}</td></tr>`
        : '',
      reason: data.reason,
      requestedIn: data.requestedIn,
      requestedOut: data.requestedOut,
      remarks: data.remarks || '—',
      outcomeNote: data.approved
        ? '<p>Your attendance record for this date has been updated accordingly.</p>'
        : '<p>Your attendance record is unchanged. Speak to your reporting authority if you need this reconsidered.</p>',
      link: this.appUrl('/attendance'),
    });

    return this.send(
      to,
      // Identical subject with an Re: prefix — Gmail uses the subject as a
      // secondary threading signal alongside the References header.
      `Re: ${this.regularizationSubject(data.employeeName, data.regularizationDate)}`,
      html,
      cc,
      { inReplyTo: data.inReplyTo, references: data.inReplyTo },
    );
  }

  /**
   * Leave request mail to the reporting authority. The requester is CC'd so the
   * decision reply threads in their mailbox too.
   */
  async sendLeaveRequest(
    to: string,
    data: {
      leaveId: string;
      approverName: string;
      employeeName: string;
      employeeCode?: string | null;
      department?: string | null;
      leaveTypeName: string;
      isPaid: boolean;
      dateRange: string;
      durationLabel: string;
      sandwichDays: number;
      reason?: string | null;
      balanceLabel: string;
      appliedAt: string;
    },
    cc?: string | string[],
  ) {
    const html = this.renderTemplate('leave-request', {
      approverName: data.approverName,
      employeeName: data.employeeName,
      employeeCodeSuffix: data.employeeCode ? ` (${data.employeeCode})` : '',
      department: data.department || '—',
      leaveTypeName: data.leaveTypeName,
      // The UI now shows only a "Paid Leave" label, but this mail goes to an
      // approver deciding a request — stating that Loss of Pay is paid would be a
      // factual error, so the real status is kept here.
      paidLabel: data.isPaid ? 'paid leave' : 'unpaid leave',
      dateRange: data.dateRange,
      durationLabel: data.durationLabel,
      sandwichRow: data.sandwichDays
        ? `<tr><td class="label">Sandwich days included</td><td>${data.sandwichDays}</td></tr>`
        : '',
      reason: data.reason || '—',
      balanceLabel: data.balanceLabel,
      appliedAt: data.appliedAt,
      link: this.appUrl('/leaves'),
    });

    return this.send(
      to,
      this.leaveSubject(data.employeeName, data.leaveTypeName, data.dateRange),
      html,
      cc,
      { messageId: this.leaveMessageId(data.leaveId) },
    );
  }

  /** Decision mail back to the requester, threaded onto the leave request mail. */
  async sendLeaveDecision(
    to: string,
    data: {
      approved: boolean;
      employeeName: string;
      approverName: string;
      /** Set when the decider was not the requester's reporting authority. */
      approverRole?: string | null;
      leaveTypeName: string;
      dateRange: string;
      durationLabel: string;
      decidedAt: string;
      decisionRemarks?: string | null;
      reason?: string | null;
      /** True when a paid-leave balance was returned on rejection. */
      balanceRefunded: boolean;
      inReplyTo: string;
    },
    cc?: string | string[],
  ) {
    const outcome = data.approved ? 'Approved' : 'Rejected';

    const html = this.renderTemplate('leave-decision', {
      outcome,
      verdictClass: data.approved ? 'approved' : 'rejected',
      employeeName: data.employeeName,
      approverName: data.approverName,
      approverRoleSuffix: data.approverRole ? ` (${data.approverRole})` : '',
      decidedAt: data.decidedAt,
      decisionRemarksRow: data.decisionRemarks
        ? `<tr><td class="label">Approver remarks</td><td>${data.decisionRemarks}</td></tr>`
        : '',
      leaveTypeName: data.leaveTypeName,
      dateRange: data.dateRange,
      durationLabel: data.durationLabel,
      reason: data.reason || '—',
      outcomeNote: data.approved
        ? 'Your leave is confirmed. Please ensure any handover is in place before you go.'
        : data.balanceRefunded
          ? 'Your leave balance for these days has been returned to you.'
          : 'Your leave balance is unchanged.',
      link: this.appUrl('/leaves'),
    });

    return this.send(
      to,
      `Re: ${this.leaveSubject(data.employeeName, data.leaveTypeName, data.dateRange)}`,
      html,
      cc,
      { inReplyTo: data.inReplyTo, references: data.inReplyTo },
    );
  }

  /**
   * Builds (but does not send) the Todo List activity email. Returned rather
   * than sent so NotificationsService stays the single place that decides
   * whether a user wants email at all.
   */
  buildActivityEmail(data: {
    recipientName: string;
    headline: string;
    intro: string;
    activityName: string;
    window: string;
    creatorName: string;
    remarks?: string | null;
  }): { subject: string; html: string } {
    const html = this.renderTemplate('activity-notification', {
      name: data.recipientName,
      headline: data.headline,
      intro: data.intro,
      activityName: data.activityName,
      window: data.window,
      creatorName: data.creatorName,
      remarksBlock: data.remarks
        ? `<p><span class="label">Note:</span> ${data.remarks}</p>`
        : '',
      // FRONTEND_URL is configured with a trailing slash, so strip it rather
      // than emit a "//todo" link.
      link: `${String(this.configService.get('FRONTEND_URL') ?? '').replace(/\/+$/, '')}/todo`,
    });

    return { subject: `${data.headline}: ${data.activityName}`, html };
  }

  /**
   * Task assignment mail. `taskTitles` carries more than one entry only for a
   * bulk import, where a mail per row would flood the assignee's inbox — those
   * are collapsed into a single digest.
   */
  buildTaskAssignedEmail(data: {
    recipientName: string;
    taskTitles: string[];
    projectName: string;
    assignedBy: string;
    priority?: string | null;
    dueDate?: Date | string | null;
  }): { subject: string; html: string } {
    const count = data.taskTitles.length;
    const isDigest = count > 1;

    const headline = isDigest ? `${count} tasks assigned to you` : 'New task assigned';
    const intro = isDigest
      ? `${data.assignedBy} assigned you ${count} tasks.`
      : `${data.assignedBy} assigned you a task.`;

    const taskBlock = isDigest
      ? `<p><span class="label">Tasks:</span></p><ul>${data.taskTitles
          .map((t) => `<li>${this.escapeHtml(t)}</li>`)
          .join('')}</ul>`
      : `<p><span class="label">Task:</span> <strong>${this.escapeHtml(data.taskTitles[0] ?? '')}</strong></p>`;

    const due = data.dueDate ? new Date(data.dueDate) : null;
    const dueBlock = due && !isNaN(due.getTime())
      ? `<p><span class="label">Due:</span> ${due.toLocaleDateString('en-GB')}</p>`
      : '';

    const html = this.renderTemplate('task-assigned', {
      name: data.recipientName,
      headline,
      intro,
      taskBlock,
      projectName: this.escapeHtml(data.projectName),
      assignedBy: this.escapeHtml(data.assignedBy),
      priorityBlock: data.priority && !isDigest
        ? `<p><span class="label">Priority:</span> ${this.escapeHtml(data.priority)}</p>`
        : '',
      dueBlock,
      // FRONTEND_URL is configured with a trailing slash, so strip it rather
      // than emit a "//tasks" link.
      link: `${String(this.configService.get('FRONTEND_URL') ?? '').replace(/\/+$/, '')}/tasks`,
    });

    const subject = isDigest
      ? `${headline} — ${data.projectName}`
      : `${headline}: ${data.taskTitles[0] ?? ''}`;

    return { subject, html };
  }

  /** Task titles are user-authored and land in an outbound email. */
  private escapeHtml(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
