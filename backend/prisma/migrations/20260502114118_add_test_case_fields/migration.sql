-- CreateEnum
CREATE TYPE "TestCaseType" AS ENUM ('MANUAL', 'AUTOMATED');

-- CreateEnum
CREATE TYPE "TestCaseCategory" AS ENUM ('FUNCTIONAL', 'UI', 'API', 'SECURITY', 'PERFORMANCE', 'OTHER');

-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN     "automationId" TEXT,
ADD COLUMN     "category" "TestCaseCategory" NOT NULL DEFAULT 'FUNCTIONAL',
ADD COLUMN     "lastActualResult" TEXT,
ADD COLUMN     "lastExecutedAt" TIMESTAMP(3),
ADD COLUMN     "lastResult" "ExecutionResult",
ADD COLUMN     "requirementId" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "type" "TestCaseType" NOT NULL DEFAULT 'MANUAL';
