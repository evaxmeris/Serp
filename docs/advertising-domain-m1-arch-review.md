# 跨阶段审查报告：广告优化管理 M1（架构设计 vs 需求规格）

> 文档编号：TRADE-ERP-ADS-M1-ARCH-REVIEW-v1.0
> 审查类型：跨阶段需求↔架构审查（BA 视角）
> 审查日期：2026-08-29
> 审查人：需求分析师（Hermes Agent）
> 被审文档：`docs/advertising-domain-m1-architecture.md`（930 行）
> 权威基准：`docs/advertising-domain-m1-requirements.md`（501 行，REQ-ADS-001~011 + §4 v20 规则 + §5 权限 + §6 流程 + §7 验收 + §8 隐性需求）
> 审查原则：**以需求规格为唯一基准**，逐条核对；架构与需求冲突时以需求为准。

---

## 审查结论摘要

**结论：需修改后通过（CONDITIONAL PASS）**

架构整体质量高：分层清晰、数据模型基本完整、引擎零重写方案（AD-1）符合需求「不重写引擎」铁律、权限三权限点与角色矩阵完全落地、E1~E9 异常流程基本覆盖、R1~R8 隐性需求大体落地。**但存在 7 项必须修改项（P0）**，其中 E3 与 analyze CLI 契约矛盾、双报告分次提交无法配对、AC-10 原始行下钻通路缺失 3 项直接影响验收标准（AC-9/AC-10）的达成，须在开发前修正。

---

## 一、已覆盖的需求（✅）

### 1.1 REQ-ADS-001 双报告上传与解析 —— ✅ 完整覆盖

| 需求项 | 架构落点 | 核对 |
|--------|----------|------|
| 001-1 双报告 multipart 上传（一次/分次提交） | §4.4 POST /reports/upload（searchFile+targetingFile，至少一份） | ⚠️ **同批一次提交已覆盖；分次提交无法配对，见缺口 G-2** |
| 001-2 必填账户/日期 + 日期窗口不一致警告不阻断 | §4.4 步骤 6（dateMismatch=true 警告不阻断） | ⚠️ 校验数据通路缺失，见内部矛盾 I-3 |
| 001-3 解析能力（inlineStr/列名探测/数值清洗/中文列名映射） | AD-4、§5.2 parse 契约（rawRows 归一化列名映射齐全：targeting/matchType/customerSearchTerm/spend/attributedSales7d/attributedUnitsOrdered7d/bid/state/campaignId/adGroupId/externalId） | ✅ 解析全部在引擎内（v20 已验证），Node 不复制，符合「必须复用」 |
| 001-4 落库 AdReport（rawRows+summary+filePath 归档，文件永久保留） | §2 AdReport 模型（rawRows Json / summary Json / filePath / 私有目录）+ §9.2 数据保留 | ✅ |
| 001-5 上传前校验（可读/必填列/行数>0，失败明确原因不落库） | §4.4 步骤 4（E1：PARSE_FAILED 422、删除已写文件、errors 指明缺列） | ✅ |
| 001-6 双报告口径一致性（偏差>15% 警告） | §4.4 步骤 7（consistencyCheck.spendDiffPct/ordersDiffPct>15% → warning=true，上传成功、analyze 阻断） | ✅ 与 E4 联动正确 |

### 1.2 REQ-ADS-002 v20 决策引擎分析 —— ✅ 覆盖（1 处字面偏离见冲突点 C-1）

| 需求项 | 架构落点 | 核对 |
|--------|----------|------|
| 002-1 引擎全流程（10 步） | §5.2 适配层调用 `report_analyzer.analyze_report`（与 v20 main.py cmd_analyze 同一代码路径），规则 §4.1~4.9 全部委托引擎 | ✅ 零重写原则符合 §10 范围外 |
| 002-2 Node 子进程、120s 超时、重试 1 次、stderr+exit code 全量记录 | §5.3（execFile timeout 120_000、自动重试 1 次、analyzeError{exitCode,stderr,attempts,durationMs}） | ⚠️ 命令形态与需求字面不同（见 C-1） |
| 002-3 输出 JSON 契约固定 + {ok:true} 才落库 | §5.2 契约（account/families/closeMatrix/negateList/expandTable/layerCheck/summary/version 完全对应需求）+ §5.4 EngineResultSchema 校验 | ✅ |
| 002-4 结果落库 AdRecommendation + AdKeyword 决策字段 | §2 模型（familyL1/duplicateOf/action/actionBid/actionReason/acos/orders/spend/clicks/impressions/ctr/reportId 全字段齐备） | ⚠️ actionReason 必填约束未在模型层强制，见 I-2 |
| 002-5 参数可配置（平衡 ACoS 默认 40%、否定阈值/成本容忍默认动态计算） | AdAccount.settings Json（breakEvenAcos 默认 40、negateClicks/stopSpend=null 动态）+ §5.3 白名单 3 参数透传 | ✅ 与 D6 一致；动态计算默认值满足 AC-4 |
| 002-6 重复分析生成新版本不覆盖 | §2 唯一约束 (recommendationId, externalId) + AdRecommendation 每跑批新行 | ✅ 版本隔离设计正确 |

