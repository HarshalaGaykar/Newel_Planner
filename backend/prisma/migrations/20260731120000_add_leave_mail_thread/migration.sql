-- AlterEnum
ALTER TYPE "EmailKind" ADD VALUE 'LEAVE_REQUEST';
ALTER TYPE "EmailKind" ADD VALUE 'LEAVE_DECISION';

-- AlterTable
ALTER TABLE "Leave" ADD COLUMN     "approverId" TEXT,
ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "decisionRemarks" TEXT,
ADD COLUMN     "requestMailMessageId" TEXT,
ADD COLUMN     "requestMailSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Leave_approverId_idx" ON "Leave"("approverId");

-- AddForeignKey
ALTER TABLE "Leave" ADD CONSTRAINT "Leave_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
