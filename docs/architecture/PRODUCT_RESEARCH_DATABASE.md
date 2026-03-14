# 产品调研模块数据库设计文档

**日期:** 2026-03-13  
**版本:** v1.0  
**作者:** Trade ERP 系统架构师  
**模块:** Product Research (产品调研)

---

## 1. 模块概述

### 1.1 核心功能

产品调研模块是 Trade ERP 系统的核心模块之一，主要用于：
- **产品信息管理**: 记录和管理跨境电商产品的详细信息
- **动态属性系统**: 支持不同品类产品的差异化属性（EAV 模式）
- **产品对比分析**: 多款产品的参数对比和评分比较
- **市场与竞品分析**: 市场趋势分析和竞争对手产品追踪
- **备货计划**: 基于调研结果生成备货建议

### 1.2 技术特点

- **EAV 模式 (Entity-Attribute-Value)**: 支持动态属性扩展
- **品类 - 属性模板**: 不同品类有不同的属性模板
- **评分系统**: 多维度产品评分（市场、竞争、利润等）
- **附件管理**: 支持产品图片、文档等多媒体附件

---

## 2. 核心实体关系图

```
┌─────────────────────┐       ┌──────────────────────┐       ┌─────────────────────┐
│  ProductCategory    │ 1───∞ │ CategoryAttribute    │ 1───∞ │ ProductAttributeValue│
│  (品类表)           │       │ (品类属性模板)        │       │ (动态属性值)         │
└─────────────────────┘       └──────────────────────┘       └─────────────────────┘
         │                              │                              ▲
         │                              │                              │
         │ 1───∞                        │                              │
         ▼                              │                              │
┌─────────────────────┐                 │                              │
│  ProductResearch    │─────────────────┘                              │
│  (产品调研主表)      │ 1───∞                                          │
└─────────────────────┘                                                 │
         │                                                              │
         │ 1───1                                                        │
         ▼                                                              │
┌─────────────────────┐                                                 │
│  ProductBasicInfo   │                                                 │
│  (产品基础信息)      │                                                 │
└─────────────────────┘                                                 │
         │                                                              │
         │ 1───1                                                        │
         ▼                                                              │
┌─────────────────────┐                                                 │
│  MarketAnalysis     │                                                 │
│  (市场分析)         │                                                 │
└─────────────────────┘                                                 │
         │                                                              │
         │ 1───1                                                        │
         ▼                                                              │
┌─────────────────────┐                                                 │
│  CompetitionAnalysis│                                                 │
│  (竞品分析)         │                                                 │
└─────────────────────┘                                                 │
         │                                                              │
         │ 1───∞                                                        │
         ▼                                                              │
┌─────────────────────┐                                                 │
│  ProductScoreDetail │◀───────────────────────────────────────────────┘
│  (评分明细)         │
└─────────────────────┘
         │
         │ 1───∞
         ▼
┌─────────────────────┐       ┌─────────────────────┐
│  ProductAttachment  │       │   StockPlan         │
│  (附件)             │       │  (备货计划)         │
└─────────────────────┘       └─────────────────────┘
```

---

## 3. Prisma Schema 设计

### 3.1 品类管理核心表

