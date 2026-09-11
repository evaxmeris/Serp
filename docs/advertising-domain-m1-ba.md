# 广告域 M1 开发梳理（BA）— 亚马逊投流优化中心 + 站点管理

> 状态：BA 梳理完成，待确认后进入架构设计 | 日期：2026-08-29
> 依据：`docs/amazon-business-hub-plan.md`（v1.0 规划）+ amazon-ads-optimization 技能（v20 决策引擎逻辑，10 次用户纠正验证）
> 决策引擎权威逻辑：`~/clawd/amazon-ads-optimizer/docs/decision-engine-logic.md`（v15 主文档）+ 铁律一~八

---

## 一、现状盘点（代码地图确认，勿重复实现）

| 组件 | 现状 | 位置 |
|------|------|------|
| PlatformAdapter 接口 | ✅ | src/lib/sync/types.ts |
| AlibabaAdapter（完整749行）| ✅ | src/lib/sync/adapters/alibaba.ts |
| AmazonAdapter / TikTok / Shopify | ⚠️ 占位 | src/lib/sync/adapters/ |
| PlatformAccount 表 | ✅ 含 region | prisma/schema.prisma:1345 |
| PlatformSyncConfig / PlatformSyncLog | ✅ | prisma/schema.prisma:2395/2487 |
| 侧栏 menuConfig | ✅ 8 个一级模块 | src/components/Sidebar/Sidebar.tsx:69 |
| 广告域模型/页面 | ❌ 无 | — |
| 决策引擎（Python v20）| ✅ 完整 | ~/clawd/amazon-ads-optimizer/ |

**结论：中台底座已具备（订单域），广告域从零建。决策引擎逻辑已在 Python 侧完整验证，ERP 侧做「接入 + 展示 + 执行」不重写逻辑。**

---

## 二、M1 范围

1. **投流优化中心**：双报告导入 → 解析 → v20 决策引擎 → 执行清单（可勾选）+ 批量操作表下载
2. **站点管理**：marketplace 配置 + 广告账户绑定（骨架）
3. 菜单「亚马逊运营」一级模块（第 9 个），库存/补货/看板 3 子页占位

---

## 三、数据模型（新表，遵守三维坐标：platformCode × marketplaceId × 业务域）

```prisma
// 广告账户（站点级；广告 API 凭据独立于订单 API）
model AdAccount {
  id                String  @id @default(cuid())
  platformCode      String  // amazon
  marketplaceId     String  // ATVPDKIKX0DER (US)
  name              String
  externalId        String? // Ads 账号 profileId
  clientId          String? // LWA 广告 API 凭据（加密存储）
  clientSecret      String?
  refreshToken      String?
  profileId         String?
  isActive          Boolean @default(true)
  // 关联订单域 PlatformAccount（可选，同一店铺）
  platformAccountId String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  @@unique([platformCode, marketplaceId])
}

// 广告活动
model AdCampaign {
  id             String  @id @default(cuid())
  adAccountId    String
  externalId     String  // campaignId（API 对接零迁移）
  name           String
  status         String  // ENABLED/PAUSED
  dailyBudget    Float?
  currency       String?
  adAccount      AdAccount @relation(...)
  keywords       AdKeyword[]
  reports        AdReport[]
}

// 投放词/关键词决策（核心资产，组合粒度 = 投放词 × 匹配类型）
model AdKeyword {
  id          String  @id @default(cuid())
  adAccountId String
  campaignId  String? // 冗余，加速查询
  externalId  String? // keywordId / productTargetingId（Bulk 表 ID）
  keywordText String   // 投放词
  matchType   String   // EXACT/PHRASE/BROAD/close-match/asin=
  state       String   // ENABLED/PAUSED（投放报告状态）
  bid         Float?   // 当前竞价（Targeting 报告"目标竞价"）
  // v20 决策结果
  familyL1    String?  // L1 语义族
  duplicateOf String?  // L2 完全重复 → 指向主词
  action      String?  // RAISE_BID/LOWER_BID/PAUSE/NEGATE/KEEP/EXPAND
  actionBid   Float?   // 建议调整后的 bid（含层级约束）
  actionReason String? // 依据文字（可追溯）
  acos        Float?
  orders      Int?
  spend       Float?
  clicks      Int?
  updatedAt   DateTime @updatedAt
  @@index([adAccountId, familyL1])
}

// 报告快照（每次导入的原始数据落库，可追溯/可对比）
model AdReport {
  id           String  @id @default(cuid())
  adAccountId  String
  reportType   String  // SEARCH_TERM / TARGETING / ADVERTISED_PRODUCT
  startDate    DateTime
  endDate      DateTime
  filePath     String? // 原始文件归档
  summary      Json    // 账户总览（花费/销售/订单/ACoS/CVR/客单价）
  rawRows      Json    // 原始数据行（或引用大表）
  createdAt    DateTime @default(now())
}

// 决策快照（v20 引擎输出，历史对比/复盘）
model AdRecommendation {
  id          String  @id @default(cuid())
  adReportId  String
  version     String  // v20
  familyTable Json    // L1 族总表（每族处置结论）
  closeMatrix Json    // 关闭矩阵（全量组合 + 双标准依据）
  negateList  Json    // 否定清单（合规/双标准）
  expandTable Json    // 逐族拓词结论 + 增量搜索词
  layerCheck  Json    // 层级核对（EXACT>PHRASE>BROAD + 系数体检）
  summary     Json    // 执行摘要（关闭X%花费后ACoS预演）
  createdAt   DateTime @default(now())
}
```

