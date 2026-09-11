# 外贸中台 · 亚马逊业务域设计要点 v1.0

> 状态：**设计定稿（开发依据）** | 日期：2026-08-29 | 作者：应亮（业务）+ Hermes（设计）
> 前序文档：docs/amazon-business-hub-plan.md（规划版）
> 本文档定位：后续开发**必须**遵循的设计规范。开发顺序按「九、里程碑」执行。
> 已确认决策：①「亚马逊运营」一级模块 ②统一广告模型跨平台复用 ③M1=投流优化中心+站点管理骨架 ④广告-库存联动规划预留（M3实现）

---

## 一、设计目标

在 Trade ERP 现有中台骨架（PlatformAdapter 抽象已存在）之上，新增**广告业务域**，形成可扩展到 库存域/补货域/多平台 的完整架构。

核心设计原则（贯穿全文）：
1. **三维坐标**：所有业务实体挂 `platformCode × marketplaceId × domain`
2. **统一抽象**：平台差异由适配器隔离，业务层只认统一模型（UnifiedOrder 的成功经验复制到广告域）
3. **决策引擎平台无关**：引擎输出抽象动作，适配器翻译成平台 API
4. **外部 ID 落库**：平台原始 ID 存 `externalId`，API 对接零迁移
5. **快照模式**：同步数据落库（AdReport/FbaInventory），不实时外呼

---

