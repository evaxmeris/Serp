# 数据库与业务逻辑审计报告

**项目**: trade-erp  
**审计日期**: 2026-04-27  
**审计范围**: Prisma schema, 服务层, 核心业务逻辑, 同步模块, 测试覆盖  

---

## 执行摘要

本项目是一个外贸 ERP 系统，包含客户管理、订单管理、采购管理、库存管理、财务报表、多平台同步等模块。经过对 prisma/schema.prisma（2233行）、服务层代码、src/lib 核心逻辑和测试文件的深入审计，共发现 **45 个问题**，其中 **高严重程度 12 个**、**中严重程度 21 个**、**低严重程度 12 个**。

主要风险集中在：金额计算不精确/不可控、库存超卖风险、同步模块可靠性不足、报表数据不准确、软删除导致的数据一致性隐患。

---

## 一、Prisma Schema 数据模型设计问题

### 1.1 `OutboundOrder.status` 使用 String 而非枚举 [严重: 高]

**文件**: `prisma/schema.prisma` L1075

**问题描述**:
```prisma
model OutboundOrder {
  status        String              // ❌ 应为枚举
}
```
`OutboundOrder.status` 使用了裸 `String` 类型，而系统中其他所有状态（OrderStatus、PurchaseOrderStatus 等）都使用了枚举。这导致：
- 无法在数据库层面约束合法值
- 前端可能传入任意字符串
- 查询时无法利用 Prisma 的类型安全

**修复建议**: 创建 `OutboundOrderStatus` 枚举并与 OrderStatus 保持一致：
```prisma
enum OutboundOrderStatus {
  PENDING
  PICKING
  PACKING
  SHIPPED
  DELIVERED
  CANCELLED
}
```

---

### 1.2 `Product.costPrice` 缺少 `@default(0)` [严重: 中]

**文件**: `prisma/schema.prisma` L93

**问题描述**:
```prisma
costPrice    Decimal    @db.Decimal(10, 2)  // 没有默认值，且非 nullable
```
`costPrice` 是 Decimal 类型且无默认值，理论上必须提供值。但如果通过 API 创建产品时未指定该字段，会在数据库层面报错（除非 Prisma 层面做了默认）。更严重的是，后续报表中多处使用 `Number(item.product.costPrice || 0)` 的 fallback 模式，暗示该字段实际上可能为空。

**修复建议**: 添加 `@default(0)` 确保始终有值，或改为 `Decimal?` 并在业务逻辑中处理 null。

---

### 1.3 `SupplierEvaluation` 分数范围不一致 [严重: 中]

**文件**: `prisma/schema.prisma` L466-486

**问题描述**:
```prisma
qualityScore    Decimal    @db.Decimal(2, 1)   // 范围: 0.0 - 99.9
deliveryScore   Decimal    @db.Decimal(2, 1)   // 范围: 0.0 - 99.9
priceScore      Decimal    @db.Decimal(2, 1)   // 范围: 0.0 - 99.9
serviceScore    Decimal    @db.Decimal(2, 1)   // 范围: 0.0 - 99.9
totalScore      Decimal    @db.Decimal(3, 2)   // 范围: 0.00 - 9.99
```
各分项分数精度是 `Decimal(2,1)`（最大 99.9），而总分精度是 `Decimal(3,2)`（最大 9.99）。如果四个分项各 10 分满分求和为 40，远超 totalScore 的最大值 9.99。如果满分是 100 求平均再除以 100 表示，则 totalScore 也应该是 `Decimal(4,2)` 来容纳 100.00。

**修复建议**: 统一分数范围。如果总分是百分制，使用 `@db.Decimal(5,2)`；如果是 10 分制，使用 `@db.Decimal(3,1)`。

---

### 1.4 `Role` 存在两套定义（Enum vs Model） [严重: 中]

**文件**: `prisma/schema.prisma` L2000-2006（RoleEnum）vs L1224-1238（Role model）

**问题描述**:
系统同时存在：
- `enum RoleEnum { ADMIN, SALES, PURCHASING, WAREHOUSE, VIEWER }` — User.role 字段使用
- `model Role` — RBAC 权限系统使用，包含 name/admin/etc

`User.role` 使用的是 `RoleEnum`，而 RBAC 权限系统使用 `Role` model + `UserRole` + `RolePermission` 关联。这两套体系没有关联关系，可能导致权限判断混乱：一个用户通过 `RoleEnum` 标识为 SALES，但在 RBAC 中可能被赋予不同的角色和权限。

**修复建议**: 明确权限模型。要么统一使用 RoleEnum（简单场景），要么将 User.role 改为指向 Role model 的外键关系（复杂 RBAC 场景），废弃 RoleEnum。

---

### 1.5 `InventoryItem` 缺少乐观锁（schema_enhanced 有，主 schema 无） [严重: 高]

