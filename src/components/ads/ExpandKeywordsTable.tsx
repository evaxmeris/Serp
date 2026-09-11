'use client';

/**
 * 新建精准候选（source=EXPAND 决策行，REQ-003-5 行级部分）
 *
 * 数据：useAdsKeywords({ recommendationId, source: 'EXPAND' })——引擎「值得拓词」族的
 *       新建精准候选，唯一勾选数据源（架构 P0-7）；勾选后批量表生成 CREATE 行。
 * 交互：Checkbox 勾选即持久化（乐观更新）；点击依据文字可下钻原始行。
 * 空态：无候选时显示「本批次无新建精准候选」（铁律：不拓也是结论，不隐藏）。
 */
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { SkeletonTable } from '@/components/ui/skeleton-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { useAdsKeywords, useUpdateKeyword } from '@/hooks/use-ads';
import type { AdKeywordRow } from '@/types/ads';
import { useAdsPerms, fmtBid } from './shared';

export interface ExpandKeywordsTableProps {
  recommendationId: string;
}

export function ExpandKeywordsTable({ recommendationId }: ExpandKeywordsTableProps) {
  const { hasPerm } = useAdsPerms();
  const { toast } = useToast();
  const canEdit = hasPerm('ads:edit');
  const [page] = useState(1);

  const { data, isLoading, isError, refetch } = useAdsKeywords({
    recommendationId,
    source: 'EXPAND',
    page,
    limit: 50,
  });
  const rows = data?.items ?? [];
  const total = data?.pagination?.total ?? 0;
  const updateKeyword = useUpdateKeyword();

  const toggle = async (row: AdKeywordRow, checked: boolean) => {
    try {
      await updateKeyword.mutateAsync({ id: row.id, data: { isSelected: checked } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      refetch();
    }
  };

  return (
    <Card className="animate-in fade-in-0 mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          新建精准候选
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            「值得拓词」族的行级候选，勾选后进入批量表（Create 行）· 共 {total} 条
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <SkeletonTable rows={3} cols={4} />
        ) : isError ? (
          <div className="py-8 text-center text-sm">
            <p className="text-destructive mb-2">加载失败</p>
            <button onClick={() => refetch()} className="text-primary underline">重试</button>
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            本批次无新建精准候选（不拓也是结论——族级理由见上方拓词结论表）
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-auto w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">{canEdit && <span className="sr-only">勾选</span>}</TableHead>
                  <TableHead className="whitespace-nowrap">候选词</TableHead>
                  <TableHead className="whitespace-nowrap">动作</TableHead>
                  <TableHead className="whitespace-nowrap">匹配</TableHead>
                  <TableHead className="whitespace-nowrap text-right">建议竞价</TableHead>
                  <TableHead className="whitespace-nowrap">依据</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {canEdit ? (
                        <Checkbox
                          checked={row.isSelected === true}
                          onCheckedChange={(c) => toggle(row, c === true)}
                          disabled={updateKeyword.isPending}
                        />
                      ) : (
                        <Badge variant={row.isSelected ? 'default' : 'outline'}>
                          {row.isSelected ? '已选' : '未选'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate font-medium" title={row.keywordText}>
                      {row.keywordText}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant={row.action === 'EXPAND_BROAD' ? 'secondary' : 'default'}>
                        {row.action === 'EXPAND_BROAD' ? '广泛探测' : '精准收割'}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{row.matchType}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{fmtBid(row.bid)}</TableCell>
                    <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground" title={row.actionReason ?? ''}>
                      {row.actionReason ?? '待补充'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <ToastContainer toasts={[]} removeToast={() => {}} />
    </Card>
  );
}
