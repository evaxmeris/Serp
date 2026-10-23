'use client';

/**
 * 新建调拨单弹窗
 * POST /api/v1/stock-transfers
 * 方向 → 源仓/目标仓联动 → 明细行（显示源仓当前可用量）
 * 创建即扣减源仓库存（后端事务），因此这里必须做可用量前置校验
 */

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import type { StockOption, TransferDirection, WarehouseRef } from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

interface Row {
  key: number;
  productId: string; // 'NONE' = 未选择
  quantity: string;
}

let rowSeq = 1;

export default function CreateTransferDialog({ open, onOpenChange, onSuccess, onError }: Props) {
  const [direction, setDirection] = useState<TransferDirection>('DOMESTIC_TO_OVERSEAS');
  const [domesticWarehouses, setDomesticWarehouses] = useState<WarehouseRef[]>([]);
  const [overseasWarehouses, setOverseasWarehouses] = useState<WarehouseRef[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);
  const [fromCode, setFromCode] = useState('');
  const [toCode, setToCode] = useState('');
  const [stockOptions, setStockOptions] = useState<StockOption[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([{ key: rowSeq++, productId: 'NONE', quantity: '1' }]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isDomesticToOverseas = direction === 'DOMESTIC_TO_OVERSEAS';

  const loadWarehouses = useCallback(async () => {
    setWarehousesLoading(true);
    try {
      const [dRes, oRes] = await Promise.all([
        fetch('/api/v1/warehouses?status=ACTIVE&limit=100'),
        fetch('/api/v1/overseas/warehouses?limit=100&page=1'),
      ]);
      const dData = await dRes.json();
      const oData = await oRes.json();
      if (dData.success) setDomesticWarehouses(dData.data.items || []);
      if (oData.success) {
        setOverseasWarehouses(
          (oData.data.items || []).filter((w: WarehouseRef & { isActive?: boolean }) => w.isActive !== false)
        );
      }
    } catch (e) {
      console.error('加载仓库列表失败:', e);
    } finally {
      setWarehousesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setDirection('DOMESTIC_TO_OVERSEAS');
      setFromCode('');
      setToCode('');
      setStockOptions([]);
      setRows([{ key: rowSeq++, productId: 'NONE', quantity: '1' }]);
      setNotes('');
      setError('');
      loadWarehouses();
    }
  }, [open, loadWarehouses]);

  // 源仓可用量（方向决定取国内库存还是海外台账）
  useEffect(() => {
    if (!fromCode) {
      setStockOptions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setStockLoading(true);
      try {
        const url = isDomesticToOverseas
          ? `/api/v1/inventory?warehouseId=${encodeURIComponent(fromCode)}&limit=200&page=1`
          : `/api/v1/overseas/inventory?warehouseId=${encodeURIComponent(fromCode)}&limit=200&page=1`;
        const res = await fetch(url);
        const data = await res.json();
        if (cancelled) return;
        if (data.success) {
          const options: StockOption[] = (data.data.items || []).map((it: any) => ({
            productId: it.productId,
            name: it.product?.name || '-',
            sku: it.product?.sku || it.sku || '-',
            available: isDomesticToOverseas
              ? Number(it.availableQuantity ?? 0)
              : Number(it.availableQty ?? 0),
          }));
          setStockOptions(options.sort((a, b) => a.sku.localeCompare(b.sku)));
        } else {
          setStockOptions([]);
          onError(data.message || '加载源仓库存失败');
        }
      } catch (e) {
        console.error('加载源仓库存失败:', e);
        if (!cancelled) onError('加载源仓库存失败');
      } finally {
        if (!cancelled) setStockLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromCode, isDomesticToOverseas, onError]);

  const optionMap = new Map(stockOptions.map(o => [o.productId, o]));

  const patchRow = (key: number, patch: Partial<Row>) =>
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows(prev => [...prev, { key: rowSeq++, productId: 'NONE', quantity: '1' }]);

  const removeRow = (key: number) => setRows(prev => prev.filter(r => r.key !== key));

  const totalQty = rows.reduce((sum, r) => {
    const q = Number.parseInt(r.quantity, 10);
    return sum + (Number.isInteger(q) ? q : 0);
  }, 0);

  const handleSubmit = async () => {
    setError('');
    if (!fromCode || !toCode) {
      setError('请选择源仓与目标仓');
      return;
    }
    if (fromCode === toCode) {
      setError('源仓与目标仓不能相同');
      return;
    }
    if (rows.length === 0) {
      setError('至少添加一行产品');
      return;
    }

    const picked = new Set<string>();
    const items: Array<{ productId: string; quantity: number }> = [];
    for (const row of rows) {
      if (!row.productId || row.productId === 'NONE') {
        setError('存在未选择产品的行');
        return;
      }
      if (picked.has(row.productId)) {
        setError('同一产品不能重复添加');
        return;
      }
      const qty = Number.parseInt(row.quantity, 10);
      if (!Number.isInteger(qty) || qty <= 0) {
        setError('调拨数量必须为大于 0 的整数');
        return;
      }
      const avail = optionMap.get(row.productId)?.available ?? 0;
      if (qty > avail) {
        setError(`可用量不足：${optionMap.get(row.productId)?.name || row.productId} 可用 ${avail}`);
        return;
      }
      picked.add(row.productId);
      items.push({ productId: row.productId, quantity: qty });
    }

    setSubmitting(true);
    try {
      const body = isDomesticToOverseas
        ? { direction, fromWarehouseId: fromCode, toOverseasWarehouseId: toCode, items }
        : { direction, fromOverseasWarehouseId: fromCode, toWarehouseId: toCode, items };
      const res = await fetch('/api/v1/stock-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, ...(notes.trim() ? { notes: notes.trim() } : {}) }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess(data.message || '调拨单创建成功');
        onOpenChange(false);
      } else {
        const detail = Array.isArray(data.errors) && data.errors.length
          ? data.errors.map((e: { message: string }) => e.message).join('；')
          : data.message;
        setError(detail || '创建失败');
      }
    } catch (e) {
      console.error('创建调拨单失败:', e);
      setError('创建失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const sourceList = isDomesticToOverseas ? domesticWarehouses : overseasWarehouses;
  const targetList = isDomesticToOverseas ? overseasWarehouses : domesticWarehouses;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新建调拨单</DialogTitle>
          <DialogDescription>
            创建即扣减源仓库存（锁定），取消时回补；发货后对方仓收货入库。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>调拨方向 *</Label>
              <Select
                value={direction}
                onValueChange={v => {
                  setDirection(v as TransferDirection);
                  setFromCode('');
                  setToCode('');
                  setStockOptions([]);
                  setRows([{ key: rowSeq++, productId: 'NONE', quantity: '1' }]);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择方向" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DOMESTIC_TO_OVERSEAS">国内仓 → 海外仓</SelectItem>
                  <SelectItem value="OVERSEAS_TO_DOMESTIC">海外仓 → 国内仓</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end pb-2 text-sm text-muted-foreground">
              {isDomesticToOverseas ? '从国内仓发货到海外仓' : '从海外仓退回国内仓'}
            </div>
          </div>

          <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <div>
              <Label>源仓 *（{isDomesticToOverseas ? '国内仓' : '海外仓'}）</Label>
              <Select
                value={fromCode || undefined}
                onValueChange={v => {
                  setFromCode(v);
                  setRows(prev =>
                    prev.length ? prev.map(r => ({ ...r, productId: 'NONE' })) : prev
                  );
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={warehousesLoading ? '加载中...' : '选择源仓'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {sourceList.map(w => (
                    <SelectItem key={w.id} value={w.code}>
                      {w.name}（{w.code}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ArrowRight className="mb-3 hidden h-4 w-4 text-muted-foreground sm:block" />
            <div>
              <Label>目标仓 *（{isDomesticToOverseas ? '海外仓' : '国内仓'}）</Label>
              <Select value={toCode || undefined} onValueChange={setToCode}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={warehousesLoading ? '加载中...' : '选择目标仓'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {targetList.map(w => (
                    <SelectItem key={w.id} value={w.code} disabled={w.code === fromCode}>
                      {w.name}（{w.code}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 明细 */}
          <div className="rounded-lg border">
            <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
              <span className="text-sm font-medium">调拨明细</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">合计 {totalQty} 件</span>
                <Button variant="outline" size="sm" onClick={addRow} disabled={!fromCode}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  添加产品行
                </Button>
              </div>
            </div>

            <div className="divide-y">
              {!fromCode ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  请先选择源仓，再添加产品
                </p>
              ) : stockLoading ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">加载源仓库存...</p>
              ) : stockOptions.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  该源仓暂无可调拨库存
                </p>
              ) : (
                rows.map(row => {
                  const opt = row.productId !== 'NONE' ? optionMap.get(row.productId) : undefined;
                  return (
                    <div key={row.key} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <Select
                          value={row.productId}
                          onValueChange={v => patchRow(row.key, { productId: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择产品" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NONE" disabled>
                              选择产品
                            </SelectItem>
                            {stockOptions.map(o => (
                              <SelectItem
                                key={o.productId}
                                value={o.productId}
                                disabled={rows.some(
                                  r => r.key !== row.key && r.productId === o.productId
                                )}
                              >
                                {o.name}（{o.sku}）
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="whitespace-nowrap">
                          可用 {opt ? opt.available : '-'}
                        </Badge>
                        <Input
                          type="number"
                          min={1}
                          max={opt?.available ?? undefined}
                          className="w-24"
                          value={row.quantity}
                          onChange={e => patchRow(row.key, { quantity: e.target.value })}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRow(row.key)}
                          disabled={rows.length === 1}
                          aria-label="删除行"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="transfer-notes">备注</Label>
            <Textarea
              id="transfer-notes"
              rows={2}
              value={notes}
              maxLength={500}
              onChange={e => setNotes(e.target.value)}
              placeholder="如：Q4 补货，海运整柜"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !fromCode || !toCode}>
            {submitting ? '创建中...' : '创建调拨单'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
