-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'TRAINING_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE 'TRAINING_CERTIFICATE_ISSUED';

-- CreateTable
CREATE TABLE "TrainingCertificate" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "certificateNo" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "TrainingCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingFeedback" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "trainerRating" INTEGER,
    "contentRating" INTEGER,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingCertificate_enrollmentId_key" ON "TrainingCertificate"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingCertificate_certificateNo_key" ON "TrainingCertificate"("certificateNo");

-- CreateIndex
CREATE INDEX "TrainingCertificate_userId_idx" ON "TrainingCertificate"("userId");

-- CreateIndex
CREATE INDEX "TrainingCertificate_sessionId_idx" ON "TrainingCertificate"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingFeedback_enrollmentId_key" ON "TrainingFeedback"("enrollmentId");

-- CreateIndex
CREATE INDEX "TrainingFeedback_sessionId_idx" ON "TrainingFeedback"("sessionId");

-- CreateIndex
CREATE INDEX "TrainingFeedback_userId_idx" ON "TrainingFeedback"("userId");

-- AddForeignKey
ALTER TABLE "TrainingCertificate" ADD CONSTRAINT "TrainingCertificate_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "TrainingEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCertificate" ADD CONSTRAINT "TrainingCertificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCertificate" ADD CONSTRAINT "TrainingCertificate_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCertificate" ADD CONSTRAINT "TrainingCertificate_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingFeedback" ADD CONSTRAINT "TrainingFeedback_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "TrainingEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingFeedback" ADD CONSTRAINT "TrainingFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingFeedback" ADD CONSTRAINT "TrainingFeedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