```prisma
// ==================== 品类管理 ====================

/// 产品品类表
/// 支持多级分类（父子品类）
model ProductCategory {
  id          String    @id @default(cuid())
  categoryNo  String    @unique  // 品类编号：CAT-20260313-001
  name        String    // 品类名称（中文）
  nameEn      String?   // 品类名称（英文）
  parentId    String?   // 父品类 ID（支持多级分类）
  parent      ProductCategory? @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children    ProductCategory[] @relation("CategoryHierarchy")
  
  // 品类描述
  description String?   @db.Text
  keywords    String[]  // 搜索关键词
  
  // 层级路径（便于查询）
  level       Int       @default(1)  // 层级：1=一级，2=二级...
  path        String?   // 层级路径：/1/5/12/
  
  // 状态
  isActive    Boolean   @default(true)
  sort        Int       @default(0)  // 排序权重
  
  // 统计
  productCount Int      @default(0)  // 产品数量（冗余字段）
  
  // 关联
  attributes  CategoryAttribute[]
  products    ProductResearch[]
  
  // 时间戳
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  // 索引
  @@index([parentId])
  @@index([level])
  @@index([isActive])
  @@index([name])
  
  @@map("product_categories")
}

/// 品类属性模板表
/// 定义每个品类有哪些属性（EAV 模式的 Attribute 定义）
model CategoryAttribute {
  id          String    @id @default(cuid())
  categoryId  String
  category    ProductCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  
  // 属性定义
  name        String    // 属性名：颜色、尺寸、材质...
  nameEn      String?   // 属性名（英文）
  code        String    // 属性代码：color, size, material...
  
  // 属性类型
  type        AttributeType @default(TEXT)
  
  // 输入配置
  isRequired  Boolean   @default(false)  // 是否必填
  isSearchable Boolean  @default(true)   // 是否可搜索
  isComparable Boolean  @default(true)   // 是否可对比
  displayOrder Int      @default(0)      // 显示顺序
  
  // 选项值（针对 SELECT/MULTI_SELECT 类型）
  options     Json?     // [{"value": "red", "label": "红色"}, ...]
  
  // 验证规则
  validation  String?   @db.Text  // 正则表达式或验证规则
  minValue    Decimal?  @db.Decimal(12, 2)  // 最小值（数字类型）
  maxValue    Decimal?  @db.Decimal(12, 2)  // 最大值（数字类型）
  unit        String?   // 单位：cm, kg, USD...
  
  // 备注
  description String?   @db.Text
  example     String?   // 示例值
  
  // 关联
  values      ProductAttributeValue[]
  
  // 时间戳
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  // 索引
  @@index([categoryId])
  @@index([code])
  @@unique([categoryId, code])  // 同一品类下属性代码唯一
  
  @@map("category_attributes")
}

enum AttributeType {
  TEXT          // 文本
  NUMBER        // 数字
  DECIMAL       // 小数
  BOOLEAN       // 布尔
  SELECT        // 单选
  MULTI_SELECT  // 多选
  DATE          // 日期
  URL           // 链接
  IMAGE         // 图片
  RICH_TEXT     // 富文本
}
```

### 3.2 产品调研核心表

