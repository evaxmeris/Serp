'use client';

/**
 * 海外仓 - 库存流水
 * GET /api/v1/overseas/inventory/movements?warehouseId=
 *
 * 说明：stock_movements 只存变动量（quantity），没有事前/事后列。
 * 这里用「台账当前数量」倒推：after = 当前数量 - 比该行更新的变动之和，before = after - 变动。
 * 因此仅对已加载窗口（最近 200 条）内的行精确；超出窗口的历史行需要后端补 before/after 字段。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';
import {
  MOVEMENT_TYPE_COLOR,
  MOVEMENT_TYPE_LABEL,
  formatDateTime,
  referenceLabel,
  type Movement,
  type OverseasWarehouse,
} from './types';

interface Props {
  warehouses: OverseasWarehouse[];
  warehouseCode: string;
  onWarehouseChange: (code: string) => void;
  onError: (message: string) => void;
}

const FETCH_LIMIT = 200;
const PAGE_SIZE = 20;

export default function MovementTable({
  warehouses,
  warehouseCode,
  onWarehouseChange,
  onError,
}: Props) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [currentQty, setCurrentQty] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState('ALL');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchMovements = useCallback(async () => {
    if (!warehouseCode) {
      setMovements([]);
      setCurrentQty(new Map());
      return;
    }
    setLoading(true);
    try {
      const [mvRes, invRes] = await Promise.all([
        fetch(
          `/api/v1/overseas/inventory/movements?warehouseId=${encodeURIComponent(
            warehouseCode
          )}&limit=${FETCH_LIMIT}&page=1`
        ),
        fetch(
          `/api/v1/overseas/inventory?warehouseId=${encodeURIComponent(
            warehouseCode
          )}&limit=200&page=1`
        ),
      ]);
      const mvData = await mvRes.json();
      const invData = await invRes.json();

      if (mvData.success) {
        setMovements(mvData.data.items || []);
      } else {
        onError(mvData.message || '获取流水失败');
      }

      if (invData.success) {
        const map = new Map<string, number>();
        for (const row of invData.data.items || []) {
          map.set(row.productId, row.quantity);
        }
        setCurrentQty(map);
      }
    } catch (e) {
      console.error('获取海外仓流水失败:', e);
      onError('获取流水失败');
    } finally {
      setLoading(false);
    }
  }, [warehouseCode, refreshKey, onError]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  useEffect(() => {
    setPage(1);
  }, [warehouseCode, type]);

  /** 倒推事前/事后（窗口内精确） */
  const enriched = useMemo(() => {
    const running = new Map<string, number | null>();
    return movements.map(m => {
      const key = m.productId;
      let after: number | null;
      if (running.has(key)) {
        after = running.get(key) ?? null;
      } else {
        const cur = currentQty.get(key);
        after = cur === undefined ? null : cur;
        running.set(key, after);
      }
      const before = after === null ? null : after - m.quantity;
      running.set(key, before);
      return { movement: m, before, after };
    });
  }, [movements, currentQty]);

  const filtered = useMemo(
    () => (type === 'ALL' ? enriched : enriched.filter(r => r.movement.type === type)),
    [enriched, type]
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 0;
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* 筛选：右对齐 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Select value={warehouseCode || undefined} onValueChange={onWarehouseChange}>
          <SelectTrigger className="w-full sm:w-60">
            <SelectValue placeholder="选择海外仓" />
          </SelectTrigger>
          <SelectContent>
            {warehouses.map(w => (
              <SelectItem key={w.id} value={w.code}>
                {w.name}（{w.code}）
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="全部类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部类型</SelectItem>
            <SelectItem value="TRANSFER">调拨</SelectItem>
            <SelectItem value="ADJUSTMENT">调整</SelectItem>
            <SelectItem value="IN">入库</SelectItem>
            <SelectItem value="OUT">出库</SelectItem>
            <SelectItem value="RETURN">退货</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setRefreshKey(k => k + 1)}>
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 w-36 shrink-0" />
              <Skeleton className="h-5 w-16 shrink-0" />
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-5 w-12 shrink-0 ml-auto" />
              <Skeleton className="h-5 w-12 shrink-0 ml-auto" />
              <Skeleton className="h-5 w-12 shrink-0 ml-auto" />
            </div>
          ))}
        </div>
      ) : !warehouseCode ? (
        <EmptyState title="请选择海外仓" description="选择仓库后查看该仓的库存流水" />
      ) : pageRows.length === 0 ? (
        <EmptyState
          title="暂无流水"
          description={
            type === 'ALL'
              ? '该仓还没有库存变动，调拨收货或差异调整后会在这里留痕'
              : '当前类型下没有流水，切换类型试试'
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">时间</TableHead>
                <TableHead className="w-20">类型</TableHead>
                <TableHead>产品 / SKU</TableHead>
                <TableHead className="w-20 text-right">变动</TableHead>
                <TableHead className="w-20 text-right">事前</TableHead>
                <TableHead className="w-20 text-right">事后</TableHead>
                <TableHead className="w-40">来源单号</TableHead>
                <TableHead>备注</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map(({ movement: m, before, after }) => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDateTime(m.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge className={MOVEMENT_TYPE_COLOR[m.type] || 'bg-gray-100 text-gray-700'}>
                      {MOVEMENT_TYPE_LABEL[m.type] || m.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{m.product?.name || '-'}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {m.product?.sku || m.productId.slice(-8)}
                    </div>
                  </TableCell>
                  <TableCell
                    className={
                      'text-right tabular-nums font-semibold ' +
                      (m.quantity >= 0 ? 'text-green-600' : 'text-red-600')
                    }
                  >
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {before === null ? '—' : before}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {after === null ? '—' : after}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{referenceLabel(m.referenceType)}</div>
                    {m.referenceId && (
                      <div className="text-xs text-muted-foreground font-mono">
                        {m.referenceId.slice(-8)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[320px] truncate" title={m.notes || ''}>
                    {m.notes || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              事前 / 事后为依据当前台账结存倒推（最近 {FETCH_LIMIT} 条流水窗口内精确）
            </p>
            <Pagination
              page={page}
              totalPages={totalPages}
              total={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </div>
  );
}
