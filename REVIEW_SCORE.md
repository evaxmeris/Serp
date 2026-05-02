# ERP 系统修复后全角色审查评分报告

审查时间: 2026-05-03
项目路径: /Users/apple/clawd/trade-erp
审查范围: 销售端(SALES) + 供应链端(PURCHASING/WAREHOUSE) + 财务/管理端(FINANCE/ADMIN) 共 30+ 模块

---

## 1. 销售端 (SALES 角色)

### 1.1 客户批量导出 `/api/customers/batch-export`
评分: 4/5
优点:
- 边界限制 (limit 默认 100, 最大 1000)
- CSV 正确转义逗号/引号/换行
- 行级过滤 (非 ADMIN 只能导出自己客户)
- 软删除过滤 (deletedAt: null)
- 完善的错误处理
问题:
- 无缓存/去重校验 (同客户可能被多次导出)
- CSV 字段值中的中文逗号可能被部分 CSV 解析器误解 (转义正确)

### 1.2 询盘跟进记录 `/api/inquiries/[id]/follow-ups`
评分: 5/5
优点:
- Zod Schema 完整验证 (type 枚举, content 非空, nextFollowUp 日期格式)
- 行级权限控制 (非 ADMIN 只能操作自己的询盘)
- 正确的 REST 资源路径设计
- 返回 consistent 错误响应

### 1.3 询盘 CRUD `/api/inquiries/[id]`
评分: 5/5
优点:
- 状态机验证 (NEW→CONTACTED→QUOTED→NEGOTIATING→WON/LOST)
- 软删除实现 (deletedAt, 非真正删除)
- 关联报价单检查 (有报价单时 409 拒绝删除)
- 行级权限控制
- 完整的 CRUD + 状态流转

### 1.4 报价单 `/api/quotations/[id]`
评分: 4/5
优点:
- GET 自动检测过期并更新 EXPIRED 状态
- 软删除
- Items 事务更新 (先删后建)
- 包含客户和产品信息
问题:
- PUT 无状态机验证 (可随意更改 status)
- deleteMany + create 组合在并发下可能有数据丢失风险
- 无行级权限控制 (任何人可更新任何报价单)

### 1.5 报价单查看标记 `/api/quotations/[id]/view`
评分: 5/5
优点:
- 专门路由, 职责单一
- 状态验证 (仅 SENT→VIEWED)
- 原子操作

### 1.6 订单批量确认 `/api/orders/batch-confirm`
评分: 3/5
问题:
- BUG: `forbiddenResponse` 未导入 (第 19 行) — 编译/运行时错误
- 未使用 order-status-machine 进行状态验证
- PENDING→CONFIRMED 硬编码, 与状态机脱节
- 无事务回滚友好错误信息

### 1.7 订单批量发货 `/api/orders/batch-ship`
评分: 3/5
问题:
- 使用硬编码状态 CONFIRMED→SHIPPED, 未通过状态机校验
- 出库单生成使用 `warehouseId: 'default'` 硬编码
- 出库单号生成无唯一性保证 (Math.random)
- 事务内调用 for 循环中的 findFirst/create 模式效率低

### 1.8 订单状态机 `/lib/order-status-machine.ts`
评分: 5/5
优点:
- 完整的状态流转映射表
- ADMIN 可跳过中间状态但不可逆终态
- 明确的终态检查 (CANCELLED/COMPLETED)
- 友好的中文错误信息
- canCancel 辅助函数

### 销售端汇总评分: 4.1/5

---

## 2. 供应链端 (PURCHASING + WAREHOUSE)

### 2.1 采购收货 `/api/v1/purchase-orders/[id]/receipts`
评分: 5/5
优点:
- 完整的事务包裹 (收货+入库+库存更新+状态推进)
- 多项状态验证 (CONFIRMED/IN_PRODUCTION/READY/PARTIAL 可收货)
- 乐观锁库存更新 (version 字段)
- 库存流水记录 (inventoryLog)
- 自动状态推进 (全部收货→RECEIVED, 部分→PARTIAL)
- items 归属验证

### 2.2 采购订单 CRUD+PATCH `/api/v1/purchase-orders/[id]`
评分: 4/5
优点:
- PATCH 状态机验证 (VALID_TRANSITIONS 映射表)
- 软删除+关联检查 (有入库单/付款则拒绝删除)
- 参数 Zod 验证 (PurchaseOrderIdSchema)
- 取消流程完整 (cancelReason)
问题:
- PUT 无状态机验证
- PATCH 状态映射表硬编码在文件内, 未复用统一状态机
- GET 无分页参数说明

