-- CreateTable
CREATE TABLE "EmployeeMaturity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "currentMaturityValue" DOUBLE PRECISION NOT NULL,
    "forTheMonth" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeMaturity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeMaturityHistory" (
    "id" TEXT NOT NULL,
    "employeeMaturityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "maturityValue" DOUBLE PRECISION NOT NULL,
    "forTheMonth" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "EmployeeMaturityHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMaturity_userId_key" ON "EmployeeMaturity"("userId");

-- CreateIndex
CREATE INDEX "EmployeeMaturity_forTheMonth_idx" ON "EmployeeMaturity"("forTheMonth");

-- CreateIndex
CREATE INDEX "EmployeeMaturityHistory_employeeMaturityId_idx" ON "EmployeeMaturityHistory"("employeeMaturityId");

-- CreateIndex
CREATE INDEX "EmployeeMaturityHistory_forTheMonth_idx" ON "EmployeeMaturityHistory"("forTheMonth");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMaturityHistory_userId_forTheMonth_key" ON "EmployeeMaturityHistory"("userId", "forTheMonth");

-- AddForeignKey
ALTER TABLE "EmployeeMaturity" ADD CONSTRAINT "EmployeeMaturity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMaturity" ADD CONSTRAINT "EmployeeMaturity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMaturity" ADD CONSTRAINT "EmployeeMaturity_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMaturityHistory" ADD CONSTRAINT "EmployeeMaturityHistory_employeeMaturityId_fkey" FOREIGN KEY ("employeeMaturityId") REFERENCES "EmployeeMaturity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMaturityHistory" ADD CONSTRAINT "EmployeeMaturityHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMaturityHistory" ADD CONSTRAINT "EmployeeMaturityHistory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMaturityHistory" ADD CONSTRAINT "EmployeeMaturityHistory_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
