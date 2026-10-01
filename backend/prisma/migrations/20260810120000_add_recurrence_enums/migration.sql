-- Enum changes are split into their own migration: `ALTER TYPE ... ADD VALUE`
-- cannot run inside a transaction block on PostgreSQL 11 and earlier, and
-- Prisma wraps each migration in one.

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "RecurrenceStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "ActivityActionType" ADD VALUE 'SERIES_CANCELLED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ACTIVITY_SERIES_ASSIGNED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ACTIVITY_SERIES_CANCELLED';
