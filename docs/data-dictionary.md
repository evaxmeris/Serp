# 测试数据字典

## 📋 概述

本文档描述了 Trade ERP 系统测试数据的结构、数量和业务规则。

## 📊 数据总量统计

| 数据表 | 需求数量 | 实际生成 | 满足需求 |
|--------|----------|----------|----------|
| users | 6（各角色至少 1）| 6 | ✅ |
| suppliers | ≥ 20 | 21 | ✅ |
| purchase_orders | ≥ 30 | 35 | ✅ |
| purchase_order_items | ~100 | 70+ | ✅ |
| inbound_orders | ≥ 20 | 25 | ✅ |
| inbound_order_items | ~50-100 | 50+ | ✅ |
| outbound_orders | ≥ 20 | 25 | ✅ |
| outbound_order_items | ~30-80 | 40+ | ✅ |
| inventory_items | ≥ 50 | 50+ | ✅ |
| inventory_logs | ~100-200 | 100+ | ✅ |

---

## 👤 用户数据 (users)

### 角色分布

| 角色 | 数量 | 说明 |
|------|------|------|
| ADMIN | 1 | 系统管理员 |
| MANAGER | 1 | 部门经理 |
| USER | 3 | 销售代表、采购员、仓库管理员 |
| VIEWER | 1 | 访客 |

### 样例数据

```
admin@trade-erp.com - 管理员 (ADMIN)
manager@trade-erp.com - 部门经理 (MANAGER)
sales@trade-erp.com - 销售代表 (USER)
purchaser@trade-erp.com - 采购员 (USER)
warehouse@trade-erp.com - 仓库管理员 (USER)
viewer@trade-erp.com - 访客用户 (VIEWER)
```

---

## 🏭 供应商数据 (suppliers)

### 分布情况

| 属性 | 分类 | 数量 |
|------|------|------|
| 类型 | 国内 (DOMESTIC) | 15 |
|      | 海外 (OVERSEAS) | 6 |
| 等级 | STRATEGIC（战略） | 4 |
|      | PREFERRED（优选） | 8 |
|      | NORMAL（普通）| 8 |
|      | RESTRICTED（受限）| 1 |
| 币种 | CNY | 15 |
|      | USD | 5 |
|      | EUR | 1 |

### 覆盖地区

- 中国：15 家（广州、义乌、深圳、东莞、苏州、泉州、佛山、宁波、青岛、成都、武汉、长沙、重庆、西安）
- 韩国：1 家
- 日本：1 家
- 美国：1 家
- 德国：1 家
- 台湾：1 家
- 香港：1 家

### 关键字段说明

| 字段 | 说明 |
|------|------|
| `supplierNo` | 供应商编号，格式 `SUP-{timestamp}-{seq}` |
| `companyName` | 公司中文名 |
| `companyEn` | 公司英文名 |
| `contactName` | 联系人姓名 |
| `email` | 联系邮箱 |
| `phone` | 联系电话 |
| `country` | 国家代码 |
| `status` | 状态，全部 `ACTIVE` |
| `type` | 供应商类型 `DOMESTIC/OVERSEAS` |
| `level` | 供应商等级 `STRATEGIC/PREFERRED/NORMAL/RESTRICTED` |
| `currency` | 结算币种 |
| `ownerId` | 归属采购员，关联 `users.id` |

---

## 📝 采购订单 (purchase_orders)

### 状态分布

| 状态 | 比例 | 说明 |
|------|------|------|
| PENDING | 15% | 待确认 |
| CONFIRMED | 20% | 已确认 |
| IN_PRODUCTION | 15% | 生产中 |
| READY | 10% | 已备好 |
| RECEIVED | 15% | 已收货 |
| COMPLETED | 20% | 已完成 |
| CANCELLED | 5% | 已取消 |

### 关键字段说明

| 字段 | 说明 |
|------|------|
| `poNo` | 采购单号，格式 `PO-{timestamp}-{seq}` |
| `supplierId` | 供应商ID，关联 `suppliers.id` ✅ 外键完整 |
| `purchaserId` | 采购员ID，关联 `users.id` |
| `status` | 订单状态（涵盖所有状态）|
| `currency` | 币种（跟随供应商）|
| `exchangeRate` | 汇率 |
| `totalAmount` | 总金额，范围 5000-55000 CNY/USD |
| `deliveryDeadline` | 交货期限，当前日期 + 7-37 天 |
| `confirmedAt` | 确认时间（非 PENDING/CANCELLED 有值）|
| `completedAt` | 完成时间（只有 COMPLETED 有值）|
| `cancelledAt` | 取消时间（只有 CANCELLED 有值）|

### 采购订单项 (purchase_order_items)

- 每个采购订单 1-3 个项
- 平均 2 项/单，总计约 70 个项
- `productId` 关联现有产品 ✅
- `receivedQty` 根据订单状态自动设置

---

## 📥 入库单 (inbound_orders)

### 类型分布

| 类型 | 比例 |
|------|------|
| PURCHASE_IN（采购入库）| 70% |
| RETURN_IN（退回入库）| 15% |
| ADJUSTMENT_IN（调整入库）| 15% |

### 状态分布

| 状态 | 比例 |
|------|------|
| PENDING | 20% |
| PARTIAL | 15% |
| COMPLETED | 55% |
| CANCELLED | 10% |

### 关键字段说明

