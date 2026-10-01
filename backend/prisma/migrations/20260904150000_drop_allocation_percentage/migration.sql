-- Allocation is now date-range only, no capacity split by percentage.
ALTER TABLE "Allocation" DROP COLUMN "percentage";