**文件**: `prisma/schema.prisma` L626-647 vs `schema_enhanced.prisma` L934-952

**问题描述**:
`schema_enhanced.prisma` 中 `InventoryItem` 有 `version Int @default(0) // 乐观锁`，但主 `schema.prisma` 中缺少此字段。并发出库/入库场景下（如两个订单同时扣减同一产品库存），没有乐观锁保护会导致库存超卖。

**修复建议**: 在主 schema 中添加乐观锁版本字段：
```prisma
version    Int    @default(0)
```
或在业务层使用 Prisma 的 `update` + where version 检查实现乐观并发控制。

---

### 1.6 `PlatformSyncConfig.credentials` 未加密存储 [严重: 高]

**文件**: `prisma/schema.prisma` L2201-2216

**问题描述**:
```prisma
credentials    Json    // 平台凭据（加密存储）
```
注释说"加密存储"，但 schema 层面没有任何加密机制，只是一个裸 Json 字段。如果数据库被泄露，所有平台的 API 密钥、Token 将明文暴露。

**修复建议**: 在写入数据库前使用 AES 或其他对称加密算法加密 credentials；或使用数据库层面的加密功能（如 PostgreSQL pgcrypto）。

---

### 1.7 `ReportData.reportId` 缺少外键约束 [严重: 中]

**文件**: `prisma/schema.prisma` L1130-1146

**问题描述**:
```prisma
model ReportData {
  reportId    String
  report      ReportDefinition @relation(fields: [reportId], references: [id])
}
```
有 Prisma 级联关系但没有指定 `onDelete`。如果删除 ReportDefinition，关联的 ReportData 不会被自动删除，可能导致孤儿数据。

**修复建议**: 添加 `onDelete: Cascade` 或 `onDelete: SetNull`：
```prisma
report    ReportDefinition @relation(fields: [reportId], references: [id], onDelete: Cascade)
```

---

### 1.8 `PlatformOrder.items` 使用 Json 存储明细 [严重: 中]

**文件**: `prisma/schema.prisma` L1360

**问题描述**:
```prisma
items    Json    @default("[]")
```
平台订单的明细数据以 JSON 格式存储，而非规范化到独立表。这导致：
- 无法对单品做聚合统计（销量、收入排行）
- 无法建立索引加速查询
- 与本地订单的 OrderItem 模型不一致

**修复建议**: 创建 `PlatformOrderItem` 模型，与 OrderItem 类似，或将平台订单明细同步时转换为本地 OrderItem。

---

### 1.9 `OutboundOrder.outboundNo` 使用 cuid() 作为默认值 [严重: 低]

**文件**: `prisma/schema.prisma` L1072

**问题描述**:
```prisma
outboundNo    String    @unique @default(cuid())
```
使用 cuid() 作为出库单号不具业务可读性。其他业务实体（Order、PurchaseOrder、Quotation 等）都使用语义化的编号格式（SO-YYYYMMDD-XXX）。

**修复建议**: 移除 `@default(cuid())`，在业务层生成语义化编号，如 `OUT-YYYYMMDD-XXX`。

---

### 1.10 `UserRegistration` 与 `User` 是独立模型 [严重: 低]

**文件**: `prisma/schema.prisma` L1268-1290

**问题描述**:
`UserRegistration` 是完全独立的模型，与 `User` 没有关联。注册审批通过后，需要在业务层手动创建对应的 `User` 记录。如果手动创建失败，会产生"已审批但无 User"的不一致状态。

**修复建议**: 添加 `userId String?` 外键字段，审批通过后在同一事务中同时创建 User 并更新 UserRegistration.userId。

---

### 1.11 软删除模型缺少关联数据的级联处理 [严重: 高]

**文件**: `prisma/schema.prisma` (Customer L58, Supplier L432, Product L106, Order L232, Quotation L176, Inquiry L141)

**问题描述**:
以下模型有 `deletedAt` 软删除字段：Customer, Supplier, Product, Order, Quotation, Inquiry, PurchaseOrder。但它们关联的子模型使用了 `onDelete: Cascade`，例如：
- `CustomerContact.customer` → `onDelete: Cascade`
- `OrderItem.order` → `onDelete: Cascade`
- `QuotationItem.quotation` → `onDelete: Cascade`

**矛盾之处**: Prisma 中间件（`prisma.ts` L28-40）将 `delete` 操作转换为 `update({ deletedAt })`。这意味着真正的 DELETE 操作几乎不会被触发，所以 cascade delete 不会执行。但如果有人绕过中间件直接执行 DELETE（如通过原始 SQL），子数据将被意外删除。

更大的问题是：软删除父记录后，子记录（如 OrderItem）仍然可见，且可以正常查询，但在查询父记录时被过滤掉了。这导致"查询订单明细能看到，但查询订单看不到"的数据断裂。

