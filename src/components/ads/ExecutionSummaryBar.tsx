'use client';

/**
 * 执行摘要（REQ-003-7/004-4）+ 生成批量表按钮（REQ-005）
 *
 * 数据：
 *  - 摘要数字：useAdsReportResult → data.summary（引擎快照：closeCount /
 *    closeSpendPct / projectedAcos / needsBidAdjust / needsListingFix）；
 *  - 已勾选分类计数：4 次 useAdsSelectedCount(source)（limit=1 只读 total，
 *    与批量表行数同源一致，FE 设计 §4.9/O-2）。
 * 布局：sticky 底部条（移动端 flex-col 堆叠）；内嵌 BulkTableButton。
 * degraded 下 summary.needsBidAdjust 恒 false（引擎保证），不显示调价徽章。
 */

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdsReportResult, useAdsSelectedCount } from '@/hooks/use-ads';
import { fmtInt, fmtNum } from './shared';
import { BulkTableButton } from './BulkTableButton';

export interface ExecutionSummaryBarProps {
  recommendationId: string;
  /** degraded：不显示「仍需叠加调价」徽章（引擎已保证恒 false） */
  degraded?: boolean;
}

export function ExecutionSummaryBar({ recommendationId, degraded = false }: ExecutionSummaryBarProps) {
  const { data, isLoading } = useAdsReportResult(recommendationId);
  const summary = data?.summary;

  // 已勾选分类计数（服务端统计，与批量表行数一致）
  const countClose = useAdsSelectedCount(recommendationId, 'CLOSE_MATRIX');
  const countBid = useAdsSelectedCount(recommendationId, 'LAYER_CHECK');
  const countNegate = useAdsSelectedCount(recommendationId, 'NEGATE');
  const countCreate = useAdsSelectedCount(recommendationId, 'EXPAND');

  const counts: Array<{ label: string; value: number | undefined; loading: boolean }> = [
    { label: '关闭', value: countClose.data, loading: countClose.isLoading },
    { label: '改价', value: countBid.data, loading: countBid.isLoading },
    { label: '否定', value: countNegate.data, loading: countNegate.isLoading },
    { label: '新建', value: countCreate.data, loading: countCreate.isLoading },
  ];

  return (
    <Card className="sticky bottom-4 z-10 border-border/60 bg-background/95 backdrop-blur animate-in fade-in-0">
      <CardContent className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        {isLoading || !summary ? (
          <>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-32" />
          </>
        ) : (
          <>
            <div className="text-sm">
              <span className="text-muted-foreground">关闭 </span>
              <span className="font-semibold">{fmtInt(summary.closeCount)}</span>
              <span className="text-muted-foreground"> 个组合</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">关闭 </span>
              <span className="font-semibold">{fmtNum(summary.closeSpendPct, 1)}%</span>
              <span className="text-muted-foreground"> 花费</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">关闭后 ACoS 预演 </span>
              <span className="font-semibold">{fmtNum(summary.projectedAcos, 1)}%</span>
            </div>
            {!degraded && summary.needsBidAdjust && (
              <Badge className="bg-yellow-100 text-yellow-700 border-transparent">仍需叠加调价</Badge>
            )}
            {summary.needsListingFix && (
              <Badge className="bg-yellow-100 text-yellow-700 border-transparent">需先修 listing</Badge>
            )}
          </>
        )}

        <Separator orientation="vertical" className="hidden h-6 sm:block" />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-muted-foreground">已勾选：</span>
          {counts.map((c) => (
            <span key={c.label} className={c.value && c.value > 0 ? 'text-primary font-medium' : 'text-muted-foreground'}>
              {c.label} {c.loading ? <Skeleton className="inline-block h-3 w-6 align-middle" /> : (c.value ?? 0)}
            </span>
          ))}
        </div>

        <div className="ml-auto">
          <BulkTableButton recommendationId={recommendationId} />
        </div>
      </CardContent>
    </Card>
  );
}
