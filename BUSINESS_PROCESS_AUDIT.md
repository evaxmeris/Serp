# Trade ERP 外贸业务流程完整性审查报告

**审查视角**: 外贸业务专家  
**审查日期**: 2026-05-02  
**审查范围**: 核心业务流程链路 询盘→报价→订单→生产→质检→出货→物流→收款→利润核算

---

## 综合评分: 67/100

| 维度 | 评分 | 说明 |
|------|------|------|
| 数据模型完整性 | 85 | Prisma schema 覆盖了外贸全链路，但缺少 Invoice/发票模块 |
| API 覆盖度 | 75 | 大部分模块有 CRUD API，但生产记录、质检无独立 API |
| 页面 UI 覆盖度 | 60 | 6 个核心节点有页面，生产/质检/佣金/绩效无专属页面 |
| 状态机/流程约束 | 55 | 仅 Order 有完整状态机，Inquiry/Quotation 无状态迁移校验 |
| 流程衔接 (转换) | 65 | 询盘→报价(弱)、报价→订单(有)、订单→采购(有)、其他衔接弱 |

---

## 一、业务链路节点逐项评估

### 1. 询盘 (Inquiry) ⭐⭐⭐⭐☆
- **数据模型**: ✓ Inquiry + Customer + FollowUp，字段完整
- **API 路由**: ✓ GET/PUT/DELETE /api/inquiries/[id], GET/POST /api/inquiries
- **页面**: ✓ /inquiries 列表页 + 创建/编辑弹窗
- **状态迁移**: InquiryStatus: NEW → CONTACTED → QUOTED → NEGOTIATING → WON | LOST
- **问题**: 
  - ❌ 无状态迁移校验器 — PUT 接口直接接受任意 status 值，无合法迁移检查
  - ❌ 询盘→报价链路无 UI 一键转换按钮 (需手动去报价模块创建)
  - ❌ 缺少 NEGOTIATING→CONTACTED 的回退校验

### 2. 报价 (Quotation) ⭐⭐⭐⭐☆
- **数据模型**: ✓ Quotation + QuotationItem，字段完整
- **API 路由**: ✓ CRUD + /api/quotations/[id]/convert (转订单) + /api/quotations/[id]/send (发送)
- **页面**: ✓ /quotations 列表 + 详情 + 新建 + 编辑
- **状态迁移**: DRAFT → SENT → VIEWED → ACCEPTED | REJECTED | EXPIRED
- **问题**:
  - ❌ 无状态迁移校验器 — 可随意修改状态
  - ❌ /send 路由中的邮件发送为 TODO 空壳 (line 78: `// TODO: 实现邮件发送逻辑`)
  - ❌ 报价单过期自动判断未实现 (有 validityDays 字段但无定时任务检查)

### 3. 订单 (Order) ⭐⭐⭐⭐⭐
- **数据模型**: ✓ Order + OrderItem，字段极其完整（含平台订单、多币种、审批状态等）
- **API 路由**: ✓ CRUD + batch-confirm + batch-ship
- **页面**: ✓ /orders 列表 + /orders/[id] 详情 + /orders/new 新建 + /orders/[id]/edit 编辑
- **状态迁移**: ⭐ 有完整的状态机验证 (src/lib/order-status-machine.ts)
  - PENDING → CONFIRMED → IN_PRODUCTION → READY → SHIPPED → DELIVERED → COMPLETED
  - 任意状态 → CANCELLED (PENDING/READY 阶段可取消)
  - ADMIN 可跳过中间状态强制流转
- **亮点**: 有 canTransition() / validateTransition() / canCancel() 完整 API
- **问题**: 
  - ⚠️ 订单生成采购订单功能 (order detail line 65) 依赖手动获取供应商列表，UI 交互略重
  - ⚠️ 订单→生产记录的流转无自动触发机制

### 4. 生产 (ProductionRecord) ⭐⭐☆☆☆
- **数据模型**: ✓ ProductionRecord + OrderItem.productionStatus
- **API 路由**: ❌ **无独立 CRUD API** — 仅在 GET /api/orders/[id] 中作为嵌套查询返回
- **页面**: ❌ **无独立管理页面** — 仅以只读方式展示在 /orders/[id] 详情中
- **状态迁移**: PLANNED → IN_PROGRESS → COMPLETED | ON_HOLD | CANCELLED
- **严重问题**:
  - 🔴 **无创建/更新/删除 ProductionRecord 的 API 路由**
  - 🔴 **无生产排程页面** — 无法统一查看所有生产任务
  - 🔴 **无生产进度录入界面** — 无法更新 progress%、实际日期
  - 🔴 **无生产看板** — 无法一览各订单生产进度

### 5. 质检 (QualityCheck) ⭐⭐☆☆☆
- **数据模型**: ✓ QualityCheck + QualityCheckItem + QualityCheckType/Status 枚举
- **API 路由**: ❌ **无独立 CRUD API** — 仅在 GET /api/orders/[id] 中作为嵌套查询返回
- **页面**: ❌ **无独立管理页面** — 仅以只读方式展示在 /orders/[id] 详情中 (line 725-769)
- **问题**:
  - 🔴 **无创建/更新/删除 QualityCheck 的 API 路由**
  - 🔴 **无质检页面** — 无法录入检验数据、上传照片
  - 🔴 **无质检不合格处理流程** — FAILED 后的处置流程未定义
  - 🔴 **质检与出货无衔接** — QC PASSED 不会自动触发 order 状态迁移

