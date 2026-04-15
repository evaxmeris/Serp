# 阿里国际站订单自动同步 - 实现方案

## 架构概述

**同步模式：** 定时轮询（2h 默认可调）+ 手动触发
**部署方式：** 完全内置于 Next.js ERP 系统，生产环境自包含运行
**阿里 API：** REST API 轮询（阿里国际站不支持 Webhook 推送）

---

## 文件结构

```
src/lib/alibaba/
├── client.ts          # 阿里 API 客户端（签名、认证、请求）
├── order-sync.ts      # 订单同步核心逻辑（拉取、映射、保存）
├── types.ts           # 阿里 API 响应类型定义
├── mapper.ts          # 阿里订单 → ERP 订单字段映射
└── config.ts          # 同步配置管理（间隔、开关、凭据）

src/app/api/alibaba/
├── sync/route.ts      # POST 手动触发同步
├── sync-status/route.ts # GET 查询同步状态
└── config/route.ts    # GET/PUT 同步配置管理

src/components/alibaba-sync/
├── sync-panel.tsx     # 同步控制面板（状态、按钮、配置）
├── sync-log-table.tsx # 同步日志表格
└── sync-config-form.tsx # 配置表单（间隔时间、开关）

src/app/(dashboard)/alibaba-sync/page.tsx  # 同步管理页面

prisma/schema.prisma   # 新增：AlibabaSyncLog, AlibabaSyncConfig
```

---

## 数据库扩展

### 1. AlibabaSyncConfig（同步配置）

```prisma
model AlibabaSyncConfig {
  id              String   @id @default(cuid())
  enabled         Boolean  @default(true)
  syncIntervalMin Int      @default(120)  // 默认 2 小时（分钟）
  lastSyncAt      DateTime?
  lastSyncStatus  String?  // success, failed, partial
  appKey          String   // 阿里 API AppKey
  appSecret       String   // 阿里 API AppSecret
  accessToken     String   // 访问令牌
  refreshToken    String?  // 刷新令牌
  tokenExpiresAt  DateTime? // 令牌过期时间
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("alibaba_sync_config")
}
```

### 2. AlibabaSyncLog（同步日志）

```prisma
model AlibabaSyncLog {
  id          String   @id @default(cuid())
  triggerType String   // manual, scheduled
  status      String   // success, failed, partial
  ordersFound Int      @default(0)
  ordersSynced Int     @default(0)
  ordersFailed Int     @default(0)
  errorMessage String?
  startedAt   DateTime @default(now())
  completedAt DateTime?
  durationMs  Int?

  @@map("alibaba_sync_logs")
  @@index([startedAt])
}
```

---

## 核心流程

### 定时轮询机制

```
Next.js Server 启动
    ↓
初始化同步调度器 (src/lib/alibaba/scheduler.ts)
    ↓
setInterval(同步函数，syncIntervalMin * 60 * 1000)
    ↓
调用 alibaba.seller.order.list
    ↓
遍历订单 → 字段映射 → 创建/更新 ERP Order
    ↓
记录同步日志
```

### 手动触发

```
用户点击"立即同步"按钮
    ↓
POST /api/alibaba/sync
    ↓
执行同步逻辑（同定时轮询）
    ↓
返回同步结果（成功/失败/部分成功）
```

---

## 字段映射详细方案

### 订单主表映射

| 阿里字段 | ERP 字段 | 转换逻辑 |
|---------|---------|---------|
| `orderId` | `orderNo` | 前缀 `ALI-` + 订单号 |
| `buyerInfo.companyName` | `customerId` | 查找/创建客户 |
| `tradeAmount.value` | `totalAmount` | 直接映射 |
| `currency` | `currency` | 直接映射 |
| `status` | `status` | 状态映射（见下表） |
| `gmtCreate` | `createdAt` | ISO 时间转换 |
| `sellerMemo` | `notes` | 卖家备注 |
| `buyerMemo` | `internalNotes` | 买家备注 |

### 状态映射

| 阿里状态 | ERP 状态 | 说明 |
|---------|---------|------|
| `WAIT_BUYER_PAY` | `PENDING` | 等待买家付款 |
| `WAIT_SELLER_SEND_GOODS` | `CONFIRMED` | 等待卖家发货 |
| `WAIT_BUYER_CONFIRM_GOODS` | `SHIPPED` | 买家确认收货 |
| `TRADE_FINISHED` | `COMPLETED` | 交易完成 |
| `TRADE_CLOSED` | `CANCELLED` | 交易关闭 |

### 订单明细映射

| 阿里字段 | ERP OrderItem 字段 | 说明 |
|---------|-------------------|------|
| `productId` | `productSku` | 阿里产品 ID |
| `subject` | `productName` | 产品名称 |
| `price.value` | `unitPrice` | 单价 |
| `quantity` | `quantity` | 数量 |
| `currency` | `currency` | 币种 |

---

## 实现步骤（按优先级）

### Phase 1：基础架构（核心）
1. ✅ 扩展 Prisma Schema
2. ✅ 创建阿里 API 客户端
3. ✅ 实现订单同步逻辑
4. ✅ 创建同步 API 路由

### Phase 2：调度与界面
5. ⏳ 实现定时调度器
6. ⏳ 创建同步管理页面
7. ⏳ 添加同步状态显示

### Phase 3：增强功能
8. 📋 令牌自动刷新
9. 📋 错误重试机制
10. 📋 同步通知（钉钉/邮件）

---

## 环境变量配置

```env
# 阿里国际站 API 配置
ALIBABA_APP_KEY=504486
ALIBABA_APP_SECRET=1fb2a78f6e7dab63d9ec81d10462961f
ALIBABA_ACCESS_TOKEN=<初始令牌>
ALIBABA_SYNC_INTERVAL=120  # 同步间隔（分钟），默认 120
ALIBABA_SYNC_ENABLED=true  # 是否启用同步
```

---

## 安全考虑

1. **凭据存储：** 使用环境变量 + 数据库加密存储
2. **API 限流：** 阿里 API 有调用频率限制，需控制请求速率
3. **幂等性：** 同步逻辑需支持重复执行（根据 orderId 去重）
4. **错误处理：** 网络异常、API 错误需记录日志并自动重试

---

## 测试计划

1. **单元测试：** API 客户端签名、字段映射逻辑
2. **集成测试：** 同步流程端到端测试（使用阿里沙箱环境）
3. **回归测试：** 确保不影响现有订单功能

---

## 后续扩展

- 支持多店铺（多个阿里账号）
- 产品同步（产品信息、库存）
- 物流状态同步
- 自动创建采购单（关联供应商）
