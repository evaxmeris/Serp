'use client';

/**
 * 关闭矩阵（REQ-003-3/004，全站最重组件）
 *
 * 数据：useAdsKeywords({ recommendationId, source: 'CLOSE_MATRIX' })（AdKeyword
 *       决策行，唯一勾选数据源，架构 P0-7）。
 * 交互：
 *  - 勾选即持久化（REQ-004-1）：onChange → useUpdateKeyword 乐观更新，无本地暂存；
 *  - 覆写（REQ-004-2，需 ads:edit）：行内编辑态（动作 Select + bid + 依据）→
 *    PUT { action, actionBid, actionReason }，保存后行标「手工修改」；
 *  - 下钻（AC-10/R1）：RawRowDialog（带 key prop），按 rawRowIndex 读原始报告行。
 * 铁律：bid 为 null 展示「—」+「需后台核对」（禁止用 CPC 冒充）；数字零加工。
 */

import { useState } from 'react';
import { ExternalLink, Pencil, Save, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SkeletonTable } from '@/components/ui/skeleton-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { useAdsKeywords, useAdsReportResult, useUpdateKeyword } from '@/hooks/use-ads';
import type { AdKeywordRow } from '@/types/ads';
import {
  actionBadgeClass,
  actionLabel,
  fmtBid,
  fmtInt,
  fmtMoney,
  fmtNum,
  fmtPct,
  matchTypeBadgeClass,
  NONE_VALUE,
  RawRowDialog,
  ReasonCell,
  stateBadgeClass,
  useAdsPerms,
} from './shared';

export interface CloseMatrixTableProps {
  recommendationId: string;
  /** degraded 受限模式：无关闭矩阵（未上传 Targeting 报告） */
  degraded?: boolean;
}

const PAGE_SIZE = 20;

/** 覆写动作可选集（REQ-004-2：关闭/加价/降价/维持/否定） */
const OVERRIDE_ACTIONS = ['PAUSE', 'RAISE_BID', 'LOWER_BID', 'KEEP', 'NEGATE'] as const;

interface OverrideDraft {
  action: string;
  actionBid: string;
  actionReason: string;
}

