-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RoleEnum" ADD VALUE 'SUPER_ADMIN';
ALTER TYPE "RoleEnum" ADD VALUE 'OWNER';
ALTER TYPE "RoleEnum" ADD VALUE 'SALES';
ALTER TYPE "RoleEnum" ADD VALUE 'PURCHASING';
ALTER TYPE "RoleEnum" ADD VALUE 'WAREHOUSE';
ALTER TYPE "RoleEnum" ADD VALUE 'FINANCE';
ALTER TYPE "RoleEnum" ADD VALUE 'PRODUCT';

-- RenameIndex
ALTER INDEX "ProductResearch_createdAt_idx" RENAME TO "product_research_createdAt_idx";
