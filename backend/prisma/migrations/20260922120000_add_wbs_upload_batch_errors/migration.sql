-- AlterTable
ALTER TABLE "TaskUploadBatch" ADD COLUMN     "errorCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "errors" JSONB;
