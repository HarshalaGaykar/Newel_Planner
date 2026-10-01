-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "bulkUploadBatchId" TEXT;

-- CreateTable
CREATE TABLE "TaskBulkUploadBatch" (
    "id" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileName" TEXT,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rolledBackAt" TIMESTAMP(3),

    CONSTRAINT "TaskBulkUploadBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskBulkUploadBatch_uploadedById_idx" ON "TaskBulkUploadBatch"("uploadedById");

-- CreateIndex
CREATE INDEX "Task_bulkUploadBatchId_idx" ON "Task"("bulkUploadBatchId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_bulkUploadBatchId_fkey" FOREIGN KEY ("bulkUploadBatchId") REFERENCES "TaskBulkUploadBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBulkUploadBatch" ADD CONSTRAINT "TaskBulkUploadBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
