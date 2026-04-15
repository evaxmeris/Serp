# 多平台订单同步框架 - 架构设计

## 设计原则

1. **平台无关性**：核心同步逻辑与具体平台解耦
2. **插件化架构**：每个平台作为独立适配器实现
3. **统一数据模型**：所有平台订单转换为标准格式
4. **动态注册**：支持运行时添加新平台适配器
5. **配置驱动**：每个平台独立配置（凭据、间隔、开关）

---

## 架构概览

```
┌─────────────────────────────────────────────────┐
│                 调度器 (Scheduler)               │
│  - 定时轮询所有启用平台                          │
│  - 支持手动触发指定平台                          │
│  - 错误重试与限流控制                            │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│              平台注册表 (Registry)               │
│  - 维护所有平台适配器                            │
│  - 根据平台类型路由请求                          │
│  - 支持动态注册/注销                             │
└─────────┬───────────┬──────────┬────────────────┘
          │           │          │
          ▼           ▼          ▼
┌────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  Alibaba   │ │  TikTok  │ │  Amazon  │ │  Shopify │
│  Adapter   │ │  Adapter │ │  Adapter │ │  Adapter │
│ (已实现)   │ │ (预留)   │ │ (预留)   │ │ (预留)   │
└─────┬──────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
      │             │            │              │
      ▼             ▼            ▼              ▼
┌─────────────────────────────────────────────────┐
│            统一订单格式 (UnifiedOrder)           │
│  - 标准字段定义                                  │
│  - 各适配器负责转换                              │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│              ERP 数据层                          │
│  - Prisma ORM                                    │
│  - 订单创建/更新                                 │
│  - 客户匹配/创建                                 │
│  - 同步日志记录                                  │
└─────────────────────────────────────────────────┘
```

---

## 核心接口定义

### 1. 平台适配器接口

```typescript
interface PlatformAdapter {
  // 平台标识
  readonly platformCode: string;  // 'alibaba', 'tiktok', 'amazon', 'shopify'
  readonly platformName: string;  // '阿里国际站', 'TikTok Shop', 'Amazon', 'Shopify'
  
  // 认证
  authenticate(config: PlatformConfig): Promise<AuthResult>;
  
  // 订单同步
  fetchOrders(params: FetchOrdersParams, config: PlatformConfig): Promise<UnifiedOrder[]>;
  fetchOrderDetail(orderId: string, config: PlatformConfig): Promise<UnifiedOrder>;
  
  // 订单状态更新
  updateOrderStatus(orderId: string, status: string, config: PlatformConfig): Promise<void>;
  
  // 可选：Webhook 支持
  setupWebhook?(webhookUrl: string, config: PlatformConfig): Promise<void>;
  handleWebhook?(payload: any): Promise<UnifiedOrder | null>;
}
```

### 2. 统一订单格式

```typescript
interface UnifiedOrder {
  // 平台信息
  platformCode: string;      // 来源平台
  platformOrderId: string;   // 平台原始订单号
  
  // 订单基本信息
  orderNo: string;           // ERP 订单号
  status: string;            // 统一状态
  currency: string;          // 币种
  totalAmount: number;       // 总金额
  paidAmount: number;        // 已付金额
  
  // 时间信息
  createdAt: Date;
  updatedAt: Date;
  
  // 客户信息
  customer: {
    email?: string;
    companyName?: string;
    contactName?: string;
    phone?: string;
    country?: string;
    address?: string;
  };
  
  // 订单明细
  items: UnifiedOrderItem[];
  
  // 物流信息
  shippingInfo?: {
    trackingNumber?: string;
    carrier?: string;
    address?: string;
  };
  
  // 原始数据（用于调试）
  rawData?: any;
}

interface UnifiedOrderItem {
  platformProductId: string;
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  currency: string;
  imageUrl?: string;
  specification?: string;
}
```

### 3. 平台配置

```typescript
interface PlatformConfig {
  id: string;
  platformCode: string;
  enabled: boolean;
  syncIntervalMin: number;
  lastSyncAt?: Date;
  credentials: Record<string, string>;  // 平台特定凭据
  settings: Record<string, any>;        // 平台特定设置
}
```

---

## 数据库设计

### PlatformSyncConfig（多平台配置表）

```prisma
model PlatformSyncConfig {
  id              String   @id @default(cuid())
  platformCode    String   // 'alibaba', 'tiktok', 'amazon', 'shopify'
  platformName    String   // 显示名称
  enabled         Boolean  @default(true)
  syncIntervalMin Int      @default(120)
  lastSyncAt      DateTime?
  lastSyncStatus  String?
  credentials     Json     // 平台凭据（加密存储）
  settings        Json     // 平台设置
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([platformCode])
  @@map("platform_sync_configs")
}
```

### PlatformSyncLog（多平台日志表）