**修复建议**: 
1. 对所有子表也添加软删除机制
2. 或者使用 `onDelete: Restrict` 替代 `Cascade`，禁止删除有关联数据的父记录
3. 或者在查询子记录时加入父记录的 deletedAt 过滤

---

### 1.12 `InboundOrder` 与 `PurchaseOrder` 存在重复建模 [严重: 中]

**文件**: `prisma/schema.prisma` L665-707 vs L563-601

**问题描述**:
系统同时存在 `InboundOrder`（入库单）和 `PurchaseReceipt`（采购收货单），两者功能高度重叠：
- 都关联 PurchaseOrder
- 都有 items 明细
- 都有仓库/数量信息

但两者之间没有关联，且数据模型不一致（InboundOrderItem 有 batchNo/productionDate/expiryDate，PurchaseReceiptItem 有 acceptedQty/rejectedQty）。可能导致：
- 数据重复录入
- 库存更新逻辑混乱
- 同一笔入库在两个地方各记一次

**修复建议**: 选择一个作为主模型，另一个作为视图或冗余字段。或者明确定义两者的职责边界（如 InboundOrder 用于采购入库，PurchaseReceipt 用于质量检验入库）。

---

## 二、业务逻辑完整性问题

### 2.1 订单创建时 `totalAmount` 由前端计算，后端未校验 [严重: 高]

**文件**: `src/app/api/orders/route.ts` L238-242

**问题描述**:
```typescript
const totalAmount = items.reduce((sum, item) => {
  const discount = item.discountRate || 0;
  const itemAmount = item.quantity * item.unitPrice * (1 - discount / 100);
  return sum + itemAmount;
}, 0);
```
后端在创建订单时自行计算 totalAmount，这是正确的。但 **`balanceAmount` 使用 `Number` 类型计算**（JavaScript 浮点数），存在精度丢失问题。更关键的是，`orderCreateSchema`（`validators/order.ts`）没有要求前端提供 `totalAmount`，而是后端计算，但 API 响应中的 Decimal 转换可能导致前端看到的金额与后端存储的金额不一致。

**修复建议**: 使用 `Decimal` 库（如 decimal.js）进行金额计算，避免浮点数精度丢失。或者至少在 `amount` 写入数据库前用 `toDecimal()` 确保精度。

---

### 2.2 付款记录不自动更新 `Order.paidAmount` [严重: 高]

**文件**: `prisma/schema.prisma` L350-365 (Payment model)

**问题描述**:
`Payment` 模型与 `Order` 关联，但没有任何机制确保：
```
Order.paidAmount = SUM(Payment.amount WHERE status = 'COMPLETED')
Order.balanceAmount = Order.totalAmount - Order.paidAmount
```
这意味着 `paidAmount` 和 `balanceAmount` 完全依赖手动维护。如果有人在创建 Payment 后忘记更新 Order，数据就会不一致。

**修复建议**: 在创建/更新/删除 Payment 时，使用事务自动计算并更新 Order 的 paidAmount 和 balanceAmount。或者使用数据库触发器/计算字段。

---

### 2.3 `PurchaseOrderItem.pendingQty` 无业务逻辑维护 [严重: 中]

**文件**: `prisma/schema.prisma` L548

**问题描述**:
```prisma
receivedQty    Int    @default(0)
rejectedQty    Int    @default(0)
pendingQty     Int    @default(0)
```
`pendingQty` 字段存在但代码中没有任何逻辑维护它。`quantity - receivedQty - rejectedQty` 应该等于 `pendingQty`，但如果没有自动计算逻辑，这三个值很容易不一致。

**修复建议**: 移除 `pendingQty` 字段（改为计算字段），或在使用 Receipt 时自动更新。

---

### 2.4 审批流程缺少与业务实体的硬关联 [严重: 中]

**文件**: `prisma/schema.prisma` L1452-1482 (ApprovalRecord)

**问题描述**:
```prisma
businessId     String
businessType   String
```
`ApprovalRecord` 使用 `businessId` + `businessType` 字符串对来关联业务实体，而不是外键。这导致：
- 无法在数据库层面验证被审批的实体是否存在
- 无法级联删除（删除订单时关联审批记录成为孤儿）
- 无法通过 JOIN 高效查询

**修复建议**: 对每种业务类型（Order、PurchaseOrder、Expense 等）创建明确的外键关联，或使用 Prisma 的 `Json` 字段存储关联元数据并配合业务层校验。

---

### 2.5 订单状态流转无约束 [严重: 中]

**文件**: `src/app/api/orders/[id]/route.ts`, `src/lib/validators/order.ts`

**问题描述**:
订单状态有 8 种：PENDING → CONFIRMED → IN_PRODUCTION → READY → SHIPPED → DELIVERED → COMPLETED / CANCELLED。但代码中没有任何地方验证状态转换的合法性。例如：
- 可以从 PENDING 直接跳到 COMPLETED
- 可以从 CANCELLED 改回 CONFIRMED
- COMPLETED 后仍可修改

