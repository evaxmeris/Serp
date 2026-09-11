# 广告域 M1 架构设计（Arch）— 亚马逊投流优化中心 + 站点管理

> 状态：架构设计，待确认后进入开发 | 日期：2026-08-29
> 依据：`docs/advertising-domain-m1-ba.md`（BA）+ Trade ERP 现有约定（api-response/permissions/crypto-utils/Sidebar）
> 开发环境：port 3001（dev）/ 3000（prod Docker），DB trade-erp-db:5432

---

## 一、Prisma 数据模型（5 张新表）

```prisma
// ─── 广告域（M1）───
// 广告账户：站点级，含广告 API 凭据（独立于订单域 PlatformAccount）
model AdAccount {
  id                String   @id @default(cuid())
  platformCode      String   @default("amazon")
  marketplaceId     String   // ATVPDKIKX0DER (US)
  name              String
  externalId        String?  // Ads profileId
  clientId          String?  // 加密存储（crypto-utils.ts）
  clientSecret      String?
  refreshToken      String?
  profileId         String?
  isActive          Boolean  @default(true)
  platformAccountId String?  // 可选关联订单域账号
  campaigns         AdCampaign[]
  keywords          AdKeyword[]
  reports           AdReport[]
  recommendations   AdRecommendation[]
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  @@unique([platformCode, marketplaceId])
  @@map("ad_accounts")
}

// 广告活动
model AdCampaign {
  id          String  @id @default(cuid())
  adAccountId String
  externalId  String  // campaignId（API 对接零迁移）
  name        String
  status      String  // ENABLED/PAUSED/ARCHIVED
  dailyBudget Float?
  currency    String? @default("USD")
  adAccount   AdAccount @relation(fields: [adAccountId], references: [id], onDelete: Cascade)
  keywords    AdKeyword[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([adAccountId])
  @@map("ad_campaigns")
}

// 投放词/关键词决策（核心资产；组合粒度 = 投放词 × 匹配类型；含 Bulk 执行三件套 ID）
model AdKeyword {
  id            String  @id @default(cuid())
  adAccountId   String
  campaignId    String?
  adGroupId     String?  // Bulk 执行用
  externalId    String?  // keywordId / productTargetingId（Bulk 执行用）
  keywordText   String   // 投放词
  matchType     String   // EXACT/PHRASE/BROAD/close-match/loose-match/asin=/TARGETING_EXPRESSION
  state         String   // ENABLED/PAUSED（投放报告/Targeting 状态）
  bid           Float?   // 当前竞价（Targeting"目标竞价"）
  // v20 决策结果
  familyL1      String?  // L1 语义族（品类×诉求）
  duplicateOf   String?  // L2 完全重复 → 指向主词 id
  action        String?  // RAISE_BID/LOWER_BID/PAUSE/NEGATE/KEEP/EXPAND/HARVEST
  actionBid     Float?   // 建议调整后 bid（含层级约束后的最终值）
  actionReason  String?  // 依据文字（双标准/合规/重复/层级约束…）
  acos          Float?
  orders        Int?
  spend         Float?
  clicks        Int?
  impressions   Int?
  ctr           Float?
  reportId      String?  // 本次决策来自哪份报告（可追溯）
  adAccount     AdAccount @relation(fields: [adAccountId], references: [id], onDelete: Cascade)
  campaign      AdCampaign? @relation(fields: [campaignId], references: [id])
  updatedAt     DateTime @updatedAt
  @@index([adAccountId, familyL1])
  @@index([keywordText, matchType])
  @@map("ad_keywords")
}

// 报告快照：每次导入/API 拉取的原始数据落库
model AdReport {
  id           String   @id @default(cuid())
  adAccountId  String
  reportType   String   // SEARCH_TERM / TARGETING / ADVERTISED_PRODUCT
  source       String   // MANUAL_UPLOAD / API
  startDate    DateTime
  endDate      DateTime
  fileName     String?  // 原始文件归档名
  filePath     String?  // 服务器存储路径
  summary      Json     // 账户总览：{spend,sales,orders,acos,cvr,aov}
  rawRows      Json     // 原始数据行数组（可追溯，前端分页读）
  rowCount     Int?
  adAccount    AdAccount @relation(fields: [adAccountId], references: [id], onDelete: Cascade)
  recommendations AdRecommendation[]
  createdAt    DateTime @default(now())
  @@index([adAccountId, reportType])
  @@map("ad_reports")
}

// 决策快照：v20 引擎输出（历史对比/复盘）
model AdRecommendation {
  id          String   @id @default(cuid())
  adReportId  String
  adAccountId String
  version     String   // "v20"
  familyTable Json     // L1 族总表：[{family, spend, orders, acos, verdict}]
  closeMatrix Json     // 关闭矩阵：[{keywordText, matchType, clicks, spend, ctr, basis}]
  negateList  Json     // 否定清单：[{term, reason}]
  expandTable Json     // 拓词结论：[{family, verdict, incremental}]
  layerCheck  Json     // 层级核对：{ladderCheck, coefficientAudit}
  summary     Json     // 执行摘要：{closeCount, closeSpendPct, projectedAcos, ...}
  adAccount   AdAccount @relation(fields: [adAccountId], references: [id], onDelete: Cascade)
  report      AdReport @relation(fields: [adReportId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  @@map("ad_recommendations")
}
```

