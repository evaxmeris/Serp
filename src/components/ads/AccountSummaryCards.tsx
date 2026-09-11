'use client';

/**
 * 账户总览卡（REQ-003-1）
 *
 * 数据：useAdsReportResult → data.account（引擎快照，数字零加工 R4）。
 * 6 指标卡：花费 / 销售 / 订单 / ACoS / CVR / 客单价。
 * ACoS 超标（> 账户 settings.breakEvenAcos，缺省 40）标红：数值 + 卡边框 + 小字。
 * degraded 模式：账户指标来自搜索词报告口径（无 bid 维度），卡下补充说明。
 */

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdsAccounts, useAdsReportResult } from '@/hooks/use-ads';
import { fmtInt, fmtMoney, fmtPct } from './shared';

export interface AccountSummaryCardsProps {
  /** 当前展示的决策版本（分析结果 recommendation.id） */
  recommendationId: string;
  /** 选中账户（取 settings.breakEvenAcos 做 ACoS 超标判断） */
  accountId: string;
}

export function AccountSummaryCards({ recommendationId, accountId }: AccountSummaryCardsProps) {
  const { data, isLoading, isError, error, refetch } = useAdsReportResult(recommendationId);
  const accounts = useAdsAccounts({ active: true });

  // 盈亏平衡 ACoS：账户设置优先，缺省 40（D6：留空=引擎动态计算，前端展示用缺省值兜底）
  const breakEvenAcos =
    accounts.data?.items?.find((a) => a.id === accountId)?.settings?.breakEvenAcos ?? 40;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="animate-in fade-in-0">
        <CardContent className="py-8 text-center text-sm">
          <p className="text-destructive mb-2">账户总览加载失败：{(error as Error)?.message || '接口未就绪'}</p>
          <button onClick={() => refetch()} className="text-primary underline">
            重试
          </button>
        </CardContent>
      </Card>
    );
  }

  const account = data?.account;
  if (!account) return null;

  const acos = account.acos ?? null;
  const overBreakEven = acos !== null && acos > Number(breakEvenAcos ?? 40);

  const cards: Array<{ label: string; value: string; danger?: boolean; dangerText?: string }> = [
    { label: '花费', value: fmtMoney(account.spend) },
    { label: '销售', value: fmtMoney(account.sales) },
    { label: '订单', value: fmtInt(account.orders) },
    {
      label: 'ACoS',
      value: fmtPct(account.acos),
      danger: overBreakEven,
      dangerText: `超盈亏平衡点（${Number(breakEvenAcos ?? 40).toFixed(0)}%）`,
    },
    { label: 'CVR', value: fmtPct(account.cvr) },
    { label: '客单价', value: fmtMoney(account.aov) },
  ];

  return (
    <div className="space-y-2 animate-in fade-in-0">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <Card
            key={c.label}
            className={c.danger ? 'border-destructive/50' : undefined}
          >
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{c.label}</div>
              <div className={`mt-1 text-xl font-semibold ${c.danger ? 'text-destructive' : 'text-foreground'}`}>
                {c.value}
              </div>
              {c.danger && <div className="mt-0.5 text-xs text-destructive">{c.dangerText}</div>}
            </CardContent>
          </Card>
        ))}
      </div>
      {data?.degraded && (
        <p className="text-xs text-muted-foreground">
          数据来源：搜索词报告（未上传 Targeting 报告，口径受限，无 bid 维度）。
        </p>
      )}
    </div>
  );
}
