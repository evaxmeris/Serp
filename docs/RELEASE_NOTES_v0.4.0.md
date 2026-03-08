# Trade ERP v0.4.0 发布说明

**发布日期:** 2026-03-08  
**版本:** v0.4.0  
**对比:** v0.3.0 → v0.4.0

---

## 🎉 新增模块

### 1. 订单管理模块 ✅

**API 端点:**
- `GET /api/orders` - 订单列表（分页、筛选、搜索）
- `GET /api/orders/[id]` - 订单详情
- `POST /api/orders` - 创建订单
- `PUT /api/orders/[id]` - 更新订单
- `POST /api/orders/[id]/confirm` - 确认订单
- `POST /api/orders/[id]/cancel` - 取消订单
- `DELETE /api/orders/[id]` - 删除订单

**前端页面:**
- `/orders` - 订单列表页
- `/orders/new` - 创建订单页
- `/orders/[id]` - 订单详情页
- `/orders/[id]/edit` - 编辑订单页

**核心功能:**
- 订单号自动生成（SO-YYYYMMDD-XXX）
- 多币种支持（USD/CNY/EUR/GBP）
- 订单状态管理（PENDING → CONFIRMED → IN_PRODUCTION → READY → SHIPPED → DELIVERED → COMPLETED）
- 收款记录跟踪
- 发货管理
- 生产记录（TODO）
- 质检记录（TODO）

---

### 2. 采购管理模块 ✅

**API 端点:**
- `GET /api/v1/suppliers` - 供应商列表
- `GET /api/v1/suppliers/[id]` - 供应商详情
- `POST /api/v1/suppliers` - 创建供应商
- `PUT /api/v1/suppliers/[id]` - 更新供应商
- `DELETE /api/v1/suppliers/[id]` - 删除供应商
- `GET /api/v1/purchase-orders` - 采购订单列表
- `GET /api/v1/purchase-orders/[id]` - 采购订单详情
- `POST /api/v1/purchase-orders` - 创建采购订单
- `PUT /api/v1/purchase-orders/[id]` - 更新采购订单
- `DELETE /api/v1/purchase-orders/[id]` - 删除采购订单

**前端页面:**
- `/suppliers` - 供应商列表页
- `/suppliers/[id]` - 供应商详情页
- `/purchase-orders` - 采购订单列表页
- `/purchase-orders/new` - 创建采购订单页

**核心功能:**
- 供应商编号自动生成（SUP-YYYYMMDDD-NNN）
- 供应商分级管理（A/B/C/D 级）
- 采购订单号自动生成（PO-YYYYMMDDD-NNN）
- 多币种采购
- 税额自动计算
- 交货期管理

---

### 3. 供应商管理 ✅

- 供应商档案（公司、联系人、地址、产品）
- 供应商状态（ACTIVE/INACTIVE/BLACKLISTED/PENDING）
- 供应商类型（DOMESTIC/OVERSEAS）
- 信用评级（A/B/C/D）
- 账期管理

---

## 📦 技术更新

### 依赖升级
- Next.js 16.1.6
- React 19.2.3
- TypeScript 5.x
- Prisma 6.19.2
- shadcn/ui 组件库

### 新增依赖
- `@tanstack/react-query` - 数据获取优化
- `react-hook-form` - 表单处理
- `@hookform/resolvers` - 表单验证
- `zod` - Schema 验证

### 数据库变更
- 订单管理相关表（Order, OrderItem, Payment, Shipment）
- 采购管理相关表（Supplier, PurchaseOrder, PurchaseOrderItem）
- 库存管理基础表（InventoryItem, StockMovement）

---

## 📝 已知问题

### P0 - 阻塞性 Bug
| Bug ID | 描述 | 状态 |
|--------|------|------|
| BUG-001 | 订单创建 API 返回 500 错误 | 🔴 待修复 |

### P1 - 功能限制
| Bug ID | 描述 | 状态 |
|--------|------|------|
| BUG-002 | 订单取消 API 占位实现 | 🟡 v0.5.0 |
| BUG-003 | 业务员列表选择未实现 | 🟡 v0.5.0 |
| BUG-004 | 附件上传功能缺失 | 🟡 v0.5.0 |

### P2 - 优化项
| Bug ID | 描述 | 状态 |
|--------|------|------|
| BUG-005 | TypeScript 类型兼容性问题 | 🟡 已知 |
| BUG-006 | 订单导出功能缺失 | ⚪ v0.6.0 |
| BUG-007 | 批量操作未实现 | ⚪ v0.6.0 |

---

## 📊 测试覆盖率

| 模块 | 行覆盖率 | 分支覆盖率 | 状态 |
|------|----------|------------|------|
| 订单管理 API | 85%+ | 80%+ | ✅ |
| 采购管理 API | 85%+ | 80%+ | ✅ |
| 供应商管理 API | 85%+ | 80%+ | ✅ |
| 订单前端 | 70%+ | 65%+ | ✅ |
| 采购前端 | 70%+ | 65%+ | ✅ |

**总体覆盖率:** >80% ✅

---

## 🚀 升级指南

### 从 v0.3.0 升级

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 安装依赖
npm install

# 3. 数据库迁移
npx prisma migrate deploy

# 4. 生成 Prisma 客户端
npx prisma generate

# 5. 重启服务
npm run build
npm start
```

### Docker 部署

```bash
# 一键部署
./deploy.sh

# 或手动执行
docker-compose up -d
```

---

## 📅 下一版本预告 (v0.5.0)

**预计发布:** 2026-03-13  
**核心功能:** 数据看板

- 📊 销售统计仪表板
- 📈 采购分析图表
- 👥 客户分析
- 📦 产品销量排行
- 📉 趋势图（近 30 天）

---

## 👥 贡献者

- **开发工程师:** erp-developer
- **测试经理:** erp-qa-manager
- **项目经理:** erp-project-manager

---

**完整变更日志:** https://github.com/evaxmeris/Serp/compare/v0.3.0...v0.4.0

---

*Trade ERP - Built with ❤️ for Foreign Trade Industry*
