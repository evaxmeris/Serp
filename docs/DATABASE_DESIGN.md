# Trade ERP 数据库设计文档

**日期:** 2026-03-06  
**版本:** v1.0  
**作者:** 系统架构师

---

## 1. 订单管理模块数据库设计

### 1.1 核心实体关系图

```
┌─────────────┐       ┌──────────────┐       ┌─────────────┐
│  Customer   │ 1───∞ │    Order     │ 1───∞ │  OrderItem  │
└─────────────┘       └──────────────┘       └─────────────┘
      │                      │                      │
      │                      │ 1───∞                │
      │                      ▼                      │
      │               ┌──────────────┐              │
      │               │   Payment    │              │
      │               └──────────────┘              │
      │                      │                      │
      │                      │ 1───∞                │
      │                      ▼                      │
      │               ┌──────────────┐              │
      │               │  Shipment    │              │
      │               └──────────────┘              │
      │                                            │
      └────────────────────────────────────────────┘
                         引用
```

### 1.2 Order 模型增强设计

```prisma
model Order {
  id                  String    @id @default(cuid())
  orderNo             String    @unique  // 订单号：SO-20260306-001
  customerId          String
  customer            Customer  @relation(fields: [customerId], references: [id])
  
  // 溯源字段
  sourceInquiryId     String?   // 来源询盘
  sourceQuotationId   String?   // 来源报价单
  
  // 订单基本信息
  status              OrderStatus @default(PENDING)
  currency            String    @default("USD")
  exchangeRate        Decimal   @default(1) @db.Decimal(10, 6)  // 汇率
  totalAmount         Decimal   @db.Decimal(12, 2)  // 总金额
  paidAmount          Decimal   @db.Decimal(12, 2) @default(0)  // 已付金额
  balanceAmount       Decimal   @db.Decimal(12, 2) @default(0)  // 余额（计算字段）
  
  // 交易条款
  paymentTerms        String?   // 付款条件：T/T 30% deposit, 70% before shipment
  paymentDeadline     DateTime? // 付款截止日期
  deliveryTerms       String?   // 交货条款：FOB/CIF/EXW
  deliveryDate        DateTime? // 交货日期
  deliveryDeadline    DateTime? // 交货截止日期
  
  // 收货地址
  shippingAddress     String?   @db.Text
  shippingContact     String?   // 收货联系人
  shippingPhone       String?   // 收货电话
  
  // 业务员
  salesRepId          String?
  salesRep            User?     @relation("SalesRep", fields: [salesRepId], references: [id])
  
  // 审批状态
  approvalStatus      ApprovalStatus @default(NOT_REQUIRED)
  approvedBy          String?
  approvedAt          DateTime?
  
  // 备注和附件
  notes               String?   @db.Text
  internalNotes       String?   @db.Text  // 内部备注，客户不可见
  attachments         String[]  // 附件 URL 数组
  
  // 时间戳
  confirmedAt         DateTime? // 确认时间
  completedAt         DateTime? // 完成时间
  cancelledAt         DateTime? // 取消时间
  cancelReason        String?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  // 关联
  items               OrderItem[]
  payments            Payment[]
  shipments           Shipment[]
  productionRecords   ProductionRecord[]  // 生产记录
  qualityChecks       QualityCheck[]      // 质检记录
  
  // 索引
  @@index([customerId, status])
  @@index([salesRepId, createdAt])
  @@index([status, deliveryDate])
  @@index([createdAt])
  @@index([orderNo])
  
  @@map("orders")
}

enum OrderStatus {
  PENDING        // 待确认
  CONFIRMED      // 已确认
  IN_PRODUCTION  // 生产中
  READY          // 待发货
  SHIPPED        // 已发货
  DELIVERED      // 已送达
  COMPLETED      // 已完成
  CANCELLED      // 已取消
}

enum ApprovalStatus {
  NOT_REQUIRED   // 无需审批
  PENDING        // 待审批
  APPROVED       // 已批准
  REJECTED       // 已拒绝
}
```

