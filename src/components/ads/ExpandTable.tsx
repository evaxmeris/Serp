'use client';

/**
 * 拓词结论（REQ-003-5）
 *
 * 数据：useAdsReportResult → data.expandTable（引擎快照透传，只读不勾选——
 *       拓词结论是族级结论；行级「新建精准」勾选由 EXPAND 决策行承载，本组件不重复渲染）。
 * 结构：每族一行 verdict + 增量词数 + 行展开 incremental[] 明细表
 *       （增量搜索词 | 当前由谁捕获 | 点击 | 出单）。
 * 铁律：每族必有一行（引擎自检 #5），verdict 空 ⇒ 「待补充」黄色徽章，不隐藏。
 */

import { Fragment, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdsReportResult } from '@/hooks/use-ads';
import type { AdExpandRow } from '@/types/ads';
import { fmtInt, verdictBadgeClass, verdictLabel } from './shared';

export interface ExpandTableProps {
  recommendationId: string;
}

export function ExpandTable({ recommendationId }: ExpandTableProps) {
  const { data, isLoading, isError, error, refetch } = useAdsReportResult(recommendationId);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const rows: AdExpandRow[] = data?.expandTable ?? [];

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
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          拓词结论
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            族级结论只读；行级「新建精准」勾选请见执行清单 EXPAND 决策行
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : isError ? (
          <div className="py-10 text-center text-sm">
            <p className="text-destructive mb-2">拓词结论加载失败：{(error as Error)?.message || '接口未就绪'}</p>
            <button onClick={() => refetch()} className="text-primary underline">
              重试
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">暂无拓词结论。</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-auto w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead className="whitespace-nowrap">族名</TableHead>
                  <TableHead className="whitespace-nowrap">拓词结论</TableHead>
                  <TableHead className="whitespace-nowrap text-right">增量词数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const isOpen = expanded.has(row.family);
                  const incremental = row.incremental ?? [];
                  return (
                    <Fragment key={row.family}>
                      <TableRow className="cursor-pointer" onClick={() => toggleExpand(row.family)}>
                        <TableCell>
                          <ChevronRight
                            className={`size-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`}
                          />
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate font-medium" title={row.family}>
                          {row.family}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge className={verdictBadgeClass(row.verdict)}>{verdictLabel(row.verdict)}</Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Badge variant="outline">{incremental.length}</Badge>
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow>
                          <TableCell colSpan={4} className="bg-muted/20 p-0">
                            <div className="p-3">
                              {incremental.length === 0 ? (
                                <p className="text-xs text-muted-foreground">无增量词明细。</p>
                              ) : (
                                <div className="overflow-x-auto rounded-md border border-border">
                                  <table className="table-auto w-full text-sm">
                                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                                      <tr>
                                        <th className="px-3 py-1.5 text-left font-medium">增量搜索词</th>
                                        <th className="px-3 py-1.5 text-left font-medium">当前由谁捕获（来源投放词）</th>
                                        <th className="px-3 py-1.5 text-right font-medium">点击</th>
                                        <th className="px-3 py-1.5 text-right font-medium">出单</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {incremental.map((m, i) => (
                                        <tr key={i} className="border-b border-border last:border-0">
                                          <td className="px-3 py-1.5 max-w-[240px] truncate" title={m.term ?? ''}>
                                            {m.term ?? '—'}
                                          </td>
                                          <td className="px-3 py-1.5 max-w-[200px] truncate" title={m.capturedBy ?? m.source ?? ''}>
                                            {m.capturedBy ?? m.source ?? '—'}
                                          </td>
                                          <td className="px-3 py-1.5 text-right whitespace-nowrap">{fmtInt(m.clicks)}</td>
                                          <td className="px-3 py-1.5 text-right whitespace-nowrap">{fmtInt(m.orders)}</td>
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
