'use client';

/**
 * 补货建议列表（行内展开显示计算公式与参数快照）
 * 状态机：PENDING/APPROVED → CONVERTED | DISMISSED
 */

import { Fragment, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronDown, ChevronRight, Ban, ShoppingCart, Truck } from 'lucide-react';
import {
  STATUS_COLOR,
  STATUS_LABEL,
  fmt,
  fmtInt,
  leadTimeSourceLabel,
  salesBasisLabel,
  type ReplenishmentSuggestion,
} from './types';

interface Props {
  items: ReplenishmentSuggestion[];
  loading: boolean;
  onConvert: (suggestion: ReplenishmentSuggestion, target: 'PURCHASE_ORDER' | 'STOCK_TRANSFER') => void;
  onDismiss: (suggestion: ReplenishmentSuggestion) => void;
}

export default function SuggestionTable({ items, loading, onConvert, onDismiss }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-5 w-6 shrink-0" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-1/5" />
            <Skeleton className="ml-auto h-5 w-14" />
            <Skeleton className="ml-auto h-5 w-14" />
            <Skeleton className="ml-auto h-5 w-14" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8 px-2" />
          <TableHead className="w-40">SKU</TableHead>
          <TableHead>产品名称</TableHead>
          <TableHead className="w-24 text-right">日均销量</TableHead>
          <TableHead className="w-28">头程天数</TableHead>
          <TableHead className="w-24 text-right">安全库存</TableHead>
          <TableHead className="w-24 text-right">再订货点</TableHead>
          <TableHead className="w-20 text-right">可用</TableHead>
          <TableHead className="w-20 text-right">在途</TableHead>
          <TableHead className="w-24 text-right">建议量</TableHead>
          <TableHead className="w-24">状态</TableHead>
          <TableHead className="w-56 text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map(s => {
          const expanded = expandedId === s.id;
          const lead = leadTimeSourceLabel(s.leadTimeSource);
          const canAct = s.status === 'PENDING';
          return (
            <Fragment key={s.id}>
              <TableRow className="hover:bg-muted/40">
                <TableCell className="px-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setExpandedId(expanded ? null : s.id)}
                    aria-label={expanded ? '收起计算过程' : '展开计算过程'}
                  >
                    {expanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
                <TableCell className="font-mono text-sm">{s.sku}</TableCell>
                <TableCell className="text-sm">
                  {s.product?.name || <span className="text-muted-foreground">未知产品</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmt(s.avgDailySales, 2)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className="tabular-nums text-sm">{fmt(s.leadTimeDays, 1)} 天</span>
                    <Badge
                      variant="outline"
                      className={
                        lead.historical
                          ? 'border-blue-200 bg-blue-50 text-[10px] text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                          : 'text-[10px] text-muted-foreground'
                      }
                      title={
                        lead.historical
                          ? `来自 ${s.leadTimeSampleSize} 张已收货调拨单实测均值`
                          : `无历史实测（样本 ${s.leadTimeSampleSize}），用配置/内置默认值`
                      }
                    >
                      {lead.text}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmt(s.safetyStock, 1)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(s.reorderPoint, 1)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtInt(s.netAvailableQty)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {fmtInt(s.inTransitQty)}
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-base font-bold tabular-nums">{fmtInt(s.suggestedQty)}</span>
                </TableCell>
                <TableCell>
                  <Badge className={STATUS_COLOR[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {canAct ? (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onConvert(s, 'PURCHASE_ORDER')}
                        title="转采购单草稿"
                      >
                        <ShoppingCart className="mr-1 h-3.5 w-3.5" />
                        转采购单
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onConvert(s, 'STOCK_TRANSFER')}
                        title="转调拨单草稿"
                      >
                        <Truck className="mr-1 h-3.5 w-3.5" />
                        转调拨单
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDismiss(s)}
                        title="忽略并记录原因"
                      >
                        <Ban className="mr-1 h-3.5 w-3.5" />
                        忽略
                      </Button>
                    </div>
                  ) : s.status === 'CONVERTED' ? (
                    <div className="text-xs">
                      <span className="text-muted-foreground">关联单号</span>
                      <div className="font-mono font-medium">{s.convertedNo || s.convertedId || '-'}</div>
                    </div>
                  ) : s.status === 'DISMISSED' ? (
                    <span className="text-xs text-muted-foreground" title={s.dismissedReason ?? ''}>
                      忽略原因：{s.dismissedReason || '-'}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">待审批</span>
                  )}
                </TableCell>
              </TableRow>

              {expanded && (
                <TableRow className="bg-muted/20">
                  <TableCell colSpan={12} className="p-0">
                    <div className="space-y-3 px-6 py-3">
                      <div className="grid gap-x-8 gap-y-1.5 text-xs md:grid-cols-2">
                        <div>
                          <span className="text-muted-foreground">① 日均销量：</span>
                          <span className="font-mono">
                            {fmt(s.avgDailySales, 2)} / 天
                          </span>
                          <span className="ml-2 text-muted-foreground">
                            （{salesBasisLabel(s.salesBasis)}，窗口 {s.salesWindowDays} 天，
                            命中订单 {s.salesOrderCount} 单
                            {s.targetDays ? `，手工目标 ${s.targetDays} 天` : ''}）
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">② 安全库存：</span>
                          <span className="font-mono">
                            z {fmt(s.serviceLevelZ, 2)} × σ {fmt(s.stdDevDailySales, 2)} × √头程{' '}
                            {fmt(s.leadTimeDays, 1)} = {fmt(s.safetyStock, 2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">③ 再订货点：</span>
                          <span className="font-mono">
                            日均 {fmt(s.avgDailySales, 2)} × 头程 {fmt(s.leadTimeDays, 1)} + 安全库存{' '}
                            {fmt(s.safetyStock, 2)} = {fmt(s.reorderPoint, 2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">④ 净可用：</span>
                          <span className="font-mono">
                            在库 {fmtInt(s.onHandQty)} + 在途 {fmtInt(s.inTransitQty)} − 预留{' '}
                            {fmtInt(s.reservedQty)} = {fmtInt(s.netAvailableQty)}
                          </span>
                        </div>
                        <div className="md:col-span-2">
                          <span className="text-muted-foreground">⑤ 建议量：</span>
                          <span className="font-mono">
                            ceil(再订货点 {fmt(s.reorderPoint, 2)} + 日均 {fmt(s.avgDailySales, 2)} ×
                            补货周期 {s.replenishCycleDays} − 净可用 {fmtInt(s.netAvailableQty)}) ={' '}
                            <span className="font-semibold text-foreground">{fmtInt(s.suggestedQty)}</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-[11px] text-muted-foreground">
                        <span>目标仓：{s.overseasWarehouse?.name || s.overseasWarehouseId}</span>
                        <span>
                          头程来源：{s.leadTimeSource}（样本 {s.leadTimeSampleSize}）
                        </span>
                        <span>生成时间：{new Date(s.generatedAt).toLocaleString('zh-CN', { hour12: false })}</span>
                        {s.convertedNo && (
                          <span>
                            已转 {s.convertedType === 'PURCHASE_ORDER' ? '采购单' : '调拨单'}：
                            <span className="font-mono">{s.convertedNo}</span>
                          </span>
                        )}
                        {s.notes && <span>备注：{s.notes}</span>}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
