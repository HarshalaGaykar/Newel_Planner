-- CreateTable
CREATE TABLE "ProjectStatusCcUser" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectContactRole" NOT NULL DEFAULT 'CC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectStatusCcUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectStatusCcUser_projectId_idx" ON "ProjectStatusCcUser"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStatusCcUser_projectId_userId_key" ON "ProjectStatusCcUser"("projectId", "userId");

-- AddForeignKey
ALTER TABLE "ProjectStatusCcUser" ADD CONSTRAINT "ProjectStatusCcUser_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStatusCcUser" ADD CONSTRAINT "ProjectStatusCcUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