```prisma
model PlatformSyncLog {
  id          String   @id @default(cuid())
  platformCode String  // 来源平台
  triggerType String   // manual, scheduled, webhook
  status      String   // success, failed, partial
  ordersFound Int      @default(0)
  ordersSynced Int     @default(0)
  ordersFailed Int     @default(0)
  errorMessage String?
  startedAt   DateTime @default(now())
  completedAt DateTime?
  durationMs  Int?

  @@map("platform_sync_logs")
  @@index([platformCode, startedAt])
}
```

### Order 表扩展

```prisma
model Order {
  // ... 现有字段 ...
  
  // 新增：多平台来源字段
  sourcePlatform String?  // 'alibaba', 'tiktok', 'amazon', 'shopify'
  platformOrderId String? // 平台原始订单号
  platformData   Json?    // 平台原始数据（用于调试）
  
  @@map("orders")
}
```

---

## 文件结构

```
src/lib/sync/
├── platform.ts              # 平台适配器接口定义
├── registry.ts              # 平台注册表
├── scheduler.ts             # 统一调度器
├── types.ts                 # 通用类型定义
├── mapper.ts                # 统一映射工具
├── index.ts                 # 导出入口
└── adapters/
    ├── base.ts              # 基础适配器抽象类
    ├── alibaba.ts           # 阿里国际站适配器
    ├── tiktok.ts            # TikTok 适配器（预留）
    ├── amazon.ts            # 亚马逊适配器（预留）
    └── shopify.ts           # 独立站适配器（预留）

src/app/api/sync/
├── route.ts                 # POST /api/sync - 手动触发同步
├── status/route.ts          # GET /api/sync/status - 同步状态
├── config/route.ts          # GET/PUT /api/sync/config - 配置管理
└── webhook/[platform]/route.ts  # POST /api/sync/webhook/[platform] - Webhook 接收

src/components/sync/
├── sync-dashboard.tsx       # 同步控制面板
├── sync-log-table.tsx       # 同步日志表格
├── platform-config-form.tsx # 平台配置表单
└── platform-status-card.tsx # 平台状态卡片

src/app/(dashboard)/sync/page.tsx  # 同步管理页面
```

---

## 实现步骤

### Phase 1：通用架构（当前）
1. ✅ 定义平台接口和统一订单格式
2. ✅ 实现平台注册表
3. ✅ 实现统一调度器
4. ✅ 扩展数据库（多平台支持）

### Phase 2：阿里适配器
5. ⏳ 实现阿里国际站适配器
6. ⏳ 测试阿里订单同步

### Phase 3：其他平台预留
7. 📋 TikTok Shop 适配器骨架
8. 📋 Amazon SP-API 适配器骨架
9. 📋 Shopify 适配器骨架

### Phase 4：高级功能
10. 📋 Webhook 支持（如果平台支持）
11. 📋 令牌自动刷新
12. 📋 错误重试与告警
13. 📋 业务员通知

---

## 扩展新平台的步骤

当需要添加新平台时（如 TikTok）：

1. **创建适配器**：`src/lib/sync/adapters/tiktok.ts`
2. **实现接口**：实现 `PlatformAdapter` 接口
3. **注册适配器**：在 `registry.ts` 中注册
4. **配置数据库**：在 `PlatformSyncConfig` 中添加配置
5. **测试**：使用 TikTok 沙箱环境测试

**无需修改核心同步逻辑！**

---

## API 端点设计

### 手动触发同步

```
POST /api/sync
Body: { platformCode: 'alibaba' }  // 不传则同步所有平台
```

### 查询同步状态

```
GET /api/sync/status
Response: {
  platforms: [
    { code: 'alibaba', name: '阿里国际站', enabled: true, lastSyncAt: '...', status: 'success' },
    { code: 'tiktok', name: 'TikTok Shop', enabled: false, lastSyncAt: null, status: 'not_configured' },
  ]
}
```

### 配置管理

```
GET /api/sync/config?platformCode=alibaba
PUT /api/sync/config
Body: {
  platformCode: 'alibaba',
  enabled: true,
  syncIntervalMin: 120,
  credentials: { ... }
}
```

### Webhook 接收（如果平台支持）

```
POST /api/sync/webhook/alibaba
POST /api/sync/webhook/tiktok
POST /api/sync/webhook/shopify
```

---

## 安全考虑

1. **凭据加密**：数据库中的 credentials 字段应加密存储
2. **API 限流**：各平台有不同调用限制，适配器需实现限流
3. **幂等性**：同步逻辑支持重复执行（根据 platformOrderId 去重）
4. **Webhook 验证**：验证 Webhook 请求来源（签名验证）
5. **审计日志**：所有同步操作记录详细日志

---

## 监控与告警

1. **同步失败告警**：连续失败 N 次后通知管理员
2. **延迟告警**：超过配置间隔未同步时告警
3. **性能监控**：记录每次同步耗时
4. **数据一致性**：定期校验平台订单与 ERP 订单一致性
