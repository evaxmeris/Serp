'use client';

/**
 * 层级核对（REQ-003-6）
 *
 * 三段布局：
 *  a) 竞价层级倒挂警告（AdKeyword source=LAYER_CHECK，可勾选=执行改价修正）；
 *      bid 为 null ⇒ 该行进「需后台核对」清单（禁止用 CPC 渲染层级，铁律 2）。
 *  b) 探索层系数体检表（引擎 layerCheck.coefficientAudit）：
 *      ratio > 规范系数 + 0.05 ⇒ 行标红「偏高，需逐轮收敛」；
 *      exactBid null/0 ⇒ 显示「—」不计算 ratio（避免除零）。
 *  c) 调价后层级复核：laddersAfterFix 0 ⇒ 绿「复核通过」；>0 ⇒ 红 + E7 兜底提示。
 *  degraded / bidUnavailable（E3）：整段不可用态 + 待核对清单，不渲染任何 bid 结论。
 *  顶部小字展示本次跑批动态阈值（AC-4 自证链：recommendation.params）。
 */

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonTable } from '@/components/ui/skeleton-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { useAdsKeywords, useAdsReportResult, useUpdateKeyword } from '@/hooks/use-ads';
import type { AdKeywordRow } from '@/types/ads';
import {
  fmtBid,
  fmtNum,
  matchTypeBadgeClass,
  RawRowDialog,
  ReasonCell,
  useAdsPerms,
} from './shared';

export interface LayerCheckPanelProps {
  recommendationId: string;
  /** degraded：未上传 Targeting 报告，bid 层级核对不可用（E3） */
  degraded?: boolean;
}

/** 待核对清单行展示（引擎 bidPendingList 为宽松对象数组，取常用键兜底） */
function pendingLabel(item: Record<string, unknown>): string {
  const k = item.keywordText ?? item.targeting ?? item.word ?? item.term;
  if (typeof k === 'string' && k) return k;
  return JSON.stringify(item);
}

