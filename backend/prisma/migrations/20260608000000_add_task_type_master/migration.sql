-- DropForeignKey
ALTER TABLE "Timesheet" DROP CONSTRAINT "Timesheet_projectId_fkey";

-- DropIndex (IF EXISTS: index may already be absent in some environments)
DROP INDEX IF EXISTS "Timesheet_userId_projectId_startDate_key";

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "taskTypeMasterId" TEXT;

-- AlterTable (rejectionRemarks already added in 20260603; projectId already added in 20260601)
ALTER TABLE "Timesheet"
ALTER COLUMN "projectId" DROP NOT NULL;

-- AlterTable (projectId already added in 20260601)
ALTER TABLE "TimesheetEntry" ADD COLUMN "taskSubActivityMasterId" TEXT;

-- CreateTable
CREATE TABLE "TaskTypeMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "TaskTypeMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskActivityMaster" (
    "id" TEXT NOT NULL,
    "taskTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "TaskActivityMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskSubActivityMaster" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "TaskSubActivityMaster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskTypeMaster_name_key" ON "TaskTypeMaster"("name");

-- CreateIndex
CREATE INDEX "TaskTypeMaster_isActive_idx" ON "TaskTypeMaster"("isActive");

-- CreateIndex
CREATE INDEX "TaskActivityMaster_taskTypeId_idx" ON "TaskActivityMaster"("taskTypeId");

-- CreateIndex
CREATE INDEX "TaskActivityMaster_isActive_idx" ON "TaskActivityMaster"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TaskActivityMaster_taskTypeId_name_key" ON "TaskActivityMaster"("taskTypeId", "name");

-- CreateIndex
CREATE INDEX "TaskSubActivityMaster_activityId_idx" ON "TaskSubActivityMaster"("activityId");

-- CreateIndex
CREATE INDEX "TaskSubActivityMaster_isActive_idx" ON "TaskSubActivityMaster"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TaskSubActivityMaster_activityId_name_key" ON "TaskSubActivityMaster"("activityId", "name");

-- CreateIndex
CREATE INDEX "Task_taskTypeMasterId_idx" ON "Task"("taskTypeMasterId");

-- CreateIndex (Timesheet_userId_startDate_key already created in 20260601)
-- CreateIndex (TimesheetEntry_projectId_idx already created in 20260601)

-- CreateIndex
CREATE INDEX "TimesheetEntry_taskSubActivityMasterId_idx" ON "TimesheetEntry"("taskSubActivityMasterId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_taskTypeMasterId_fkey" FOREIGN KEY ("taskTypeMasterId") REFERENCES "TaskTypeMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_taskSubActivityMasterId_fkey" FOREIGN KEY ("taskSubActivityMasterId") REFERENCES "TaskSubActivityMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (TimesheetEntry_projectId_fkey already added in 20260601)

-- AddForeignKey
ALTER TABLE "TaskTypeMaster" ADD CONSTRAINT "TaskTypeMaster_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTypeMaster" ADD CONSTRAINT "TaskTypeMaster_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivityMaster" ADD CONSTRAINT "TaskActivityMaster_taskTypeId_fkey" FOREIGN KEY ("taskTypeId") REFERENCES "TaskTypeMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivityMaster" ADD CONSTRAINT "TaskActivityMaster_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivityMaster" ADD CONSTRAINT "TaskActivityMaster_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubActivityMaster" ADD CONSTRAINT "TaskSubActivityMaster_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "TaskActivityMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubActivityMaster" ADD CONSTRAINT "TaskSubActivityMaster_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubActivityMaster" ADD CONSTRAINT "TaskSubActivityMaster_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