### 1.3 OrderItem 模型增强设计

```prisma
model OrderItem {
  id              String    @id @default(cuid())
  orderId         String
  order           Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  
  // 产品信息
  productId       String?
  product         Product?  @relation(fields: [productId], references: [id])
  productName     String    // 产品名称（快照）
  productSku      String?   // 产品 SKU（快照）
  specification   String?   @db.Text  // 规格（快照）
  
  // 数量和价格
  quantity        Int       @default(1)
  unit            String    @default("PCS")  // 单位
  unitPrice       Decimal   @db.Decimal(10, 2)
  discountRate    Decimal   @default(0) @db.Decimal(5, 2)  // 折扣率
  amount          Decimal   @db.Decimal(12, 2)  // 小计金额
  
  // 生产信息
  productionStatus ProductionStatus @default(NOT_STARTED)
  productionNote  String?   @db.Text
  estimatedProductionDate DateTime?  // 预计生产完成日期
  actualProductionDate    DateTime?  // 实际生产完成日期
  
  // 发货信息
  shippedQty      Int       @default(0)  // 已发货数量
  deliveredQty    Int       @default(0)  // 已送达数量
  
  // 产品信息（详细快照）
  productImage    String?   // 产品图片
  productWeight   Decimal?  @db.Decimal(10, 2)  // 单品重量
  productVolume   Decimal?  @db.Decimal(10, 2)  // 单品体积
  hsCode          String?   // HS 编码
  originCountry   String?   @default("CN")  // 原产国
  
  // 备注
  notes           String?   @db.Text
  
  // 时间戳
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // 索引
  @@index([orderId])
  @@index([productId])
  
  @@map("order_items")
}

enum ProductionStatus {
  NOT_STARTED    // 未开始
  IN_PROGRESS    // 生产中
  COMPLETED      // 已完成
  DELAYED        // 延期
}
```

### 1.4 新增：生产记录模型

```prisma
model ProductionRecord {
  id              String    @id @default(cuid())
  orderId         String
  order           Order     @relation(fields: [orderId], references: [id])
  
  // 生产信息
  productionNo    String    @unique  // 生产单号
  productId       String?
  quantity        Int
  plannedStartDate DateTime
  plannedEndDate  DateTime
  actualStartDate DateTime?
  actualEndDate   DateTime?
  
  // 生产状态
  status          ProductionRecordStatus @default(PLANNED)
  progress        Int       @default(0)  // 进度百分比 0-100
  
  // 负责部门/工厂
  department      String?
  factory         String?
  supervisor      String?   // 负责人
  
  // 备注
  notes           String?   @db.Text
  
  // 时间戳
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // 索引
  @@index([orderId])
  @@index([status])
  
  @@map("production_records")
}

enum ProductionRecordStatus {
  PLANNED        // 已计划
  IN_PROGRESS    // 进行中
  COMPLETED      // 已完成
  ON_HOLD        // 暂停
  CANCELLED      // 已取消
}
```

### 1.5 新增：质检记录模型