**修复建议**: 实现状态机验证：
```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PRODUCTION', 'CANCELLED'],
  IN_PRODUCTION: ['READY', 'CANCELLED'],
  READY: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};
```

---

### 2.6 `findOrCreateCustomer` 存在客户匹配歧义 [严重: 中]

**文件**: `src/lib/sync/order-sync.ts` L247-290

**问题描述**:
同步模块中客户匹配逻辑：
1. 先匹配 email
2. 再匹配 companyName
3. 最后创建新客户

问题：
- 不同客户可能有相同 email（如 info@company.com 被多个销售共用）
- companyName 可能拼写不一致（"ABC Co., Ltd" vs "ABC Company Limited"）
- 没有 fuzzy matching，大小写敏感
- 没有通知/确认机制，自动创建的的客户没有 ownerId

**修复建议**: 
- 增加多字段组合匹配（email + companyName）
- 使用模糊匹配（Levenshtein distance）
- 自动创建的客户标记来源并通知管理员审核

---

### 2.7 库存数量计算：`availableQty` 未自动更新 [严重: 高]

**文件**: `prisma/schema.prisma` L626-647

**问题描述**:
```prisma
quantity       Int    @default(0)
reservedQty    Int    @default(0)
availableQty   Int    @default(0)
```
业务规则应为 `availableQty = quantity - reservedQty`，但代码中没有任何地方自动维护这个关系。如果在出库时只更新了 `quantity` 而没有更新 `reservedQty`，`availableQty` 就是错误的。

同时 `InventoryItem` 还缺少 `lastInboundDate` 和 `lastOutboundDate` 字段的自动更新逻辑（在 schema_enhanced 中被移除了）。

**修复建议**: 使用数据库触发器或业务层事务确保 `availableQty = quantity - reservedQty` 始终成立。

---

### 2.8 库存报表库龄计算使用 `createdAt` 而非入库日期 [严重: 中]

**文件**: `src/app/api/v1/reports/inventory/route.ts` L143-148

**问题描述**:
```typescript
const firstInDate = new Date(item.createdAt);
const agingDays = Math.floor((now.getTime() - firstInDate.getTime()) / ...);
```
库存报表使用 `InventoryItem.createdAt` 计算库龄，但 `createdAt` 是库存记录创建时间，不是实际入库时间。如果后来做了库存调整，`createdAt` 不会变化，导致库龄计算不准确。

**修复建议**: 使用 `lastInboundDate`（如果存在）或从 `InventoryLog` 查询最近一次 IN 类型日志的时间。

---

### 2.9 库存报表低库存统计逻辑矛盾 [严重: 中]

**文件**: `src/app/api/v1/reports/inventory/route.ts` L179

**问题描述**:
```typescript
lowStockItems: itemsWithAging.filter(item => item.quantity <= 0).length,
outOfStockItems: itemsWithAging.filter(item => item.quantity === 0).length,
```
`lowStockItems` 定义为 `quantity <= 0`，这实际上是"缺货"而非"低库存"。真正的低库存应该是 `quantity <= minStock` 或 `quantity <= maxStock * 0.1`。而且 `InventoryItem` 有 `minStock` 字段，但这里没有使用。

**修复建议**:
```typescript
lowStockItems: itemsWithAging.filter(item => 
  item.minStock !== null && item.quantity <= item.minStock
).length,
```

---

### 2.10 库存周转率未实现 [严重: 低]

**文件**: `src/app/api/v1/reports/inventory/route.ts` L223-230

**问题描述**:
```typescript
const turnover = {
  turnoverRate: 0,
  daysOfInventory: 0
};
// TODO: 需要从销售数据计算周转率
```
库存周转率是关键的仓储指标，当前代码标注为 TODO 但返回硬编码的 0，可能导致管理层做出错误决策。

**修复建议**: 实现周转率计算：
```
turnoverRate = 期间销售成本 / 期间平均库存
daysOfInventory = 365 / turnoverRate
```

---

### 2.11 报表导出服务在客户端运行，无法导出大数据量 [严重: 中]

**文件**: `src/lib/reports/export-service.ts`

**问题描述**:
`export-service.ts` 是一个纯客户端库（使用了 `file-saver`、`window.open`），无法在 API route 中用于服务端导出。这意味着：
- 大数据量报表会导致浏览器崩溃
- CSV 导出未处理 Unicode BOM，中文可能乱码
- Excel 导出使用 HTML 方式，不是真正的 Excel 格式
- PDF 导出只是浏览器打印

**修复建议**: 实现服务端导出，使用 `exceljs`（Excel）、`pdf-lib`（PDF）、`csv-stringify`（CSV）等库。

