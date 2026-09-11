/**
 * 亚马逊广告优化管理（M1）前端 DTO 类型
 *
 * 字段契约来源：docs/advertising-domain-m1-be-design.md §17（Phase 3 仲裁点）
 *  - §17-1 决策行 30+ 字段（GET /keywords 行对象）
 *  - §17-2 动作枚举 / §17-3 决策来源枚举
 *  - §17-4 result 接口顶层键（前端禁止重命名/二次聚合，R4/AC-1）
 *  - §17-5 批量表统计键 / §17-6 上传响应键 / §17-7 分析响应键
 *  - §17-8 报告列表项键 / §17-9 账户项键（凭据一律 ****后4位） / §17-10 日期格式
 *
 * 铁律：引擎数字零加工，前端只做展示层格式化（见 FE 设计 §6.6 / §10-9）。
 */

// ──────────────────────────────────────────────────────────────
// 枚举（BE §17-2 / §17-3，前端只透传不翻译，展示映射仅着色）
// ──────────────────────────────────────────────────────────────

/** 建议动作（PUT /keywords 与查询共用） */
export type AdAction =
  | 'PAUSE'
  | 'RAISE_BID'
  | 'LOWER_BID'
  | 'NEGATE'
  | 'KEEP'
  | 'EXPAND'
  | 'HARVEST';

export const AD_ACTIONS: AdAction[] = [
  'PAUSE',
  'RAISE_BID',
  'LOWER_BID',
  'NEGATE',
  'KEEP',
  'EXPAND',
  'HARVEST',
];

/** 决策来源分区（前端四表 Tab 分区依据） */
export type AdKeywordSource = 'CLOSE_MATRIX' | 'LAYER_CHECK' | 'EXPAND' | 'NEGATE';

/** 投放状态（Targeting 报告口径） */
export type AdState = 'ENABLED' | 'PAUSED';

/** 报告分析状态 */
export type AdAnalyzeStatus = 'UPLOADED' | 'ANALYZING' | 'ANALYZED' | 'ANALYZE_FAILED';

/** 报告类型 */
export type AdReportType = 'SEARCH_TERM' | 'TARGETING';

// ──────────────────────────────────────────────────────────────
// 通用分页包装（listResponse：{ items, pagination }）
// ──────────────────────────────────────────────────────────────

export interface AdsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdsListResponse<T> {
  items: T[];
  pagination: AdsPagination;
}

// ──────────────────────────────────────────────────────────────
// 站点 / 账户（BE §17-9）
// ──────────────────────────────────────────────────────────────

export interface AdMarketplaceDTO {
  id: string;
  code: string;
  name: string;
  marketplaceId: string;
  currency: string;
  adEndpoint: string | null;
  isActive: boolean;
  createdAt?: string;
}

/** 账户引擎参数（D6：留空=引擎动态计算） */
export interface AdAccountSettings {
  breakEvenAcos?: number | null;
  negateClicks?: number | null;
  stopSpend?: number | null;
  [key: string]: unknown;
}

export interface AdAccountDTO {
  id: string;
  platformCode: string;
  marketplaceId: string;
  marketplace: {
    code: string;
    name: string;
    currency: string;
    adEndpoint: string | null;
  } | null;
  name: string;
  externalId: string | null;
  /** 凭据一律脱敏：`****后4位` 或 ''（任何角色不可回读明文，AC-7） */
  clientId: string | null;
  clientSecret: string | null;
  refreshToken: string | null;
  platformAccountId: string | null;
  isActive: boolean;
  settings: AdAccountSettings | null;
  createdAt?: string;
}

export interface AdAccountInput {
  name: string;
  marketplaceId: string;
  externalId?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
  refreshToken?: string | null;
  platformAccountId?: string | null;
  isActive?: boolean;
  settings?: AdAccountSettings | null;
}

export interface AdMarketplaceInput {
  code: string;
  name: string;
  marketplaceId: string;
  currency?: string;
  adEndpoint?: string | null;
  isActive?: boolean;
}

// ──────────────────────────────────────────────────────────────
// 报告（BE §17-6 / §17-8）
// ──────────────────────────────────────────────────────────────

