import { Injectable, Logger } from '@nestjs/common';
import { EmailKind, EmailLogStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface EmailLogEntry {
  kind: EmailKind;
  status: EmailLogStatus;
  recipient: string;
  subject: string;
  templateName: string;
  messageId?: string | null;
  error?: string | null;
  /** The employee the mail is *about*, not the recipient. */
  subjectUserId?: string | null;
  dedupeKey?: string | null;
  metadata?: any;
}

/**
 * Writes the outbound-email audit trail. Extracted so every approval-mail flow
 * (attendance regularization, leave, …) records sends identically instead of
 * each service growing its own copy.
 */
@Injectable()
export class EmailLogService {
  private readonly logger = new Logger(EmailLogService.name);

  constructor(private prisma: PrismaService) {}

  async record(entry: EmailLogEntry) {
    try {
      await this.prisma.emailLog.create({
        data: {
          kind: entry.kind,
          status: entry.status,
          recipient: entry.recipient,
          subject: entry.subject,
          templateName: entry.templateName,
          messageId: entry.messageId ?? null,
          error: entry.error ?? null,
          subjectUserId: entry.subjectUserId ?? null,
          // Only SUCCESS rows carry a dedupeKey, so a failure stays retryable
          // while a duplicate success is blocked by the unique constraint.
          dedupeKey: entry.status === EmailLogStatus.SUCCESS ? entry.dedupeKey ?? null : null,
          metadata: entry.metadata ?? undefined,
        },
      });
    } catch (error) {
      // The audit row must never take down the operation it describes. A unique
      // dedupeKey violation also lands here, which is the intended no-op.
      this.logger.warn(
        `EmailLog write skipped for ${entry.kind}/${entry.recipient}: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
