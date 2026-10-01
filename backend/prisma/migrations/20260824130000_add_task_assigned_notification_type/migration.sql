-- Task assignment notifications: new NotificationType member.
-- Additive only — existing rows and preferences are untouched.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_ASSIGNED';
