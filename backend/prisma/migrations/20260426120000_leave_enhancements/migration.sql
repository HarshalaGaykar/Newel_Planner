-- AlterTable Leave: replace type with leaveTypeCode + add new fields
ALTER TABLE "Leave" ADD COLUMN "leaveTypeCode" TEXT;
ALTER TABLE "Leave" ADD COLUMN "isHalfDay" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Leave" ADD COLUMN "halfDaySession" TEXT;
ALTER TABLE "Leave" ADD COLUMN "sandwichDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Leave" ADD COLUMN "duration" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- Migrate existing type -> leaveTypeCode
UPDATE "Leave" SET "leaveTypeCode" = "type" WHERE "leaveTypeCode" IS NULL;

-- Drop old type column
ALTER TABLE "Leave" DROP COLUMN "type";

-- Create index on leaveTypeCode
CREATE INDEX "Leave_leaveTypeCode_idx" ON "Leave"("leaveTypeCode");

-- AlterTable LeaveTypeMaster: add requiresSandwichCheck
ALTER TABLE "LeaveTypeMaster" ADD COLUMN "requiresSandwichCheck" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable LeaveBalance: add new columns (nullable first for data migration)
ALTER TABLE "LeaveBalance" ADD COLUMN "leaveTypeCode" TEXT;
ALTER TABLE "LeaveBalance" ADD COLUMN "earnedBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "LeaveBalance" ADD COLUMN "usedBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "LeaveBalance" ADD COLUMN "carryForward" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "LeaveBalance" ADD COLUMN "expiryDate" TIMESTAMP(3);
ALTER TABLE "LeaveBalance" ADD COLUMN "financialYearId" TEXT;

-- Migrate existing data: copy type -> leaveTypeCode, balance -> earnedBalance
UPDATE "LeaveBalance" SET
  "leaveTypeCode" = "type",
  "earnedBalance" = "balance"
WHERE "leaveTypeCode" IS NULL;

-- Make leaveTypeCode NOT NULL now that data is migrated
ALTER TABLE "LeaveBalance" ALTER COLUMN "leaveTypeCode" SET NOT NULL;

-- Drop old unique constraint on [userId, type]
DROP INDEX IF EXISTS "LeaveBalance_userId_type_key";

-- Drop old columns
ALTER TABLE "LeaveBalance" DROP COLUMN "type";
ALTER TABLE "LeaveBalance" DROP COLUMN "balance";

-- Add new unique constraint on [userId, leaveTypeCode]
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_userId_leaveTypeCode_key" UNIQUE ("userId", "leaveTypeCode");
