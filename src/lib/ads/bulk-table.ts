/**
 * bulk-table.ts — 亚马逊 Bulk Operations 批量操作表生成（v18.1 已验证格式）
 *
 * 三类操作行：
 *   关闭：Entity=Keyword/Product Targeting, Operation=Update, State=paused（禁止同时填 Bid）
 *   改价：Operation=Update, State=enabled, Bid=层级约束后的最终值（两位小数）
 *   否定：Entity=Campaign Negative Keyword, Operation=Create, negativeExact
 *
 * 自检（4 项全为 0 才生成，否则拒绝）：
 *   1. Update 行缺 Campaign/AdGroup ID = 0
 *   2. Entity=Keyword 缺 Keyword ID = 0
 *   3. State 非 paused/enabled = 0
 *   4. State=paused 与 Bid 并存 = 0
 *
 * Campaign ID 列一律用 amazonCampaignId（亚马逊 externalId），严禁写内部 cuid。
 */

import ExcelJS from 'exceljs';
import type { AdKeywordRow } from '@/types/ads';

/** Bulk 33 列标准英文模板（亚马逊「批量操作」通用表头） */
export const BULK_HEADERS = [
  'Product',
  'Entity',
  'Operation',
  'Campaign ID',
  'Ad Group ID',
  'Portfolio ID',
  'Ad ID',
  'Keyword ID',
  'Product Targeting ID',
  'Campaign Name',
  'Ad Group Name',
  'Start Date',
  'End Date',
  'Targeting Type',
  'State',
  'Campaign State (Informational only)',
  'Ad Group State (Informational only)',
  'Daily Budget',
  'SKU',
  'ASIN',
  'Eligibility Status (Informational only)',
  'Reason for Ineligibility (Informational only)',
  'Ad Group Default Bid',
  'Bid',
  'Keyword Text',
  'Native Language Keyword',
  'Native Language Locale',
  'Match Type',
  'Bidding Strategy',
  'Placement',
  'Percentage',
  'Product Targeting Expression',
  'Resolved Product Targeting Expression (Informational only)',
] as const;

export const SHEET_NAME = 'Sponsored Products Campaigns';

export interface BulkRowInput {
  row: AdKeywordRow;
  action: 'PAUSE' | 'RAISE_BID' | 'LOWER_BID' | 'NEGATE' | 'CREATE';
}

export interface BulkTableResult {
  rowCount: number;
  stats: { close: number; bidChange: number; negate: number; create: number };
}

/** Entity 判定：关键词匹配 → Keyword；自动定向/ASIN → Product Targeting */
function entityOf(matchType: string | null | undefined): 'Keyword' | 'Product Targeting' {
  const m = (matchType ?? '').toUpperCase();
  if (m === 'EXACT' || m === 'PHRASE' || m === 'BROAD') return 'Keyword';
  return 'Product Targeting';
}

/** Match Type 小写（Keyword 行专用） */
function matchTypeLower(matchType: string | null | undefined): string {
  const m = (matchType ?? '').toUpperCase();
  return m === 'EXACT' || m === 'PHRASE' || m === 'BROAD' ? m.toLowerCase() : '';
}

/** 层级约束后的改价：LOWER→×0.85、RAISE→×1.2、CREATE（新建精准）→×0.85（主词降档收割）；最低 $0.20；两位小数 */
export function constrainedBid(action: string, currentBid: number | null | undefined): number | null {
  if (!currentBid) return null;
  let next: number;
  if (action === 'LOWER_BID') next = currentBid * 0.85;
  else if (action === 'RAISE_BID') next = currentBid * 1.2;
  else if (action === 'CREATE') next = currentBid * 0.85;
  else return null;
  return Math.max(0.2, Math.round(next * 100) / 100);
}

interface SelfCheckResult {
  ok: boolean;
  errors: string[];
}