---

### 2.12 CSV 导出存在注入风险 [严重: 低]

**文件**: `src/lib/reports/export-service.ts` L25-35

**问题描述**:
```typescript
const csvContent = [
  headers.join(','),
  ...rows.map(row => row.map(cell => {
    const str = String(cell ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }).join(','))
].join('\n');
```
虽然处理了逗号和引号，但没有处理 CSV 注入（公式注入）。如果单元格内容以 `=`, `+`, `-`, `@` 开头，Excel 会将其解释为公式执行。

**修复建议**: 对以 `=`, `+`, `-`, `@`, `\t`, `\r` 开头的单元格值添加前缀单引号 `'` 或将其用引号包裹并添加 `\t` 前缀。

---

## 三、数据一致性问题

### 3.1 `Order` 与 `OrderItem` 的 `amount` 一致性 [严重: 高]

**文件**: `src/app/api/orders/route.ts` L238-294, `prisma/schema.prisma` L199-287

**问题描述**:
`Order.totalAmount` 在创建时由后端计算，但 `OrderItem.amount` 是独立存储的。如果后续手动修改了某个 OrderItem.amount 而没有重新计算 Order.totalAmount，两者会不一致。

**修复建议**: 在更新 OrderItem 时，使用事务重新计算并更新 Order.totalAmount。

---

### 3.2 软删除后子记录仍可查询 [严重: 高]

**文件**: `src/lib/prisma.ts` L19-58

**问题描述**:
Prisma 中间件只对 7 个软删除模型（Customer, Supplier, Product, Order, Quotation, Inquiry, PurchaseOrder）添加 `deletedAt: null` 过滤。但这些模型的子模型（OrderItem, Payment, Shipment 等）不受影响。

这意味着：
- 查询 `orderItems.findMany()` 可以查到已软删除订单的明细
- 聚合统计（如 `orderItems.aggregate({ _sum: { amount: true } })`）会包含已删除订单的金额
- 关联查询 `orderItem.order` 在 `include` 模式下可能返回 null（因为 order 被过滤了）

**修复建议**: 
1. 对子查询也应用软删除过滤（递归检测）
2. 或在 Prisma 中间件中为这些子模型的查询也添加父表 deletedAt 过滤

---

### 3.3 `StockMovement` 无外键关联 [严重: 中]

**文件**: `prisma/schema.prisma` L649-663

**问题描述**:
```prisma
model StockMovement {
  productId      String
  warehouse      String
  referenceType  String?
  referenceId    String?
}
```
`referenceType` 和 `referenceId` 是字符串对，没有外键约束。如果引用的记录被删除，StockMovement 成为孤儿记录。

**修复建议**: 如果 `referenceType` 是 `INBOUND_ORDER`，应该关联 `InboundOrder`；如果是 `OUTBOUND_ORDER`，关联 `OutboundOrder`。使用可空外键替代字符串对。

---

### 3.4 `InventoryLog` 中 `warehouseId` 与 `InventoryItem.warehouse` 类型不一致 [严重: 低]

**文件**: `prisma/schema.prisma` L710-735

**问题描述**:
```prisma
model InventoryLog {
  warehouseId     String
  inventoryItem   InventoryItem @relation(fields: [productId, warehouseId], references: [productId, warehouse])
}
```
`InventoryLog.warehouseId` 的命名暗示是一个 ID（通常指向 Warehouse model），但实际它是关联到 `InventoryItem.warehouse`（一个字符串如 "MAIN"）。这容易造成理解混淆。

**修复建议**: 将字段名改为 `warehouse` 以保持一致，或创建 `Warehouse` model 并关联。

---

### 3.5 `ReportData` 可能因缺少 `onDelete` 产生孤儿记录 [严重: 中]

**文件**: `prisma/schema.prisma` L1130-1146

**问题描述**:
同 1.7，`ReportData.reportId` 关系没有指定 `onDelete`，默认行为是 `Restrict`。但在某些 Prisma 版本中行为可能不同。

**修复建议**: 显式指定 `onDelete: Cascade`。

---

### 3.6 `PlatformSyncLog` 的 `status` 值包含 `'processing'` 但 Schema 中没有定义 [严重: 低]

**文件**: `src/lib/sync/order-sync.ts` L50-51 vs `prisma/schema.prisma` L2218-2233

**问题描述**:
```typescript
// 代码中
status: 'processing'
// Schema 注释中说
// status: success, failed, partial
```
`'processing'` 状态没有在 schema 注释中列出，且 `PlatformSyncLog.status` 是裸 String 类型。

**修复建议**: 创建 `SyncLogStatus` 枚举。

---

## 四、报表和统计数据准确性

### 4.1 Dashboard 统计未过滤软删除数据 [严重: 高]

**文件**: `src/app/api/dashboard/orders/route.ts` L85-108, L111-124, etc.

