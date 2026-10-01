-- AlterTable
-- Both columns are nullable: existing one-off activities keep working untouched.
ALTER TABLE "Activity" ADD COLUMN     "occurrenceDate" TIMESTAMP(3),
ADD COLUMN     "recurrenceId" TEXT;

-- CreateTable
CREATE TABLE "ActivityRecurrence" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "byWeekday" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "byMonthDay" INTEGER,
    "seriesStartAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "seriesEndDate" TIMESTAMP(3),
    "maxOccurrences" INTEGER,
    "status" "RecurrenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "generatedUntil" TIMESTAMP(3),
    "occurrenceCount" INTEGER NOT NULL DEFAULT 0,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityRecurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityRecurrenceAssignee" (
    "recurrenceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityRecurrenceAssignee_pkey" PRIMARY KEY ("recurrenceId","userId")
);

-- CreateIndex
CREATE INDEX "ActivityRecurrence_createdById_idx" ON "ActivityRecurrence"("createdById");

-- CreateIndex
CREATE INDEX "ActivityRecurrence_status_generatedUntil_idx" ON "ActivityRecurrence"("status", "generatedUntil");

-- CreateIndex
CREATE INDEX "ActivityRecurrenceAssignee_userId_idx" ON "ActivityRecurrenceAssignee"("userId");

-- CreateIndex
CREATE INDEX "Activity_recurrenceId_idx" ON "Activity"("recurrenceId");

-- CreateIndex
-- Idempotency key for occurrence generation. Existing rows all hold NULL in both
-- columns, and PostgreSQL treats NULLs as distinct, so no backfill is needed.
CREATE UNIQUE INDEX "Activity_recurrenceId_occurrenceDate_key" ON "Activity"("recurrenceId", "occurrenceDate");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "ActivityRecurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRecurrence" ADD CONSTRAINT "ActivityRecurrence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRecurrenceAssignee" ADD CONSTRAINT "ActivityRecurrenceAssignee_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "ActivityRecurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRecurrenceAssignee" ADD CONSTRAINT "ActivityRecurrenceAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