export interface AdReportListItem {
  id: string;
  accountId: string;
  accountName: string | null;
  reportType: AdReportType | string;
  source: string | null;
  startDate: string | null;
  endDate: string | null;
  originalName: string | null;
  rowCount: number | null;
  analyzeStatus: AdAnalyzeStatus | string;
  analyzedAt: string | null;
  latestRecommendation: { id: string; version: number; createdAt: string } | null;
  createdAt: string;
}

/** 两报告口径一致性（E4 前置可见） */
export interface AdConsistencyCheck {
  spendDiffPct?: number | null;
  ordersDiffPct?: number | null;
  dateMismatch?: boolean;
  warning?: boolean;
}

/** 上传响应（BE §17-6） */
export interface AdUploadResponse {
  uploadBatchId: string;
  reports: Array<{
    id: string;
    reportType: AdReportType | string;
    rowCount: number | null;
  }>;
  warnings?: string[];
  /** FE 设计 §6.3：上传响应可携带口径校验明细（后端可选返回） */
  consistencyCheck?: AdConsistencyCheck | null;
}

/** 分析响应（BE §17-7） */
export interface AdAnalyzeResponse {
  recommendationId: string;
  degraded: boolean;
  pairing: {
    mode: 'batch' | 'fallback' | 'none';
    reportId?: string | null;
  };
}

/** 引擎失败详情（E2/E7） */
export interface AdAnalyzeError {
  exitCode?: number | null;
  stderr?: string | null;
  attempts?: number | null;
  version?: string | null;
}

// ──────────────────────────────────────────────────────────────
// 决策行（BE §17-1，四表统一消费该结构）
// ──────────────────────────────────────────────────────────────