```prisma
// ==================== 产品调研主表 ====================

/// 产品调研主表
/// 核心实体，记录产品调研的基本信息
model ProductResearch {
  id          String    @id @default(cuid())
  productNo   String    @unique  // 产品编号：PRD-20260313-001
  
  // 关联品类
  categoryId  String
  category    ProductCategory @relation(fields: [categoryId], references: [id])
  
  // 产品标识
  title       String    // 产品标题
  titleEn     String?   // 产品标题（英文）
  sku         String?   // SKU 编码
  mpn         String?   // 制造商零件号 (Manufacturer Part Number)
  brand       String?   // 品牌
  brandEn     String?   // 品牌（英文）
  
  // 产品状态
  status      ProductStatus @default(DRAFT)
  stage       ResearchStage @default(INITIAL)  // 调研阶段
  
  // 基础信息关联（1 对 1）
  basicInfo   ProductBasicInfo?
  marketAnalysis MarketAnalysis?
  competitionAnalysis CompetitionAnalysis?
  
  // 动态属性值（EAV 模式）
  attributeValues ProductAttributeValue[]
  
  // 评分明细
  scoreDetails ProductScoreDetail[]
  
  // 附件
  attachments ProductAttachment[]
  
  // 备货计划
  stockPlans StockPlan[]
  
  // 负责人
  ownerId     String?
  owner       User?     @relation("ProductResearcher", fields: [ownerId], references: [id])
  
  // 备注
  notes       String?   @db.Text
  internalNotes String? @db.Text  // 内部备注
  
  // 时间戳
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  publishedAt DateTime? // 发布时间（状态变为 PUBLISHED 时）
  
  // 索引
  @@index([categoryId])
  @@index([status])
  @@index([stage])
  @@index([brand])
  @@index([ownerId])
  @@index([createdAt])
  @@index([productNo])
  
  @@map("product_research")
}

enum ProductStatus {
  DRAFT       // 草稿
  IN_REVIEW   // 审核中
  PUBLISHED   // 已发布
  ARCHIVED    // 已归档
  REJECTED    // 已驳回
}

enum ResearchStage {
  INITIAL     // 初步调研
  DEEP_DIVE   // 深度调研
  DECISION    // 决策阶段
  TRACKING    // 追踪阶段
}

/// 产品基础信息表
/// 存储产品的标准化基础信息（1 对 1 关联）
model ProductBasicInfo {
  id              String    @id @default(cuid())
  productResearchId String  @unique
  productResearch ProductResearch @relation(fields: [productResearchId], references: [id], onDelete: Cascade)
  
  // 产品描述
  description     String?   @db.Text
  descriptionEn   String?   @db.Text  // 英文描述
  
  // 规格参数
  specification   String?   @db.Text  // 规格描述
  material        String?   // 材质
  color           String?   // 颜色
  size            String?   // 尺寸
  weight          Decimal?  @db.Decimal(10, 2)  // 重量 (kg)
  volume          Decimal?  @db.Decimal(10, 2)  // 体积 (m³)
  
  // 包装信息
  packageSize     String?   // 包装尺寸：L×W×H cm
  packageWeight   Decimal?  @db.Decimal(10, 2)  // 包装重量 (kg)
  packageType     String?   // 包装类型：纸箱/木箱/...
  
  // 认证信息
  certifications  String[]  // 认证列表：CE, FCC, RoHS...
  
  // 产地信息
  originCountry   String?   @default("CN")
  originProvince  String?
  originCity      String?
  
  // 产品图片
  mainImage       String?   // 主图 URL
  images          String[]  // 图片 URL 数组
  
  // HS 编码
  hsCode          String?   // 海关编码
  
  // 时间戳
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([productResearchId])
  
  @@map("product_basic_info")
}
```

### 3.3 动态属性值表（EAV 核心）

```prisma
/// 产品属性值表
/// EAV 模式的核心：存储每个产品的具体属性值
model ProductAttributeValue {
  id              String    @id @default(cuid())
  
  // 关联
  productResearchId String
  productResearch ProductResearch @relation(fields: [productResearchId], references: [id], onDelete: Cascade)
  
  attributeId     String
  attribute       CategoryAttribute @relation(fields: [attributeId], references: [id], onDelete: Cascade)
  
  // 属性值（根据类型存储不同格式）
  valueText       String?   @db.Text  // 文本值
  valueNumber     Int?                // 整数值
  valueDecimal    Decimal?  @db.Decimal(12, 4)  // 小数值
  valueBoolean    Boolean?            // 布尔值
  valueDate       DateTime?           // 日期值
  valueJson       Json?               // 复杂值（多选/富文本等）
  
  // 统一值字段（用于搜索和对比）
  valueUnified    String?   @db.Text  // 统一字符串表示
  
  // 备注
  note            String?   @db.Text
  
  // 时间戳
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // 索引
  @@index([productResearchId])
  @@index([attributeId])
  @@index([valueUnified])
  @@unique([productResearchId, attributeId])  // 同一产品的同一属性唯一
  
  @@map("product_attribute_values")
}
```

### 3.4 市场与竞品分析表