function selfCheck(rows: BulkRowInput[]): SelfCheckResult {
  const errors: string[] = [];
  rows.forEach(({ row, action }, i) => {
    if (action === 'NEGATE') return; // Create 行无 ID 要求
    if (action === 'CREATE') {
      // 新建精准：只需 Ad Group ID + Keyword Text（不要求 keywordId/campaignId）
      if (!row.adGroupId) errors.push(`行${i + 1}: CREATE 缺 Ad Group ID（${row.keywordText}）`);
      return;
    }
    if (!row.amazonCampaignId) errors.push(`行${i + 1}: 缺 Campaign ID（${row.keywordText}）`);
    if (!row.adGroupId) errors.push(`行${i + 1}: 缺 Ad Group ID（${row.keywordText}）`);
    if (entityOf(row.matchType) === 'Keyword' && !row.externalId) {
      errors.push(`行${i + 1}: Keyword 缺 Keyword ID（${row.keywordText}）`);
    }
    if (action === 'PAUSE') {
      // 只查显式传入的 actionBid（端点构造时 PAUSE 已强制 null；row.bid 是当前竞价不算冲突）
      const b = row.actionBid;
      if (b != null && b > 0) errors.push(`行${i + 1}: State=paused 与 Bid 并存（${row.keywordText}）`);
    }
  });
  return { ok: errors.length === 0, errors };
}

/**
 * 生成批量操作表 xlsx（Buffer 返回，由路由下发下载）。
 * @param rows 已勾选的决策行 + 动作（含风险词两行：关闭+否定由调用方拆好传入）
 */
export async function generateBulkTable(rows: BulkRowInput[]): Promise<{ buffer: Buffer; result: BulkTableResult }> {
  const check = selfCheck(rows);
  if (!check.ok) {
    const err = new Error(`批量表自检失败（${check.errors.length} 项）：\n${check.errors.slice(0, 10).join('\n')}`);
    (err as Error & { code?: string }).code = 'BULK_SELF_CHECK_FAILED';
    throw err;
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(SHEET_NAME);
  ws.addRow([...BULK_HEADERS]);

  const stats = { close: 0, bidChange: 0, negate: 0, create: 0 };

  for (const { row, action } of rows) {
    const values = new Array<string | number>(BULK_HEADERS.length).fill('');
    // 列索引（0-based → 1-based 赋值）
    const col = (name: string) => BULK_HEADERS.indexOf(name as (typeof BULK_HEADERS)[number]);

    if (action === 'NEGATE') {
      // 活动级否定：Entity=Campaign Negative Keyword, Operation=Create
      values[col('Product')] = 'Sponsored Products';
      values[col('Entity')] = 'Campaign Negative Keyword';
      values[col('Operation')] = 'Create';
      values[col('Campaign ID')] = row.amazonCampaignId ?? '';
      values[col('Keyword Text')] = row.keywordText;
      values[col('Match Type')] = 'negativeExact';
      values[col('State')] = 'enabled';
      stats.negate++;
      ws.addRow(values);
      continue;
    }

    if (action === 'CREATE') {
      // 新建精准：Entity=Keyword, Operation=Create（Ad Group ID + Keyword Text + Match Type + Bid）
      // bid 直接用引擎建议值（落库时已含层级约束 ×0.85，不再二次打折）
      const bid = row.actionBid ?? row.bid;
      values[col('Product')] = 'Sponsored Products';
      values[col('Entity')] = 'Keyword';
      values[col('Operation')] = 'Create';
      values[col('Ad Group ID')] = row.adGroupId ?? '';
      values[col('State')] = 'enabled';
      values[col('Bid')] = bid ?? '';
      values[col('Keyword Text')] = row.keywordText;
      values[col('Match Type')] = matchTypeLower(row.matchType || 'EXACT');
      stats.create++;
      ws.addRow(values);
      continue;
    }

    // Update 行（关闭/改价）
    const isKeyword = entityOf(row.matchType) === 'Keyword';
    values[col('Product')] = 'Sponsored Products';
    values[col('Entity')] = isKeyword ? 'Keyword' : 'Product Targeting';
    values[col('Operation')] = 'Update';
    values[col('Campaign ID')] = row.amazonCampaignId ?? '';
    values[col('Ad Group ID')] = row.adGroupId ?? '';
    if (isKeyword) {
      values[col('Keyword ID')] = row.externalId ?? '';
      values[col('Keyword Text')] = row.keywordText;
      values[col('Match Type')] = matchTypeLower(row.matchType);
    } else {
      values[col('Product Targeting ID')] = row.externalId ?? '';
      values[col('Product Targeting Expression')] = row.keywordText;
    }

    if (action === 'PAUSE') {
      values[col('State')] = 'paused';
      stats.close++;
    } else {
      const bid = constrainedBid(action, row.actionBid ?? row.bid);
      values[col('State')] = 'enabled';
      values[col('Bid')] = bid ?? '';
      stats.bidChange++;
    }
    ws.addRow(values);
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, result: { rowCount: rows.length, stats } };
}
