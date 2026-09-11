'use client';

/**
 * 广告域前端共享工具与小组件
 *
 * 职责：展示层格式化（R4：数字零加工，只做 $/%/小数位）、徽章着色映射、
 *       hasPerm 前端权限、原始报告行下钻 Dialog（AC-10）。
 * 铁律：颜色走 shadcn 语义变量为主；徽章色阶按 FE 设计 §4.4/§4.5 固化文案着色。
 */

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useRawReportRow } from '@/hooks/use-ads';
import type { AdKeywordRow } from '@/types/ads';

/** Select 占位值：Radix Select 禁止空串（UI 铁律 7） */
export const NONE_VALUE = '__none__';

// ──────────────────────────────────────────────────────────────
// 权限（hasPerm 前端控制，FE 设计 §9.1）
// ──────────────────────────────────────────────────────────────

/**
 * 从 localStorage.user.permissions 读取权限点。
 * 在 useEffect 内读取以避免 SSR/CSR 首帧不一致。
 */
export function useAdsPerms() {
  const [perms, setPerms] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      const user = raw ? JSON.parse(raw) : null;
      setPerms(Array.isArray(user?.permissions) ? user.permissions : []);
    } catch {
      setPerms([]);
    } finally {
      setReady(true);
    }
  }, []);

  const hasPerm = (p: string) => perms.includes(p) || perms.includes('*');

  return {
    ready,
    perms,
    hasPerm,
    canView: hasPerm('ads:view'),
    canEdit: hasPerm('ads:edit'),
    canAdmin: hasPerm('ads:admin'),
  };
}

// ──────────────────────────────────────────────────────────────
// 展示层格式化（仅格式化，禁止任何算术推导 —— R4/AC-1）
// ──────────────────────────────────────────────────────────────

const DASH = '—';

export function fmtMoney(v: number | null | undefined, currency = 'USD'): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return DASH;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(v));
  } catch {
    return `$${Number(v).toFixed(2)}`;
  }
}

/** bid/金额两位小数 */
export function fmtBid(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return DASH;
  return `$${Number(v).toFixed(2)}`;
}

/** ACoS/CVR/CTR 一位小数 */
export function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return DASH;
  return `${Number(v).toFixed(digits)}%`;
}

export function fmtInt(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return DASH;
  return new Intl.NumberFormat('en-US').format(Number(v));
}

export function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return DASH;
  return Number(v).toFixed(digits);
}

export function fmtDate(v: string | null | undefined): string {
  if (!v) return DASH;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('zh-CN');
}

export function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// ──────────────────────────────────────────────────────────────
// 徽章着色（只按引擎文案着色，禁止改写文案 —— FE 设计 §4.4）
// ──────────────────────────────────────────────────────────────

/** 处置结论/拓词结论徽章 class（verdict 文案匹配） */
export function verdictBadgeClass(verdict: string | null | undefined): string {
  const v = (verdict || '').trim();
  if (!v) return 'border-yellow-400 text-yellow-700 bg-transparent';
  if (/加投|收割|开\s*BROAD|★/.test(v)) return 'bg-green-100 text-green-700 border-transparent';
  if (/重度收缩|收缩|换变体|试探/.test(v)) return 'bg-yellow-100 text-yellow-700 border-transparent';
  if (/关闭|整族关|风险/.test(v)) return 'bg-red-100 text-red-700 border-transparent';
  if (/待观察|样本不足|不拓/.test(v)) return 'bg-gray-100 text-gray-500 border-transparent';
  return 'bg-blue-100 text-blue-700 border-transparent';
}

/** verdict 展示文案（空串 ⇒ 「待补充」，引擎自检兜底，不隐藏该行） */
export function verdictLabel(verdict: string | null | undefined): string {
  const v = (verdict || '').trim();
  return v || '待补充';
}

