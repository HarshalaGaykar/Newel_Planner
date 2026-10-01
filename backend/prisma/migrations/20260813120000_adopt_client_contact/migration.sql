-- CreateEnum
CREATE TYPE "ProjectContactRole" AS ENUM ('TO', 'CC');

-- CreateTable
CREATE TABLE "ClientContact" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "designation" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectClientContact" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clientContactId" TEXT NOT NULL,
    "role" "ProjectContactRole" NOT NULL DEFAULT 'TO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectClientContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientContact_clientId_idx" ON "ClientContact"("clientId");

-- CreateIndex
CREATE INDEX "ClientContact_isActive_idx" ON "ClientContact"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ClientContact_clientId_email_key" ON "ClientContact"("clientId", "email");

-- CreateIndex
CREATE INDEX "ProjectClientContact_clientContactId_idx" ON "ProjectClientContact"("clientContactId");

-- CreateIndex
CREATE INDEX "ProjectClientContact_projectId_idx" ON "ProjectClientContact"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectClientContact_projectId_clientContactId_key" ON "ProjectClientContact"("projectId", "clientContactId");

-- AddForeignKey
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectClientContact" ADD CONSTRAINT "ProjectClientContact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectClientContact" ADD CONSTRAINT "ProjectClientContact_clientContactId_fkey" FOREIGN KEY ("clientContactId") REFERENCES "ClientContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
