-- CreateEnum
CREATE TYPE "DataScope" AS ENUM ('OWN', 'TEAM', 'DEPARTMENT', 'PROJECT', 'ALL');

-- AlterTable
ALTER TABLE "RolePermission" ADD COLUMN     "dataScope" "DataScope" NOT NULL DEFAULT 'OWN';