**字段说明**：所有建议动作带 `actionReason`（用户会核对原始数据，结论必须可追溯）；外部 ID 统一 `externalId`（Bulk 表三件套：Campaign ID / Ad Group ID / Keyword ID 存入 AdKeyword 扩展字段——需要加 `adGroupId` + `adGroupExternalId`）。

---

## 四、核心流程（投流优化中心）

### 4.1 数据获取抽象层（M1 手动 / M2 API 双模式）

```
业务层（解析 → v20引擎 → 决策 → 展示/执行）  ← 完全不变
    ↕
数据获取层 ReportFetcher 接口（fetchReport / fetchSettings）
  ├─ ManualFetcher（M1：手动上传双报告，审批未通先用）→ 落 AdReport
  └─ ApiFetcher  （M2：Ads API 自动拉，审批通过后无缝切换）→ 落 AdReport
```

**用户关键质疑（2026-08-29）**："能接上亚马逊 API 为什么不直接读设置，还要下载报告？"
- 答案是时间线问题而非技术问题：Ads API 审批 2-4 周，**审批通过前**唯一数据源是后台导出 → M1 手动
- **M2 API 模式能力**：
  - `GET /sp/keywords` 实时读所有投放词 bid+状态 → 层级核对秒出（比报告更实时）
  - `POST /reporting/reports` 异步创建搜索词/Targeting 报告 → 轮询下载 → **定时自动拉**（每日/每周），免人工导出
  - `PUT /sp/keywords` + `POST /sp/negativeKeywords` → **决策直接程序化执行**（dry-run 默认 + 二次确认 + 单批上限 50），批量表下载仅作过渡/兜底
- 报告（历史表现）与 settings（当前 bid/状态）用途不同：报告→决策依据；settings→层级核对/执行，API 两者都覆盖

### 4.2 M1 手动流程（当前落地）

```
用户上传 2 个报告（搜索词.xlsx + Targeting.csv）
  → API 落库 AdReport（原始数据 + 文件归档）
  → 调用 Python v20 引擎（子进程/HTTP）
      解析 → L1语义族+L2重复 → 双标准关闭矩阵(34点击/$23.76)
      → 关闭vs否定 → 逐族拓词+增量 → 分层约束+系数体检
      → 僵尸词/CTR体检 → 调价后层级复核 → 关闭预演(ACoS 变化)
  → 结果落 AdRecommendation + AdKeyword 决策字段
  → 前端展示：族级总览/关闭矩阵/拓词表/层级核对/执行清单
  → 生成批量操作表（Bulk Operations 33列模板，exceljs）下载
```

### 4.3 M2 API 流程（审批通过后，业务层复用）

```
定时任务（每日/每周）
  → ApiFetcher：POST /reporting/reports（search-term + targeting）
  → 轮询 → 下载 → 落 AdReport（同 M1 表，reportType 标注 API 来源）
  → GET /sp/keywords 同步当前 bid/status → 更新 AdKeyword
  → 触发 v20 引擎（同一入口）
  → 决策落库 → 前端展示
  → 可选：用户确认后 PUT /sp/keywords 直接执行（dry-run→apply 二次确认）
```

**引擎集成（D1=方案A）**：ERP 后端 `exec` Python CLI（`main.py analyze --targeting ... --out json`）或常驻 HTTP 服务。选 **子进程+JSON 文件交换**（简单、无端口管理、失败可重试）；后续 Ads API 自动执行再升级为服务。

