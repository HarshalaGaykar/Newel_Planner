-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActivityActionType" AS ENUM ('CREATED', 'POSTPONED', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ACTIVITY_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'ACTIVITY_POSTPONED';
ALTER TYPE "NotificationType" ADD VALUE 'ACTIVITY_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE 'ACTIVITY_CANCELLED';

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "status" "ActivityStatus" NOT NULL DEFAULT 'PENDING',
    "postponeCount" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityAssignee" (
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityAssignee_pkey" PRIMARY KEY ("activityId","userId")
);

-- CreateTable
CREATE TABLE "ActivityAction" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" "ActivityActionType" NOT NULL,
    "fromStartAt" TIMESTAMP(3),
    "fromEndAt" TIMESTAMP(3),
    "toStartAt" TIMESTAMP(3),
    "toEndAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activity_createdById_idx" ON "Activity"("createdById");

-- CreateIndex
CREATE INDEX "Activity_status_idx" ON "Activity"("status");

-- CreateIndex
CREATE INDEX "Activity_startAt_idx" ON "Activity"("startAt");

-- CreateIndex
CREATE INDEX "ActivityAssignee_userId_idx" ON "ActivityAssignee"("userId");

-- CreateIndex
CREATE INDEX "ActivityAction_activityId_idx" ON "ActivityAction"("activityId");

-- CreateIndex
CREATE INDEX "ActivityAction_actorId_idx" ON "ActivityAction"("actorId");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAssignee" ADD CONSTRAINT "ActivityAssignee_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAssignee" ADD CONSTRAINT "ActivityAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAction" ADD CONSTRAINT "ActivityAction_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAction" ADD CONSTRAINT "ActivityAction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
