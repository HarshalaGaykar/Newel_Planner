-- CreateEnum
CREATE TYPE "CRPhase" AS ENUM ('REQUIREMENT', 'DESIGN', 'DEVELOPMENT', 'TESTING', 'UAT', 'DEPLOYMENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CRStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "CRStatus" ADD VALUE 'CLOSED';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "crId" TEXT,
ADD COLUMN     "phase" "CRPhase";

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_crId_fkey" FOREIGN KEY ("crId") REFERENCES "ChangeRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