export interface AdKeywordRow {
  id: string;
  adAccountId: string;
  campaignId: string | null;
  amazonCampaignId: string | null;
  adGroupId: string | null;
  externalId: string | null;
  keywordText: string;
  matchType: string | null;
  state: AdState | string | null;
  /** 目标竞价；null ⇒ 「需后台核对」（禁止用 CPC 冒充，口径铁律 2） */
  bid: number | null;
  familyL1: string | null;
  duplicateOf: string | null;
  action: AdAction | string;
  actionBid: number | null;
  actionReason: string | null;
  rawRowIndex: number | null;
  source: AdKeywordSource | string;
  acos: number | null;
  orders: number | null;
  spend: number | null;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  /** FE 设计 §11.1 使用列；后端未返回时展示「—」 */
  cpa?: number | null;
  reportId: string | null;
  isSelected: boolean;
  overrideAction: AdAction | string | null;
  overrideBid: number | null;
  overriddenBy: string | null;
  overriddenAt: string | null;
  recommendationId: string;
  /** 派生字段（后端返回）：overriddenAt != null */
  isManualOverride: boolean;
  /** 派生字段（后端返回）：actionReason === '待补充' */
  reasonPending: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdKeywordListQuery {
  recommendationId: string;
  source?: AdKeywordSource | string;
  familyL1?: string;
  action?: string;
  matchType?: string;
  isSelected?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

/** PUT /keywords/:id 入参：仅 isSelected ⇒ 纯勾选；含 action/actionBid ⇒ 服务端置 override* */
export interface UpdateKeywordInput {
  isSelected?: boolean;
  action?: AdAction | string;
  actionBid?: number | null;
  actionReason?: string;
}

// ──────────────────────────────────────────────────────────────
// 引擎结果快照（BE §17-4 顶层键，键名与引擎契约一一对应）
// ──────────────────────────────────────────────────────────────

export interface AdResultAccount {
  spend: number | null;
  sales: number | null;
  orders: number | null;
  acos: number | null;
  cvr: number | null;
  aov: number | null;
  [key: string]: unknown;
}

export interface AdFamilyMember {
  targeting?: string | null;
  keywordText?: string | null;
  matchType?: string | null;
  clicks?: number | null;
  spend?: number | null;
  acos?: number | null;
  orders?: number | null;
  action?: string | null;
  [key: string]: unknown;
}

export interface AdFamilyRow {
  family: string;
  spend: number | null;
  orders: number | null;
  acos: number | null;
  /** 引擎值直接渲染；空串 ⇒ 「待补充」（禁止前端推导，架构 I-8/R4） */
  verdict: string;
  members?: AdFamilyMember[];
  [key: string]: unknown;
}

export interface AdExpandIncremental {
  term?: string | null;
  /** 当前由谁捕获（来源投放词） */
  capturedBy?: string | null;
  source?: string | null;
  clicks?: number | null;
  orders?: number | null;
  [key: string]: unknown;
}

export interface AdExpandRow {
  family: string;
  verdict: string;
  incremental?: AdExpandIncremental[];
  [key: string]: unknown;
}

export interface AdCoefficientAuditRow {
  family?: string | null;
  match?: string | null;
  bid?: number | null;
  exactBid?: number | null;
  ratio?: number | null;
  /** 规范系数（0.75 / 0.50） */
  standard?: number | null;
  [key: string]: unknown;
}

export interface AdLadderWarning {
  family?: string | null;
  keywordText?: string | null;
  targeting?: string | null;
  matchType?: string | null;
  bid?: number | null;
  suggestedBid?: number | null;
  reason?: string | null;
  [key: string]: unknown;
}

export interface AdLayerCheck {
  ladderWarnings?: AdLadderWarning[];
  coefficientAudit?: AdCoefficientAuditRow[];
  /** degraded：未上传 Targeting 报告，无法做 bid 层级核对（E3/口径铁律 3） */
  bidUnavailable?: boolean;
  bidPendingList?: Array<Record<string, unknown>>;
  laddersAfterFix?: number | null;
  [key: string]: unknown;
}

export interface AdSummary {
  closeCount?: number | null;
  closeSpendPct?: number | null;
  projectedAcos?: number | null;
  needsBidAdjust?: boolean;
  needsListingFix?: boolean;
  bidPendingList?: Array<Record<string, unknown>>;
  laddersAfterFix?: number | null;
  [key: string]: unknown;
}

export interface AdRecommendationMeta {
  id: string;
  version?: number | null;
  createdAt?: string | null;
  /** 本次跑批动态阈值（AC-4 自证链） */
  params?: {
    breakEvenAcos?: number | null;
    negateClicks?: number | null;
    stopSpend?: number | null;
    [key: string]: unknown;
  } | null;
  version_engine?: string | null;
  [key: string]: unknown;
}

/** GET /reports/:id/result（BE §17-4 顶层键，前端禁止重命名） */
export interface AdsResultResponse {
  recommendation: AdRecommendationMeta | null;
  account: AdResultAccount | null;
  families: AdFamilyRow[];
  expandTable: AdExpandRow[];
  layerCheck: AdLayerCheck | null;
  summary: AdSummary | null;
  /** 仅 AC-1 对照冗余，前端不据其渲染可勾选行（架构 P0-7） */
  closeMatrix?: Array<Record<string, unknown>>;
  negateList?: Array<Record<string, unknown>>;
  degraded: boolean;
  pairing?: AdAnalyzeResponse['pairing'] | null;
  /** FE 设计 §13 O-1 补充点：批内报告引用（供原始行下钻定位） */
  reports?: {
    search?: { id: string } | null;
    targeting?: { id: string } | null;
  } | null;
}

/** 原始报告行（下钻单行，GET /reports/:id/result?rawRow=N） */
export type AdRawReportRow = Record<string, unknown>;

// ──────────────────────────────────────────────────────────────
// 批量表（BE §17-5）
// ──────────────────────────────────────────────────────────────

export interface AdBulkTableStats {
  close: number;
  bidChange: number;
  negate: number;
  create: number;
}

export interface AdBulkTableResponse {
  xlsxUrl: string;
  readmeUrl?: string | null;
  stats: AdBulkTableStats;
}

export interface AdRecommendationListItem {
  id: string;
  accountId?: string | null;
  accountName?: string | null;
  version?: number | null;
  degraded?: boolean;
  createdAt: string;
  [key: string]: unknown;
}