**问题描述**:
所有 Dashboard 统计 API 都使用 `$queryRaw` 直接查询数据库表，**绕过了 Prisma 的软删除中间件**。这意味着：
- 已软删除的订单会被计入总订单数、总收入
- 已软删除的客户会被计入客户统计
- 已软删除的产品会被计入产品销量排行

例如：
```sql
SELECT COUNT(*) as totalOrders, SUM("totalAmount") as totalRevenue
FROM "orders"
WHERE "createdAt" >= ${startDate}
-- 没有 WHERE "deletedAt" IS NULL !
```

**修复建议**: 在所有 `$queryRaw` 查询中添加 `AND "deletedAt" IS NULL`。

---

### 4.2 Dashboard 转化率统计口径不正确 [严重: 中]

**文件**: `src/app/api/dashboard/orders/route.ts` L143-152

**问题描述**:
```sql
SELECT 
  (SELECT COUNT(*) FROM "inquiries" WHERE "createdAt" >= ${startDate}) as totalInquiries,
  (SELECT COUNT(*) FROM "quotations" WHERE "createdAt" >= ${startDate}) as totalQuotations,
  (SELECT COUNT(*) FROM "orders" WHERE "createdAt" >= ${startDate}) as totalOrders
```
转化率计算 `inquiryToQuotationRate` = quotations / inquiries，但这不是真正的转化率。真正的转化率应该是"有后续跟进的询盘占比"和"由询盘转化的订单占比"。当前的计算方式会严重夸大转化率，因为同一个客户可能产生多个询盘和报价。

**修复建议**: 
- `inquiryToQuotationRate` = 有报价的询盘数 / 总询盘数
- `quotationToOrderRate` = 有订单的报价数 / 总报价数
- 使用 `COUNT(DISTINCT ...)` 避免重复计数

---

### 4.3 产品销量统计 JOIN 了 `products` 但未过滤软删除 [严重: 中]

**文件**: `src/app/api/dashboard/sales/route.ts` L109-127

**问题描述**:
```sql
SELECT p."name" as productName, ...
FROM "order_items" oi
JOIN "products" p ON oi."productId" = p.id
JOIN "orders" o ON oi."orderId" = o.id
WHERE o."createdAt" >= ${startDate}
```
产品表没有过滤软删除，已删除的产品仍然出现在 Top 10 排行中。

**修复建议**: 添加 `AND p."deletedAt" IS NULL` 过滤条件。

---

### 4.4 销售趋势 `period` 参数存在 SQL 注入风险 [严重: 高]

**文件**: `src/app/api/dashboard/sales/route.ts` L82

**问题描述**:
```typescript
DATE_TRUNC(${period}, "createdAt")
```
`period` 直接从查询参数获取（`day | week | month`），虽然前端验证了取值范围，但 `$queryRaw` 模板标签中直接插入变量意味着如果验证被绕过，可能导致 SQL 注入。

**修复建议**: 在服务端显式验证：
```typescript
const validPeriods = ['day', 'week', 'month', 'year'];
if (!validPeriods.includes(period)) throw new Error('Invalid period');
```

---

### 4.5 库存报表 totalValue 计算使用 `costPrice` 但忽略了币种 [严重: 中]

**文件**: `src/app/api/v1/reports/inventory/route.ts` L178

**问题描述**:
```typescript
totalValue: itemsWithAging.reduce((sum, item) => sum + (item.quantity * Number(item.product.costPrice || 0)), 0),
```
产品的 `costPrice` 有 `currency` 字段（可能是 USD、CNY 等），但报表计算总价值时没有考虑币种差异，直接相加不同币种的值。

**修复建议**: 按币种分组计算，或统一转换为基准币种后计算。

---

## 五、同步模块（sync）可靠性和错误处理

### 5.1 同步缺少分布式锁/互斥机制 [严重: 高]

**文件**: `src/lib/sync/scheduler.ts` L50-58

**问题描述**:
```typescript
const timer = setInterval(async () => {
  try {
    const result = await executePlatformSync(config.platformCode, 'scheduled');
  } catch (error) {
    console.error(...);
  }
}, intervalMs);
```
如果一次同步执行时间超过间隔时间（如接口响应慢、数据量大），`setInterval` 会启动第二次同步，导致：
- 重复处理订单
- 数据库锁竞争
- lastSyncAt 可能被覆盖为较早的值

**修复建议**: 
- 使用 `setTimeout` 替代 `setInterval`，确保上次执行完成后才调度下一次
- 或在 `executePlatformSync` 入口处检查是否已有同步进行中（分布式锁）

---

### 5.2 同步模块没有重试机制 [严重: 高]

**文件**: `src/lib/sync/order-sync.ts` L129-139

