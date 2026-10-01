-- AlterTable
-- Defaulted to false, so every series created before this keeps generating on
-- weekends and holidays exactly as it did.
ALTER TABLE "ActivityRecurrence" ADD COLUMN     "skipNonWorkingDays" BOOLEAN NOT NULL DEFAULT false;