### 1.3 REQ-ADS-003 结果展示 —— ✅ 完整覆盖

| 需求项 | 架构落点 | 核对 |
|--------|----------|------|
| 003-1 账户总览卡片（ACoS 超平衡点标红） | §7.3 AccountSummaryCards + §4.7 result.account | ✅ |
| 003-2 族级总览（每族必有处置结论、Tabs+徽章、展开成员） | §7.3 FamilyOverviewTable | ⚠️ verdict 字段依赖 v20 输出，风险见 §11 R4 与建议项 P1-4 |
| 003-3 关闭矩阵（全量不遗漏、依据文字、动作列可勾选） | §7.3 CloseMatrixTable + §5.2 closeMatrix 契约（basis/action/ctr/cpa/bid/state） | ⚠️ 数据源与勾选状态合并策略未定义，见 I-5 |
| 003-4 否定清单（原因分类） | §7.3 NegateListTable + negateList{term,reason} | ✅（需求 §4.4 与 003-4 的原因口径差异为需求文档自身问题，见附注 N-2） |
| 003-5 拓词结论（每族一行+增量明细+由谁捕获） | §7.3 ExpandTable + expandTable{family,verdict,incremental} | ✅ |
| 003-6 层级核对（倒挂警告/系数体检/复核结果） | §7.3 LayerCheckPanel + layerCheck{ladderWarnings,coefficientAudit,bidUnavailable} | ✅ |
| 003-7 执行摘要条 | §7.3 ExecutionSummaryBar + summary 契约（closeCount/closeSpendPct/projectedAcos/needsBidAdjust/needsListingFix） | ✅ |
| 003-8 UI 铁律 + 数字与引擎 JSON 一致 | §7.4（CSS 变量/骨架屏/Toast/分页/fade-in）+ AD-3 前端禁止二次聚合 | ✅ |

### 1.4 REQ-ADS-004 执行清单勾选 —— ✅ 完整覆盖

| 需求项 | 架构落点 | 核对 |
|--------|----------|------|
| 004-1 建议动作默认携带引擎值、可勾选/取消 | §4.8 GET /keywords + PUT isSelected | ✅ |
| 004-2 手工覆写 + 标注「手工修改」+ 覆写值为准 + 需权限 | §4.8（overrideAction/overrideBid/overriddenBy/overriddenAt → isManualOverride；批量表取 overrideBid ?? actionBid；权限 ads:edit） | ✅ 权限正确（§12-4 已纠草稿误标 admin 的问题） |
| 004-3 勾选/覆写持久化，刷新不丢 | §2 AdKeyword 字段 + §7.1 乐观更新 | ✅ |
| 004-4 汇总区分类计数与批量表行数一致 | §7.3 ExecutionSummaryBar + §4.9 stats{close,bidChange,negate,create} | ✅ 同一数据源（isSelected 行），一致性有保证 |

### 1.5 REQ-ADS-005 批量操作表下载 —— ✅ 完整覆盖

| 需求项 | 架构落点 | 核对 |
|--------|----------|------|
| 005-1 exceljs、Sheet 名、Product 列、33 列 | §6.1（exceljs 未装已识别，开发第 1 步安装）+ §6.4 Sheet 名固定 | ✅ |
| 005-2 三类操作行 + 风险词两行 | §6.2 行生成规则表（关闭/改价/否定；合规风险词输出两行） | ✅ |
| 005-3 Entity 判定 | §6.2（EXACT/PHRASE/BROAD→Keyword 小写；TARGETING_EXPRESSION(_PREDEFINED)→Product Targeting） | ✅ |
| 005-4 生成前自检 4 项全为 0 | §6.3 与需求 4 项逐字对应 | ✅ |
| 005-5 使用说明 txt（备份/核对列名/上传/效果/回滚） | §6.4 ①~④ | ✅ |
| 005-6 中文投放词风险提示 | §6.4 ⑤ | ✅ |

### 1.6 REQ-ADS-006 站点管理 —— ✅ 完整覆盖