/** 建议动作徽章 class（action 枚举，BE §17-2） */
export function actionBadgeClass(action: string | null | undefined): string {
  switch (action) {
    case 'PAUSE':
      return 'bg-red-100 text-red-700 border-transparent';
    case 'RAISE_BID':
    case 'HARVEST':
      return 'bg-green-100 text-green-700 border-transparent';
    case 'LOWER_BID':
      return 'bg-yellow-100 text-yellow-700 border-transparent';
    case 'KEEP':
      return 'bg-gray-100 text-gray-600 border-transparent';
    default:
      return 'bg-blue-100 text-blue-700 border-transparent';
  }
}

/** 动作中文标注（仅 UI 辅助，枚举值原样透传给后端） */
export const ACTION_LABELS: Record<string, string> = {
  PAUSE: '关闭',
  RAISE_BID: '加价',
  LOWER_BID: '降价',
  NEGATE: '否定',
  KEEP: '维持',
  EXPAND: '新建',
  HARVEST: '收割',
};

export function actionLabel(action: string | null | undefined): string {
  if (!action) return DASH;
  return ACTION_LABELS[action] ? `${ACTION_LABELS[action]}(${action})` : action;
}

/** 匹配类型徽章 class */
export function matchTypeBadgeClass(matchType: string | null | undefined): string {
  const m = (matchType || '').toUpperCase();
  if (m.includes('EXACT') || m.includes('CLOSE-MATCH')) return 'bg-blue-100 text-blue-700 border-transparent';
  if (m.includes('PHRASE') || m.includes('LOOSE-MATCH')) return 'bg-yellow-100 text-yellow-700 border-transparent';
  if (m.includes('BROAD')) return 'bg-green-100 text-green-700 border-transparent';
  return 'bg-gray-100 text-gray-600 border-transparent';
}

/** 投放状态徽章 class */
export function stateBadgeClass(state: string | null | undefined): string {
  if (state === 'ENABLED') return 'bg-green-100 text-green-700 border-transparent';
  if (state === 'PAUSED') return 'bg-gray-100 text-gray-600 border-transparent';
  return 'bg-gray-100 text-gray-500 border-transparent';
}

/** 否定原因徽章 class（合规风险=红/双标准=黄/不相关=灰） */
export function negateReasonBadgeClass(reason: string | null | undefined): string {
  const r = reason || '';
  if (/合规|风险|安全/.test(r)) return 'bg-red-100 text-red-700 border-transparent';
  if (/双标准|重复|冲突/.test(r)) return 'bg-yellow-100 text-yellow-700 border-transparent';
  return 'bg-gray-100 text-gray-600 border-transparent';
}

/** 报告分析状态徽章 class */
export function analyzeStatusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case 'ANALYZED':
      return 'bg-green-100 text-green-700 border-transparent';
    case 'ANALYZING':
      return 'bg-blue-100 text-blue-700 border-transparent';
    case 'ANALYZE_FAILED':
      return 'bg-red-100 text-red-700 border-transparent';
    default:
      return 'bg-gray-100 text-gray-600 border-transparent';
  }
}

// ──────────────────────────────────────────────────────────────
// 依据文字单元格（truncate + title 全文，reasonPending 标黄）
// ──────────────────────────────────────────────────────────────

