-- Add indexes to ProductResearch table for better query performance

-- Single column indexes
CREATE INDEX IF NOT EXISTS "ProductResearch_name_idx" ON "product_research" ("name");
CREATE INDEX IF NOT EXISTS "ProductResearch_status_idx" ON "product_research" ("status");
CREATE INDEX IF NOT EXISTS "ProductResearch_assignedTo_idx" ON "product_research" ("assignedTo");
CREATE INDEX IF NOT EXISTS "ProductResearch_categoryId_idx" ON "product_research" ("categoryId");
CREATE INDEX IF NOT EXISTS "ProductResearch_createdAt_idx" ON "product_research" ("createdAt" DESC);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS "ProductResearch_categoryId_status_idx" ON "product_research" ("categoryId", "status");
CREATE INDEX IF NOT EXISTS "ProductResearch_status_createdAt_idx" ON "product_research" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ProductResearch_assignedTo_status_idx" ON "product_research" ("assignedTo", "status");

-- Add indexes to ProductAttributeValue table
CREATE INDEX IF NOT EXISTS "ProductAttributeValue_productId_idx" ON "product_attribute_values" ("productId");
CREATE INDEX IF NOT EXISTS "ProductAttributeValue_attributeId_idx" ON "product_attribute_values" ("attributeId");