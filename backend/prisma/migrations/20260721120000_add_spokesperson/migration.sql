-- CreateTable
CREATE TABLE "Spokesperson" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Spokesperson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Spokesperson_clientId_idx" ON "Spokesperson"("clientId");

-- CreateIndex
CREATE INDEX "Spokesperson_isActive_idx" ON "Spokesperson"("isActive");

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "spokespersonId" TEXT;

-- CreateIndex
CREATE INDEX "Asset_spokespersonId_idx" ON "Asset"("spokespersonId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_spokespersonId_fkey" FOREIGN KEY ("spokespersonId") REFERENCES "Spokesperson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spokesperson" ADD CONSTRAINT "Spokesperson_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spokesperson" ADD CONSTRAINT "Spokesperson_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spokesperson" ADD CONSTRAINT "Spokesperson_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