export function ReasonCell({ row }: { row: AdKeywordRow }) {
  const text = row.actionReason || '';
  return (
    <span
      title={text || '无依据文字'}
      className={`block max-w-[320px] truncate text-left text-xs ${
        row.reasonPending ? 'text-yellow-700 font-medium' : 'text-muted-foreground'
      }`}
    >
      {text || '待补充'}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────
// 原始报告行下钻 Dialog（AC-10/R1；Dialog 必带 key prop，UI 铁律 6）
// ──────────────────────────────────────────────────────────────

/** 归一化列名中文标注（BE §6.2 parse 输出契约列名） */
const RAW_ROW_LABELS: Record<string, string> = {
  targeting: '投放',
  customerSearchTerm: '客户搜索词',
  matchType: '匹配类型',
  clicks: '点击',
  impressions: '展示',
  spend: '花费',
  cpc: 'CPC',
  attributedSales7d: '7天总销售额',
  attributedUnitsOrdered7d: '7天总订单数',
  bid: '目标竞价',
  state: '投放状态',
  campaignId: 'Campaign ID',
  adGroupId: 'Ad Group ID',
  externalId: '关键词/商品定向 ID',
  campaignName: '广告活动',
  adGroupName: '广告组',
};

function renderRawValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return DASH;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export interface RawRowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 决策行（依据文字 + 族 + 建议动作） */
  row: AdKeywordRow | null;
  /** 原始行所属报告 id（CLOSE_MATRIX/LAYER_CHECK→Targeting；NEGATE→搜索词） */
  reportId: string | null;
  onCopied?: (msg: string) => void;
}

export function RawRowDialog({ open, onOpenChange, row, reportId, onCopied }: RawRowDialogProps) {
  const rowIndex = row?.rawRowIndex ?? null;
  const { data, isLoading, isError, error } = useRawReportRow(open ? reportId : null, open ? rowIndex : null);

  const entries = data ? Object.entries(data) : [];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(row?.actionReason || '');
      onCopied?.('依据文字已复制');
    } catch {
      onCopied?.('复制失败，请手动选择文本');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>决策依据与原始报告行</DialogTitle>
          <DialogDescription>
            自证链：依据文字 → 决策行 → 原始报告行（rowIndex {rowIndex ?? DASH}），数字与列表同源，不做二次计算。
          </DialogDescription>
        </DialogHeader>

        {row && (
          <div className="space-y-4">
            {/* 1) 依据文字全文 */}
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground mb-1">依据文字（引擎输出，原文）</div>
              <p className={`text-sm leading-relaxed ${row.reasonPending ? 'text-yellow-700' : 'text-foreground'}`}>
                {row.actionReason || '待补充'}
              </p>
            </div>

            {/* 2) 所属族 + 建议动作 */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">投放词</div>
                <div className="font-medium break-all">{row.keywordText}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">所属 L1 族</div>
                <div className="font-medium">{row.familyL1 || DASH}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">建议动作</div>
                <Badge className={actionBadgeClass(row.overrideAction || row.action)}>
                  {actionLabel(row.overrideAction || row.action)}
                </Badge>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">建议竞价</div>
                <div className="font-medium">{fmtBid(row.overrideBid ?? row.actionBid)}</div>
              </div>
            </div>

            {/* 3) 原始报告行 */}
            <div>
              <div className="text-xs text-muted-foreground mb-2">原始报告行（归一化列名）</div>
              {rowIndex === null && (
                <p className="text-sm text-muted-foreground">无原始报告行（受限模式 / search-only）。</p>
              )}
              {rowIndex !== null && isLoading && (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-4/5" />
                  <Skeleton className="h-5 w-3/5" />
                </div>
              )}
              {rowIndex !== null && isError && (
                <p className="text-sm text-destructive">
                  原始行读取失败：{(error as Error)?.message || '接口未就绪'}（可稍后重试）
                </p>
              )}
              {rowIndex !== null && !isLoading && !isError && entries.length === 0 && (
                <p className="text-sm text-muted-foreground">未返回原始行数据。</p>
              )}
              {entries.length > 0 && (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="table-auto w-full text-sm">
                    <tbody>
                      {entries.map(([k, v]) => (
                        <tr key={k} className="border-b border-border last:border-0">
                          <th className="whitespace-nowrap bg-muted/40 px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">
                            {RAW_ROW_LABELS[k] || k}
                          </th>
                          <td className="px-3 py-1.5 break-all">{renderRawValue(v)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCopy}>
            复制依据
          </Button>
          <Button onClick={() => onOpenChange(false)}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
