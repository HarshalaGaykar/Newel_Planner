-- CreateTable
CREATE TABLE "DeliveryReportSettings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3),
    "preparedBy" TEXT,
    "statusSummary" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryReportSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryReportSend" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sentById" TEXT NOT NULL,
    "preparedBy" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "recipients" TEXT[],
    "cc" TEXT[],
    "subject" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "messageId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryReportSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryReportSettings_projectId_key" ON "DeliveryReportSettings"("projectId");

-- CreateIndex
CREATE INDEX "DeliveryReportSend_projectId_idx" ON "DeliveryReportSend"("projectId");

-- CreateIndex
CREATE INDEX "DeliveryReportSend_sentById_idx" ON "DeliveryReportSend"("sentById");

-- AddForeignKey
ALTER TABLE "DeliveryReportSettings" ADD CONSTRAINT "DeliveryReportSettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryReportSettings" ADD CONSTRAINT "DeliveryReportSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryReportSend" ADD CONSTRAINT "DeliveryReportSend_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryReportSend" ADD CONSTRAINT "DeliveryReportSend_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
