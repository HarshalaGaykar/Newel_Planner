-- CreateEnum
CREATE TYPE "TrainingType" AS ENUM ('INTERNAL', 'EXTERNAL', 'ONLINE', 'CERTIFICATION');

-- CreateEnum
CREATE TYPE "TrainingMode" AS ENUM ('ONLINE', 'OFFLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ENROLLED', 'WAITLISTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "TrainingCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingProgram" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "TrainingType" NOT NULL DEFAULT 'INTERNAL',
    "categoryId" TEXT,
    "durationHrs" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingProgramSkill" (
    "programId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "TrainingProgramSkill_pkey" PRIMARY KEY ("programId","skillId")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "title" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "mode" "TrainingMode" NOT NULL DEFAULT 'OFFLINE',
    "venue" TEXT,
    "meetingUrl" TEXT,
    "maxCapacity" INTEGER,
    "trainerId" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingEnrollment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingCategory_name_key" ON "TrainingCategory"("name");

-- CreateIndex
CREATE INDEX "TrainingProgram_categoryId_idx" ON "TrainingProgram"("categoryId");

-- CreateIndex
CREATE INDEX "TrainingProgram_type_idx" ON "TrainingProgram"("type");

-- CreateIndex
CREATE INDEX "TrainingProgramSkill_skillId_idx" ON "TrainingProgramSkill"("skillId");

-- CreateIndex
CREATE INDEX "TrainingSession_programId_idx" ON "TrainingSession"("programId");

-- CreateIndex
CREATE INDEX "TrainingSession_startDate_idx" ON "TrainingSession"("startDate");

-- CreateIndex
CREATE INDEX "TrainingSession_status_idx" ON "TrainingSession"("status");

-- CreateIndex
CREATE INDEX "TrainingEnrollment_sessionId_idx" ON "TrainingEnrollment"("sessionId");

-- CreateIndex
CREATE INDEX "TrainingEnrollment_userId_idx" ON "TrainingEnrollment"("userId");

-- CreateIndex
CREATE INDEX "TrainingEnrollment_status_idx" ON "TrainingEnrollment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingEnrollment_sessionId_userId_key" ON "TrainingEnrollment"("sessionId", "userId");

-- AddForeignKey
ALTER TABLE "TrainingProgram" ADD CONSTRAINT "TrainingProgram_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TrainingCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingProgramSkill" ADD CONSTRAINT "TrainingProgramSkill_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingProgramSkill" ADD CONSTRAINT "TrainingProgramSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingEnrollment" ADD CONSTRAINT "TrainingEnrollment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingEnrollment" ADD CONSTRAINT "TrainingEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
