'use client';

/**
 * 族级总览（REQ-003-2）
 *
 * 数据：useAdsReportResult → data.families（引擎快照透传；verdict 直接渲染
 *       引擎值，空串 ⇒ 「待补充」黄色徽章，禁止前端推导——I-8/R4）。
 * Tabs 分组：全部 / 出单族（orders>0）/ 风险族（verdict 含「风险」）/
 *            待关闭（verdict 含「关闭」），数量徽章。
 * 行展开：members[] 子表（投放词/匹配/点击/花费/ACoS/动作）。
 */

import { Fragment, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdsReportResult } from '@/hooks/use-ads';
import type { AdFamilyRow } from '@/types/ads';
import {
  actionBadgeClass,
  actionLabel,
  fmtInt,
  fmtMoney,
  fmtPct,
  matchTypeBadgeClass,
  verdictBadgeClass,
  verdictLabel,
} from './shared';

export interface FamilyOverviewTableProps {
  recommendationId: string;
}

type FamilyTab = 'all' | 'ordered' | 'risk' | 'close';

/** Tabs 分组谓词（前端仅按引擎字段过滤展示，不影响数字） */
function matchTab(f: AdFamilyRow, tab: FamilyTab): boolean {
  switch (tab) {
    case 'all':
      return true;
    case 'ordered':
      return (f.orders ?? 0) > 0;
    case 'risk':
      return /风险/.test(f.verdict || '');
    case 'close':
      return /关闭/.test(f.verdict || '');
  }
}

export function FamilyOverviewTable({ recommendationId }: FamilyOverviewTableProps) {
  const { data, isLoading } = useAdsReportResult(recommendationId);
  const [tab, setTab] = useState<FamilyTab>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const families = data?.families ?? [];
  const counts: Record<FamilyTab, number> = {
    all: families.length,
    ordered: families.filter((f) => matchTab(f, 'ordered')).length,
    risk: families.filter((f) => matchTab(f, 'risk')).length,
    close: families.filter((f) => matchTab(f, 'close')).length,
  };
  const visible = families.filter((f) => matchTab(f, tab));

  const toggleExpand = (family: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(family)) next.delete(family);
      else next.add(family);
      return next;
    });
  };

  return (
    <Card className="animate-in fade-in-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <CardTitle className="text-base">族级总览</CardTitle>
        <Tabs value={tab} onValueChange={(v) => setTab(v as FamilyTab)}>
          <TabsList>
            <TabsTrigger value="all">
              全部 <Badge variant="secondary" className="ml-1">{counts.all}</Badge>
            </TabsTrigger>
            <TabsTrigger value="ordered">
              出单族 <Badge variant="secondary" className="ml-1">{counts.ordered}</Badge>
            </TabsTrigger>
            <TabsTrigger value="risk">
              风险族 <Badge variant="secondary" className="ml-1">{counts.risk}</Badge>
            </TabsTrigger>
            <TabsTrigger value="close">
              待关闭 <Badge variant="secondary" className="ml-1">{counts.close}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4">
            <div className="h-4 w-1/3 bg-muted animate-pulse rounded mb-3" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">该分组下暂无族。</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-auto w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead className="whitespace-nowrap">族名</TableHead>
                  <TableHead className="whitespace-nowrap text-right">花费</TableHead>
                  <TableHead className="whitespace-nowrap text-right">订单</TableHead>
                  <TableHead className="whitespace-nowrap text-right">ACoS</TableHead>
                  <TableHead className="whitespace-nowrap">处置结论</TableHead>
                  <TableHead className="whitespace-nowrap text-right">成员数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((f) => {
                  const isOpen = expanded.has(f.family);
                  const members = f.members ?? [];
                  return (
                    <Fragment key={f.family}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => toggleExpand(f.family)}
                      >
                        <TableCell>
                          <ChevronRight
                            className={`size-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`}
                          />
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate font-medium" title={f.family}>
                          {f.family}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmtMoney(f.spend)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmtInt(f.orders)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmtPct(f.acos)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge className={verdictBadgeClass(f.verdict)}>{verdictLabel(f.verdict)}</Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Badge variant="outline">{members.length}</Badge>
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow key={`${f.family}-members`}>
                          <TableCell colSpan={7} className="bg-muted/20 p-0">
                            <div className="p-3">
                              {members.length === 0 ? (
                                <p className="text-xs text-muted-foreground">无成员明细。</p>
                              ) : (
                                <div className="overflow-x-auto rounded-md border border-border">
                                  <table className="table-auto w-full text-sm">
                                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                                      <tr>
                                        <th className="px-3 py-1.5 text-left font-medium">投放词 / 关键词</th>
                                        <th className="px-3 py-1.5 text-left font-medium">匹配类型</th>
                                        <th className="px-3 py-1.5 text-right font-medium">点击</th>
                                        <th className="px-3 py-1.5 text-right font-medium">花费</th>
                                        <th className="px-3 py-1.5 text-right font-medium">ACoS</th>
                                        <th className="px-3 py-1.5 text-left font-medium">动作</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {members.map((m, i) => (
                                        <tr key={i} className="border-b border-border last:border-0">
                                          <td className="px-3 py-1.5 max-w-[240px] truncate" title={m.keywordText ?? m.targeting ?? ''}>
                                            {m.keywordText ?? m.targeting ?? '—'}
                                          </td>
                                          <td className="px-3 py-1.5">
                                            {m.matchType ? (
                                              <Badge className={matchTypeBadgeClass(m.matchType)}>{m.matchType}</Badge>
                                            ) : (
                                              '—'
                                            )}
                                          </td>
                                          <td className="px-3 py-1.5 text-right whitespace-nowrap">{fmtInt(m.clicks)}</td>
                                          <td className="px-3 py-1.5 text-right whitespace-nowrap">{fmtMoney(m.spend)}</td>
                                          <td className="px-3 py-1.5 text-right whitespace-nowrap">{fmtPct(m.acos)}</td>
                                          <td className="px-3 py-1.5">
                                            {m.action ? (
                                              <Badge className={actionBadgeClass(m.action)}>{actionLabel(m.action)}</Badge>
                                            ) : (
                                              '—'
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