```prisma
model QualityCheck {
  id              String    @id @default(cuid())
  orderId         String
  order           Order     @relation(fields: [orderId], references: [id])
  
  // 质检信息
  qcNo            String    @unique  // 质检单号
  type            QualityCheckType @default(FINAL)
  inspector       String?   // 质检员
  inspectionDate  DateTime  @default(now())
  
  // 质检结果
  status          QualityCheckStatus @default(PENDING)
  passRate        Decimal?  @db.Decimal(5, 2)  // 合格率
  defectCount     Int?      @default(0)  // 不良品数量
  defectReasons   String[]  // 不良原因列表
  
  // 质检项目
  items           QualityCheckItem[]
  
  // 附件
  photos          String[]  // 质检照片
  report          String?   // 质检报告
  
  // 备注
  notes           String?   @db.Text
  
  // 时间戳
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // 索引
  @@index([orderId])
  @@index([status])
  
  @@map("quality_checks")
}

enum QualityCheckType {
  RAW_MATERIAL   // 来料检验
  IN_PROCESS     // 过程检验
  FINAL          // 最终检验
  PRE_SHIPMENT   // 出货前检验
}

enum QualityCheckStatus {
  PENDING        // 待检验
  IN_PROGRESS    // 检验中
  PASSED         // 合格
  FAILED         // 不合格
  CONDITIONAL    // 条件接收
}

model QualityCheckItem {
  id              String    @id @default(cuid())
  qualityCheckId  String
  qualityCheck    QualityCheck @relation(fields: [qualityCheckId], references: [id], onDelete: Cascade)
  
  itemName        String    // 检验项目
  standard        String?   // 标准
  result          String?   // 结果
  passed          Boolean   // 是否通过
  
  @@map("quality_check_items")
}
```

---

## 2. 采购管理模块数据库设计

### 2.1 核心实体关系图

```
┌─────────────┐       ┌──────────────────┐       ┌───────────────────┐
│  Supplier   │ 1───∞ │  PurchaseOrder   │ 1───∞ │ PurchaseOrderItem │
└─────────────┘       └──────────────────┘       └───────────────────┘
                             │
                             │ 1───∞
                             ▼
                      ┌──────────────────┐
                      │  PurchaseReceipt │  采购入库单
                      └──────────────────┘
```

### 2.2 Supplier 模型增强设计

```prisma
model Supplier {
  id              String    @id @default(cuid())
  supplierNo      String    @unique  // 供应商编号：SUP-20260306-001
  companyName     String
  companyEn       String?   // 英文名称
  contactName     String?
  contactTitle    String?   // 职位
  email           String?
  phone           String?
  mobile          String?   // 手机
  fax             String?
  
  // 地址信息
  address         String?   @db.Text
  city            String?
  province        String?
  country         String?   @default("CN")
  postalCode      String?
  
  // 企业信息
  website         String?
  taxId           String?   // 税号/统一社会信用代码
  businessLicense String?   // 营业执照号
  bankName        String?   // 开户行
  bankAccount     String?   // 银行账号
  bankCode        String?   // 银行联行号
  
  // 供应产品
  products        String?   @db.Text  // 供应产品描述
  categories      String[]  // 供应品类
  
  // 状态和评级
  status          SupplierStatus @default(ACTIVE)
  type            SupplierType @default(DOMESTIC)  // 国内/国外
  level           SupplierLevel @default(NORMAL)    // 供应商等级
  score           Decimal?  @db.Decimal(3, 2)  // 评分 0-5
  
  // 商务条款
  creditTerms     String?   // 账期：月结 30 天/货到付款等
  paymentMethods  String[]  // 支持的付款方式
  currency        String    @default("CNY")  // 结算币种
  minOrderAmount  Decimal?  @db.Decimal(12, 2)  // 最小订单金额
  
  // 业务统计
  totalOrders     Int       @default(0)  // 累计订单数
  totalAmount     Decimal   @default(0) @db.Decimal(14, 2)  // 累计采购金额
  lastOrderDate   DateTime?
  
  // 负责人
  ownerId         String?
  owner           User?     @relation("Purchaser", fields: [ownerId], references: [id])
  
  // 备注
  notes           String?   @db.Text
  attachments     String[]  // 附件（营业执照、合同等）
  
  // 时间戳
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // 关联
  purchaseOrders  PurchaseOrder[]
  contacts        SupplierContact[]
  evaluations     SupplierEvaluation[]
  
  // 索引
  @@index([status])
  @@index([companyName])
  @@index([ownerId])
  
  @@map("suppliers")
}

enum SupplierStatus {
  ACTIVE         // 正常
  INACTIVE       // 停用
  BLACKLISTED    // 拉黑
  PENDING        // 待审核
}

enum SupplierType {
  DOMESTIC       // 国内供应商
  OVERSEAS       // 海外供应商
}

enum SupplierLevel {
  STRATEGIC      // 战略供应商
  PREFERRED      // 优先供应商
  NORMAL         // 普通供应商
  RESTRICTED     // 限制供应商
}
```

