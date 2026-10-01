-- AlterTable
ALTER TABLE "ActivityRecurrence" ADD COLUMN     "byMonthDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