```prisma
// ==================== 市场分析 ====================

/// 市场分析表
/// 记录产品的市场环境和趋势分析
model MarketAnalysis {
  id              String    @id @default(cuid())
  productResearchId String  @unique
  productResearch ProductResearch @relation(fields: [productResearchId], references: [id], onDelete: Cascade)
  
  // 市场规模
  marketSize      Decimal?  @db.Decimal(14, 2)  // 市场规模（USD）
  marketGrowth    Decimal?  @db.Decimal(5, 2)   // 市场增长率（%）
  marketTrend     MarketTrend @default(STABLE)
  
  // 目标市场
  targetMarkets   String[]  // 目标市场列表：["US", "EU", "JP"]
  targetCustomers String?   @db.Text  // 目标客户群体描述
  
  // 价格分析
  priceRangeMin   Decimal?  @db.Decimal(10, 2)  // 市场价格区间 - 最低
  priceRangeMax   Decimal?  @db.Decimal(10, 2)  // 市场价格区间 - 最高
  priceRangeAvg   Decimal?  @db.Decimal(10, 2)  // 市场价格区间 - 平均
  suggestedPrice  Decimal?  @db.Decimal(10, 2)  // 建议售价
  
  // 需求分析
  demandLevel     DemandLevel @default(MEDIUM)
  seasonality     String?   @db.Text  // 季节性特征
  demandTrend     String?   @db.Text  // 需求趋势描述
  
  // 渠道分析
  salesChannels   String[]  // 销售渠道：["Amazon", "eBay", "Shopify"]
  channelNotes    String?   @db.Text
  
  // SWOT 分析
  strengths       String?   @db.Text
  weaknesses      String?   @db.Text
  opportunities   String?   @db.Text
  threats         String?   @db.Text
  
  // 数据来源
  dataSources     String[]  // 数据来源列表
  researchDate    DateTime? @default(now())
  
  // 备注
  notes           String?   @db.Text
  
  // 时间戳
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([productResearchId])
  
  @@map("market_analysis")
}

enum MarketTrend {
  GROWING     // 增长
  STABLE      // 稳定
  DECLINING   // 衰退
  VOLATILE    // 波动
}

enum DemandLevel {
  VERY_HIGH   // 非常高
  HIGH        // 高
  MEDIUM      // 中
  LOW         // 低
  VERY_LOW    // 非常低
}

// ==================== 竞品分析 ====================

/// 竞品分析表
/// 记录竞争对手产品信息和对比分析
model CompetitionAnalysis {
  id              String    @id @default(cuid())
  productResearchId String  @unique
  productResearch ProductResearch @relation(fields: [productResearchId], references: [id], onDelete: Cascade)
  
  // 竞品信息列表（JSON 存储多个竞品）
  competitors     Json?     // [{name, brand, price, rating, features, url}, ...]
  
  // 主要竞争对手
  mainCompetitors String[]  // 主要竞争对手品牌/公司名
  
  // 竞争格局
  competitionLevel CompetitionLevel @default(MEDIUM)
  marketConcentration String? @db.Text  // 市场集中度描述
  
  // 竞品对比
  ourAdvantages   String?   @db.Text  // 我们的优势
  ourDisadvantages String?  @db.Text  // 我们的劣势
  
  // 价格对比
  pricePosition   PricePosition @default(MID_RANGE)
  priceStrategy   String?   @db.Text  // 定价策略
  
  // 差异化分析
  differentiation String?   @db.Text  // 差异化策略
  
  // 进入壁垒
  barriers        String?   @db.Text  // 进入壁垒分析
  
  // 数据来源
  dataSources     String[]
  researchDate    DateTime? @default(now())
  
  // 备注
  notes           String?   @db.Text
  
  // 时间戳
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([productResearchId])
  
  @@map("competition_analysis")
}

enum CompetitionLevel {
  VERY_LOW    // 非常低
  LOW         // 低
  MEDIUM      // 中
  HIGH        // 高
  VERY_HIGH   // 非常高
}

enum PricePosition {
  PREMIUM     // 高端
  MID_HIGH    // 中高端
  MID_RANGE   // 中端
  MID_LOW     // 中低端
  BUDGET      // 低端
}
```

### 3.5 评分明细表