### 2.3 新增：供应商联系人模型

```prisma
model SupplierContact {
  id          String   @id @default(cuid())
  supplierId  String
  supplier    Supplier @relation(fields: [supplierId], references: [id], onDelete: Cascade)
  
  name        String
  title       String?   // 职位
  department  String?   // 部门
  email       String?
  phone       String?
  mobile      String?
  wechat      String?   // 微信
  qq          String?
  isPrimary   Boolean  @default(false)
  notes       String?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([supplierId])
  
  @@map("supplier_contacts")
}
```

### 2.4 PurchaseOrder 模型增强设计

```prisma
model PurchaseOrder {
  id              String    @id @default(cuid())
  poNo            String    @unique  // 采购单号：PO-20260306-001
  
  // 供应商
  supplierId      String
  supplier        Supplier  @relation(fields: [supplierId], references: [id])
  
  // 关联的销售订单
  salesOrderId    String?   // 关联的销售订单
  salesOrder      Order?    @relation(fields: [salesOrderId], references: [id])
  
  // 订单状态
  status          PurchaseOrderStatus @default(PENDING)
  approvalStatus  ApprovalStatus @default(NOT_REQUIRED)
  
  // 金额信息
  currency        String    @default("CNY")
  exchangeRate    Decimal   @default(1) @db.Decimal(10, 6)
  totalAmount     Decimal   @db.Decimal(12, 2)
  paidAmount      Decimal   @db.Decimal(12, 2) @default(0)
  balanceAmount   Decimal   @db.Decimal(12, 2) @default(0)
  
  // 交货条款
  deliveryDate    DateTime?
  deliveryDeadline DateTime?
  deliveryAddress String?   @db.Text
  shippingMethod  String?   // 运输方式
  
  // 付款条款
  paymentTerms    String?   // 付款条件
  paymentDeadline DateTime?
  
  // 负责人
  purchaserId     String?
  purchaser       User?     @relation("Purchaser", fields: [purchaserId], references: [id])
  
  // 备注
  notes           String?   @db.Text
  internalNotes   String?   @db.Text
  attachments     String[]
  
  // 时间戳
  confirmedAt     DateTime?
  completedAt     DateTime?
  cancelledAt     DateTime?
  cancelReason    String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // 关联
  items           PurchaseOrderItem[]
  receipts        PurchaseReceipt[]
  payments        SupplierPayment[]
  
  // 索引
  @@index([supplierId, status])
  @@index([salesOrderId])
  @@index([status, deliveryDate])
  @@index([createdAt])
  
  @@map("purchase_orders")
}

enum PurchaseOrderStatus {
  PENDING        // 待确认
  CONFIRMED      // 已确认
  IN_PRODUCTION  // 生产中
  READY          // 待收货
  RECEIVED       // 已收货
  COMPLETED      // 已完成
  CANCELLED      // 已取消
}
```

### 2.5 PurchaseOrderItem 模型增强设计

