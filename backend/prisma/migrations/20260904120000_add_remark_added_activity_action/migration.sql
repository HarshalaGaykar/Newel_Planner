-- Remarks-only updates from assignees: new ActivityActionType member for a
-- history entry that carries a remark without changing the activity status.
ALTER TYPE "ActivityActionType" ADD VALUE IF NOT EXISTS 'REMARK_ADDED';