### 6. 出货/发货 (Shipment + OutboundOrder) ⭐⭐⭐⭐☆
- **数据模型**: ✓ Shipment (发货记录) + OutboundOrder (出库单)
- **API 路由**: ✓ /api/v1/shipments (CRUD) + /api/v1/outbound-orders (含 confirm/cancel/batch)
- **页面**: ✓ /shipments + /outbound-orders 列表 + 详情 + 新建 + 发货
- **状态迁移**: 
  - Shipment: PENDING → BOOKED → IN_TRANSIT → SHIPPED → DELIVERED
  - OutboundOrder: PENDING → PICKING → PACKING → SHIPPED → DELIVERED | CANCELLED
- **问题**:
  - 🔴 **OutboundOrder.status 使用 String 而非 Prisma 枚举** — 早期审计已发现未修复
  - ⚠️ Shipment 和 OutboundOrder 之间的关联较弱 (shipmentId 外键存在但页面无联动)

### 7. 物流 (Logistics) ⭐⭐⭐⭐☆
- **数据模型**: ✓ LogisticsProvider + LogisticsQuotation + LogisticsOrder (四维审批)
- **API 路由**: ✓ 完整 — providers CRUD + 报价管理 + orders CRUD + submit/review/approve/finance-confirm/reject
- **页面**: ✓ /logistics/orders + /logistics/providers + /logistics/providers/[id]
- **审批流程**: DRAFT → PENDING_REVIEW → PENDING_APPROVAL → PENDING_FINANCE → APPROVED
- **问题**:
  - ⚠️ 物流订单与销售订单关联 (salesOrderId) 仅在数据层面，页面无直接业务跳转
  - ⚠️ 物流费用自动计入利润核算的链路未打通

### 8. 收款 (Payment/Receivables) ⭐⭐⭐☆☆
- **数据模型**: ✓ Payment model (订单级收款) + SupplierPayment (供应商付款)
- **API 路由**: ✓ /api/v1/payments (CRUD)
- **页面**: ✓ /finance/receivables (应收账款) + /finance/payments (付款记录)
- **问题**:
  - 🔴 **无发票 (Invoice) 模块** — 外贸业务需要向客户开具形式发票(PI)或商业发票(CI)，系统无此功能
  - 🔴 **应收应付无自动核销** — page.tsx 中手动计算 balance = totalAmount - paidAmount
  - ⚠️ 收款与订单状态无联动 — 收款完成不会自动推动订单状态
  - ⚠️ 多币种收款无汇率损益处理

### 9. 利润核算 (ProfitCalculation) ⭐⭐☆☆☆
- **数据模型**: ✓ ProfitCalculation + ProfitDetail (含各项成本拆分) + Commission + PerformanceRule
- **API 路由**: ✓ /api/v1/reports/profit (GET/POST)
- **页面**: ✓ /reports/profit — **但使用了硬编码样本数据**
  - **证据**: line 40-46 `// TODO: 调用 API 获取实际数据` + `setData(sampleData)`
- **问题**:
  - 🔴 **利润报表页面未接入真实 API 数据** — 展示的是写死的示例数据
  - 🔴 **利润自动核算缺失** — ProfitCalculation 记录没有自动生成机制
  - 🔴 **佣金模块无 UI 页面** — Commission model 存在但无管理界面
  - 🔴 **绩效规则无 UI 页面** — PerformanceRule 存在但无管理界面
  - ⚠️ 各项成本（物流费、平台费、广告费）需手动录入到 profit_detail，无自动归集

---

## 二、流程断裂点地图

```
询盘 ──→ 报价 ──→ 订单 ──→ 生产 ──→ 质检 ──→ 出货 ──→ 物流 ──→ 收款 ──→ 利润核算
 │         │         │         │         │         │         │         │         │
 │         │         │         │         │         │         │         │         │
[弱]      [有]      [断裂]    [断裂]    [有]      [有]      [弱]      [断裂]
 │         │         │         │         │         │         │         │
 └──无一键   └──可转    └──无生产   └──无质检   └──可创建  └──关联    └──发票    └──样本数据
     转报价    换订单       管理API     管理API     发货记录    salesId    缺失       未接入
                             无页面      无页面       有出库单              收款与订单   真实API
                                                      管理                  无状态联动   无自动核算
```

### 断裂点分类

