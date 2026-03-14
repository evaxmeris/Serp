# Sprint 5 自动化测试报告

**日期:** 2026-03-14  
**测试模块:** 出库单管理 (Outbound Orders)  
**测试文件:** `tests/outbound-orders.test.ts`

---

## 📊 测试执行结果

### 总体统计
- **测试用例总数:** 9
- **通过:** 2 (22%)
- **失败:** 7 (78%)
- **阻塞:** 0

### 详细结果

| 测试用例 | 状态 | 说明 |
|----------|------|------|
| POST /api/v1/outbound-orders - 应该成功创建出库单 | ❌ 失败 | 返回 500 内部错误 |
| POST /api/v1/outbound-orders - 应该验证必填字段 | ✅ 通过 | 正确验证必填字段 |
| POST /api/v1/outbound-orders - 应该验证销售订单存在 | ✅ 通过 | 正确验证订单存在性 |
| POST /api/v1/outbound-orders - 应该验证库存充足 | ❌ 失败 | 返回 422 验证错误 |
| POST /api/v1/outbound-orders/:id/confirm - 应该成功确认出库单 | ❌ 失败 | 无法创建测试数据 |
| POST /api/v1/outbound-orders/:id/confirm - 应该扣减库存 | ❌ 失败 | 无法创建测试数据 |
| POST /api/v1/outbound-orders/:id/confirm - 应该验证库存充足 | ❌ 失败 | 无法创建测试数据 |
| POST /api/v1/outbound-orders/:id/cancel - 应该成功取消出库单 | ❌ 失败 | 无法创建测试数据 |
| POST /api/v1/outbound-orders/:id/cancel - 应该恢复库存 | ❌ 失败 | 无法创建测试数据 |

---

## 🐛 发现的 Bug

### Bug #1: OutboundOrderItem 缺少 warehouseId 字段

**严重程度:** 🔴 高  
**状态:** ✅ 已修复

**问题描述:**
- Prisma  schema 中 `OutboundOrderItem` 模型缺少 `warehouseId` 字段
- API 验证要求 `warehouseId`，但无法保存到数据库
- 导致所有创建出库单的请求失败

**修复方案:**
1. 在 `prisma/schema.prisma` 中为 `OutboundOrderItem` 添加 `warehouseId` 字段
2. 添加 `batchNo`, `location`, `notes` 等可选字段
3. 执行 `npx prisma db push` 更新数据库

**修复后的 Schema:**
```prisma
model OutboundOrderItem {
  id              String        @id @default(cuid())
  outboundOrderId String
  productId       String
  warehouseId     String        // 仓库 ID
  quantity        Int
  shippedQuantity Int           @default(0)
  unitPrice       Decimal?
  batchNo         String?
  location        String?
  notes           String?
  outboundOrder   OutboundOrder @relation(fields: [outboundOrderId], references: [id], onDelete: Cascade)
  product         Product       @relation(fields: [productId], references: [id])
}
```

---

### Bug #2: 模型关系定义不完整

**严重程度:** 🟡 中  
**状态:** ✅ 已修复

**问题描述:**
- `OutboundOrder` 模型缺少与 `Order`、`InventoryLog` 的双向关系定义
- Prisma 验证失败，无法生成客户端

**修复方案:**
1. 为 `OutboundOrder.order` 添加 `name: "SalesOrder"`
2. 为 `OutboundOrder.inventoryLogs` 添加关系定义
3. 移除未使用的 `shipment` 字段（避免与现有 Shipment 模型冲突）

---

### Bug #3: 单元测试中 API 路由执行失败

**严重程度:** 🔴 高  
**状态:** ⏳ 待修复

**问题描述:**
- 单元测试直接导入 API 路由处理器
- 在测试环境中执行数据库事务时返回 500 错误
- 可能原因：Next.js 运行时上下文缺失或 Prisma 客户端配置问题

**影响:**
- 无法测试创建、确认、取消出库单的核心功能
- 只能测试验证逻辑（不依赖数据库写操作）

**建议解决方案:**

