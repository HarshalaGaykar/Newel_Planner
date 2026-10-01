/*
  Warnings:

  - You are about to drop the `DeliveryItemStageLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DeliveryItemStageLog" DROP CONSTRAINT "DeliveryItemStageLog_deliveryItemId_fkey";

-- DropTable
DROP TABLE "DeliveryItemStageLog";

-- CreateTable
CREATE TABLE "DeliveryItemHistory" (
    "id" TEXT NOT NULL,
    "deliveryItemId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryItemHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryItemHistory_deliveryItemId_idx" ON "DeliveryItemHistory"("deliveryItemId");

-- AddForeignKey
ALTER TABLE "DeliveryItemHistory" ADD CONSTRAINT "DeliveryItemHistory_deliveryItemId_fkey" FOREIGN KEY ("deliveryItemId") REFERENCES "DeliveryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