## 二、架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    前端页面层 (App Router)               │
│  亚马逊运营: 投流优化中心 | 站点管理 | 库存对接 | 补货计划 | 数据看板 │
├─────────────────────────────────────────────────────────┤
│                    API 层 (route handlers)              │
│  /api/ads/reports  /api/ads/decisions  /api/ads/expansions │
│  /api/ads/campaigns  /api/ads/marketplaces  ...         │
├─────────────────────────────────────────────────────────┤
│                  服务层 (services)                      │
│  AdsDecisionEngine（决策引擎，平台无关）                  │
│  ├─ analyzer.ts   组合粒度分析（投放词×匹配）             │
│  ├─ thresholds.ts 统计显著性否定阈值 + 止损线             │
│  ├─ bidding.ts    竞价矩阵（匹配×词长）                  │
│  └─ expansion.ts  拓词引擎（词根→变体→播种）              │
├─────────────────────────────────────────────────────────┤
│                 平台适配器层 (src/lib/sync/adapters)     │
│  AmazonAdapter（扩展: fetchAds/fetchReport/applyAction） │
│  TikTokAdapter（将来）  ShopifyAdapter（将来）           │
├─────────────────────────────────────────────────────────┤
│                    数据层 (Prisma)                      │
│  PlatformAccount(已有) → AdAccount/AdCampaign/AdKeyword/│
│  AdReport/AdExpansionSuggestion/AmazonMarketplace       │
└─────────────────────────────────────────────────────────┘
```

**分层职责**：
- 页面层：展示 + 交互，不写业务逻辑
- API 层：鉴权 + 参数校验 + 调服务层
- 服务层：决策引擎（纯函数，可单测）
- 适配器层：唯一接触平台 API 的地方
- 数据层：Prisma 模型 + 迁移

---

## 三、数据模型设计（Prisma，核心）

### 3.1 站点主数据（M1 建表）

```prisma
model AmazonMarketplace {
  id            String   @id @default(cuid())
  code          String   @unique   // 'US','CA','BR','UK','DE','FR','JP'
  name          String              // '美国','加拿大','巴西'...
  currency      String              // 'USD','CAD','BRL','GBP','EUR'
  region        String              // 'NA','EU','FE'
  adsEndpoint   String?             // 广告API端点（NA/EU/FE 不同）
  spApiEndpoint String?             // SP-API 端点（库存/订单用）
  status        String   @default('active')  // active|inactive
  sortOrder     Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@map("amazon_marketplaces")
}
```

**种子数据（seed）**：US/CA/BR/UK/DE/FR/ES/IT/JP 九站点预置。

### 3.2 广告账户（M1，关联已有 PlatformAccount）

```prisma
model AdAccount {
  id               String   @id @default(cuid())
  platformCode     String   @default('amazon')   // amazon|tiktok|shopify
  marketplaceId    String                          // 关联 AmazonMarketplace（amazon 时必填）
  platformAccountId String  @unique               // 关联已有 PlatformAccount（凭据存那里）
  name             String                          // 显示名，如 '美国站主账户'
  status           String   @default('active')
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  @@map("ad_accounts")
}
```

> 凭据（clientId/secret/token）**不重复存储**，复用 `PlatformAccount` 表（已有 region 字段）。

### 3.3 广告活动（M1）

```prisma
model AdCampaign {
  id            String   @id @default(cuid())
  accountId     String                            // → AdAccount
  externalId    String                            // 亚马逊 campaignId（API 对接零迁移）
  name          String
  status        String   @default('ENABLED')      // ENABLED|PAUSED|ARCHIVED
  dailyBudget   Float?
  targetingType String   @default('MANUAL')       // MANUAL|AUTO
  marketplaceId String
  rawData       Json?                             // 平台原始响应快照
  lastSyncedAt  DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@unique([accountId, externalId])
  @@map("ad_campaigns")
}
```

### 3.4 投放单元（核心抽象，M1）——跨平台统一

```prisma
model AdTarget {
  id            String   @id @default(cuid())
  campaignId    String                            // → AdCampaign
  targetType    String   @default('KEYWORD')      // KEYWORD|AUDIENCE|PLACEMENT|PRODUCT
  targetValue   String                            // 关键词文本 或 受众ID 或 商品ASIN
  matchType     String?                           // EXACT|PHRASE|BROAD（仅 KEYWORD 用）
  bid           Float?                            // 当前竞价（美元）
  status        String   @default('ENABLED')
  // 平台特有配置（TikTok受众参数、Google匹配设置等，JSON 存储）
  settings      Json?
  // 决策引擎状态
  lastAction    String?                           // RAISE_BID|LOWER_BID|PAUSE|NEGATE|EXPAND
  lastActionAt  DateTime?
  lastDecisionId String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([campaignId])
  @@map("ad_targets")
}
```

**命名说明**：表名用 AdTarget 而非 AdKeyword——因为要容纳受众/商品/版位等多类投放对象，命名必须中立（这是跨平台复用的关键设计决策）。

### 3.5 决策记录（M1）——每次分析的审计

```prisma
model AdDecision {
  id            String   @id @default(cuid())
  targetId      String                            // → AdTarget
  campaignId    String?
  reportId      String?                           // → AdReport 来源
  // 数据快照（决策时点的数据，防后续变动）
  spend         Float
  sales         Float
  orders        Int
  clicks        Int
  impressions   Int
  acos          Float?                            // 亚马逊口径；其他平台存对应指标
  // 决策
  action        String                            // RAISE_BID|LOWER_BID|PAUSE|NEGATE|EXPAND|KEEP|WATCH
  reason        String                            // 决策原因（人可读）
  detail        Json?                             // 引擎输出明细（阈值命中、规则名）
  // 执行状态
  execStatus    String   @default('PENDING')      // PENDING|APPLIED|SKIPPED|FAILED
  executedAt    DateTime?
  createdAt     DateTime @default(now())
  @@index([targetId, createdAt])
  @@map("ad_decisions")
}
```

### 3.6 报告快照（M1）——导入/同步的原始数据

```prisma
model AdReport {
  id            String   @id @default(cuid())
  accountId     String
  marketplaceId String
  fileName      String?                           // 手动导入的文件名
  source        String   @default('MANUAL')       // MANUAL|API|WEBHOOK
  dateRangeFrom DateTime?
  dateRangeTo   DateTime?
  // 摘要（导入时计算）
  totalSpend    Float    @default(0)
  totalSales    Float    @default(0)
  totalOrders   Int      @default(0)
  totalClicks   Int      @default(0)
  totalImpressions Int   @default(0)
  overallAcos   Float?
  // 分析参数（决策引擎阈值，导入时固化）
  negateThreshold Int?
  spendCap       Float?
  stats          Json?                            // 完整统计 JSON（组合粒度分析结果）
  createdBy      String?
  createdAt     DateTime @default(now())
  @@map("ad_reports")
}
```

### 3.7 拓词建议（M1）

```prisma
model AdExpansionSuggestion {
  id            String   @id @default(cuid())
  reportId      String
  rootTerm      String                            // 出单词根
  orders        Int
  acos          Float?
  reason        String                            // 拓词理由
  variants      Json                              // 生成变体数组 ["firming x cream", ...]
  status        String   @default('PENDING')      // PENDING|APPLIED|DISMISSED
  createdAt     DateTime @default(now())
  @@map("ad_expansion_suggestions")
}
```

### 3.8 预留模型（M2/M3，本阶段不建，仅设计）

```prisma
// M2 库存域
model FbaInventory { linkId, warehouse, available, reserved, inbound, snapshottedAt }
// M3 补货域
model ReplenishmentPlan { linkId, forecast, reorderPoint, recommendedQty, status }
// M2 站点级产品桥（跨站点 ASIN）
model AmazonProductLink { productId, marketplaceId, asin, sku, price, status }
```

> 设计原则：M1 只建 3.1-3.7 的表。预留表不建——避免过度设计，但**命名和关联方向已定**，后续建表不返工。

---

## 四、决策引擎设计（服务层，纯 TypeScript）

### 4.1 输入

```ts
interface DecisionInput {
  reportStats: ComboStat[];   // 组合粒度统计 [{target, match, spend, sales, orders, clicks, impressions}]
  accountMeta: { cvr: number; aov: number };  // 账户整体 CVR 与客单价（引擎参数来源）
  rules?: Partial<DecisionRules>;
}
```

### 4.2 规则（默认值 = 已验证的 v7 专业版）

```ts
interface DecisionRules {
  // 否定双标准
  statAlpha: 0.05;            // 显著性水平
  spendCapMultiplier: 1.5;    // 止损线 = 1.5 × 客单价
  // 竞价阈值
  keepBidAcos: 30;            // ≤30% 加价
  bidUpPct: 20;
  reduceBidAcos: 60;          // ≤60% 降竞价
  bidDownPct: 15;
  stopAcos: 100;              // >100% 停止
  // 竞价矩阵系数
  matchLevel: { EXACT: 1.0, PHRASE: 0.75, BROAD: 0.5 };
  lengthLevel: { short: 1.0, mid: 1.2, long: 1.4 };
  // 拓词
  expansionAcos: 60;          // 出单且 ACoS ≤60% 才拓词
}
```

### 4.3 输出（动作类型——平台无关）

```
RAISE_BID  加价（幅度 pct）
LOWER_BID  降价（幅度 pct）
PAUSE      暂停投放
NEGATE     否定（仅 KEYWORD 平台有意义；其他平台=排除受众）
EXPAND     拓词（词根+变体）
KEEP       保留不动
WATCH      继续观察（数据不足）
```

### 4.4 关键实现约束

1. **否定阈值动态计算**：`negateClicks = ceil(ln(0.05) / ln(1 - cvr))`，止损线 `= 1.5 × aov`——随每次报告变化重算，不硬编码
2. **词长分桶**：`wordBucket(term)` → short(1-2)/mid(3-4)/long(5+)
3. **竞价倒挂检查**：同一词根族内 EXACT CPC < BROAD CPC×0.9 → 输出警告（不自动改，人工确认）
4. **组合粒度**：分析最小单位 = target × matchType（不是搜索词聚合，不是投放词聚合）——v1-v7 迭代教训
5. **合规黑名单**：enlargement/growth 类词 → 即使出单也标记 `COMPLIANCE_RISK`，不自动加价

### 4.5 引擎文件结构（服务层）

```
src/services/ads/
├── engine.ts          // 主入口：analyze(report) → Decision[]
├── analyzer.ts        // 报告解析 + 组合粒度聚合
├── thresholds.ts      // 统计阈值/止损线计算（纯函数）
├── bidding.ts         // 竞价矩阵判断
├── expansion.ts       // 拓词变体生成（词根×修饰词池）
└── __tests__/         // 单测（阈值/矩阵/拓词）
```

---

## 五、API 设计

### 5.1 路由清单

```
GET    /api/ads/marketplaces           站点列表（含种子）
POST   /api/ads/accounts               创建广告账户（绑定 PlatformAccount）
GET    /api/ads/accounts               账户列表
PUT    /api/ads/accounts/[id]          更新账户

