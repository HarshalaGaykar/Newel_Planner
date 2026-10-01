-- Remarks-only updates from assignees now notify creator/co-assignees with
-- their own notification type, distinct from a status change.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ACTIVITY_REMARK_ADDED';
