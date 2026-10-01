-- AlterTable
ALTER TABLE "BulkUploadBatch" ADD COLUMN     "errorCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "errors" JSONB;