POST   /api/ads/reports                上传搜索词报告（multipart，CSV/Excel）
GET    /api/ads/reports                报告列表（分页）
GET    /api/ads/reports/[id]           报告详情（含组合粒度分析结果）
DELETE /api/ads/reports/[id]           删除报告

POST   /api/ads/analyze                对报告执行决策引擎（dry-run，不落执行）
GET    /api/ads/decisions?reportId=    决策列表（分页+筛选）
POST   /api/ads/decisions/apply        批量执行决策（更新 AdTarget 状态；无 API 凭据时仅标记 APPLIED 本地态）
GET    /api/ads/expansions?reportId=   拓词建议列表
POST   /api/ads/expansions/[id]/apply  采纳拓词（生成 AdTarget 草稿）

GET    /api/ads/campaigns?accountId=   广告活动列表（本地数据）
```

### 5.2 鉴权与权限

- 所有路由：`getUserFromRequest` 鉴权（沿用现有模式）
- 权限点：`ads:view`（查看）/ `ads:manage`（上传/分析/执行）——新增到权限表，默认 super-admin/admin 拥有
- 侧栏「亚马逊运营」roles: ['admin', 'super-admin']（M1 收窄，后续按需放开）

### 5.3 响应格式

沿用现有 `successResponse / listResponse / errorResponse`（**前端必须读 `data.data` 或 `data.data.items`**——trade-erp-dev-workflow 反复强调的坑）。

---

## 六、前端页面设计

### 6.1 路由与侧栏

```
侧栏新增一级模块「亚马逊运营」（放「报表中心」前）：
├─ /ads  (投流优化中心，默认页)
├─ /ads/sites     (站点管理)
├─ /ads/inventory (库存对接，M1 占位页)
├─ /ads/replenishment (补货计划，M1 占位页)
└─ /ads/dashboard (数据看板，M1 占位页)
```

Sidebar.tsx `menuConfig` 新增 group `'亚马逊运营'`，5 个 item。

### 6.2 投流优化中心页面（/ads，核心页面）

结构（Tab 布局，符合 ERP 多分区规范）：

```
Tab1 概览:    账户选择器 + 统计卡片（花费/销售/ACoS/CVR/客单价/否定阈值/止损线）
Tab2 投放词:  组合粒度表（投放词|匹配|词长|订单|花费|销售|ACoS|建议动作）
              + 筛选（动作类型/匹配类型/词长）+ ACoS 色阶 + 导出
