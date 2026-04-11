-- 重命名原 ProductAttributeValue 为 ProductResearchAttributeValue，新增 ProductAttributeValue 给正式产品
-- 为 Product 表添加 categoryId 外键关联 ProductCategory

-- 创建正式产品属性值表
CREATE TABLE "product_attribute_values" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" DECIMAL(20,4),
    "valueBoolean" BOOLEAN,
    "valueDate" TIMESTAMP(3),
    "valueOptions" TEXT[],
    "unit" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_attribute_values_pkey" PRIMARY KEY ("id")
);

-- 创建产品调研属性值表（原 ProductAttributeValue 重命名）
CREATE TABLE "product_research_attribute_values" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" DECIMAL(20,4),
    "valueBoolean" BOOLEAN,
    "valueDate" TIMESTAMP(3),
    "valueOptions" TEXT[],
    "unit" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_research_attribute_values_pkey" PRIMARY KEY ("id")
);

-- 添加索引
CREATE INDEX "product_attribute_values_productId_idx" ON "product_attribute_values"("productId");
CREATE INDEX "product_attribute_values_attributeId_idx" ON "product_attribute_values"("attributeId");
CREATE UNIQUE INDEX "product_attribute_values_productId_attributeId_key" ON "product_attribute_values"("productId", "attributeId");

CREATE INDEX "product_research_attribute_values_productId_idx" ON "product_research_attribute_values"("productId");
CREATE INDEX "product_research_attribute_values_attributeId_idx" ON "product_research_attribute_values"("attributeId");
CREATE UNIQUE INDEX "product_research_attribute_values_productId_attributeId_key" ON "product_research_attribute_values"("productId", "attributeId");

-- 修改 ProductCategory 添加 products 反向关系（已在 schema 修改，这里只需要记录，数据库结构不变）
-- 添加外键约束
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "attribute_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_research_attribute_values" ADD CONSTRAINT "product_research_attribute_values_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "attribute_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_research_attribute_values" ADD CONSTRAINT "product_research_attribute_values_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product_research"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Product 表已经在 schema 中添加了 categoryId 和外键关系，这里确保外键存在
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 修改 ProductCategory 中 products 关系名称（从 products 改为 productResearches，新增 products 给正式产品）
-- 这只是 Prisma 层面的关系变更，数据库结构不变
