-- CreateTable
CREATE TABLE "AssetAllocationConfirmation" (
    "id" TEXT NOT NULL,
    "reportingAuthorityId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "assetCount" INTEGER NOT NULL DEFAULT 0,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetAllocationConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetAllocationConfirmation_period_idx" ON "AssetAllocationConfirmation"("period");

-- CreateIndex
CREATE INDEX "AssetAllocationConfirmation_status_idx" ON "AssetAllocationConfirmation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AssetAllocationConfirmation_reportingAuthorityId_period_key" ON "AssetAllocationConfirmation"("reportingAuthorityId", "period");

-- AddForeignKey
ALTER TABLE "AssetAllocationConfirmation" ADD CONSTRAINT "AssetAllocationConfirmation_reportingAuthorityId_fkey" FOREIGN KEY ("reportingAuthorityId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAllocationConfirmation" ADD CONSTRAINT "AssetAllocationConfirmation_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