Tab3 止损:    达阈值否定/暂停清单（红标）
Tab4 拓词:    出单词根 + 变体列表 + 「采纳」按钮（生成投放词草稿）
Tab5 决策记录: 历史决策（时间/动作/原因/执行状态）
```

交互流程：
1. 选账户 → 上传报告（拖拽/选择 CSV/Excel）→ 解析 → 预览摘要
2. 点「分析」→ 调 `/api/ads/analyze` → Tab2/3/4 展示决策（dry-run）
3. 点「执行决策」→ 二次确认弹窗 → 调 `/api/ads/decisions/apply`
4. 无 API 凭据时：执行仅更新本地 AdTarget 状态 + 记录（模拟执行）；有凭据后走 AmazonAdapter

### 6.3 站点管理页面（/ads/sites）

- 站点列表（种子数据 US/CA/BR/UK/DE/FR/ES/IT/JP，状态/货币/端点）
- 广告账户 CRUD：选站点 → 绑定 PlatformAccount → 命名
- 简单表格 + 弹窗（复用现有 Dialog 模式，注意 key prop 防状态泄漏）

---

## 七、平台适配器扩展设计（M2+，本期不实现）

```ts
// PlatformAdapter 接口扩展（可选方法，不破坏现有实现）
export interface PlatformAdapter {
  // ...现有方法不变...
  fetchAdCampaigns?(config: PlatformConfig): Promise<UnifiedCampaign[]>;
  fetchAdReport?(params: AdReportParams, config: PlatformConfig): Promise<UnifiedReport>;
  applyAdAction?(actions: AdAction[], config: PlatformConfig): Promise<AdActionResult>;
}
```

- AmazonAdapter：实现三个方法（SP 广告 API）
- 统一模型：`UnifiedCampaign { externalId, name, status, budget, stats }`
- 动作翻译：`LOWER_BID` → PUT /sp/keywords；`PAUSE` → PUT state=paused
- TikTok/Shopify 适配器：将来实现同样三个方法，引擎零改动

**约束**：本期**不**改 adapters 层（避免破坏现有订单同步）。只定义接口扩展的**设计草案**（本文件即规范），M2 接 API 时实现。

---

## 八、安全与合规

1. 凭据：复用 PlatformAccount（不新增存储）；前端永不暴露 secret/token
2. 上传文件：仅接受 .csv/.xlsx，大小 ≤10MB，服务端解析（不存原始文件）
3. 执行安全：所有写操作需二次确认；决策引擎默认 dry-run
4. 合规红线：广告词黑名单（enlargement/growth/boob 等）内置引擎，命中即标记不自动加价
5. 审计：AdDecision 表即审计日志（谁/何时/什么决策/状态）

---

## 九、里程碑与验收标准

### M1（本期，投流优化中心 + 站点管理）
- [ ] 建表：amazon_marketplaces / ad_accounts / ad_campaigns / ad_targets / ad_decisions / ad_reports / ad_expansion_suggestions（7 表 + 站点种子）
- [ ] API：市场列表 / 账户 CRUD / 报告上传解析 / analyze / decisions / apply / expansions（9 路由）
- [ ] 决策引擎服务层：analyzer/thresholds/bidding/expansion + 单测（用已验证的 100 词报告数据做测试夹具）
- [ ] 前端：/ads 五 Tab 页面 + /ads/sites 站点管理
- [ ] 侧栏：「亚马逊运营」模块 + 权限点 ads:view/ads:manage
- [ ] 验收：导入真实搜索词报告 → 分析结果与 v7 文档一致（出单8/否定0-3/观察30/拓词10 级别）→ 决策可执行 → 记录落库

### M2（多站点 + 数据看板 + API 自动拉取）
- [ ] AmazonAdapter 三个方法实现（凭据审批通过后）
- [ ] 站点切换器（全局 marketplaceId 上下文）
- [ ] /ads/dashboard 跨站点汇总
- [ ] FbaInventory 库存快照（设计已定，建表实现）

### M3（库存联动 + 补货）
- [ ] 低库存预警 → 自动暂停广告（三域联动闭环）
- [ ] ReplenishmentPlan 预测/建议/转采购单

### M4+（平台扩展）
- [ ] TikTokAdapter 广告方法（复用引擎，指标模板换 CPA/ROAS）
- [ ] 跨平台看板（亚马逊/TikTok/独立站 花费/销售/利润对比）

---

## 十、决策记录（本设计的依据）

| 决策点 | 结论 | 依据 |
|--------|------|------|
| 菜单归属 | 「亚马逊运营」一级模块 | 为 TikTok/独立站留空间 |
| 统一广告模型 | AdTarget 抽象（targetType 维度） | UnifiedOrder 模式复用；订单能统一广告就能统一 |
| M1 范围 | 投流优化中心 + 站点管理 | 单站点起步，目录多站点就绪 |
| 广告-库存联动 | 规划预留，M3 实现 | 断货烧钱是真实痛点 |
| 决策引擎 | v7 专业版方法论固化 | 统计显著性+止损线+竞价矩阵+拓词 |
| 引擎平台无关 | 动作类型 + 适配器翻译 | 与现有 PlatformAdapter 模式一致 |