export function LayerCheckPanel({ recommendationId, degraded = false }: LayerCheckPanelProps) {
  const { toast, toasts, removeToast } = useToast();
  const { canEdit } = useAdsPerms();
  const updateKeyword = useUpdateKeyword();

  const [drill, setDrill] = useState<{ row: AdKeywordRow; reportId: string | null } | null>(null);

  const { data: result, isLoading: resultLoading } = useAdsReportResult(recommendationId);
  const { data, isLoading, isError, error, refetch } = useAdsKeywords({
    recommendationId,
    source: 'LAYER_CHECK',
    page: 1,
    limit: 100,
  });

  const layerCheck = result?.layerCheck;
  const summary = result?.summary;
  const params = result?.recommendation?.params;

  const bidUnavailable = degraded || layerCheck?.bidUnavailable === true;
  const ladderRows = data?.items ?? [];
  const audit = layerCheck?.coefficientAudit ?? [];
  const pendingList = layerCheck?.bidPendingList ?? summary?.bidPendingList ?? [];
  // 调价后复核：引擎校验值（理论上恒 0，出现 >0 即 E7 兜底提示）
  const laddersAfterFix = layerCheck?.laddersAfterFix ?? summary?.laddersAfterFix;

  const overriddenRows = ladderRows.filter((r) => !!r.isManualOverride).length;

  function toggle(row: AdKeywordRow) {
    updateKeyword.mutate(
      { id: row.id, data: { isSelected: !row.isSelected } },
      { onError: (e) => toast.error(e.message || '勾选保存失败') }
    );
  }

  function openDrill(row: AdKeywordRow) {
    // LAYER_CHECK 行 → Targeting 报告原始行
    const reportId = result?.reports?.targeting?.id ?? row.reportId;
    setDrill({ row, reportId });
  }

  return (
    <div className="space-y-4 animate-in fade-in-0">
      {/* 本次跑批参数（AC-4 自证链） */}
      {params && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          本次跑批参数：盈亏平衡 ACoS {params.breakEvenAcos != null ? `${params.breakEvenAcos}%` : '引擎动态'}、
          否定阈值点击 {params.negateClicks != null ? `${params.negateClicks}` : '引擎动态'}、
          成本容忍花费 {params.stopSpend != null ? `${params.stopSpend}` : '引擎动态'}
          {result?.recommendation?.version_engine ? ` · 引擎版本 ${result.recommendation.version_engine}` : ''}
        </div>
      )}

      {/* a) 竞价层级倒挂警告（bid 层级核对，degraded 下不可用） */}
      {bidUnavailable ? (
        <Card className="animate-in fade-in-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">竞价层级核对</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert variant="destructive" className="border-yellow-400/60 text-yellow-800 [&>svg]:text-yellow-600">
              <AlertTriangle className="size-4" />
              <AlertTitle>未上传 Targeting 报告，无法进行 bid 层级核对（E3）</AlertTitle>
              <AlertDescription>
                以下词需从后台人工核对 bid 状态；请从后台导出 Targeting 报告上传后重新分析。
              </AlertDescription>
            </Alert>
            {pendingList.length > 0 && (
              <div className="rounded-md border border-border">
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">
                  bid 待核对清单（{pendingList.length}）
                </div>
                <ul className="max-h-56 overflow-y-auto divide-y divide-border">
                  {pendingList.map((item, i) => (
                    <li key={i} className="px-3 py-1.5 text-sm">
                      <span className="truncate" title={pendingLabel(item)}>
                        {pendingLabel(item)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {pendingList.length === 0 && (
              <p className="text-sm text-muted-foreground">引擎未返回待核对清单。</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="animate-in fade-in-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              竞价层级倒挂警告
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                勾选 = 按建议 bid 执行改价（计入执行摘要「改价」）
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4">
                <SkeletonTable rows={4} cols={7} />
              </div>
            ) : isError ? (
              <div className="py-10 text-center text-sm">
                <p className="text-destructive mb-2">倒挂警告加载失败：{(error as Error)?.message || '接口未就绪'}</p>
                <button onClick={() => refetch()} className="text-primary underline">
                  重试
                </button>
              </div>
            ) : ladderRows.length === 0 ? (
              <EmptyState title="无倒挂警告" description="当前无竞价层级倒挂（EXACT≤PHRASE 或 PHRASE≤BROAD）。" />
            ) : (
              <div className="overflow-x-auto">
                <Table className="table-auto w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead className="whitespace-nowrap">族</TableHead>
                      <TableHead className="whitespace-nowrap">词</TableHead>
                      <TableHead className="whitespace-nowrap">层级</TableHead>
                      <TableHead className="whitespace-nowrap text-right">当前 bid</TableHead>
                      <TableHead className="whitespace-nowrap text-right">建议 bid</TableHead>
                      <TableHead className="whitespace-nowrap">依据文字</TableHead>
                      <TableHead className="whitespace-nowrap">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ladderRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Checkbox
                            checked={row.isSelected}
                            disabled={!canEdit || updateKeyword.isPending}
                            onCheckedChange={() => toggle(row)}
                            aria-label="勾选改价"
                          />
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate" title={row.familyL1 ?? ''}>
                          {row.familyL1 ?? '—'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate font-medium" title={row.keywordText}>
                          {row.keywordText}
                        </TableCell>
                        <TableCell>
                          <Badge className={matchTypeBadgeClass(row.matchType)}>{row.matchType || '—'}</Badge>
                        </TableCell>
                        {/* 当前 bid：null ⇒ 需后台核对（铁律 2：禁止用 CPC 冒充） */}
                        <TableCell className="text-right whitespace-nowrap">
                          {row.bid != null ? (
                            fmtBid(row.bid)
                          ) : (
                            <span>
                              <span className="text-muted-foreground">—</span>{' '}
                              <Badge className="bg-yellow-100 text-yellow-700 border-transparent">需后台核对</Badge>
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {row.actionBid != null ? fmtBid(row.actionBid) : '—'}
                        </TableCell>
                        <TableCell>
                          <ReasonCell row={row} />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            aria-label="下钻"
                            title={row.rawRowIndex != null ? '查看依据与原始报告行' : '无原始报告行'}
                            disabled={row.rawRowIndex == null}
                            onClick={() => openDrill(row)}
                          >
                            <ExternalLink className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* b) 探索层系数体检表（degraded 下无 bid 数据，隐藏） */}
      {!bidUnavailable && (
        <Card className="animate-in fade-in-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              探索层系数体检
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                实际系数高于规范系数 +0.05 的行标红，需逐轮收敛
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {resultLoading ? (
              <div className="p-4">
                <Skeleton className="h-24 w-full" />
              </div>
            ) : audit.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">暂无系数体检数据。</p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="table-auto w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">族</TableHead>
                      <TableHead className="whitespace-nowrap">层级</TableHead>
                      <TableHead className="whitespace-nowrap text-right">实际 bid</TableHead>
                      <TableHead className="whitespace-nowrap text-right">EXACT bid</TableHead>
                      <TableHead className="whitespace-nowrap text-right">实际系数</TableHead>
                      <TableHead className="whitespace-nowrap text-right">规范系数</TableHead>
                      <TableHead className="whitespace-nowrap">对比</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit.map((r, i) => {
                      const noExact = r.exactBid == null || r.exactBid === 0;
                      const ratio = r.ratio ?? null;
                      const standard = r.standard ?? null;
                      const high = ratio !== null && standard !== null && ratio > standard + 0.05;
                      return (
                        <TableRow key={i} className={high ? 'bg-red-50/60' : undefined}>
                          <TableCell className="max-w-[160px] truncate" title={r.family ?? ''}>
                            {r.family ?? '—'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge className={matchTypeBadgeClass(r.match)}>{r.match || '—'}</Badge>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">{fmtBid(r.bid)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {noExact ? '—' : fmtBid(r.exactBid)}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {noExact ? '—' : ratio != null ? fmtNum(ratio) : '—'}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {standard != null ? fmtNum(standard) : '—'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {high ? (
                              <span className="text-xs font-medium text-destructive">偏高，需逐轮收敛</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">正常</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* c) 调价后层级复核 */}
      <Card className="animate-in fade-in-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">调价后层级复核</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {laddersAfterFix == null ? (
            <p className="text-sm text-muted-foreground">引擎未返回复核值。</p>
          ) : laddersAfterFix === 0 ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-green-600" />
              <Badge className="bg-green-100 text-green-700 border-transparent">复核通过（倒挂 0）</Badge>
              <span className="text-xs text-muted-foreground">
                已勾选改价 {overriddenRows > 0 ? `${overriddenRows} 行手工修改` : '0 行'}，执行后需重新分析验证。
              </span>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>复核未通过：仍存在 {laddersAfterFix} 处倒挂（E7 兜底）</AlertTitle>
              <AlertDescription>
                引擎自检本应保证倒挂为 0，出现此情况请联系管理员核对引擎版本与数据契约。
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}