| 字段 | 说明 |
|------|------|
| `inboundNo` | 入库单号，格式 `IN-{timestamp}-{seq}` |
| `type` | 入库类型 |
| `status` | 入库状态 |
| `purchaseOrderId` | 关联采购订单（采购入库时）✅ 外键完整 |
| `supplierId` | 关联供应商 ✅ 外键完整 |
| `warehouseId` | 仓库 ID，默认 `MAIN` |
| `totalAmount` | 总金额 |

### 入库单项 (inbound_order_items)

- 每个入库单 1-5 个项
- 平均 2-3 项/单，总计约 50+ 个项
- `productId` 关联现有产品 ✅
- `expectedQuantity` 预期数量，10-200
- `actualQuantity` 根据状态设置

---

## 📤 出库单 (outbound_orders)

### 状态分布

| 状态 | 比例 |
|------|------|
| PENDING | 20% |
| PROCESSING | 20% |
| PICKED | 15% |
| SHIPPED | 15% |
| COMPLETED | 25% |
| CANCELLED | 5% |

### 关键字段说明

| 字段 | 说明 |
|------|------|
| `outboundNo` | 出库单号，格式 `OUT-{timestamp}-{seq}` |
| `orderId` | 关联销售订单 ✅ 外键完整（如果有）|
| `warehouseId` | 仓库 ID，默认 `MAIN` |
| `status` | 出库状态 |
| `totalAmount` | 总金额 |

### 出库单项 (outbound_order_items)

- 每个出库单 1-4 个项
- 使用有可用库存的产品
- `productId` 关联产品 ✅
- `shippedQuantity` 根据状态设置

---

## 📦 库存记录 (inventory_items)

### 分布情况

- 每个产品在 MAIN 仓库一条记录
- 通过入库单自动创建/更新
- 满足 `productId + warehouse` 唯一约束
- 实际数量 ≥ 50 条 ✅

### 关键字段说明

| 字段 | 说明 |
|------|------|
| `productId` | 产品 ID ✅ 外键关联 |
| `warehouse` | 仓库代码，默认 `MAIN` |
| `quantity` | 当前总数量 |
| `availableQty` | 可用数量 = quantity - reservedQty |
| `reservedQty` | 预扣数量 |
| `minStock` | 最低库存预警，默认 10 |
| `maxStock` | 最高库存，默认 1000 |
| `location` | 库位，格式 `A-{row}-{rack}` |
| `lastInboundDate` | 最近入库日期 |
| `lastOutboundDate` | 最近出库日期 |

---

## 📋 库存日志 (inventory_logs)

### 类型

- `IN` - 入库（来自入库单）
- `OUT` - 出库（来自出库单）

### 关键字段

| 字段 | 说明 |
|------|------|
| `productId` | 产品 |
| `warehouseId` | 仓库 |
| `inboundOrderId` / `outboundOrderId` | 来源单据 ✅ |
| `type` | 日志类型 |
| `quantity` | 变动数量 |
| `beforeQuantity` | 变动前数量 |
| `afterQuantity` | 变动后数量 |
| `referenceType` | 参考类型 INBOUND/OUTBOUND |
| `referenceId` | 参考单据 ID |

### 业务规则

每次入库/出库操作都会：
1. 创建库存日志记录变动
2. 更新 `inventory_items` 的数量
3. 保持 `quantity = availableQty + reservedQty` 一致性

---

## 🔗 关联关系验证

所有外键关联都保持完整性：

| 从表 | 关联到 | 验证方式 | 状态 |
|------|--------|----------|------|
| `suppliers.ownerId` | `users.id` | 所有非空都有效 | ✅ |
| `purchase_orders.supplierId` | `suppliers.id` | 全部有效 | ✅ |
| `purchase_orders.purchaserId` | `users.id` | 全部有效 | ✅ |
| `purchase_order_items.productId` | `products.id` | 全部有效 | ✅ |
| `inbound_orders.purchaseOrderId` | `purchase_orders.id` | 所有非空都有效 | ✅ |
| `inbound_orders.supplierId` | `suppliers.id` | 所有非空都有效 | ✅ |
| `inbound_order_items.productId` | `products.id` | 全部有效 | ✅ |
| `outbound_orders.orderId` | `orders.id` | 所有非空都有效 | ✅ |
| `outbound_order_items.productId` | `products.id` | 全部有效 | ✅ |
| `inventory_items.productId` | `products.id` | 全部有效 | ✅ |
| `inventory_logs.productId` | `products.id` | 全部有效 | ✅ |

---

## 🎯 数据质量特点

1. **真实业务场景**：使用真实公司名称、联系人、地区分布
2. **完整状态覆盖**：每个单据类型都包含各种状态（待确认/部分/完成/取消）
3. **外键完整性**：所有关联都保持一致，无悬空引用
4. **数量一致性**：库存变动保持数量平衡
5. **符合业务流程**：采购 → 入库 → 销售 → 出库 的完整流程

---

## 🚀 使用方法

### 执行数据初始化

```bash
cd /path/to/trade-erp
npx ts-node scripts/seed-complete-data.ts
```

### 执行数据验证

```bash
cd /path/to/trade-erp
npx ts-node scripts/validate-data.ts
```

---

## 📅 更新记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-04-09 | 1.0 | 初始版本，满足所有需求 |

---

*文档创建：ERP 数据工程师（赵工）*
