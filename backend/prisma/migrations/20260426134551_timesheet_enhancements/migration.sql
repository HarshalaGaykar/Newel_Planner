-- CreateTable
CREATE TABLE "BackdatedTimesheetRequest" (
    "id" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approverId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackdatedTimesheetRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackdatedTimesheetRequest_timesheetId_idx" ON "BackdatedTimesheetRequest"("timesheetId");

-- CreateIndex
CREATE INDEX "BackdatedTimesheetRequest_userId_idx" ON "BackdatedTimesheetRequest"("userId");

-- CreateIndex
CREATE INDEX "BackdatedTimesheetRequest_approverId_idx" ON "BackdatedTimesheetRequest"("approverId");

-- AddForeignKey
ALTER TABLE "BackdatedTimesheetRequest" ADD CONSTRAINT "BackdatedTimesheetRequest_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackdatedTimesheetRequest" ADD CONSTRAINT "BackdatedTimesheetRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackdatedTimesheetRequest" ADD CONSTRAINT "BackdatedTimesheetRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