### 2.3 入库确认 `/api/v1/inbound-orders/[id]/confirm`
评分: 5/5
优点:
- 乐观锁库存更新
- 事务包裹所有操作
- 支持部分入库 (items 可选)
- 库存流水记录
- 状态检查 (COMPLETED/CANCELLED 拒绝)

### 2.4 出库单创建 `/api/v1/outbound-orders`
评分: 5/5
优点:
- 完整的事务 + 乐观锁库存扣减
- 库存检查 (getAvailableQty 动态计算)
- 库存流水记录
- Zod Schema 验证
- 查询支持多维度筛选 (status/orderId/search)

### 2.5 出库单取消 `/api/v1/outbound-orders/[id]/cancel`
评分: 5/5
优点:
- 状态检查 (仅 PENDING 可取消)
- 乐观锁库存恢复
- 库存流水记录 (type: RETURN)
- 未扣减库存时不恢复 (避免重复操作)

### 2.6 出库单批量操作 `/api/v1/outbound-orders/batch`
评分: 4/5
问题:
- 未使用事务 (逐一处理, 部分失败无全局回滚)
- 批量取消逻辑与单条取消重复, 可抽取公共函数
- 批量导出 CSV 字段未转义
- 无库存恢复乐观锁 (和单条取消一致)
优点:
- 支持 confirm/cancel/export 三种操作
- 部分失败有详细错误报告

### 2.7 库存管理 `/api/v1/inventory`
评分: 5/5
优点:
- 乐观锁 + 重试机制 (最多 3 次, 100ms 间隔)
- 动态计算 availableQty (computeAvailableQty)
- 库存流水记录
- 库存调整类型枚举 (IN/OUT/ADJUSTMENT/TRANSFER/RETURN)
- 负库存保护 (afterQty < 0 → 409)

### 2.8 物流审批引擎 `/api/v1/logistics/orders/[id]/{approve,review,finance-confirm}`
评分: 5/5
优点:
- 三步审批完整 (review→approve→financeConfirm)
- 审批人权限验证 (approverId/reviewerId/financeId + ADMIN 兜底)
- 审批实例联动 (approvalInstance + approvalActionRecord)
- 审批步骤验证 (禁止跳过)
- 备注追加 (notes 保留完整审批链)

### 供应链端汇总评分: 4.7/5

---

## 3. 财务 + 管理端 (FINANCE + ADMIN)

### 3.1 收款管理 `/api/v1/payments`
评分: 4/5
优点:
- 收款自动创建交易流水 (Transaction INCOME)
- 订单付款状态自动推进 (updateOrderPaymentStatus)
- 权限检查 (payments:create)
- 事务包裹
问题:
- updateOrderPaymentStatus 有逻辑 BUG: PENDING→CONFIRMED→COMPLETED 两阶段推进中, CONFIRMED 阶段被覆盖 (第 60-63 行: status 被连续赋值两次, 最终为 COMPLETED, 跳过了 CONFIRMED 状态)
- 未使用状态机校验订单状态推进

### 3.2 财务概览 `/api/v1/finance/summary`
评分: 4/5
优点:
- 并发查询 (Promise.all)
- 应收/应付/本月收支完整覆盖
- 软删除过滤
问题:
- 应收仅统计 balanceAmount > 0, 未考虑已逾期金额标记
- 无缓存 (每次查询全量汇总)

### 3.3 财务管理页面 `/finance/page.tsx`
评分: 4/5
优点:
- 良好的 Skeleton 加载态
- 四个概览卡片交互
- 快捷操作导航
问题:
- 暂无收款/付款记录占位 (hardcoded "暂无" 文案)
- 利润趋势无真实数据展示

### 3.4 费用报销 `/api/v1/reimbursements`
评分: 3/5
问题:
- 报销单号生成简单 (RE-${Date.now()}) 无唯一性保证
- 无分页参数验证
- 报销单号生成应在事务内
- 无 Zod Schema 验证 (直接解构 body)
- 无审批流程关联
- connect 和 expenseIds 重复存储

### 3.5 利润报表 `/api/v1/reports/profit`
评分: 5/5
优点:
- 真实利润计算 (销售收入 - 采购成本 - 物流费 - 平台费 - 其他费用)
- 平台费用来自实际平台订单 (platformFee + commissionFee)
- 上期对比 (环比) + 同比
- 按期间趋势 (月/季/年)
- 按产品/客户分组
- 报表快照持久化 (profitCalculation 表)

### 3.6 审批工作流 `/api/v1/approval-workflows`
评分: 5/5
优点:
- Zod Schema 完整验证 (含 code 正则校验)
- code 唯一性检查
- 事务创建 (流程+步骤+审批人)
- 幂等 seed (code 已存在跳过)