| 需求项 | 架构落点 | 核对 |
|--------|----------|------|
| 006-1 站点预设 9 站 + CRUD | §2.2 种子（US/CA/BR/UK/DE/FR/ES/IT/JP 全列）+ §4.1 marketplaces 端点 | ✅（JP 补 -fe 端点合理） |
| 006-2 广告账户绑定（凭据加密/可选关联 PlatformAccount） | §2 AdAccount（clientId/clientSecret/refreshToken 加密；platformAccountId 弱引用不建 FK） | ✅ 广告凭据独立于订单域，符合 §3.4 |
| 006-3 凭据脱敏（后 4 位、不可回读） | §3.5 maskCredential + select 不查凭据列双保险 + 解密仅限 M2 ApiFetcher | ✅ |
| 006-4 启停 + platformCode+marketplaceId 唯一 | §2 @@unique([platformCode, marketplaceId]) + isActive | ✅ |
| 006-5 凭据仅存储 M1 不用 + 页面注明 | §3.5 机制落地 | ⚠️ 页面「API 凭据用于 M2，当前仅手动上传」文案未在 UI 设计中明确，见建议项 P1-7 |

### 1.7 REQ-ADS-007 数据获取层抽象 —— ⚠️ 基本覆盖（1 处 P1 缺口）

| 需求项 | 架构落点 | 核对 |
|--------|----------|------|
| 007-1 ReportFetcher 接口（fetchReport + fetchSettings） | §1.3 完整接口定义（FetchedReport 含 source） | ✅ |
| 007-2 ManualFetcher | §1.3（上传文件→引擎 parse→落 AdReport source=MANUAL_UPLOAD） | ✅ |
| 007-3 ApiFetcher 预留签名与配置位 | §1.3 注释（POST /reporting/reports→轮询→下载；fetchSettings 注释 M2=GET /sp/keywords） | ❌ **写回接口未预留，见缺口 G-1** |
| 007-4 source 字段贯穿 + 历史可筛 | AdReport.source + §4.5 GET /reports?source= | ✅ |

### 1.8 REQ-ADS-008 报告历史 —— ⚠️ 基本覆盖（1 处小缺口）

