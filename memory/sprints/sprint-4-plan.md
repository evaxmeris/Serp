# Sprint 4 - 入库管理模块

**周期**: 2026-03-09 ~ 2026-03-10 (2 天)  
**版本**: v0.5.0  
**优先级**: 🔴 高

---

## 📋 Sprint 目标

实现完整的入库管理功能，支持采购入库、退货入库、库存调整等业务场景。

---

## 🎯 功能需求

### 1. 入库单管理 (Inbound Orders)

**API 端点:**
```
POST   /api/v1/inbound-orders       - 创建入库单
GET    /api/v1/inbound-orders       - 获取入库单列表
GET    /api/v1/inbound-orders/:id   - 获取入库单详情
PUT    /api/v1/inbound-orders/:id   - 更新入库单
DELETE /api/v1/inbound-orders/:id   - 删除入库单
POST   /api/v1/inbound-orders/:id/confirm  - 确认入库
POST   /api/v1/inbound-orders/:id/cancel   - 取消入库
```

**入库单类型:**
- `PURCHASE_IN` - 采购入库
- `RETURN_IN` - 退货入库
- `ADJUSTMENT_IN` - 调拨入库

**入库单状态:**
- `PENDING` - 待入库
- `PARTIAL` - 部分入库
- `COMPLETED` - 已完成
- `CANCELLED` - 已取消

**字段结构:**
```typescript
interface InboundOrder {
  id: string
  inboundNo: string           // 入库单号 (自动生成)
  type: InboundType           // 入库类型
  status: InboundStatus       // 入库状态
  purchaseOrderId?: string    // 关联采购订单 ID
  supplierId?: string         // 供应商 ID
  warehouseId?: string        // 仓库 ID
  items: InboundOrderItem[]   // 入库商品明细
  expectedDate: Date          // 预计入库日期
  actualDate?: Date           // 实际入库日期
  totalAmount: number         // 总金额
  note?: string               // 备注
  createdAt: Date
  updatedAt: Date
}
```

---

### 2. 入库单明细 (Inbound Order Items)

```typescript
interface InboundOrderItem {
  id: string
  inboundOrderId: string
  productId: string
  product: Product
  expectedQuantity: number    // 预计入库数量
  actualQuantity: number      // 实际入库数量
  unitPrice: number           // 单价
  amount: number              // 金额
  batchNo?: string            // 批次号
  productionDate?: Date       // 生产日期
  expiryDate?: Date           // 过期日期
}
```

---

### 3. 库存管理 (Inventory)

**API 端点:**
```
GET    /api/v1/inventory           - 获取库存列表
GET    /api/v1/inventory/:id       - 获取库存详情
POST   /api/v1/inventory/adjust    - 库存调整
GET    /api/v1/inventory/logs      - 库存流水
```

**库存结构:**
```typescript
interface Inventory {
  id: string
  productId: string
  product: Product
  warehouseId: string
  warehouse: Warehouse
  quantity: number        // 当前库存数量
  availableQuantity: number  // 可用库存
  lockedQuantity: number     // 锁定库存
  minStock: number        // 最低库存
  maxStock: number        // 最高库存
  lastInboundDate?: Date  // 最后入库日期
  lastOutboundDate?: Date // 最后出库日期
}
```

**库存流水:**
```typescript
interface InventoryLog {
  id: string
  productId: string
  warehouseId: string
  type: 'IN' | 'OUT' | 'ADJUST'
  quantity: number        // 变动数量 (+/-)
  beforeQuantity: number  // 变动前库存
  afterQuantity: number   // 变动后库存
  referenceType: string   // 关联单据类型
  referenceId: string     // 关联单据 ID
  note?: string
  createdAt: Date
}
```

---

## 📝 开发任务

### 任务 1: 数据库 Schema 设计
- [ ] 设计 InboundOrder 模型
- [ ] 设计 InboundOrderItem 模型
- [ ] 设计 Inventory 模型
- [ ] 设计 InventoryLog 模型
- [ ] 运行 Prisma migration

### 任务 2: 入库单 API 开发
- [ ] POST /api/v1/inbound-orders - 创建入库单
- [ ] GET /api/v1/inbound-orders - 获取入库单列表
- [ ] GET /api/v1/inbound-orders/:id - 获取入库单详情
- [ ] PUT /api/v1/inbound-orders/:id - 更新入库单
- [ ] DELETE /api/v1/inbound-orders/:id - 删除入库单
- [ ] POST /api/v1/inbound-orders/:id/confirm - 确认入库
- [ ] POST /api/v1/inbound-orders/:id/cancel - 取消入库

### 任务 3: 库存管理 API 开发
- [ ] GET /api/v1/inventory - 获取库存列表
- [ ] GET /api/v1/inventory/:id - 获取库存详情
- [ ] POST /api/v1/inventory/adjust - 库存调整
- [ ] GET /api/v1/inventory/logs - 库存流水

### 任务 4: 业务逻辑实现
- [ ] 入库单号自动生成规则
- [ ] 入库确认时更新库存
- [ ] 库存流水自动记录
- [ ] 库存预警检查

### 任务 5: 测试
- [ ] 入库单 API 测试
- [ ] 库存管理 API 测试
- [ ] 集成测试（采购→入库→库存）

---

## 📊 验收标准

1. **功能完整性**: 所有 API 端点正常工作
2. **测试通过率**: 100% (目标 40+ 测试用例)
3. **代码质量**: TypeScript 编译通过，无 ESLint 错误
4. **文档完整**: API 文档、使用示例

---

## 🎯 业务价值

- ✅ 实现采购到入库的完整闭环
- ✅ 实时库存管理，避免超卖
- ✅ 库存流水可追溯
- ✅ 支持多仓库管理

---

**创建时间**: 2026-03-09 13:00  
**状态**: 🔄 进行中  
**负责人**: 开发工程师
