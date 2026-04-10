-- DropIndex
DROP INDEX "product_research_createdAt_idx";

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "product_research_conclusion_idx" ON "product_research"("conclusion");

-- CreateIndex
CREATE INDEX "product_research_priority_idx" ON "product_research"("priority");

-- RenameIndex
ALTER INDEX "ProductResearch_assignedTo_status_idx" RENAME TO "product_research_assignedTo_status_idx";

-- RenameIndex
ALTER INDEX "ProductResearch_categoryId_status_idx" RENAME TO "product_research_categoryId_status_idx";

-- RenameIndex
ALTER INDEX "ProductResearch_name_idx" RENAME TO "product_research_name_idx";

-- RenameIndex
ALTER INDEX "ProductResearch_status_createdAt_idx" RENAME TO "product_research_status_createdAt_idx";
