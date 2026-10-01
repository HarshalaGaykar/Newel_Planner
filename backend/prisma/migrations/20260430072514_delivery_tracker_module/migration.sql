/*
  Warnings:

  - You are about to drop the `TaskDueDateRevision` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TaskRemark` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- DropForeignKey
ALTER TABLE "TaskDueDateRevision" DROP CONSTRAINT "TaskDueDateRevision_taskId_fkey";

-- DropForeignKey
ALTER TABLE "TaskRemark" DROP CONSTRAINT "TaskRemark_taskId_fkey";

-- DropTable
DROP TABLE "TaskDueDateRevision";

-- DropTable
DROP TABLE "TaskRemark";

-- CreateTable
CREATE TABLE "DeliveryItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "srNo" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "owners" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "currentStage" TEXT,
    "stageDueDate" TIMESTAMP(3),
    "status" "DeliveryStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryItemRemark" (
    "id" TEXT NOT NULL,
    "deliveryItemId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryItemRemark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryItemStageLog" (
    "id" TEXT NOT NULL,
    "deliveryItemId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "stageDueDate" TIMESTAMP(3),
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryItemStageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryItem_projectId_idx" ON "DeliveryItem"("projectId");

-- CreateIndex
CREATE INDEX "DeliveryItemRemark_deliveryItemId_idx" ON "DeliveryItemRemark"("deliveryItemId");

-- CreateIndex
CREATE INDEX "DeliveryItemStageLog_deliveryItemId_idx" ON "DeliveryItemStageLog"("deliveryItemId");

-- AddForeignKey
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryItemRemark" ADD CONSTRAINT "DeliveryItemRemark_deliveryItemId_fkey" FOREIGN KEY ("deliveryItemId") REFERENCES "DeliveryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryItemStageLog" ADD CONSTRAINT "DeliveryItemStageLog_deliveryItemId_fkey" FOREIGN KEY ("deliveryItemId") REFERENCES "DeliveryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
