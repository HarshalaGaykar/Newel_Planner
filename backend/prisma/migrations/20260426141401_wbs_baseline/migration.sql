-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "isCritical" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "plannedEnd" TIMESTAMP(3),
ADD COLUMN     "plannedHours" DOUBLE PRECISION,
ADD COLUMN     "plannedStart" TIMESTAMP(3),
ADD COLUMN     "progressPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "wbsLevel" TEXT;

-- CreateTable
CREATE TABLE "Baseline" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "snapshotData" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Baseline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Baseline_projectId_idx" ON "Baseline"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Baseline_projectId_version_key" ON "Baseline"("projectId", "version");

-- AddForeignKey
ALTER TABLE "Baseline" ADD CONSTRAINT "Baseline_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Baseline" ADD CONSTRAINT "Baseline_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
