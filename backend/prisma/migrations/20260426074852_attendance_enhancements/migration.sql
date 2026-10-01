-- CreateEnum
CREATE TYPE "RegularizationReason" AS ENUM ('FORGOT_PUNCH', 'SYSTEM_ERROR', 'FIELD_WORK', 'CLIENT_VISIT', 'TRAINING', 'OTHER');

-- CreateEnum
CREATE TYPE "RegularizationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "isWfh" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "shiftId" TEXT;

-- CreateTable
CREATE TABLE "AttendanceRegularization" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attendanceId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "requestedIn" TIMESTAMP(3),
    "requestedOut" TIMESTAMP(3),
    "reason" "RegularizationReason" NOT NULL,
    "remarks" TEXT,
    "status" "RegularizationStatus" NOT NULL DEFAULT 'PENDING',
    "approverId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRegularization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceRegularization_userId_idx" ON "AttendanceRegularization"("userId");

-- CreateIndex
CREATE INDEX "AttendanceRegularization_date_idx" ON "AttendanceRegularization"("date");

-- CreateIndex
CREATE INDEX "AttendanceRegularization_status_idx" ON "AttendanceRegularization"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRegularization_userId_date_key" ON "AttendanceRegularization"("userId", "date");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRegularization" ADD CONSTRAINT "AttendanceRegularization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRegularization" ADD CONSTRAINT "AttendanceRegularization_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRegularization" ADD CONSTRAINT "AttendanceRegularization_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
