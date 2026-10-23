'use client';

/**
 * 海外仓 - 库存台账
 * GET /api/v1/overseas/inventory?warehouseId=  → 明细 + summary
 * 行内「差异调整」→ POST /api/v1/overseas/inventory/adjust
 */

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { Search, SlidersHorizontal } from 'lucide-react';
import AdjustDialog, { type AdjustProductOption } from './adjust-dialog';
import type { LedgerItem, LedgerSummary, OverseasWarehouse } from './types';

interface Props {
  warehouses: OverseasWarehouse[];
  warehouseCode: string;
  onWarehouseChange: (code: string) => void;
  onDataChanged: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const PAGE_SIZE = 50;

export default function InventoryLedger({
  warehouses,
  warehouseCode,
  onWarehouseChange,
  onDataChanged,
  onSuccess,
  onError,
}: Props) {
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [summary, setSummary] = useState<LedgerSummary>({
    totalQuantity: 0,
    totalReserved: 0,
    totalAvailable: 0,
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<LedgerItem | null>(null);
  // 手工建账时的产品候选（懒加载）
  const [products, setProducts] = useState<AdjustProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  const fetchLedger = useCallback(async () => {
    if (!warehouseCode) {
      setItems([]);
      setTotal(0);
      setTotalPages(0);
      setSummary({ totalQuantity: 0, totalReserved: 0, totalAvailable: 0 });
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        warehouseId: warehouseCode,
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (search) params.set('search', search);
      const res = await fetch(`/api/v1/overseas/inventory?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.data.items || []);
        setSummary(data.data.summary || { totalQuantity: 0, totalReserved: 0, totalAvailable: 0 });
        setTotal(data.data.pagination?.total ?? 0);
        setTotalPages(data.data.pagination?.totalPages ?? 0);
      } else {
        onError(data.message || '获取台账失败');
      }
    } catch (e) {
      console.error('获取海外仓台账失败:', e);
      onError('获取台账失败');
    } finally {
      setLoading(false);
    }
  }, [warehouseCode, page, search, refreshKey, onError]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  // 切仓重置分页
  useEffect(() => {
    setPage(1);
  }, [warehouseCode]);

  const ensureProducts = useCallback(async () => {
    if (products.length > 0 || productsLoading) return;
    setProductsLoading(true);
    try {
      const res = await fetch('/api/v1/products?limit=500&page=1');
      const data = await res.json();
      if (data.success) {
        setProducts(
          (data.data.items || []).map((it: { id: string; name: string; sku: string }) => ({
            id: it.id,
            name: it.name,
            sku: it.sku,
          }))
        );
      }
    } catch (e) {
      console.error('加载产品列表失败:', e);
    } finally {
      setProductsLoading(false);
    }
  }, [products.length, productsLoading]);

  const openAdjust = (item: LedgerItem | null) => {
    setAdjustItem(item);
    setAdjustOpen(true);
    if (!item) ensureProducts();
  };

  const activeWarehouse = warehouses.find(w => w.code === warehouseCode);

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
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="搜索 SKU / 产品名"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                setPage(1);
                setSearch(searchInput.trim());
              }
            }}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setPage(1);
              setSearch(searchInput.trim());
            }}
          >
            搜索
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setSearchInput('');
              setSearch('');
              setPage(1);
            }}
          >
            重置
          </Button>
          <Button onClick={() => openAdjust(null)} disabled={!warehouseCode}>
            差异调整
          </Button>
        </div>
      </div>

      {/* 汇总 */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">在库合计</div>
            <div className="text-2xl font-semibold tabular-nums">
              {summary.totalQuantity.toLocaleString('zh-CN')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">预留合计</div>
            <div className="text-2xl font-semibold tabular-nums">
              {summary.totalReserved.toLocaleString('zh-CN')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">可用合计</div>
            <div className="text-2xl font-semibold tabular-nums text-blue-600 dark:text-blue-400">
              {summary.totalAvailable.toLocaleString('zh-CN')}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {activeWarehouse ? (
            <>
              当前仓库：<span className="text-foreground font-medium">{activeWarehouse.name}</span>
              <Badge variant="outline" className="ml-2 font-mono">
                {activeWarehouse.code}
              </Badge>
            </>
          ) : (
            '未选择仓库'
          )}
        </span>
        <span>共 {total} 个 SKU</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-5 w-24 shrink-0" />
              <Skeleton className="h-5 w-16 shrink-0 ml-auto" />
              <Skeleton className="h-5 w-16 shrink-0 ml-auto" />
              <Skeleton className="h-5 w-16 shrink-0 ml-auto" />
              <Skeleton className="h-8 w-20 shrink-0" />
            </div>
          ))}
        </div>
      ) : !warehouseCode ? (
        <EmptyState
          icon={<SlidersHorizontal className="h-8 w-8 text-gray-400" />}
          title="请选择海外仓"
          description="选择仓库后查看该仓的 SKU 台账与可用量"
        />
      ) : items.length === 0 ? (
        <EmptyState
          title={search ? '没有匹配的 SKU' : '该仓暂无台账记录'}
          description={
            search
              ? '换个关键字试试'
              : '通过国内→海外调拨收货，或直接做差异调整来建立台账'
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">序号</TableHead>
                <TableHead>产品名称</TableHead>
                <TableHead className="w-52">SKU</TableHead>
                <TableHead className="w-24 text-right">在库</TableHead>
                <TableHead className="w-24 text-right">预留</TableHead>
                <TableHead className="w-24 text-right">可用</TableHead>
                <TableHead className="w-28 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {(page - 1) * PAGE_SIZE + idx + 1}
                  </TableCell>
                  <TableCell className="font-medium">{item.product?.name || '-'}</TableCell>
                  <TableCell className="font-mono text-sm">{item.product?.sku || item.sku}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Badge variant={item.quantity > 0 ? 'secondary' : 'destructive'}>
                      {item.quantity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.reservedQty}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {item.availableQty}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => openAdjust(item)}>
                      差异调整
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      <AdjustDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        warehouseCode={warehouseCode}
        item={adjustItem}
        products={products}
        onSuccess={message => {
          onSuccess(message);
          fetchLedger();
          onDataChanged();
        }}
        onError={onError}
      />
    </div>
  );
}