---

## 五、API 设计草案

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | /api/ads/reports/upload | 上传双报告（multipart）→ 落库 AdReport |
| POST | /api/ads/reports/:id/analyze | 触发 v20 引擎跑批 → 落 AdRecommendation |
| GET | /api/ads/reports/:id/result | 分析结果（族表/矩阵/拓词/层级）|
| GET | /api/ads/accounts | 广告账户列表（站点管理）|
| POST | /api/ads/accounts | 绑定广告账户（凭据加密）|
| PUT | /api/ads/accounts/:id | 更新账户 |
| GET | /api/ads/keywords | 投放词决策列表（筛 account/族/动作）|
| POST | /api/ads/bulk-table | 生成批量操作表（Bulk 33列 xlsx）→ 下载 |
| PUT | /api/ads/keywords/:id | 手工覆写决策（勾选/修改）|

权限：沿用现有角色体系（admin/sales 起步，广告数据敏感性高——可加 VIEW 级控制，参照 JY-PLM 权限经验）。

---

## 六、页面结构

```
亚马逊运营（一级模块，侧栏第 9 组，roles: admin/sales）
├─ 📊 投流优化中心  /ads/optimization   （M1：上传→分析→执行清单→批量表）
├─ 🌍 站点管理      /ads/sites          （M1：marketplace + 广告账户）
├─ 📦 库存对接      /ads/inventory      （占位）
├─ 🔄 补货计划      /ads/replenishment  （占位）
└─ 📈 数据看板      /ads/dashboard      （占位）
```

投流优化中心页布局（遵循现有 UI 铁律：CSS变量/骨架屏/Toast/分页/fade-in）：
1. 报告上传区（双文件 + 日期范围）
2. 账户总览卡片（花费/销售/订单/ACoS vs 平衡点）
3. 族级总览表（L1 族 × 处置结论，标签页+数量徽章）
4. 关闭矩阵 / 否定清单 / 拓词表（分页表格，动作列可勾选）
5. 层级核对区（EXACT>PHRASE>BROAD + 系数体检表）
6. 执行清单汇总 + 「生成批量操作表」按钮

---

## 七、开发任务拆解（M1 里程碑）

| # | 任务 | 产出 | 依赖 |
|---|------|------|------|
| 1 | Prisma 模型 + 迁移 | AdAccount/AdCampaign/AdKeyword/AdReport/AdRecommendation | — |
| 2 | Python 引擎封装 | `analyze_wrapper`（子进程调用 + JSON 交换 + 错误处理）| amazon-ads-optimizer v20 |
| 3 | API 路由 | 上表 9 个端点 | 1,2 |
| 4 | 站点管理页 | marketplace 配置 + 账户绑定表单 | 1,3 |
| 5 | 投流优化中心页 | 上传/分析/展示/勾选/下载全流程 | 1,3 |
| 6 | 批量表生成 | exceljs 生成 Bulk 33 列模板（含层级约束值）| 1,3 |
| 7 | QA | 多角色验证（admin/sales/观察者）+ 真实 v20 数据回放 | 全 |

---

## 八、决策点（默认按推荐执行，可改）

| # | 决策点 | 推荐 | 理由 |
|---|--------|------|------|
| D1 | 引擎集成 | **方案A：Python 子进程复用** | v20 逻辑 10 轮验证，零重写；ADR-001 自研客户端铁律 |
| D2 | AdAccount | **独立表**（含广告 API 凭据）| 广告凭据≠订单凭据；不侵入订单域 PlatformAccount |
| D3 | 批量表下载 | **含（M1 就做）** | 执行闭环关键，v18.1 已验证 127/127 ID |
| D4 | 菜单 | **「亚马逊运营」一级模块** | 为 TikTok/独立站留空间 |
| D5 | 权限 | admin/sales 起步 + 敏感字段 VIEW 级 | 广告花费数据敏感 |

---

## 九、待确认/风险

1. 广告 API 凭据加密方案（现有项目凭据加密模式？）
2. Python 引擎部署形态：与 ERP 同机（本地子进程）即可，暂不做容器化
3. Targeting 报告列名随站点/语言变化——解析器需保留"列名探测"能力（技能铁律七已适配新版列名）
4. 批量表列名风险：上传前用户需先下载后台模板核对列名（技能已固化此流程）
