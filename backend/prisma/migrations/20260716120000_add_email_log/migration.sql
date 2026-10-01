-- CreateEnum
CREATE TYPE "EmailLogStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailKind" AS ENUM ('ATTENDANCE_CHECKIN_MISSING_EMPLOYEE', 'ATTENDANCE_CHECKIN_MISSING_RA', 'ATTENDANCE_CHECKIN_MISSING_HR_DIGEST');

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "kind" "EmailKind" NOT NULL,
    "status" "EmailLogStatus" NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "templateName" TEXT,
    "messageId" TEXT,
    "error" TEXT,
    "subjectUserId" TEXT,
    "contextDate" DATE,
    "dedupeKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailLog_dedupeKey_key" ON "EmailLog"("dedupeKey");

-- CreateIndex
CREATE INDEX "EmailLog_kind_idx" ON "EmailLog"("kind");

-- CreateIndex
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");

-- CreateIndex
CREATE INDEX "EmailLog_subjectUserId_idx" ON "EmailLog"("subjectUserId");

-- CreateIndex
CREATE INDEX "EmailLog_contextDate_idx" ON "EmailLog"("contextDate");

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