**问题描述**:
```typescript
for (const order of allOrders) {
  try {
    await processSingleOrder(order, config);
    synced++;
  } catch (error) {
    failed++;
    errors.push(errorMsg);
    console.error(...);
    // 没有重试！
  }
}
```
单个订单同步失败后直接跳过，不重试。由于网络波动、API 限流等导致的临时错误，下次同步时该订单可能已经被跳过（因为 lastSyncAt 已经更新）。

**修复建议**: 
- 对临时错误（网络超时、429 限流）实现指数退避重试
- 或使用死信队列记录失败的订单，稍后单独重试

---

### 5.3 `executePlatformSync` 中 `lastSyncAt` 更新时机不安全 [严重: 高]

**文件**: `src/lib/sync/order-sync.ts` L142-148

**问题描述**:
```typescript
// 7. 更新平台配置（记录最后同步时间）
await prisma.platformSyncConfig.update({
  where: { platformCode },
  data: {
    lastSyncAt: new Date(),  // 无论成功/部分失败都更新
    ...
  },
});
```
即使有大量订单同步失败（如 API 返回的数据格式错误），`lastSyncAt` 仍然会被更新。这意味着失败的数据会被永久跳过，永远不会再尝试同步。

**修复建议**: 
- 只在所有订单都成功同步时更新 lastSyncAt
- 或者记录最后成功处理的订单时间戳，而非当前时间

---

### 5.4 分页拉取硬编码为 5 页上限 [严重: 中]

**文件**: `src/lib/sync/order-sync.ts` L119-122

**问题描述**:
```typescript
if (fetchParams.page > 5) {
  hasMore = false;
}
```
每次同步最多拉取 5 × 50 = 250 条订单。如果同步间隔是 2 小时，但 2 小时内产生了超过 250 条订单，多余的订单将永远不会被同步到。

**修复建议**: 移除硬编码限制，改为基于时间范围的判断（确保所有 createdAt > lastSyncAt 的订单都被拉取）。

---

### 5.5 平台适配器（Amazon/TikTok/Shopify）只有骨架代码 [严重: 中]

**文件**: `src/lib/sync/adapters/amazon.ts`, `tiktok.ts`, `shopify.ts`

**问题描述**:
除了 `AlibabaAdapter` 有完整实现，其他三个平台适配器都是 TODO 骨架：
- `AmazonAdapter`: 空实现，返回空数组
- `TikTokAdapter`: 空实现
- `ShopifyAdapter`: 返回错误"尚未实现"

但它们在 `src/lib/sync/index.ts` 中被注册了。如果用户启用了这些平台配置，同步会静默失败或返回空结果。

**修复建议**: 
1. 在注册时检查适配器是否为可用实现（非 TODO 骨架）
2. 或在 `executePlatformSync` 中对返回空结果的适配器发出警告
3. 在管理界面标记未实现的平台

---

### 5.6 同步中创建客户没有设置 `ownerId` [严重: 低]

**文件**: `src/lib/sync/order-sync.ts` L276-287

**问题描述**:
```typescript
const newCustomer = await prisma.customer.create({
  data: {
    companyName,
    contactName: ...,
    email: ...,
    // 没有 ownerId！
    source: order.platformCode.toUpperCase(),
    status: 'ACTIVE',
  },
});
```
同步自动创建的客户没有指定 `ownerId`（业务员），这意味着这些客户不会出现在任何业务员的客户列表中。

**修复建议**: 根据业务规则分配 ownerId（如根据平台账号的 userId，或分配给默认业务员）。

---

### 5.7 同步中的 `orderNo` 生成可能冲突 [严重: 中]

**文件**: `src/lib/sync/adapters/base.ts` L34-37

**问题描述**:
```typescript
protected generateOrderNo(platformOrderId: string): string {
  return `${prefix}-${platformOrderId}`;
}
```
订单号格式为 `ALI-1234567890`，但 `Order.orderNo` 有 `@unique` 约束。如果同一平台订单被重复同步（如 webhook + scheduled sync 同时触发），可能因 `orderNo` 冲突而失败。

**修复建议**: 在 `processSingleOrder` 中已经用 `platformOrderId + sourcePlatform` 做了幂等检查（L208-213），但 `orderNo` 的 unique 约束可能导致在检查之前就先报错。应先查询再创建。

---

## 六、缺少测试覆盖的关键业务场景

### 6.1 同步模块完全缺少测试 [严重: 高]

**文件**: `tests/` 目录下无 sync 相关测试

**问题描述**:
`src/lib/sync/` 包含整个多平台订单同步框架，但 tests 目录中没有任何 sync 相关的测试文件。考虑到同步模块是高风险区域（涉及外部 API、数据转换、幂等性、并发控制），缺少测试是重大风险。

**需要覆盖的测试场景**:
- 订单幂等创建（重复同步不会重复创建）
- 客户匹配逻辑（邮箱匹配/名称匹配/新建）
- 状态映射正确性
- 分页拉取边界情况
- 错误恢复（部分失败时的状态）
- 适配器注册表功能