### 3.7 权限缓存 `/lib/permissions.ts`
评分: 5/5
优点:
- 5 分钟 TTL 内存缓存
- 通配符匹配 (module:*)
- ADMIN '*' 快速路径
- 过期清理 + 手动失效
- 向后兼容旧单角色系统

### 3.8 报表调度器 `/lib/reports/scheduler.ts`
评分: 3/5
问题:
- nextRunAt 计算简单粗暴 (固定 +24h), 未使用 cron-parser
- 报表数据实际为空 (data: {})
- 无报表生成逻辑 (仅创建空记录)
- 调度器与报表 API 没有真正的集成

### 3.9 订单同步 `/lib/sync/order-sync.ts`
评分: 5/5
优点:
- 互斥锁 (防止并发同步)
- 指数退避重试 (最多 3 次, 1s/2s/4s)
- 增量同步 (基于 lastSyncAt)
- 分页拉取 + 安全限制 (MAX_PAGES)
- 同步日志完整记录
- 失败不更新 lastSyncAt (保留重试机会)
- 通知集成 (检查是否存在通知逻辑)

### 3.10 竞品分析 `/api/v1/competitors`
评分: 4/5
优点:
- 支持 category 筛选
- 搜索支持 (competitorName/productName)
- 分页
问题:
- 无 Zod Schema 验证 (body 直接解构)
- 无行级权限控制

### 财务/管理端汇总评分: 4.2/5

---

## 总体评分

| 角色 | 模块数 | 平均分 | 评分等第 |
|------|--------|--------|----------|
| SALES (销售端) | 8 | 4.1 | 良好 |
| PURCHASING+WAREHOUSE (供应链端) | 8 | 4.7 | 优秀 |
| FINANCE+ADMIN (财务/管理端) | 10 | 4.2 | 良好 |
| **总体** | **26** | **4.3/5** | **良好** |

---

## 改善建议清单

### P0 - 必须修复 (影响运行)

1. **batch-confirm 缺少 forbiddenResponse 导入**
   - 文件: `src/app/api/orders/batch-confirm/route.ts:19`
   - 影响: 编译/运行时 ReferenceError
   - 修复: 在 import 中添加 forbiddenResponse

2. **payments 中订单状态推进逻辑 BUG**
   - 文件: `src/app/api/v1/payments/route.ts:60-63`
   - 问题: `status` 被连续赋值两次 (CONFIRMED 被 COMPLETED 覆盖)
   - 修复: 应分两步推进或在事务内依次执行

### P1 - 重要改善

3. **报价单 PUT 无状态机验证**
   - 文件: `src/app/api/quotations/[id]/route.ts`
   - 建议: 添加状态流转验证, 参照 inquiries/[id] 的模式

4. **订单批量操作硬编码状态 (未使用状态机)**
   - 文件: `batch-confirm/route.ts`, `batch-ship/route.ts`
   - 建议: 引入 `canTransition` / `validateTransition` 进行状态验证

5. **批量发货出库单 warehouseId 硬编码 'default'**
   - 文件: `batch-ship/route.ts:73`
   - 建议: 从请求参数或订单关联仓库获取

6. **报销单号无唯一性保证**
   - 文件: `reimbursements/route.ts`
   - 建议: 使用 UUID 或数据库序列

### P2 - 建议优化

7. **批量操作缺少事务保护**
   - 文件: `outbound-orders/batch/route.ts`
   - 建议: 使用 $transaction 包裹, 部分失败回滚

8. **报表调度器缺少 cron-parser 和真正报表生成**
   - 文件: `scheduler.ts`
   - 建议: 集成 `cron-parser`, 实际调用 profit report API

9. **竞品分析无 Zod 验证**
   - 文件: `competitors/route.ts`
   - 建议: 添加输入 Schema 验证

10. **批量出库导出 CSV 未转义**
    - 文件: `outbound-orders/batch/route.ts:284-301`
    - 建议: 添加 CSV 转义逻辑

11. **采购订单 PATCH 状态机与 order-status-machine 脱节**
    - 文件: `purchase-orders/[id]/route.ts`
    - 建议: 统一使用或借鉴 order-status-machine 模式

12. **报价单无行级权限控制**
    - 文件: `quotations/[id]/route.ts`
    - 建议: 添加 assignedTo 检查

13. **财务概览无缓存**
    - 文件: `finance/summary/route.ts`
    - 建议: 添加 5 分钟内存缓存减少 DB 压力

14. **批量发货出库单号无唯一性保证**
    - 文件: `batch-ship/route.ts:66-68`
    - 建议: 使用数据库序列或 UUID

---

*报告生成日期: 2026-05-03*
*审查方法: 代码静态分析 + 逻辑推理*