```prisma
model PurchaseOrderItem {
  id              String    @id @default(cuid())
  purchaseOrderId String
  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
  
  // 产品信息
  productId       String?
  product         Product?  @relation(fields: [productId], references: [id])
  productName     String
  productSku      String?
  specification   String?   @db.Text
  unit            String    @default("PCS")
  
  // 数量和价格
  quantity        Int       @default(1)
  unitPrice       Decimal   @db.Decimal(10, 2)
  discountRate    Decimal   @default(0) @db.Decimal(5, 2)
  amount          Decimal   @db.Decimal(12, 2)
  taxRate         Decimal   @default(0) @db.Decimal(5, 2)  // 税率
  taxAmount       Decimal   @db.Decimal(12, 2) @default(0)  // 税额
  
  // 收货情况
  receivedQty     Int       @default(0)
  rejectedQty     Int       @default(0)
  pendingQty      Int       @default(0)  // 待收数量（计算字段）
  
  // 预计和实际
  expectedDeliveryDate DateTime?
  actualDeliveryDate   DateTime?
  
  // 备注
  notes           String?   @db.Text
  
  // 时间戳
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // 索引
  @@index([purchaseOrderId])
  @@index([productId])
  
  @@map("purchase_order_items")
}
```

### 2.6 新增：采购入库单模型

```prisma
model PurchaseReceipt {
  id              String    @id @default(cuid())
  receiptNo       String    @unique  // 入库单号：GRN-20260306-001
  
  // 关联采购单
  purchaseOrderId String
  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id])
  
  // 入库信息
  warehouse       String    @default("MAIN")
  receiptDate     DateTime  @default(now())
  receiptBy       String?   // 入库人
  
  // 状态
  status          ReceiptStatus @default(PENDING)
  
  // 质检
  qualityCheckId  String?
  qualityStatus   QualityCheckStatus @default(PENDING)
  
  // 备注
  notes           String?   @db.Text
  
  // 时间戳
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // 关联
  items           PurchaseReceiptItem[]
  
  // 索引
  @@index([purchaseOrderId])
  @@index([warehouse])
  @@index([receiptDate])
  
  @@map("purchase_receipts")
}

enum ReceiptStatus {
  PENDING        // 待入库
  PARTIAL        // 部分入库
  COMPLETED      // 已完成
  CANCELLED      // 已取消
}

model PurchaseReceiptItem {
  id              String    @id @default(cuid())
  receiptId       String
  receipt         PurchaseReceipt @relation(fields: [receiptId], references: [id], onDelete: Cascade)
  
  // 关联采购单项
  purchaseOrderItemId String
  purchaseOrderItem PurchaseOrderItem @relation(fields: [purchaseOrderItemId], references: [id])
  
  // 入库数量
  quantity        Int       @default(1)
  acceptedQty     Int       @default(0)  // 合格数量
  rejectedQty     Int       @default(0)  // 不合格数量
  
  // 库位
  warehouse       String    @default("MAIN")
  location        String?   // 库位
  
  // 备注
  notes           String?
  
  // 时间戳
  createdAt       DateTime  @default(now())
  
  @@index([receiptId])
  
  @@map("purchase_receipt_items")
}
```

### 2.7 新增：供应商付款模型

```prisma
model SupplierPayment {
  id              String    @id @default(cuid())
  paymentNo       String    @unique  // 付款单号：PAY-20260306-001
  
  // 关联采购单
  purchaseOrderId String
  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id])
  
  // 付款信息
  amount          Decimal   @db.Decimal(12, 2)
  currency        String    @default("CNY")
  paymentMethod   String?   // 付款方式
  paymentDate     DateTime?
  
  // 银行信息
  bankName        String?
  bankAccount     String?
  bankReference   String?   // 银行参考号
  
  // 状态
  status          PaymentStatus @default(PENDING)
  
  // 备注
  notes           String?   @db.Text
  attachments     String[]  // 付款凭证
  
  // 时间戳
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // 索引
  @@index([purchaseOrderId])
  @@index([paymentDate])
  
  @@map("supplier_payments")
}

enum PaymentStatus {
  PENDING        // 待付款
  PROCESSING     // 处理中
  COMPLETED      // 已完成
  FAILED         // 失败
  CANCELLED      // 已取消
}
```

### 2.8 新增：供应商评估模型