| 断裂级别 | 位置 | 描述 |
|----------|------|------|
| 🔴 **严重断裂** | 生产管理 | 无独立 API 和页面，数据只能读不能写 |
| 🔴 **严重断裂** | 质检管理 | 无独立 API 和页面，检验记录无法录入 |
| 🔴 **严重断裂** | 利润核算 | 样本数据未接入真实 API，无自动核算 |
| 🔴 **严重断裂** | 发票管理 | 整个模块缺失，无法开具 PI/CI |
| 🟡 **中度断裂** | 询盘→报价 | 无一键转换功能，需手动跨模块操作 |
| 🟡 **中度断裂** | 收款→订单 | 收款完成不推动订单状态 |
| 🟡 **中度断裂** | 质检→出货 | QC PASSED 不自动触发出货流程 |
| 🟡 **中度断裂** | 出口单证 | 无装箱单、报关单等文档生成 |
| 🟢 **轻度断裂** | 佣金管理 | Model 完整但无 UI 页面 |
| 🟢 **轻度断裂** | 绩效管理 | Model 完整但无 UI 页面 |

---

## 三、功能缺漏清单

### P0 — 必须修复 (业务流程无法闭环)

| # | 缺漏项 | 影响 | 建议方案 |
|---|--------|------|----------|
| 1 | 生产记录管理 (API + 页面) | 生产进度无法录入/跟踪 | 创建 /api/v1/production-records CRUD + 生产看板页面 |
| 2 | 质检管理 (API + 页面) | 检验数据无法录入，缺少质控环节 | 创建 /api/v1/quality-checks CRUD + 质检页面 |
| 3 | 利润核算接入真实数据 | 利润报表完全不可用 | 对接 ProfitCalculation API，去掉 sampleData |
| 4 | 发票/形式发票模块缺失 | 无法向客户开 PI/CI，外贸基本功能缺失 | 创建 Invoice model + API + 页面 |

### P1 — 重要缺失 (影响效率)

| # | 缺漏项 | 影响 | 建议方案 |
|---|--------|------|----------|
| 5 | 询盘→报价一键转换 | 业务员需手动复制数据 | 添加"生成报价单"按钮，自动填充询盘数据到 Quotation |
| 6 | 收款与订单状态联动 | 款到后需手动更新订单状态 | 支付创建时自动推进 Order.status (如确认到款后 → CONFIRMED) |
| 7 | 质检与出货流程衔接 | QC 通过后无法自动触发发货 | QC PASSED 时自动推进 Order.status → READY |
| 8 | 订单状态机嵌入质检节点 | 缺少 QC 作为状态流转条件 | 在 READY→SHIPPED 前增加 QC 前置条件检查 |
| 9 | 佣金管理页面 | 无法查看/审批/发放销售佣金 | 创建 Commission 列表/详情/审批页面 |
| 10 | 绩效规则页面 | 无法配置提成规则 | 创建 PerformanceRule 配置页面 |

### P2 — 建议增强 (体验优化)

| # | 缺漏项 | 说明 |
|---|--------|------|
| 11 | 出口单证生成 | 装箱单(Packing List)、报关单、产地证模板 |
| 12 | 多币种汇率自动获取 | 汇率手动维护，未接入实时汇率 API |
| 13 | 邮件发送集成 | /send 路由标记 TODO，未集成邮件服务 |
| 14 | 询盘状态迁移校验器 | 防止非法状态跳转 (类似 order-status-machine) |
| 15 | 报价单过期自动判断 | 有 validityDays 但无定时任务检查过期 |
| 16 | 应收应付自动核销 | 目前前端手动计算 balance |
| 17 | 超期订单预警 | 无 deliveryDeadline 超期提醒 |

---

## 四、状态机覆盖度矩阵

| 实体 | 有状态机校验 | 有页面 | 有 API | 状态完整度 |
|------|-------------|--------|--------|-----------|
| Inquiry | ❌ | ✅ | ✅ | ⭐⭐⭐ (6态) |
| Quotation | ❌ | ✅ | ✅ | ⭐⭐⭐ (6态) |
| Order | ✅ ✅ | ✅ | ✅ | ⭐⭐⭐⭐⭐ (8态) |
| ProductionRecord | ❌ | ❌ | ❌ | ⭐⭐⭐ (5态) |
| QualityCheck | ❌ | ❌ | ❌ | ⭐⭐⭐ (5态) |
| Shipment | ❌ | ✅ | ✅ | ⭐⭐⭐ (5态) |
| OutboundOrder | ❌ (String) | ✅ | ✅ | ⭐⭐⭐ (6态) |
| LogisticsOrder | ❌ (硬编码) | ✅ | ✅ | ⭐⭐⭐⭐⭐ (11态) |

---

## 五、结论与建议

**整体评价**: Trade ERP 的系统架构和数据模型设计扎实，覆盖了外贸 ERP 的主要业务实体。订单模块和物流模块的质量较高，有完整的状态机约束。但**生产管理、质检管理、利润核算**三个环节存在严重断裂，导致"询盘→利润核算"的完整业务链路无法实际闭环。

**建议修复优先级**:
1. **立刻 (P0)**: 补齐生产记录 + 质检管理 + 利润核算接入 + 发票模块
2. **短期 (P1)**: 打通询盘→报价一键转换、收款→订单联动、质检→出货衔接
3. **中期 (P2)**: 出口单证、邮件集成、汇率自动获取、超期预警

完成 P0+P1 修复后，评分可从 67 提升至 85+。