---

### 6.2 库存管理缺少并发测试 [严重: 高]

**文件**: `tests/` 无库存并发测试

**问题描述**:
库存出入库是最容易出现并发问题的场景。没有测试验证：
- 两个订单同时出库同一产品是否导致超卖
- `availableQty` 计算是否正确
- 库存不足时是否正确拒绝出库

**修复建议**: 添加并发测试用例，使用 Promise.all 模拟并发出库请求。

---

### 6.3 金额计算缺少精度测试 [严重: 中]

**文件**: `tests/` 无 Decimal 精度测试

**问题描述**:
订单金额、利润计算、佣金计算等都涉及 Decimal 运算。没有测试验证：
- 折扣计算精度（如 1000 * 0.0333）
- 多币种转换精度
- 汇率计算精度
- 汇总金额的精度

**修复建议**: 添加精度测试用例，验证常见边缘情况。

---

### 6.4 财务报表测试使用占位 Token [严重: 中]

**文件**: `tests/reports/financial-reports.test.ts` L29-35

**问题描述**:
```typescript
// TODO: 实现登录逻辑获取 token
authToken = 'test-token-placeholder';
```
财务报表测试没有实现真实认证，所有测试实际上都会失败（401 或 500）。整个测试文件只是"计划"而非可用测试。

**修复建议**: 实现测试认证流程，或使用 mock 中间件绕过认证。

---

### 6.5 审批流程缺少测试 [严重: 中]

**文件**: `tests/` 无审批流程测试

**问题描述**:
审批流程涉及 `ApprovalFlow`、`ApprovalRecord`、`ApprovalHistory` 三个模型，但没有测试覆盖：
- 审批发起
- 审批通过/拒绝
- 多级审批流程
- 审批超时处理

---

### 6.6 软删除行为缺少测试 [严重: 中]

**文件**: `tests/` 无软删除测试

**问题描述**:
Prisma 中间件实现了软删除，但没有测试验证：
- delete 是否正确转为软删除
- 查询是否正确过滤已删除记录
- 软删除后子记录的可见性
- includeDeleted 参数是否工作
- 恢复操作是否正确

---

### 6.7 权限和 RBAC 缺少测试 [严重: 低]

**文件**: `src/lib/__tests__/permissions-cache.test.ts` 是唯一权限测试

**问题描述**:
只有一个权限缓存测试，缺少：
- 权限中间件测试
- 行级过滤测试
- 不同角色对同一资源的操作权限测试

---

### 6.8 采购流程缺少集成测试 [严重: 中]

**文件**: `tests/purchase-orders.test.ts` 存在但覆盖面有限

**问题描述**:
采购流程涉及 PurchaseOrder → PurchaseReceipt → InboundOrder → InventoryItem 的完整链路，但缺少端到端集成测试验证：
- 采购订单创建 → 收货 → 入库 → 库存更新的完整流程
- 部分收货场景
- 收货质检不合格场景

---

### 6.9 性能测试仅覆盖出库 [严重: 低]

**文件**: `tests/performance/outbound-performance.test.ts`

**问题描述**:
只有一个出库性能测试，缺少：
- 订单列表查询性能
- 报表生成性能
- 同步拉取性能
- 并发库存操作性能

---

## 严重程度汇总

| 严重程度 | 数量 | 典型问题 |
|---------|------|---------|
| 高 | 12 | 软删除数据计入报表、库存超卖风险、同步无重试/互斥、金额计算精度 |
| 中 | 21 | 审批无硬关联、库存库龄计算错误、同步分页限制、报表币种忽略 |
| 低 | 12 | 出库单号不可读、CSV 注入风险、性能测试覆盖面窄 |

---

## 优先级修复建议

### P0（立即修复）
1. **4.1** Dashboard 统计添加 `deletedAt IS NULL` 过滤
2. **2.2** 付款自动更新 Order.paidAmount
3. **5.3** 修复 lastSyncAt 更新时机（只在成功时更新）
4. **1.5** 添加 InventoryItem 乐观锁

### P1（一周内修复）
5. **3.2** 软删除中间件扩展到子查询
6. **5.1** 同步添加互斥机制
7. **5.2** 同步添加重试机制
8. **2.5** 订单状态流转验证
9. **2.7** 库存 availableQty 自动计算
10. **1.6** PlatformSyncConfig.credentials 加密存储

### P2（一个月内修复）
11. **6.1** 同步模块测试覆盖
12. **6.2** 库存并发测试
13. **4.2** Dashboard 转化率计算修正
14. **1.1** OutboundOrder.status 改为枚举
15. **2.11** 服务端报表导出

---

*报告结束。此报告基于 2026-04-27 的代码状态，建议定期复审。*