export function CloseMatrixTable({ recommendationId, degraded = false }: CloseMatrixTableProps) {
  const { toast, toasts, removeToast } = useToast();
  const { canEdit } = useAdsPerms();
  const updateKeyword = useUpdateKeyword();

  const [page, setPage] = useState(1);
  // 行内覆写编辑态（同一时刻仅一行）
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<OverrideDraft>({ action: NONE_VALUE, actionBid: '', actionReason: '' });
  // 下钻弹窗：{ row, reportId }（reportId 由组件在点击时解析）
  const [drill, setDrill] = useState<{ row: AdKeywordRow; reportId: string | null } | null>(null);

  const { data, isLoading, isError, error, refetch } = useAdsKeywords({
    recommendationId,
    source: 'CLOSE_MATRIX',
    page,
    limit: PAGE_SIZE,
  });
  // 批内报告引用（O-1）：CLOSE_MATRIX 原始行位于 Targeting 报告
  const result = useAdsReportResult(recommendationId);

  const rows = data?.items ?? [];
  const pagination = data?.pagination;

  /** 勾选（乐观更新，勾选即持久化） */
  function toggle(row: AdKeywordRow) {
    updateKeyword.mutate(
      { id: row.id, data: { isSelected: !row.isSelected } },
      {
        onError: (e) => toast.error(e.message || '勾选保存失败'),
      }
    );
  }

  function startEdit(row: AdKeywordRow) {
    setEditingId(row.id);
    setDraft({
      action: row.overrideAction ?? row.action ?? NONE_VALUE,
      actionBid: String(row.overrideBid ?? row.actionBid ?? ''),
      actionReason: row.actionReason ?? '',
    });
  }

  /** 保存覆写：传 action/actionBid/actionReason ⇒ 服务端置 override* */
  async function saveOverride(row: AdKeywordRow) {
    if (draft.action === NONE_VALUE) return toast.warning('请选择建议动作');
    const bidNum = draft.actionBid === '' ? null : Number(draft.actionBid);
    if (bidNum !== null && (Number.isNaN(bidNum) || bidNum < 0.2)) {
      return toast.warning('建议竞价需 ≥ 0.2');
    }
    try {
      await updateKeyword.mutateAsync({
        id: row.id,
        data: {
          action: draft.action,
          actionBid: bidNum,
          actionReason: draft.actionReason.trim() || undefined,
        },
      });
      toast.success('已保存手工修改');
      setEditingId(null);
    } catch (e) {
      toast.error((e as Error)?.message || '覆写保存失败');
    }
  }

  function openDrill(row: AdKeywordRow) {
    // CLOSE_MATRIX 行 → Targeting 报告原始行；后端未返回引用时退化为行内 reportId
    const reportId = result.data?.reports?.targeting?.id ?? row.reportId;
    setDrill({ row, reportId });
  }

  if (degraded) {
    return (
      <Card className="animate-in fade-in-0">
        <CardContent>
          <EmptyState
            title="受限模式无关闭矩阵"
            description="未上传 Targeting 报告，无法进行关闭矩阵与状态核对。请从后台导出 Targeting 报告上传后重新分析。"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-in fade-in-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          关闭矩阵
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            勾选即持久化；点击「下钻」查看依据文字与原始报告行
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={5} cols={8} />
          </div>
        ) : isError ? (
          <div className="py-10 text-center text-sm">
            <p className="text-destructive mb-2">关闭矩阵加载失败：{(error as Error)?.message || '接口未就绪'}</p>
            <button onClick={() => refetch()} className="text-primary underline">
              重试
            </button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="无匹配数据" description="当前筛选条件下暂无关闭矩阵建议行。" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table className="table-auto w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead className="whitespace-nowrap">投放词</TableHead>
                    <TableHead className="whitespace-nowrap">匹配类型</TableHead>
                    <TableHead className="whitespace-nowrap text-right">点击</TableHead>
                    <TableHead className="whitespace-nowrap text-right">花费</TableHead>
                    <TableHead className="whitespace-nowrap text-right">CTR</TableHead>
                    <TableHead className="whitespace-nowrap text-right">CPA</TableHead>
                    <TableHead className="whitespace-nowrap text-right">当前 bid</TableHead>
                    <TableHead className="whitespace-nowrap">状态</TableHead>
                    <TableHead className="whitespace-nowrap">依据文字</TableHead>
                    <TableHead className="whitespace-nowrap">建议动作</TableHead>
                    <TableHead className="whitespace-nowrap text-right">手工修改</TableHead>
                    <TableHead className="whitespace-nowrap">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const isEditing = editingId === row.id;
                    const saving = updateKeyword.isPending;
                    const overridden = !!row.isManualOverride;
                    const actionShown = row.overrideAction ?? row.action;
                    const bidShown = row.overrideBid ?? row.actionBid;
                    // 覆写值与引擎建议不同 → bid 橙色提示
                    const bidOverridden = overridden && row.overrideBid !== row.actionBid;
                    return (
                      <TableRow key={row.id}>
                        {/* 勾选 */}
                        <TableCell>
                          <Checkbox
                            checked={row.isSelected}
                            disabled={!canEdit || saving}
                            onCheckedChange={() => toggle(row)}
                            aria-label="勾选执行"
                          />
                        </TableCell>
                        {/* 投放词 + L2 重复提示 */}
                        <TableCell className="max-w-[200px]">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium" title={row.keywordText}>
                              {row.keywordText}
                            </span>
                            {row.duplicateOf && (
                              <Badge
                                variant="outline"
                                className="shrink-0 text-[10px]"
                                title={`L2重复→主词:${row.duplicateOf}`}
                              >
                                L2
                              </Badge>
                            )}
                          </div>
                          {row.familyL1 && (
                            <div className="truncate text-xs text-muted-foreground" title={row.familyL1}>
                              {row.familyL1}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={matchTypeBadgeClass(row.matchType)}>{row.matchType || '—'}</Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmtInt(row.clicks)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmtMoney(row.spend)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmtPct(row.ctr)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{row.cpa != null ? fmtNum(row.cpa) : '—'}</TableCell>
                        {/* 当前 bid：null ⇒ 「需后台核对」（口径铁律 2） */}
                        <TableCell className="text-right whitespace-nowrap">
                          {row.bid != null ? (
                            <span className={bidOverridden ? 'font-medium text-orange-600' : undefined}>
                              {fmtBid(row.bid)}
                            </span>
                          ) : (
                            <span>
                              <span className="text-muted-foreground">—</span>
                              <span className="ml-1 text-xs text-yellow-700">需后台核对</span>
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={stateBadgeClass(row.state)}>{row.state || '—'}</Badge>
                        </TableCell>
                        {/* 依据文字（下钻入口） */}
                        <TableCell>
                          <ReasonCell row={row} />
                        </TableCell>
                        {/* 建议动作 + 建议 bid */}
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Badge className={actionBadgeClass(actionShown)}>{actionLabel(actionShown)}</Badge>
                            {bidShown != null && (
                              <span className="text-xs text-muted-foreground">{fmtBid(bidShown)}</span>
                            )}
                          </div>
                        </TableCell>
                        {/* 手工修改 */}
                        <TableCell className="text-right whitespace-nowrap">
                          {overridden && (
                            <Badge className="bg-orange-100 text-orange-700 border-transparent">手工修改</Badge>
                          )}
                        </TableCell>
                        {/* 操作：覆写 / 下钻 */}
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {isEditing ? (
                              <>
                                <Button size="icon" variant="ghost" className="size-7" aria-label="保存覆写" onClick={() => saveOverride(row)}>
                                  <Save className="size-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="size-7" aria-label="取消覆写" onClick={() => setEditingId(null)}>
                                  <X className="size-3.5" />
                                </Button>
                              </>
                            ) : (
                              <>
                                {canEdit && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-7"
                                    aria-label="覆写"
                                    title="覆写建议动作 / 竞价"
                                    onClick={() => startEdit(row)}
                                  >
                                    <Pencil className="size-3.5" />
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7"
                                  aria-label="下钻"
                                  title={row.rawRowIndex != null ? '查看依据与原始报告行' : '无原始报告行（search-only 模式）'}
                                  disabled={row.rawRowIndex == null}
                                  onClick={() => openDrill(row)}
                                >
                                  <ExternalLink className="size-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {/* 覆写编辑行（当前编辑行下方展开表单） */}
                  {editingId && (
                    <TableRow key={`edit-${editingId}`}>
                      <TableCell colSpan={13} className="bg-muted/20 p-3">
                        <div className="grid gap-3 md:grid-cols-4">
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">建议动作</div>
                            <Select
                              value={draft.action}
                              onValueChange={(v) => setDraft((d) => ({ ...d, action: v }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="选择动作" />
                              </SelectTrigger>
                              <SelectContent>
                                {OVERRIDE_ACTIONS.map((a) => (
                                  <SelectItem key={a} value={a}>
                                    {actionLabel(a)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">建议竞价（$）</div>
                            <Input
                              type="number"
                              min={0.2}
                              step={0.05}
                              value={draft.actionBid}
                              onChange={(e) => setDraft((d) => ({ ...d, actionBid: e.target.value }))}
                              placeholder="留空=不传竞价"
                            />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <div className="text-xs text-muted-foreground">依据文字（≥1 字，可选）</div>
                            <Input
                              value={draft.actionReason}
                              onChange={(e) => setDraft((d) => ({ ...d, actionReason: e.target.value }))}
                              placeholder="手工修改的原因说明"
                            />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {pagination && (
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                onPageChange={setPage}
                pageSize={PAGE_SIZE}
              />
            )}
          </>
        )}
      </CardContent>

      {/* 下钻 Dialog（铁律：必带 key prop，保证每次打开重置内部状态） */}
      {drill && (
        <RawRowDialog
          key={drill.row.id}
          open={!!drill}
          onOpenChange={(open) => !open && setDrill(null)}
          row={drill.row}
          reportId={drill.reportId}
          onCopied={(msg) => toast.success(msg)}
        />
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </Card>
  );
}