```prisma
/// 产品评分明细表
/// 记录产品在各维度的评分（支持多维度、多版本评分）
model ProductScoreDetail {
  id              String    @id @default(cuid())
  productResearchId String
  productResearch ProductResearch @relation(fields: [productResearchId], references: [id], onDelete: Cascade)
  
  // 评分版本（支持多次评分）
  version         Int       @default(1)
  isLatest        Boolean   @default(true)  // 是否最新版本
  
  // 评分维度（1-10 分）
  marketScore     Decimal   @db.Decimal(3, 2)  // 市场评分
  competitionScore Decimal  @db.Decimal(3, 2)  // 竞争评分
  profitScore     Decimal   @db.Decimal(3, 2)  // 利润评分
  supplyScore     Decimal   @db.Decimal(3, 2)  // 供应链评分
  riskScore       Decimal   @db.Decimal(3, 2)  // 风险评分（越低越好）
  
  // 综合评分（加权平均）
  totalScore      Decimal   @db.Decimal(3, 2)
  
  // 权重配置
  marketWeight    Decimal   @default(0.25) @db.Decimal(3, 2)
  competitionWeight Decimal @default(0.20) @db.Decimal(3, 2)
  profitWeight    Decimal   @default(0.25) @db.Decimal(3, 2)
  supplyWeight    Decimal   @default(0.15) @db.Decimal(3, 2)
  riskWeight      Decimal   @default(0.15) @db.Decimal(3, 2)
  
  // 评分等级
  grade           ScoreGrade @default(C)  // S/A/B/C/D
  
  // 推荐意见
  recommendation  Recommendation @default(HOLD)
  recommendationNotes String? @db.Text
  
  // 评分人
  scoredBy        String?
  scoredByName    String?
  
  // 备注
  notes           String?   @db.Text
  
  // 时间戳
  createdAt       DateTime  @default(now())
  
  // 索引
  @@index([productResearchId])
  @@index([version])
  @@index([isLatest])
  @@index([totalScore])
  
  @@map("product_score_details")
}

enum ScoreGrade {
  S   // 90-100: 强烈推荐
  A   // 80-89: 推荐
  B   // 70-79: 可行
  C   // 60-69: 谨慎
  D   // 0-59: 不推荐
}

enum Recommendation {
  STRONG_BUY  // 强烈推荐
  BUY         // 推荐
  HOLD        // 观望
  CAUTION     // 谨慎
  AVOID       // 避免
}
```

### 3.6 附件与备货计划表

```prisma
// ==================== 附件管理 ====================

/// 产品附件表
/// 存储产品相关的图片、文档等附件
model ProductAttachment {
  id              String    @id @default(cuid())
  productResearchId String
  productResearch ProductResearch @relation(fields: [productResearchId], references: [id], onDelete: Cascade)
  
  // 附件信息
  name            String    // 附件名称
  type            AttachmentType
  mimeType        String    // MIME 类型
  size            Int       // 文件大小（字节）
  url             String    @db.Text  // 存储路径/URL
  
  // 分类
  category        AttachmentCategory  // 分类：产品图/证书/文档...
  
  // 描述
  description     String?   @db.Text
  tags            String[]  // 标签
  
  // 排序
  sort            Int       @default(0)
  
  // 上传信息
  uploadedBy      String?
  uploadedByName  String?
  
  // 时间戳
  createdAt       DateTime  @default(now())
  
  // 索引
  @@index([productResearchId])
  @@index([type])
  @@index([category])
  
  @@map("product_attachments")
}

enum AttachmentType {
  IMAGE       // 图片
  DOCUMENT    // 文档
  SPREADSHEET // 表格
  PDF         // PDF
  VIDEO       // 视频
  OTHER       // 其他
}

enum AttachmentCategory {
  PRODUCT_IMAGE     // 产品图片
  CERTIFICATE       // 认证证书
  SPEC_SHEET        // 规格书
  PACKAGING         // 包装图
  QUALITY_REPORT    // 质检报告
  OTHER             // 其他
}

// ==================== 备货计划 ====================

/// 备货计划表
/// 基于产品调研结果生成的备货建议
model StockPlan {
  id              String    @id @default(cuid())
  productResearchId String
  productResearch ProductResearch @relation(fields: [productResearchId], references: [id])
  
  // 计划信息
  planNo          String    @unique  // 计划编号：SP-20260313-001
  planName        String    // 计划名称
  
  // 备货数量
  quantity        Int       // 备货数量
  unit            String    @default("PCS")  // 单位
  
  // 成本估算
  unitCost        Decimal   @db.Decimal(10, 2)  // 单位成本
  totalCost       Decimal   @db.Decimal(12, 2)  // 总成本
  shippingCost    Decimal?  @db.Decimal(10, 2)  // 运费
  otherCost       Decimal?  @db.Decimal(10, 2)  // 其他费用
  
  // 销售预测
  expectedPrice   Decimal   @db.Decimal(10, 2)  // 预期售价
  expectedSales   Int       // 预期销量
  expectedRevenue Decimal   @db.Decimal(12, 2)  // 预期收入
  expectedProfit  Decimal   @db.Decimal(12, 2)  // 预期利润
  profitMargin    Decimal   @db.Decimal(5, 2)   // 利润率（%）
  
  // 时间计划
  planDate        DateTime  @default(now())  // 计划日期
  purchaseDate    DateTime? // 采购日期
  arrivalDate     DateTime? // 到货日期
  selloutDate     DateTime? // 预计售罄日期
  
  // 状态
  status          StockPlanStatus @default(DRAFT)
  
  // 关联采购单
  purchaseOrderId String?
  
  // 备注
  notes           String?   @db.Text
  
  // 时间戳
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // 索引
  @@index([productResearchId])
  @@index([status])
  @@index([planDate])
  
  @@map("stock_plans")
}

enum StockPlanStatus {
  DRAFT       // 草稿
  PENDING     // 待审批
  APPROVED    // 已批准
  IN_PURCHASE // 采购中
  COMPLETED   // 已完成
  CANCELLED   // 已取消
}
```

