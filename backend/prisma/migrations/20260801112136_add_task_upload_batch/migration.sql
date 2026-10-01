-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "uploadBatchId" TEXT;

-- CreateTable
CREATE TABLE "TaskUploadBatch" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileName" TEXT,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rolledBackAt" TIMESTAMP(3),

    CONSTRAINT "TaskUploadBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskUploadBatch_projectId_idx" ON "TaskUploadBatch"("projectId");

-- CreateIndex
CREATE INDEX "TaskUploadBatch_uploadedById_idx" ON "TaskUploadBatch"("uploadedById");

-- CreateIndex
CREATE INDEX "Task_uploadBatchId_idx" ON "Task"("uploadBatchId");

-- CreateIndex
CREATE INDEX "TimesheetEntry_taskId_idx" ON "TimesheetEntry"("taskId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_uploadBatchId_fkey" FOREIGN KEY ("uploadBatchId") REFERENCES "TaskUploadBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskUploadBatch" ADD CONSTRAINT "TaskUploadBatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskUploadBatch" ADD CONSTRAINT "TaskUploadBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