| 需求项 | 架构落点 | 核对 |
|--------|----------|------|
| 008-1 历史列表（账户/类型/日期/来源/文件/行数/上传时间/**关联决策版本**）+ 下载归档 | §4.5 列表（账户/类型/来源/日期/行数/状态齐全）+ §4.10 GET /reports/:id/file | ❌ **列表缺「关联决策版本」列，见缺口 G-3** |
| 008-2 历史报告重新触发分析 | §4.6 POST /analyze 对任意报告可重跑（E8 允许） | ✅ |

### 1.9 REQ-ADS-009 决策历史对比 —— ✅ 覆盖

| 需求项 | 架构落点 | 核对 |
|--------|----------|------|
| 009-1 决策快照列表 | §4.10 GET /recommendations（P1） | ✅ |
| 009-2 两次快照对比（账户指标 + 处置差异） | §4.10 compare?a=&b=（服务端对比，避免前端二次聚合） | ✅ |

### 1.10 REQ-ADS-010/011（P2）—— ✅ 覆盖

- 010-1 数据看板占位页：§7.2 /ads/dashboard ✅；010-2 汇总字段预留：AdReport.summary ✅
- 011-1 账户切换器：§7.3 顶部切换器 ✅；011-2 marketplaceId 维度：§2 模型含维度 + 切换后全页按账户过滤 ✅（架构把切换器提前到 P0 主页面，超出需求 P2 的最低要求，属合理增强）

### 1.11 §4 v20 规则（4.1~4.9，全部 P0）—— ✅ 委托引擎实现

- §4.1 双维度、4.2 L1/L2 词根族、4.3 双标准动态计算、4.4 关闭vs否定、4.5 合规风险词、4.6 僵尸词/CTR 体检、4.7 分层架构/层级复核、4.8 逐族拓词、4.9 自检清单：**全部由 v20 引擎（report_analyzer.py 原样复制）承担**，架构侧仅契约映射与展示透传，符合「判定规则以 v20 引擎为唯一实现基准」「在 ERP 内重写引擎逻辑=范围外」。
- 引擎输出校验（§5.4）+ 契约映射（§5.2）+ 版本记录（E7/R8）形成闭环。
- ⚠️ 唯一风险点：verdict 等契约字段 v20 输出可能未直接提供（§11 R4），详见建议项 P1-4。

### 1.12 §5 权限 —— ✅ 完整落地（无缺口）

- 三个权限点注册两处（§3.1：lib/permissions.ts + /api/permissions/init/route.ts），**两处同步修改**的探索结论正确（避免生产初始化漏权限点）。
- 角色矩阵（§3.2）：admin=view+edit+admin、sales=view+edit、viewer 默认无（D1 隐藏菜单）、purchasing/warehouse 无 —— 与需求 §5.2 完全一致。
- 幂等接线 seedAdsRolePermissions（§3.3）：admin/sales 显式接线，并说明 admin 在 UserRole 体系下依赖 RolePermission 行（legacy '*' 快速路径不覆盖），设计严谨。
- API 校验矩阵（§4.1）+ 前端隐藏≠安全（§3.4，每个接口独立 hasPermission）✅ 满足 §5.3 与 AC-7。
- 凭据读写一律 ads:admin ✅。

### 1.13 §6 流程与异常 E1~E9 —— ⚠️ 覆盖 8/9（E3 有矛盾待修）

| 异常 | 架构落点 | 核对 |
|------|----------|------|
| E1 报告格式错误 | §4.4 步骤 4（不落库、删文件、缺列明细、列名风险提示） | ✅ |
| E2 引擎失败 | §4.6（重试 1 次、analyzeError 全量日志、ANALYZE_FAILED 可重试、文件保留） | ✅ |
| E3 无投放报告 | §4.6 degraded=true + layerCheck.bidUnavailable=true + 前端警示条 | ❌ **与 §5.2 analyze CLI 必填 --targeting 矛盾，见内部矛盾 I-1** |
| E4 口径不一致 | §4.6（consistencyCheck.warning && !force → 422 CONSISTENCY_MISMATCH 带差异明细） | ⚠️ force 参数与需求「重传」字面不同，见 C-2 |
| E5 批量表自检失败 | §4.9（422 BULK_SELF_CHECK_FAILED + 缺 ID 行明细） | ✅ |
| E6 无勾选动作 | §4.9（422 NO_ACTIONS + confirmEmpty 确认弹窗） | ✅ |
| E7 引擎版本不兼容 | §5.4（契约校验失败按 E2/E7、version 记录、提示联系管理员） | ✅ |
| E8 重复分析 | §4.6 + 002-6（新版本、旧版保留） | ✅ |
| E9 超大文件 | §4.4（FILE_TOO_LARGE、50MB） | ✅ |

### 1.14 隐性需求 R1~R8 —— ⚠️ 落地 8/8（2 处依赖必改项）

| 隐性需求 | 架构落点 | 核对 |
|----------|----------|------|
| R1 全量可追溯（actionReason 必含依据类型+关键数字，可下钻原始行） | §2 actionReason + §4.8 + AC-10 下钻 | ⚠️ 必填未强制（I-2）；下钻行引用缺失（I-6） |
| R2 所有建议有依据文字 | closeMatrix.basis / negateList.reason / expandTable.verdict / layerCheck 警告 + actionReason | ✅ |
| R3 批量表列名核对（备份+重排+提示） | §6.2 列头 diff + §6.4 使用说明 + UI 提示 | ✅ |
| R4 数字一致性（同源、禁二次聚合） | AD-3 + §4.7 透传 + §7.4 渲染原值 | ✅ |
| R5 结论可被挑战（双维度→Targeting→原始行下钻） | AC-10 下钻（rawRows 按需分页读） | ⚠️ 下钻通路依赖 I-6 修正 |
| R6 状态可见 | AdKeyword.state + closeMatrix.state（R6） | ✅ |
| R7 变更留痕 | §9.4 审计表（覆写/批量表/删除/账户/上传/分析全记） | ✅ |
| R8 引擎升级不破坏 | result 全量快照 + version + String 枚举（§2 决策说明）+ 契约校验失败不覆盖 + 只升级 services/ 目录 | ✅ 设计正确 |

### 1.15 非功能需求（§9）—— ✅ 覆盖

- 性能：引擎 ≤120s/重试、并发 2+排队（§5.3 信号量）、上传 ≤50MB、批量表内存生成 ≤10s、result 服务端分页（R6 缓解 Json 过大）✅
- 安全：AES 加密（crypto-utils）+ ENCRYPTION_KEY 部署检查项（§9.1/R11）、文件私有目录+鉴权下载（§9.2）、execFile 数组参数+白名单 3 参数+正则（§9.3/R12）、CSRF 复用 middleware ✅
- 可维护性：数据获取层抽象、引擎契约化、services/ 与 ERP 分离、引擎调用日志全量 ✅
- 兼容性：新旧列名（引擎内探测）、JSON 向后兼容（Zod catch + String 枚举）✅
- 决策点 D1~D6 全部落地 ✅

---

## 二、未覆盖的需求（❌ 缺口）

### G-1（P1，中）REQ-ADS-007-3 程序化执行（写回）预留缺失

- **需求**：007-3 明确预留 `PUT /sp/keywords` + `POST /sp/negativeKeywords` 程序化执行（dry-run 默认 + 二次确认 + 单批上限 50）；§2.4/G3 要求「M2 切 ApiFetcher **业务层零改动**」。
- **架构**：§1.3 的 ReportFetcher 只含 `fetchReport` + `fetchSettings` 两个**读**方法，注释仅提 GET /sp/keywords；**写回接口签名未预留**。
- **影响**：M2 自动执行时业务层「执行」动作无处挂接，`applyChanges/batchExec` 之类签名缺失，「零改动」目标打折。
- **建议**：在 ReportFetcher（或并行接口）预留 `applyChanges(actions, {dryRun}) → {accepted, rejected}` 签名，并在文档标注 M2 批上限 50 / 二次确认语义。

### G-2（P0，高）REQ-ADS-001-1「分次提交」无法配对

- **需求**：001-1「multipart 一次提交**或分次提交均可**」。
- **架构**：uploadBatchId 由单次请求生成（§4.4），analyze 仅「经 uploadBatchId 找**批内**另一份报告」（§4.6）。用户先传搜索词、次日再传 Targeting（两次独立 POST）→ 两个 batchId → 无法配对 → 永远落入 E3 degraded 路径，即使 Targeting 已存在。
- **影响**：违反 001-1 字面要求；真实使用中分次提交是常见场景（报告导出时间不同）。
- **建议**：analyze 配对增加回退规则——批内无配对时按 (adAccountId, reportType, 日期窗口重叠) 找最近互补报告；或 upload 支持 batchId 延续参数（分次提交追加到同一批）。

### G-3（P1，低）REQ-ADS-008-1 报告历史列表缺「关联决策版本」

- **需求**：008-1 列表字段含「关联决策版本」。
- **架构**：§4.5 列表响应（id/accountId/accountName/reportType/source/startDate/endDate/originalName/rowCount/analyzeStatus/analyzedAt/createdAt）**无版本字段**。
- **建议**：列表项增加 `latestRecommendation: {id, version, createdAt} | null`（或经 recommendations 查询关联，但列表字段需补）。

---

## 三、过度设计（⚠️ 需求没要但架构做了，标注可裁剪）

| # | 项 | 位置 | 评估 |
|---|----|------|------|
| O-1 | E4 一致性阻断的 `force` 跳过参数 | §4.6 | **可裁剪**。需求 E4 要求「阻断分析，要求确认窗口/账户一致后重传」。force 允许用户绕过阻断，属需求外能力。若保留需理由（减少重传成本），但验收 AC-9 E4 演练须以阻断路径为准。 |
| O-2 | AdAccount.deletedAt 软删除 | §2 | **建议保留**（虽需求未明示，但 §9.2「报告/决策只增不删除非 admin 显式删除」的精神需要它；避免硬删级联破坏历史）。不列为裁剪项。 |
| O-3 | 审计日志扩展到站点 CRUD / 上传 / 分析 / 引擎调用 | §9.4 | 需求 §9.2 只要求「批量表生成、覆写、账户变更」三类，架构扩展 4 类。**保留**（成本低、与 R7 精神一致），不算实质过度。 |
| O-4 | GET /keywords 的 search 等通用筛选参数 | §4.8 | 通用列表能力，**保留**。 |
| O-5 | AdCampaign 表由报告行 upsert | §2 | 需求 §3.4 明确要求 AdCampaign 表（externalId=campaignId），非过度。 |

> 总评：无实质性过度设计。O-1 是唯一明确可裁剪项，O-2/O-3 属合理增强。

---

## 四、架构与需求的冲突点

| # | 冲突 | 需求原文 | 架构做法 | 严重度 |
|---|------|----------|----------|--------|
| C-1 | 引擎 CLI 命令形态 | 002-2：`analyze_cli.py --search <file> --targeting <file> --out <out.json>`（无子命令） | §5.2：`analyze_cli.py analyze --search ... --targeting ... --out ...`（增加 analyze/parse 子命令） | **低**。架构 §12-9 已说明理由（与 v20 main.py analyze 子命令形态对齐、适配层职责），核心意图（子进程+超时+重试+日志+契约输出）全部满足；AC-1 验收以 JSON 契约一致为准，不受命令形态影响。建议需求侧确认接受子命令形态，保持两文档一致。 |
| C-2 | E4 阻断策略 | E4：「阻断分析，要求确认日期窗口/账户一致后**重传**」 | §4.6：warning && !force → 422；force=true 可跳过 | **低**。force 属 O-1 的可裁剪扩展；阻断路径本身符合需求。 |
| C-3 | AdMarketplace 辅助表 | §3.4「新表（5 张）」未列站点表 | 新增第 6 张表承载 006-1 CRUD | **无实质冲突**。架构 §2 注释说明理由充分（006-1 明确要求站点可增删改，无承载表无法实现）。 |

> 权限矩阵、范围边界（M2/M3/M4/M5/M6 不做）、零重写原则、凭据独立性：**与需求完全一致，无冲突**。

---

## 五、架构内部矛盾 / 未决设计点

| # | 矛盾 | 位置 | 说明 | 严重度 |
|---|------|------|------|--------|
| I-1 | **E3 无 Targeting 分析 vs analyze CLI 必填 --targeting** | §4.6 vs §5.2 | §4.6 声称「批内无 targeting 报告 → 允许分析（degraded）」，但 §5.2 analyze 用法 `--targeting <f>` 为必填参数，未定义 search-only 调用形态与 degraded 输出契约。E3 演练（AC-9）无法实现。**必改。** | **高** |
| I-2 | **actionReason 必填 vs 模型 String?** | 需求 §3.4/R1 vs §2 AdKeyword | 需求明确「actionReason 为**必填**」，架构模型为 `String?`（可空），仅 §4.6 落库说明处写「必填」——模型层未强制，存在静默写空依据文字的可能，直接违反 R1/R2。**必改**（模型改 String 或落库强校验+测试断言）。 | **高** |
| I-3 | **dateMismatch（001-2 日期窗口校验）数据通路缺失** | §4.4 步骤 6 vs §5.2 parse 契约 | dateMismatch 需要「用户填写的 startDate/endDate」与「报告内数据窗口」对比，但 parse CLI 命令 `analyze_cli.py parse --search <f> [--targeting <f>] --out <json>` **未透传日期参数**，引擎无从得知用户填的窗口。**必改**（parse 增加 --start-date/--end-date，或该检查改 Node 侧实现并说明）。 | **高** |
| I-4 | **Bulk 三件套 Campaign ID 取值路径歧义** | §2 AdKeyword.campaignId vs §6.2 批量表 | AdKeyword.campaignId 既是 FK 指向 AdCampaign.**id（内部 cuid）**，而批量表「Campaign ID」列必须是**亚马逊 campaignId（= AdCampaign.externalId）**。若直接写 AdKeyword.campaignId 会把内部 cuid 写进批量表（亚马逊拒绝）。§6.2 数据源说明「AdKeyword 行」未指明 Campaign ID 列取值=join AdCampaign.externalId。**必改**（明确 join 取 externalId，或冗余 amazonCampaignId 列）。 | **高** |
| I-5 | **CloseMatrixTable 数据源与勾选状态合并策略未定义** | §4.7 result 接口 vs §4.8 keywords 接口 | 003-3 关闭矩阵需「全量投放组合 + 可勾选」。result 接口返回 closeMatrix（引擎快照，**无 isSelected/override**）；勾选状态在 AdKeyword 表（GET /keywords）。前端合并需要行级匹配键（keywordText+matchType+externalId），架构未定义主数据源与合并策略，存在两表不一致风险（如决策行落库遗漏 KEEP 行时矩阵不全）。**必改**（定义：CloseMatrixTable 数据源=GET /keywords 决策行（含全量 closeMatrix 落库行），result.closeMatrix 仅兜底/一致性核对；或 result 接口 closeMatrix 行内联 isSelected）。 | **中高** |
| I-6 | **AC-10「对应原始报告行」下钻通路缺失** | §4.8/§11 R6 vs AC-10 | AC-10 要求点击建议看到「对应的原始报告行（点击/花费/CTR/CPA/搜索词来源）」。架构只解决性能（rawRows 按需分页读），**未定义决策行→rawRows 行的引用机制**（无 rowIndex/行 ID 字段），前端只能按 keywordText 文本匹配，聚合型决策行无法精确定位。**必改**（closeMatrix 契约行/AdKeyword 增加 rawRowIndex（或报告行 ID 引用）；negateList 行同样）。 | **中高** |
| I-7 | **AdKeyword upsert 冲突消解未定义** | §4.6 vs §2 唯一约束 | decisionRows 来源含 closeMatrix + negateList + expandTable 增量 + **layerCheck 警告行**，唯一约束 (recommendationId, externalId)。同一词若同时出现在 closeMatrix（如关闭）与 layerCheck（如改价警告），或 negateList 行 externalId=null 多条共存，批量 upsert 以哪条为准未定义（静默覆盖风险）。**建议**：定义来源优先级或 (recommendationId, externalId, source) 分区；negateList 行需明确外部 ID 语义（无 keywordId 时如何进表）。 | 中 |
| I-8 | **verdict 缺失时的「派生 vs 前端展示」策略含糊** | §5.2 映射说明 | 同一段既说「按 §4.2 优先级**从已有字段派生**，禁止新写判定逻辑」，又说「若 v20 输出缺 verdict，M1 先输出 '' + **前端按 §4.2 规则展示**」——派生=判定逻辑，与「禁止新写判定逻辑」自相矛盾；前端展示派生又与 AD-3「禁止前端二次聚合」冲突。**建议**：明确派生逻辑归属（推荐放 analyze_cli.py 适配层，保持展示层纯透传），并在开发第一周确认 v20 是否产出 verdict。 | 中 |
| I-9 | analyze 参数示例缺 --stop-spend | §4.6 vs §5.3 | §4.6 示例只列 `--break-even-acos/--negate-clicks`，§5.3 白名单 3 参数含 --stop-spend。文档不一致（非逻辑矛盾）。**建议**：统一。 | 低 |
| I-10 | 需求 §4.4 vs 003-4 否定原因口径 | 需求文档内部 | §4.4「否定只有两类原因（合规风险/双标准达标）」，003-4 列三类（含「相关性」）。架构 negateList.reason 为通用字符串可兼容两者。**附注提示需求文档自身需澄清**（见 N-2），非架构缺陷。 | 低（需求侧） |

---

## 六、验收标准可达成性（AC-1~10）

| 验收项 | 可达成性 | 前提/风险 |
|--------|----------|-----------|
| **AC-1 引擎逐字段一致性** | ✅ 可达成 | AD-3 result 原样存储 + §5.4 契约校验 + §10 步骤 34 回归脚本（CLI 直跑 vs 存储 diff）。**前提**：①对比基准 CLI 需明确为 `analyze_cli.py` 的契约输出（或明确原始 v20 输出的键名映射规则），避免 diff 失真（§11 R4）；②verdict 缺失字段需先与引擎作者核对补齐（I-8）。 |
| **AC-2 双维度正确性** | ✅ 可达成 | 判定在引擎内（v20 已修正 3 处历史误判），用真实报告回归即可。架构零重写保证结论与 v20 一致。 |
| **AC-3 层级复核** | ✅ 可达成 | layerCheck 契约（ladderWarnings/coefficientAudit）+ LayerCheckPanel 逐族展开。倒挂数=0 由引擎保证。 |
| **AC-4 双标准动态计算** | ✅ 可达成 | settings 中 negateClicks/stopSpend 默认 null=动态计算（中位数×2 / 1.5×客单价），引擎内计算，无硬编码；breakEvenAcos 默认 40 是需求 002-5 明示的默认配置非硬编码阈值。审查确认时按「代码中无硬编码阈值」核对引擎参数传递即可。 |
| **AC-5 批量表自检** | ✅ 可达成 | §6.3 四检全 0 + 三件套齐全率（依赖 I-4 修正后 Campaign ID 取值正确）+ 步骤 10 验收「读回校验列头/行内容」符合 AC-5 验收方法（openpyxl/exceljs 读回）。 |
| **AC-6 全流程走通** | ✅ 可达成 | §8 时序完整（上传→分析→5 区渲染→勾选→生成下载），浏览器实测 dev 3001。 |
| **AC-7 权限边界** | ✅ 可达成 | 三权限点 + 每接口 hasPermission（§4.1 矩阵）+ 凭据脱敏（§3.5）+ viewer 无 ads:view→403。curl + 前端实测路径齐备。 |
| **AC-8 站点管理** | ✅ 可达成 | 账户 CRUD/脱敏/唯一约束 + 全查询按 accountId 过滤 + 切换器过滤。 |
| **AC-9 异常路径** | ⚠️ **需先修 I-1/I-3** | E1/E2/E4/E5/E6/E7/E8/E9 均有明确落点；**E3（单报告场景）因 analyze CLI 必填 --targeting 无法演练**（I-1）；E4 演练需确认 force 与阻断路径的关系（O-1）。 |
| **AC-10 可追溯性** | ⚠️ **需先修 I-6** | actionReason + L1 族 + rawRows 数据齐备，但「对应的原始报告行」的**行级引用**未设计，当前只能文本匹配，无法保证精确定位（I-6）。修复后达成。 |

> 总评：AC-1~8 可达成；**AC-9、AC-10 依赖必改项 I-1、I-3、I-6 修正后方可达成**。

---

## 七、结论与必改项清单

### 结论：**需修改后通过**

架构对需求覆盖率高（11 条 REQ 中 9 条完整覆盖、2 条基本覆盖；§4 规则/§5 权限/E 流程/R 隐性需求全量落地），无需求级的方向性错误，无实质性过度设计。但 7 项必改（其中 3 项直接阻塞 AC-9/AC-10 验收）须在开发前完成。

### 必改项清单（P0，阻塞验收或违反需求约束）

| # | 必改项 | 对应 |
|---|--------|------|
| 1 | **E3 无 Targeting 分析路径落地**：analyze CLI 支持 --targeting 可选（search-only/degraded 模式），定义 degraded 输出契约（layerCheck.bidUnavailable=true、无改价/层级结论、输出待核对清单） | I-1 / AC-9 |
| 2 | **双报告分次提交配对**：analyze 配对增加跨批回退（按 accountId+日期窗口找互补报告）或 upload 支持 batchId 延续 | G-2 / 001-1 |
| 3 | **actionReason 必填强制**：AdKeyword.actionReason 改非空 String（或落库强校验+测试断言），杜绝无依据文字的建议行 | I-2 / §3.4 / R1 / R2 |
| 4 | **dateMismatch 校验通路**：parse CLI 透传 --start-date/--end-date（或该检查改 Node 侧并说明实现） | I-3 / 001-2 |
| 5 | **批量表 Campaign ID 取值明确**：Campaign ID 列 = AdCampaign.externalId（join），或 AdKeyword 冗余 amazonCampaignId 列；防止内部 cuid 写入批量表 | I-4 / 005-2 / AC-5 |
| 6 | **AC-10 原始行下钻引用**：closeMatrix/negateList 契约行与 AdKeyword 增加 rawRowIndex（报告行 ID 引用） | I-6 / AC-10 / R1 / R5 |
| 7 | **CloseMatrixTable 数据源与勾选合并策略**：定义主数据源（建议 GET /keywords 全量决策行）与 result 快照的关系及行级合并键 | I-5 / 003-3 / 004-3 |

### 建议修改项（P1，不阻塞但应处理）

| # | 建议项 | 对应 |
|---|--------|------|
| 1 | ApiFetcher 预留写回接口签名（applyChanges/dry-run/批上限 50） | G-1 / 007-3 |
| 2 | 报告历史列表补「关联决策版本」字段 | G-3 / 008-1 |
| 3 | verdict 派生逻辑归属明确化（推荐放 analyze_cli.py 适配层，展示层保持纯透传） | I-8 / §11 R4 / AD-3 |
| 4 | AdKeyword upsert 冲突消解规则（来源优先级或 (recommendationId, externalId, source) 分区；negateList 行外部 ID 语义） | I-7 |
| 5 | AC-1 对比基准 CLI 明确（analyze_cli.py 契约输出 vs 原始 v20 main.py 的映射规则），写入 AC-1 回归脚本说明 | AC-1 |
| 6 | E4 force 参数保留与否与验收口径确认（需求字面为「重传」） | O-1 / C-2 |
| 7 | 006-5 页面文案「API 凭据用于 M2 自动拉取，当前阶段仅手动上传报告」落到 /ads/sites UI 设计 | 006-5 |
| 8 | analyze 参数示例补 --stop-spend，统一 §4.6/§5.3 文档 | I-9 |

---

## 附注：需求文档自身问题（非架构缺陷，供 BA 修正基准文档）

- **N-1**：需求 001-3 引用「REQ-ADS-016」，但需求文档仅定义 REQ-ADS-001~011，016 不存在（应为 001-3 或列名风险提示条目的笔误）。架构 §11 R5 照抄了该引用，建议需求侧修正编号后架构同步。
- **N-2**：§4.4「否定只有两类原因（合规风险/双标准达标）」与 003-4「原因（合规风险/双标准达标/相关性）」口径不一致。架构 negateList.reason 通用字符串可兼容，但需求需澄清「相关性」是否可作为否定原因（按 §4.4 铁律应为否）。
- **N-3**：AC-1 的「Python CLI 直接运行结果」未指明 CLI 指原始 v20 main.py 还是经适配层的 analyze_cli.py，验收时需明确（见必改项 P1-5）。

---

*审查结束。本报告以 `advertising-domain-m1-requirements.md` 为唯一基准；必改项修正后架构可通过评审，进入开发。*
