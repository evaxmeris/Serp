File unchanged since last read. The content from the earlier read_file result in this conversation is still current — refer to that instead of re-reading.

## [v0.10.0] - 2026-04-27

### 🔒 安全加固 (12项)
- 密码 bcrypt 加密存储，消除明文密码漏洞
- 报价单全端点认证 + 询盘行级权限检查
- 登录速率限制 (20次/15分钟) + CSRF 保护
- Debug 端点生产环境硬禁用
- 批量导出数量上限 (10000→100)
- 产品详情/更新端点认证
- 权限初始化 ADMIN 保护
- Row-level filter 全局统一应用
- 批准/拒绝事务原子化防竞态

### 📊 数据准确性 (4项)
- Dashboard 7个SQL查询排除软删除数据
- 订单金额 Decimal 精度修正
- lastSyncAt 仅在成功时更新
- 库存 availableQty 动态计算

### 🚚 物流管理模块 (全新)
- 物流服务商管理：CRUD + 证照上传(≤500KB)
- 物流订单管理：四级审批(提交→校对→审批→财务)
- 费用明细(海运费/报关费/港杂等) + 物品明细

### ⚙️ 审批流程配置引擎 (全新)
- 可配置审批流程：步骤+审批人(用户/角色)
- 审批实例跟踪 + 审批历史记录
- 支持产品采购/物流采购等多种审批类型

### 🏗️ 基础设施 (10+个新模块)
- auth-unified.ts 统一认证入口
- order-status-machine.ts 订单状态机
- status-config.ts 状态颜色统一配置
- crypto-utils.ts AES-256-GCM 加密
- id-generator.ts 编号生成器
- pagination/empty-state/skeleton-table/responsive-table 通用组件

### 🐛 修复
- 订单号竞态条件 (count+1 → 时间戳+随机)
- 批量导入 N+1 查询 → createMany
- customerId UUID→CUID 兼容
- 侧边栏多路径同时高亮
- React hydration warnings

---