### 3.7 用户模型扩展

```prisma
// 需要在现有 User 模型中添加关联
model User {
  // ... 现有字段 ...
  
  // 产品调研关联
  researchedProducts ProductResearch[] @relation("ProductResearcher")
  
  // ... 现有关联 ...
}
```

---

## 4. 数据库索引优化

### 4.1 核心查询索引

```prisma
// 产品调研表
@@index([categoryId, status])
@@index([status, stage])
@@index([brand, status])
@@index([ownerId, createdAt])
@@index([createdAt])

// 属性值表（EAV 查询优化）
@@index([productResearchId, attributeId])
@@index([attributeId, valueUnified])

// 评分表
@@index([productResearchId, isLatest])
@@index([totalScore])

// 品类表
@@index([parentId, isActive])
@@index([level, sort])
```

### 4.2 全文搜索索引（PostgreSQL）

```sql
-- 产品搜索索引
CREATE INDEX product_research_search_idx ON product_research 
USING GIN (to_tsvector('simple', title || ' ' || COALESCE(description, '')));

-- 属性值搜索索引
CREATE INDEX attribute_value_search_idx ON product_attribute_values 
USING GIN (to_tsvector('simple', COALESCE(value_text, '')));
```

---

## 5. 数据完整性约束

### 5.1 触发器建议

```sql
-- 自动更新品类产品数量
CREATE OR REPLACE FUNCTION update_category_product_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE product_categories SET product_count = product_count + 1
    WHERE id = NEW.category_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE product_categories SET product_count = product_count - 1
    WHERE id = OLD.category_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_category_product_count
AFTER INSERT OR DELETE ON product_research
FOR EACH ROW EXECUTE FUNCTION update_category_product_count();

-- 自动计算综合评分
CREATE OR REPLACE FUNCTION calculate_product_total_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_score := (
    NEW.market_score * NEW.market_weight +
    NEW.competition_score * NEW.competition_weight +
    NEW.profit_score * NEW.profit_weight +
    NEW.supply_score * NEW.supply_weight +
    NEW.risk_score * NEW.risk_weight
  );
  
  -- 自动设置等级
  IF NEW.total_score >= 90 THEN NEW.grade := 'S';
  ELSIF NEW.total_score >= 80 THEN NEW.grade := 'A';
  ELSIF NEW.total_score >= 70 THEN NEW.grade := 'B';
  ELSIF NEW.total_score >= 60 THEN NEW.grade := 'C';
  ELSE NEW.grade := 'D';
  END IF;
  
  -- 自动设置推荐意见
  IF NEW.total_score >= 85 THEN NEW.recommendation := 'STRONG_BUY';
  ELSIF NEW.total_score >= 75 THEN NEW.recommendation := 'BUY';
  ELSIF NEW.total_score >= 65 THEN NEW.recommendation := 'HOLD';
  ELSIF NEW.total_score >= 55 THEN NEW.recommendation := 'CAUTION';
  ELSE NEW.recommendation := 'AVOID';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_total_score
BEFORE INSERT OR UPDATE ON product_score_details
FOR EACH ROW EXECUTE FUNCTION calculate_product_total_score();
```

