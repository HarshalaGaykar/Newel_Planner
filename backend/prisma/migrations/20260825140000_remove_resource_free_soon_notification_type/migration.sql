-- Removes NotificationType.RESOURCE_FREE_SOON — the "resource free soon" cron
-- job and email were dropped from the app. Postgres has no ALTER TYPE ... DROP
-- VALUE, so narrowing an enum means: build the new type, repoint every column
-- that uses it, retire the old type.
--
-- Requires no row still uses 'RESOURCE_FREE_SOON' at the time this runs — see
-- prisma/cleanup-resource-free-soon-notifications.ts, which must be run first.
-- If any row still references it, the USING casts below fail loudly rather
-- than silently corrupting data.
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('TIMESHEET_REMINDER', 'APPROVAL_PENDING', 'APPROVED', 'REJECTED', 'CONTRACT_EXPIRY', 'MILESTONE_OVERDUE', 'LEAVE_BALANCE_LOW', 'BUDGET_EXCEEDED', 'ALLOCATION_CONFLICT', 'ISSUE_ESCALATED', 'TRAINING_COMPLETED', 'TRAINING_CERTIFICATE_ISSUED', 'PROJECT_DORMANT', 'ACTIVITY_ASSIGNED', 'ACTIVITY_POSTPONED', 'ACTIVITY_COMPLETED', 'ACTIVITY_CANCELLED', 'ACTIVITY_SERIES_ASSIGNED', 'ACTIVITY_SERIES_CANCELLED', 'TASK_ASSIGNED', 'GENERAL');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TABLE "NotificationPreference" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "NotificationType_old";
COMMIT;
