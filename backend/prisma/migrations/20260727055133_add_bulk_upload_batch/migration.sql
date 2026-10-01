-- AlterTable
ALTER TABLE "Timesheet" ADD COLUMN     "bulkUploadBatchId" TEXT;

-- AlterTable
ALTER TABLE "TimesheetEntry" ADD COLUMN     "bulkUploadBatchId" TEXT;

-- CreateTable
CREATE TABLE "BulkUploadBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileName" TEXT,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rolledBackAt" TIMESTAMP(3),

    CONSTRAINT "BulkUploadBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulkUploadBatch_userId_idx" ON "BulkUploadBatch"("userId");

-- CreateIndex
CREATE INDEX "BulkUploadBatch_uploadedById_idx" ON "BulkUploadBatch"("uploadedById");

-- CreateIndex
CREATE INDEX "Timesheet_bulkUploadBatchId_idx" ON "Timesheet"("bulkUploadBatchId");

-- CreateIndex
CREATE INDEX "TimesheetEntry_bulkUploadBatchId_idx" ON "TimesheetEntry"("bulkUploadBatchId");

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_bulkUploadBatchId_fkey" FOREIGN KEY ("bulkUploadBatchId") REFERENCES "BulkUploadBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_bulkUploadBatchId_fkey" FOREIGN KEY ("bulkUploadBatchId") REFERENCES "BulkUploadBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkUploadBatch" ADD CONSTRAINT "BulkUploadBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkUploadBatch" ADD CONSTRAINT "BulkUploadBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