### 5.2 视图建议

```sql
-- 产品调研概览视图
CREATE VIEW product_research_overview AS
SELECT 
  pr.id,
  pr.product_no,
  pr.title,
  pc.name AS category_name,
  pr.status,
  pr.stage,
  ps.total_score,
  ps.grade,
  ps.recommendation,
  pr.owner_id,
  pr.created_at
FROM product_research pr
LEFT JOIN product_categories pc ON pr.category_id = pc.id
LEFT JOIN (
  SELECT product_research_id, total_score, grade, recommendation
  FROM product_score_details
  WHERE is_latest = true
) ps ON pr.id = ps.product_research_id;

-- 产品属性对比视图（透视表）
CREATE VIEW product_attribute_comparison AS
SELECT 
  pav.product_research_id,
  pr.title,
  ca.code AS attribute_code,
  ca.name AS attribute_name,
  pav.value_unified
FROM product_attribute_values pav
JOIN category_attributes ca ON pav.attribute_id = ca.id
JOIN product_research pr ON pav.product_research_id = pr.id
WHERE ca.is_comparable = true;
```

---

## 6. 数据迁移计划

### 6.1 迁移步骤

```bash
# 1. 创建 Prisma 迁移
npx prisma migrate dev --name add_product_research_module

# 2. 生成 Prisma Client
npx prisma generate

# 3. 数据填充（可选）
npx prisma db seed
```

### 6.2 种子数据

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 创建示例品类
  const electronics = await prisma.productCategory.create({
    data: {
      categoryNo: 'CAT-ELECTRONICS-001',
      name: '消费电子',
      nameEn: 'Consumer Electronics',
      level: 1,
      path: '/1/',
    },
  });

  // 创建品类属性模板
  await prisma.categoryAttribute.createMany({
    data: [
      { categoryId: electronics.id, name: '颜色', code: 'color', type: 'SELECT', options: [...] },
      { categoryId: electronics.id, name: '尺寸', code: 'size', type: 'TEXT' },
      { categoryId: electronics.id, name: '重量', code: 'weight', type: 'DECIMAL', unit: 'kg' },
      { categoryId: electronics.id, name: '电池容量', code: 'battery', type: 'NUMBER', unit: 'mAh' },
    ],
  });

  console.log('产品调研模块种子数据创建完成');
}

main();
```

---

## 7. 性能优化建议

### 7.1 EAV 查询优化

```typescript
// ❌ 低效：多次查询
const attributes = await prisma.categoryAttribute.findMany({ where: { categoryId } });
for (const attr of attributes) {
  const value = await prisma.productAttributeValue.findUnique({ ... });
}

// ✅ 高效：单次查询 + 内存处理
const values = await prisma.productAttributeValue.findMany({
  where: { productResearchId },
  include: { attribute: true },
});
const valueMap = values.reduce((map, v) => {
  map[v.attribute.code] = v;
  return map;
}, {});
```

### 7.2 对比功能优化

```typescript
// 产品对比查询（批量加载属性值）
async function compareProducts(productIds: string[]) {
  const products = await prisma.productResearch.findMany({
    where: { id: { in: productIds } },
    include: {
      category: true,
      basicInfo: true,
      attributeValues: {
        include: { attribute: true },
        orderBy: { attribute: { displayOrder: 'asc' } },
      },
      scoreDetails: {
        where: { isLatest: true },
      },
    },
  });
  
  return products;
}
```

---

*文档结束*