**设计要点**：
- 全部遵守三维坐标：platformCode（默认 amazon）+ marketplaceId + externalId
- AdKeyword 存 Bulk 三件套（campaignId/adGroupId/externalId）→ M2 API 执行、M1 批量表都直接可用
- Json 大字段（rawRows/familyTable 等）→ 避免 5 张大宽表，报告/决策快照天然只读
- 表名 snake_case 映射，与现有项目一致

---

## 二、Python 引擎接口契约（D1=方案A：子进程 + JSON 文件交换）

**位置**：`services/amazon-ads-engine/`（Trade ERP 内），软链/复制 amazon-ads-optimizer 核心模块
**调用方式**：Node 侧 `child_process.execFile('python3', ['services/amazon-ads-engine/analyze_cli.py', '--search', file1, '--targeting', file2, '--out', out.json])`

**analyze_cli.py 契约**：
```
输入：
  --search <搜索词报告路径>   (xlsx/csv)
  --targeting <投放报告路径>   (csv/xlsx，含"目标竞价/状态"列)
  --out <输出json路径>
  [--break-even-acos 40] [--negate-clicks 34] [--stop-spend 23.76]
输出（JSON，UTF-8）：
{
  "ok": true,
  "account": {spend, sales, orders, acos, cvr, aov},
  "families": [{family, spend, orders, acos, verdict, members:[...]}],
  "closeMatrix": [{keywordText, matchType, clicks, spend, ctr, bid, state, basis, action}],
  "negateList": [{term, reason}],
  "expandTable": [{family, verdict, incremental}],
  "layerCheck": {ladderWarnings:[], coefficientAudit:[{family, match, bid, exactBid, ratio}]},
  "summary": {closeCount, closeSpendPct, projectedAcos, ...},
  "version": "v20"
}
错误：{ "ok": false, "error": "..." }（exit code 非0）
```

**Node 侧封装**：`src/lib/ads/engine-client.ts`
```typescript
export async function runAdsEngine(searchFile, targetingFile, opts): Promise<EngineResult>
// 写临时目录 → execFile → 读 out.json → 校验 {ok:true} → 返回
// 超时 120s；失败重试 1 次；日志记录 exit code/stderr
```

---

## 三、API 设计（前缀 /api/v1/ads/，遵循现有约定）

| 方法 | 路径 | 功能 | 权限 | 响应 |
|------|------|------|------|------|
| GET | /api/v1/ads/accounts | 广告账户列表 | admin/sales（VIEW）| listResponse |
| POST | /api/v1/ads/accounts | 创建账户（凭据加密）| admin | createdResponse |
| PUT | /api/v1/ads/accounts/:id | 更新账户 | admin | successResponse |
| POST | /api/v1/ads/reports/upload | 上传双报告(multipart)→落 AdReport | admin/sales | createdResponse |
| POST | /api/v1/ads/reports/:id/analyze | 调引擎→落 AdRecommendation+AdKeyword | admin/sales | successResponse({recommendationId}) |
| GET | /api/v1/ads/reports/:id/result | 分析结果（族表/矩阵/拓词/层级）| admin/sales | successResponse |
| GET | /api/v1/ads/reports | 报告历史列表 | admin/sales | listResponse |
| GET | /api/v1/ads/keywords | 投放词决策列表（筛 account/族/动作/分页）| admin/sales | listResponse |
| POST | /api/v1/ads/bulk-table | 生成 Bulk 33列 xlsx → 返回下载 URL | admin/sales | successResponse({url}) |
| PUT | /api/v1/ads/keywords/:id | 手工覆写决策（勾选/改 action）| admin | successResponse |

**通用约定**：
- 响应一律 `successResponse/listResponse/errorResponse`（前端读 `data.data || data`）
- Zod 校验（`api-schemas.ts` 模式），`z.coerce.number().default().catch()` 处理 null
- 权限：`hasPermission(userId, 'ads:view')` 级别——新增权限点：ads:view / ads:edit / ads:admin（admin 全有）
- 错误：`errorResponse('...', code)`；CSRF 由现有 middleware 统一处理（production）
- 凭据加密：`src/lib/crypto-utils.ts`（复用现有 AES 加密，不新造）

---

## 四、前端组件树

