-- AlterTable
ALTER TABLE "DeliveryItem" RENAME COLUMN "startDate" TO "plannedStart";
ALTER TABLE "DeliveryItem" RENAME COLUMN "endDate" TO "plannedEnd";
ALTER TABLE "DeliveryItem" ADD COLUMN "actualStart" TIMESTAMP(3);
ALTER TABLE "DeliveryItem" ADD COLUMN "actualEnd" TIMESTAMP(3);
ALTER TABLE "DeliveryItem" ADD COLUMN "uatReleaseDate" TIMESTAMP(3);
ALTER TABLE "DeliveryItem" ALTER COLUMN "owners" DROP NOT NULL;
