-- AlterEnum
ALTER TYPE "EmailKind" ADD VALUE 'ATTENDANCE_REGULARIZATION_REQUEST';
ALTER TYPE "EmailKind" ADD VALUE 'ATTENDANCE_REGULARIZATION_DECISION';

-- AlterTable
ALTER TABLE "AttendanceRegularization" ADD COLUMN     "decisionRemarks" TEXT,
ADD COLUMN     "requestMailMessageId" TEXT,
ADD COLUMN     "requestMailSentAt" TIMESTAMP(3);