```prisma
model SupplierEvaluation {
  id              String    @id @default(cuid())
  supplierId      String
  supplier        Supplier  @relation(fields: [supplierId], references: [id])
  
  // 评估信息
  evaluationDate  DateTime  @default(now())
  evaluatorId     String?
  period          String    // 评估周期：2026-Q1
  
  // 评分维度 (1-5 分)
  qualityScore    Decimal   @db.Decimal(2, 1)  // 质量
  deliveryScore   Decimal   @db.Decimal(2, 1)  // 交期
  priceScore      Decimal   @db.Decimal(2, 1)  // 价格
  serviceScore    Decimal   @db.Decimal(2, 1)  // 服务
  
  // 综合评分
  totalScore      Decimal   @db.Decimal(3, 2)
  level           SupplierLevel
  
  // 备注
  comments        String?   @db.Text
  improvementPlan String?   @db.Text  // 改进计划
  
  // 时间戳
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // 索引
  @@index([supplierId, period])
  
  @@map("supplier_evaluations")
}
```

---

## 3. 数据库索引优化建议

### 3.1 订单模块索引

```prisma
// 订单表
@@index([customerId, status])
@@index([salesRepId, createdAt])
@@index([status, deliveryDate])
@@index([createdAt])
@@index([orderNo])
@@index([sourceInquiryId])
@@index([sourceQuotationId])

// 订单项表
@@index([orderId])
@@index([productId])
@@index([productionStatus])
```

### 3.2 采购模块索引

```prisma
// 供应商表
@@index([status])
@@index([companyName])
@@index([ownerId])
@@index([type, level])

// 采购订单表
@@index([supplierId, status])
@@index([salesOrderId])
@@index([status, deliveryDate])
@@index([createdAt])
@@index([poNo])

// 采购入库表
@@index([purchaseOrderId])
@@index([warehouse])
@@index([receiptDate])
```

---

## 4. 数据完整性约束

### 4.1 触发器建议

```sql
-- 自动计算订单余额
CREATE OR REPLACE FUNCTION update_order_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE orders 
  SET balance_amount = total_amount - paid_amount
  WHERE id = NEW.order_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 自动更新供应商统计
CREATE OR REPLACE FUNCTION update_supplier_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE suppliers 
  SET total_orders = total_orders + 1,
      total_amount = total_amount + NEW.total_amount,
      last_order_date = NOW()
  WHERE id = NEW.supplier_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 4.2 视图建议

```sql
-- 订单统计视图
CREATE VIEW order_statistics AS
SELECT 
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS order_count,
  SUM(total_amount) AS total_amount,
  SUM(paid_amount) AS paid_amount,
  COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completed_count
FROM orders
GROUP BY DATE_TRUNC('month', created_at);

-- 供应商绩效视图
CREATE VIEW supplier_performance AS
SELECT 
  s.id,
  s.company_name,
  COUNT(po.id) AS total_orders,
  SUM(po.total_amount) AS total_amount,
  AVG(CASE WHEN po.status = 'COMPLETED' 
      THEN EXTRACT(DAY FROM (po.completed_at - po.created_at)) 
      ELSE NULL END) AS avg_delivery_days
FROM suppliers s
LEFT JOIN purchase_orders po ON s.id = po.supplier_id
WHERE s.status = 'ACTIVE'
GROUP BY s.id, s.company_name;
```

---

## 5. 数据迁移计划

### 5.1 迁移步骤

1. **备份现有数据**
   ```bash
   pg_dump -U user trade_erp > backup_20260306.sql
   ```

2. **创建新迁移**
   ```bash
   npx prisma migrate dev --name enhance_order_purchase_models
   ```

3. **数据填充** (如需要)
   - 为现有订单生成生产记录
   - 为现有供应商初始化评分

4. **验证迁移**
   ```bash
   npx prisma db seed
   ```

### 5.2 回滚方案

```bash
# 回滚到最后一次迁移
npx prisma migrate resolve --rolled-back

# 或恢复备份
psql -U user trade_erp < backup_20260306.sql
```

---

*文档结束*