```
src/app/ads/optimization/page.tsx      ← 投流优化中心（M1 主页面）
src/app/ads/sites/page.tsx             ← 站点管理（M1）
src/app/ads/inventory/page.tsx         ← 占位
src/app/ads/replenishment/page.tsx     ← 占位
src/app/ads/dashboard/page.tsx         ← 占位
src/components/ads/
├─ ReportUploadCard.tsx    双报告上传（FileUpload ×2 + 日期 + 账户选择）
├─ AccountSummaryCards.tsx 账户总览（花费/销售/单/ACoS vs 平衡点）
├─ FamilyOverviewTable.tsx 族级总览（标签页+数量徽章，含处置结论）
├─ CloseMatrixTable.tsx    关闭矩阵（分页，CTR/CPA/依据，动作列可勾选）
├─ NegateListTable.tsx     否定清单
├─ ExpandTable.tsx         拓词结论（每族一行 + 增量明细）
├─ LayerCheckPanel.tsx     层级核对（倒挂警告 + 系数体检表）
├─ ExecutionSummaryBar.tsx 执行摘要（关闭X%→ACoS预演）
└─ BulkTableButton.tsx     生成批量表下载按钮
```

**页面布局**（投流优化中心，自上而下）：
1. 报告上传卡（双文件拖拽 + 账户下拉 + 分析按钮）
2. 账户总览卡（4-6 个指标卡片）
3. 族级总览（Tabs：全部/出单族/风险族/待关闭，每 tab 数量徽章）
4. 关闭矩阵 / 否定清单 / 拓词 / 层级（Tabs 切换，Pagination）
5. 执行摘要条 + 生成批量表按钮

**UI 铁律**：CSS 变量、骨架屏（loading.tsx/Skeleton）、Toast、Pagination、fade-in；Dialog 有 key prop；Select value 非空串；移动端 table-auto+nowrap+truncate。

---

## 五、批量表生成（Bulk Operations 33 列）

`src/lib/ads/bulk-table.ts`（exceljs 生成）：
- Sheet：`Sponsored Products Campaigns`，Product 列=`Sponsored Products`
- 行：关闭（Update+paused，不填 Bid）| 改价（Update+enabled+Bid=层级约束值）| 否定（Create+negativeExact+Campaign ID）
- 列头：标准 33 列英文模板（技能铁律：**用户先下载后台模板核对列名**，中文列名按用户模板重排）
- 交付伴随：`批量表使用说明.txt`（备份→核对列名→上传→预期效果→回滚）
- 自检：Update 行缺 ID=0、Entity 缺 Keyword ID=0、State 非法=0、paused+Bid 并存=0

---

## 六、新增文件清单（开发顺序）

| 步骤 | 文件 | 内容 |
|------|------|------|
| 1 | prisma/schema.prisma | 追加 5 模型 + @@map |
| 2 | services/amazon-ads-engine/analyze_cli.py | Python 引擎 CLI 封装（复用 amazon-ads-optimizer）|
| 3 | src/lib/ads/engine-client.ts | 子进程调用封装 |
| 4 | src/lib/ads/bulk-table.ts | exceljs 批量表生成 |
| 5 | src/lib/permissions.ts | 追加 ads:view/edit/admin 权限点 |
| 6 | src/app/api/v1/ads/accounts/route.ts + [id]/route.ts | 账户 CRUD |
| 7 | src/app/api/v1/ads/reports/upload/route.ts | 上传落库 |
| 8 | src/app/api/v1/ads/reports/[id]/analyze/route.ts | 引擎调用 |
| 9 | src/app/api/v1/ads/reports/[id]/result/route.ts | 结果读取 |
| 10 | src/app/api/v1/ads/reports/route.ts | 报告历史 |
| 11 | src/app/api/v1/ads/keywords/route.ts + [id]/route.ts | 决策列表/覆写 |
| 12 | src/app/api/v1/ads/bulk-table/route.ts | 批量表下载 |
| 13 | src/components/ads/*.tsx | 8 个组件 |
| 14 | src/app/ads/{optimization,sites,inventory,replenishment,dashboard}/page.tsx | 5 页面 |
| 15 | src/components/Sidebar/Sidebar.tsx | 第 9 组「亚马逊运营」|

---

## 七、开发顺序与验证

1. **Schema + db push**（kill dev → generate → 重启，防 Unknown field 500）
2. **引擎 CLI 冒烟**：用真实 v20 报告（Ads Amazon 文件夹）跑 analyze_cli.py → 校验输出 JSON
3. **API 层**：curl 带认证逐端点验证（上传→analyze→result→keywords→bulk-table）
4. **前端**：browser 实测页面渲染 + 全流程（上传→分析→展示→下载批量表）
5. **QA**：多角色（admin/sales/viewer）验证权限边界；数据用 v20 真实报告回放比对

---

## 八、待确认点

1. 权限点命名：`ads:view / ads:edit / ads:admin` OK？（需加进 seed 权限表）
2. Python 引擎部署：Trade ERP 内 `services/amazon-ads-engine/` 复制一份（与 amazon-ads-optimizer 独立，避免跨项目引用）OK？
3. AdReport.rawRows 存 Json（大字段）vs 独立明细表？建议 Json（只读快照，够用）