**方案 1: 改为集成测试（推荐）**
```bash
# 启动测试服务器
npm run dev

# 运行集成测试
npm test -- tests/integration/outbound-orders.test.ts
```

**方案 2: Mock Prisma 客户端**
```typescript
// 在测试中 mock prisma 调用
jest.mock('@/lib/prisma', () => ({
  prisma: {
    outboundOrder: {
      create: jest.fn().mockResolvedValue({...}),
    },
  },
}));
```

**方案 3: 使用 Next.js 测试工具**
```typescript
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

// 创建真实的 Next.js 测试服务器
const app = next({ dev: false });
const handle = app.getRequestHandler();
```

---

## ✅ 已完成的工作

### 1. 测试框架准备
- ✅ 测试环境配置 (`.env.test`)
- ✅ Prisma 测试数据库连接
- ✅ 测试数据准备和清理函数
- ✅ Mock NextRequest 工具函数

### 2. Schema 修复
- ✅ 添加 `OutboundOrderItem.warehouseId` 字段
- ✅ 添加 `OutboundOrderItem.batchNo`, `location`, `notes` 字段
- ✅ 修复 `OutboundOrder` 模型关系定义
- ✅ 添加 `OutboundOrder.inventoryLogs` 关系
- ✅ 数据库迁移完成

### 3. 测试脚本开发
- ✅ 创建出库单测试（基础框架）
- ✅ 验证必填字段测试（通过）
- ✅ 验证销售订单存在测试（通过）
- ✅ 验证库存充足测试（框架完成）
- ✅ 确认出库单测试（框架完成）
- ✅ 取消出库单测试（框架完成）
- ✅ 库存扣减/恢复测试（框架完成）

---

## 📋 后续工作清单

### 高优先级
- [ ] **修复 API 路由测试执行问题** - 确定是 Prisma 配置问题还是 Next.js 上下文问题
- [ ] **添加错误日志输出** - 在 API 路由中捕获并输出详细错误信息
- [ ] **验证测试数据库连接** - 确认测试环境可以正常访问数据库

### 中优先级
- [ ] **完成集成测试脚本** - 销售→出库→库存全流程测试
- [ ] **添加更多边界条件测试** - 重复确认、重复取消、状态流转等
- [ ] **添加性能测试** - 大批量出库单创建性能

### 低优先级
- [ ] **添加 E2E 测试** - 通过 UI 测试完整流程
- [ ] **添加负载测试** - 并发出库单处理
- [ ] **生成测试覆盖率报告** - 确保关键路径覆盖

---

## 🔧 技术细节

### 测试数据流
```
1. beforeAll: 创建客户、产品、仓库、库存、销售订单
2. 每个测试：创建/操作出库单
3. afterAll: 清理所有测试数据
```

### API 端点
- `POST /api/v1/outbound-orders` - 创建出库单
- `POST /api/v1/outbound-orders/:id/confirm` - 确认出库单
- `POST /api/v1/outbound-orders/:id/cancel` - 取消出库单

### 状态流转
```
DRAFT → PENDING → SHIPPED
              ↘ CANCELLED
```

### 库存影响
- **创建出库单:** 不扣减库存（仅验证库存充足）
- **确认出库单:** 扣减库存（availableQuantity - quantity）
- **取消出库单:** 恢复库存（仅 PENDING 状态可取消）

---

## 📝 经验总结

### 遇到的问题
1. **Schema 设计不完整** - Sprint 5 模型添加时未完善双向关系
2. **测试策略选择** - 单元测试 vs 集成测试的权衡
3. **Next.js API 路由测试** - 需要特殊处理运行时上下文

### 最佳实践
1. **先修复 Schema 再写测试** - 确保数据模型正确
2. **从简单测试开始** - 先测试验证逻辑，再测试数据库操作
3. **完善的错误日志** - 便于调试测试失败原因

---

**报告生成时间:** 2026-03-14 18:53 GMT+8  
**下一步:** 修复 API 路由测试执行问题，完成剩余 7 个测试用例
