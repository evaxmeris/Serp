'use client';

/**
 * 否定清单（REQ-003-4/004）
 *
 * 数据：useAdsKeywords({ recommendationId, source: 'NEGATE' })（AdKeyword 决策行）。
 * 列：勾选 | 搜索词 | 原因 Badge（合规风险=红/双标准=黄/不相关=灰，按文案着色不改文案）
 *     | 依据文字 | 建议动作（NEGATE）| 下钻。
 * 下钻目标 = 搜索词报告 rawRows（O-1 reports.search 引用）。
 * 合规风险词行：红色左边框 + 账号安全提示（§4.5）；degraded 模式仍可用。
 */

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { SkeletonTable } from '@/components/ui/skeleton-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { useAdsKeywords, useAdsReportResult, useUpdateKeyword } from '@/hooks/use-ads';
import type { AdKeywordRow } from '@/types/ads';
import {
  actionBadgeClass,
  actionLabel,
  negateReasonBadgeClass,
  RawRowDialog,
  ReasonCell,
  useAdsPerms,
} from './shared';

export interface NegateListTableProps {
  recommendationId: string;
}

const PAGE_SIZE = 20;

export function NegateListTable({ recommendationId }: NegateListTableProps) {
  const { toast, toasts, removeToast } = useToast();
  const { canEdit } = useAdsPerms();
  const updateKeyword = useUpdateKeyword();

  const [page, setPage] = useState(1);
  const [drill, setDrill] = useState<{ row: AdKeywordRow; reportId: string | null } | null>(null);

  const { data, isLoading, isError, error, refetch } = useAdsKeywords({
    recommendationId,
    source: 'NEGATE',
    page,
    limit: PAGE_SIZE,
  });
  // 批内报告引用（O-1）：NEGATE 原始行位于搜索词报告
  const result = useAdsReportResult(recommendationId);

  const rows = data?.items ?? [];
  const pagination = data?.pagination;

  function toggle(row: AdKeywordRow) {
    updateKeyword.mutate(
      { id: row.id, data: { isSelected: !row.isSelected } },
      { onError: (e) => toast.error(e.message || '勾选保存失败') }
    );
  }

  function openDrill(row: AdKeywordRow) {
    const reportId = result.data?.reports?.search?.id ?? row.reportId;
    setDrill({ row, reportId });
  }

  return (
    <Card className="animate-in fade-in-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          否定清单
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            勾选即持久化；否定行下钻目标为搜索词报告原始行
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={5} cols={6} />
          </div>
        ) : isError ? (
          <div className="py-10 text-center text-sm">
            <p className="text-destructive mb-2">否定清单加载失败：{(error as Error)?.message || '接口未就绪'}</p>
            <button onClick={() => refetch()} className="text-primary underline">
              重试
            </button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="无匹配数据" description="当前筛选条件下暂无否定建议。" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table className="table-auto w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead className="whitespace-nowrap">搜索词</TableHead>
                    <TableHead className="whitespace-nowrap">否定原因</TableHead>
                    <TableHead className="whitespace-nowrap">依据文字</TableHead>
                    <TableHead className="whitespace-nowrap">建议动作</TableHead>
                    <TableHead className="whitespace-nowrap">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const reason = row.actionReason || '';
                    const complianceRisk = /合规|风险|安全/.test(reason);
                    return (
                      <TableRow key={row.id} className={complianceRisk ? 'border-l-2 border-l-red-400' : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={row.isSelected}
                            disabled={!canEdit || updateKeyword.isPending}
                            onCheckedChange={() => toggle(row)}
                            aria-label="勾选执行"
                          />
                        </TableCell>
                        <TableCell className="max-w-[240px] font-medium">
                          <span className="truncate" title={row.keywordText}>
                            {row.keywordText}
                          </span>
                          {complianceRisk && (
                            <p className="mt-0.5 text-xs text-red-600">
                              账号安全优先：暂停 + 活动级否定，批量表输出两行
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge className={negateReasonBadgeClass(reason)}>{reason || '—'}</Badge>
                        </TableCell>
                        <TableCell>
                          <ReasonCell row={row} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge className={actionBadgeClass(row.action)}>{actionLabel(row.action)}</Badge>
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
                    );
                  })}
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
