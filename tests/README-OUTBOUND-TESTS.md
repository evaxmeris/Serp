# Sprint 5 出库管理模块自动化测试

## 📋 测试文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `outbound-orders.test.ts` | 单元测试 | 出库单 API 基础功能测试 |
| `outbound-integration.test.ts` | 集成测试 | 销售订单→出库单→库存扣减→发货全流程测试 |
| `prepare-outbound-test-data.js` | 数据准备 | 测试数据准备和清理脚本 |

## 🎯 测试覆盖

### 单元测试 (`outbound-orders.test.ts`)

**POST /api/v1/outbound-orders**
- ✅ 成功创建出库单
- ✅ 验证必填字段（orderId、items）
- ✅ 验证销售订单存在
- ✅ 验证库存充足

**POST /api/v1/outbound-orders/:id/confirm**
- ✅ 成功确认出库单
- ✅ 扣减库存
- ✅ 验证库存充足

**POST /api/v1/outbound-orders/:id/cancel**
- ✅ 成功取消出库单
- ✅ 恢复库存

### 集成测试 (`outbound-integration.test.ts`)

**完整出库流程**
- ✅ 记录初始库存
- ✅ 创建多产品出库单
- ✅ 创建出库单时立即扣减库存
- ✅ 验证库存日志已创建
- ✅ 确认出库单
- ✅ 更新销售订单出库状态
- ✅ 取消出库单并恢复库存
- ✅ 验证库存恢复日志

**分批出库**
- ✅ 创建第一批出库单（50 个）
- ✅ 确认第一批出库单
- ✅ 创建第二批出库单（剩余 50 个）
- ✅ 确认第二批出库单
- ✅ 验证销售订单全部出库
- ✅ 验证销售订单状态自动更新为 SHIPPED

**异常场景**
- ✅ 拒绝不存在的销售订单
- ✅ 拒绝不存在的产品
- ✅ 拒绝库存不足的出库单
- ✅ 拒绝重复确认已发货的出库单

## 🚀 快速开始

### 1. 准备测试数据

```bash
cd /Users/apple/clawd/trade-erp

# 准备出库单测试数据
npm run test:data:prepare-outbound
```

### 2. 运行测试

```bash
# 运行单元测试
npm run test:outbound

# 运行集成测试
npm run test:outbound:integration

# 运行所有出库单测试
npm run test:outbound:all

# 运行测试并生成覆盖率报告
npm run test:outbound -- --coverage
```

### 3. 清理测试数据

```bash
# 清理出库单测试数据
npm run test:data:cleanup-outbound
```

## 📊 测试数据

测试脚本会自动创建以下数据：

- **客户**: Sprint5 测试客户
- **产品**: 3 个测试产品（初始库存各 1000 个）
- **仓库**: 测试仓库
- **销售订单**: 包含多个产品的测试订单

测试数据会保存在 `tests/test-data.json` 文件中，清理时会自动删除。

## 🔍 测试输出示例

```
📦 开始准备出库管理测试数据...

1️⃣  创建测试客户...
   ✅ 客户创建成功：Sprint5 测试客户_TEST_1234567890_abc123 (ID: xxx)

2️⃣  创建测试产品...
   ✅ 产品创建成功：Sprint5 测试产品 1_TEST_... (SKU: Sprint5-TEST-001_..., ID: xxx)
   ✅ 产品创建成功：Sprint5 测试产品 2_TEST_... (SKU: Sprint5-TEST-002_..., ID: xxx)
   ✅ 产品创建成功：Sprint5 测试产品 3_TEST_... (SKU: Sprint5-TEST-003_..., ID: xxx)

3️⃣  创建测试仓库...
   ✅ 仓库创建成功：测试仓库 (ID: xxx)

4️⃣  创建测试库存...
   ✅ 产品 Sprint5 测试产品 1_TEST_... 库存：1000 个
   ✅ 产品 Sprint5 测试产品 2_TEST_... 库存：1000 个
   ✅ 产品 Sprint5 测试产品 3_TEST_... 库存：1000 个

5️⃣  创建测试销售订单...
   ✅ 销售订单创建成功：SO-TEST_... (ID: xxx)
      商品数量：3 种
      订单总额：$10200

📊 测试数据摘要:
   =========================================
   客户 ID: xxx
   仓库 ID: xxx
   订单 ID: xxx
   产品列表:
     1. Sprint5 测试产品 1_TEST_... (ID: xxx, 库存：1000)
     2. Sprint5 测试产品 2_TEST_... (ID: xxx, 库存：1000)
     3. Sprint5 测试产品 3_TEST_... (ID: xxx, 库存：1000)
   =========================================

💾 测试数据已保存到：/Users/apple/clawd/trade-erp/tests/test-data.json
```

## ✅ 测试通过标准

- [ ] 所有单元测试通过（8 个测试用例）
- [ ] 所有集成测试通过（16 个测试用例）
- [ ] 测试覆盖率 > 80%
- [ ] 无内存泄漏
- [ ] 测试数据完全清理

## 🐛 故障排查

### 问题 1: 数据库连接失败

**症状**: `Can't reach database server at localhost:5432`

**解决方案**:
```bash
# 检查 PostgreSQL 是否运行
psql -h localhost -U trade_erp -d trade_erp

# 重启数据库
brew services restart postgresql@14
```

### 问题 2: Prisma Client 未生成

**症状**: `@prisma/client did not initialize yet`

**解决方案**:
```bash
npm run db:generate
```

### 问题 3: 测试数据冲突

**症状**: `Unique constraint failed on the fields: (sku)`

**解决方案**:
```bash
# 清理旧测试数据
npm run test:data:cleanup-outbound

# 重新准备数据
npm run test:data:prepare-outbound
```

### 问题 4: 库存不足

**症状**: `产品库存不足（可用：X，需要：Y）`

**解决方案**:
```bash
# 清理测试数据并重新准备（会重置库存）
npm run test:data:cleanup-outbound
npm run test:data:prepare-outbound
```

## 📝 测试报告

运行测试后，会生成详细的测试报告：

```bash
# 运行测试并生成报告
npm run test:outbound:all -- --verbose

# 生成 HTML 报告
npm run test:outbound:all -- --coverage --coverageReporters=html
```

## 🔗 相关文档

- [Sprint 5 需求文档](../FEATURES/OUTBOUND_MANAGEMENT.md)
- [出库单 API 文档](../docs/api/outbound-orders.md)
- [数据库 Schema](../prisma/schema.prisma)

---

*最后更新：2026-03-14*
*版本：Sprint 5 v1.0*
