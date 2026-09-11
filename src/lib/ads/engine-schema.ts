/**
 * 广告引擎输出 JSON 校验（E7 契约防漂移）
 *
 * 依据：docs/advertising-domain-m1-be-design.md §6.4
 *  - 全部字段 .catch() 容错：引擎可能输出 null/缺字段，兜底不拒批（§3.2）
 *  - ok: false → 顶层 literal 校验即失败（按 E2/E7 处理）
 *  - degraded=true 时 closeMatrix=[] 且 layerCheck.bidUnavailable=true 为合法输出
 *
 * 相对 §6.4 基线的扩展（同为 catch 容错字段，保留引擎有用数据供决策行落库）：
 *  - closeMatrix 行补 acos/orders/sales/impr/actionBid/actionReason
 *  - negateList 行补 spend/clicks/orders/acos
 *  - expandTable 行补 mainTarget/mainOrders/mainAcos/incremental*
 *  - summary 补 stop_spend/negate_clicks/break_even_acos（动态阈值自证，AC-4）
 */
import { z } from 'zod';

const AccountSchema = z.object({
  spend: z.coerce.number().catch(0),
  sales: z.coerce.number().catch(0),
  orders: z.coerce.number().catch(0),
  clicks: z.coerce.number().catch(0),
  acos: z.coerce.number().nullable().catch(null),
  cvr: z.coerce.number().nullable().catch(null),
  aov: z.coerce.number().nullable().catch(null),
});

const CloseMatrixRowSchema = z.object({
  keywordText: z.string().catch(''),
  matchType: z.string().catch(''),
  clicks: z.coerce.number().catch(0),
  spend: z.coerce.number().catch(0),
  sales: z.coerce.number().nullable().catch(null),
  orders: z.coerce.number().nullable().catch(null),
  impr: z.coerce.number().nullable().catch(null),
  ctr: z.coerce.number().nullable().catch(null),
  cpa: z.coerce.number().nullable().catch(null),
  acos: z.coerce.number().nullable().catch(null),
  bid: z.coerce.number().nullable().catch(null),
  state: z.string().catch(''),
  basis: z.string().catch(''),
  action: z.string().catch(''),
  actionBid: z.coerce.number().nullable().catch(null),
  actionReason: z.string().catch(''),
  rowIndex: z.coerce.number().nullable().catch(null), // P0-6：degraded 模式为 null 合法
  // Bulk 三件套（架构必改项 5/I-4：批量表 Campaign ID 用 amazonCampaignId，严禁内部 cuid）
  amazonCampaignId: z.string().nullable().catch(null),
  adGroupId: z.string().nullable().catch(null),
  externalId: z.string().nullable().catch(null),
});

const NegateRowSchema = z.object({
  term: z.string().catch(''),
  reason: z.string().catch(''),
  spend: z.coerce.number().nullable().catch(null),
  clicks: z.coerce.number().nullable().catch(null),
  orders: z.coerce.number().nullable().catch(null),
  acos: z.coerce.number().nullable().catch(null),
  rowIndex: z.coerce.number().nullable().catch(null),
});

const ExpandRowSchema = z.object({
  family: z.string().catch(''),
  mainTarget: z.string().nullable().catch(null),
  mainOrders: z.coerce.number().nullable().catch(null),
  mainAcos: z.coerce.number().nullable().catch(null),
  incrementalClicks: z.coerce.number().nullable().catch(null),
  incrementalOrders: z.coerce.number().nullable().catch(null),
  incrementalSpend: z.coerce.number().nullable().catch(null),
  verdict: z.string().catch(''),
  // 拓词动作（用户纠正：开 BROAD 探测 → 收割，不只新建精准）
  actionType: z.string().catch('NONE'),
  probeTerms: z.array(z.string()).catch([]),
  harvestTerms: z
    .array(z.object({ term: z.string().catch(''), orders: z.coerce.number().nullable().catch(null), clicks: z.coerce.number().nullable().catch(null) }))
    .catch([]),
  incremental: z.array(z.unknown()).catch([]),
});

const LayerCheckSchema = z.object({
  ladderWarnings: z.array(z.unknown()).catch([]),
  coefficientAudit: z
    .array(
      z.object({
        family: z.string().catch(''),
        match: z.string().catch(''),
        bid: z.coerce.number().nullable().catch(null),
        exactBid: z.coerce.number().nullable().catch(null),
        ratio: z.coerce.number().nullable().catch(null),
      })
    )
    .catch([]),
  bidUnavailable: z.boolean().catch(false),
});

const SummarySchema = z.object({
  closeCount: z.coerce.number().catch(0),
  closeSpendPct: z.coerce.number().catch(0),
  projectedAcos: z.coerce.number().nullable().catch(null),
  needsBidAdjust: z.boolean().catch(false),
  needsListingFix: z.boolean().catch(false),
  bidPendingList: z.array(z.unknown()).catch([]), // degraded 特有，catch 容错
  stop_spend: z.coerce.number().nullable().catch(null), // AC-4 动态阈值自证
  negate_clicks: z.coerce.number().nullable().catch(null),
  break_even_acos: z.coerce.number().nullable().catch(null),
});

export const EngineResultSchema = z.object({
  ok: z.literal(true),
  degraded: z.boolean().catch(false), // P0-1：search-only 标记
  account: AccountSchema.catch({ spend: 0, sales: 0, orders: 0, clicks: 0, acos: null, cvr: null, aov: null }),
  families: z
    .array(
      z.object({
        family: z.string().catch(''),
        spend: z.coerce.number().catch(0),
        orders: z.coerce.number().catch(0),
        acos: z.coerce.number().nullable().catch(null),
        verdict: z.string().catch(''),
        members: z.array(z.unknown()).catch([]),
      })
    )
    .catch([]),
  closeMatrix: z.array(CloseMatrixRowSchema).catch([]),
  negateList: z.array(NegateRowSchema).catch([]),
  expandTable: z.array(ExpandRowSchema).catch([]),
  layerCheck: LayerCheckSchema.catch({ ladderWarnings: [], coefficientAudit: [], bidUnavailable: false }),
  summary: SummarySchema.catch({
    closeCount: 0,
    closeSpendPct: 0,
    projectedAcos: null,
    needsBidAdjust: false,
    needsListingFix: false,
    bidPendingList: [],
    stop_spend: null,
    negate_clicks: null,
    break_even_acos: null,
  }),
  version: z.string().catch('unknown'),
});

export type EngineResult = z.infer<typeof EngineResultSchema>;
