'use client';

/**
 * 海外仓台账差异调整弹窗
 * POST /api/v1/overseas/inventory/adjust
 * 规则：类型 + 变动量(±整数) + 原因(≥2字) 必填；提交前展示调整后数量预览
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import type { LedgerItem } from './types';

export interface AdjustProductOption {
  id: string;
  name: string;
  sku: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseCode: string;
  /** 从台账行进入时传入；从工具栏「差异调整」进入时为 null（手工建账） */
  item: LedgerItem | null;
  /** item 为 null 时的产品选择列表 */
  products: AdjustProductOption[];
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const ADJUST_TYPES = [
  { value: 'LOST', label: '丢件（LOST）' },
  { value: 'PLATFORM_DIFF', label: '平台差异（PLATFORM_DIFF）' },
  { value: 'OTHER', label: '其他（OTHER）' },
];

export default function AdjustDialog({
  open,
  onOpenChange,
  warehouseCode,
  item,
  products,
  onSuccess,
  onError,
}: Props) {
  const [type, setType] = useState('LOST');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setType('LOST');
      setProductId(item?.productId ?? '');
      setQuantity('');
      setReason('');
      setError('');
    }
  }, [open, item?.id, item?.productId]);

  const manualMode = !item;
  const targetProductId = item?.productId ?? productId;
  const currentQuantity = item?.quantity ?? 0;
  const currentAvailable = item?.availableQty ?? 0;

  const delta = Number.parseInt(quantity, 10);
  const validDelta = Number.isInteger(delta) && delta !== 0;
  const afterQuantity = currentQuantity + (validDelta ? delta : 0);
  const afterAvailable = currentAvailable + (validDelta ? delta : 0);

  const handleSubmit = async () => {
    setError('');
    if (!targetProductId) {
      setError('请选择产品');
      return;
    }
    if (!validDelta) {
      setError('变动量必须为非 0 整数（盘亏填负数，盘盈填正数）');
      return;
    }
    if (manualMode && delta < 0) {
      setError('该产品在此仓还没有台账记录，首次调整只能新增（填正数）');
      return;
    }
    if (reason.trim().length < 2) {
      setError('必须填写调整原因（至少 2 个字）');
      return;
    }
    if (afterQuantity < 0) {
      setError('调整后在库数量不能为负数');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/overseas/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId: warehouseCode,
          productId: targetProductId,
          quantity: delta,
          type,
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess(data.message || '台账调整成功');
        onOpenChange(false);
      } else {
        const detail = Array.isArray(data.errors) && data.errors.length
          ? data.errors.map((e: { message: string }) => e.message).join('；')
          : data.message;
        setError(detail || '调整失败');
      }
    } catch (e) {
      console.error('台账调整失败:', e);
      setError('调整失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>差异调整</DialogTitle>
          <DialogDescription>
            {item
              ? `${item.product?.name || item.sku}（${item.product?.sku || item.sku}）`
              : '手工建账：为台账里还没有的产品建立首条记录'}
            {' · '}仓库 {warehouseCode}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {manualMode && (
            <div>
              <Label>产品 *</Label>
              <Select value={productId || undefined} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择产品" />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}（{p.sku}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>调整类型 *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="选择类型" />
              </SelectTrigger>
              <SelectContent>
                {ADJUST_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="adjust-qty">变动量 *</Label>
            <Input
              id="adjust-qty"
              type="number"
              step={1}
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="盘亏填 -2，盘盈填 2"
            />
            <p className="mt-1 text-xs text-muted-foreground">按实物盘点结果填差额，负数表示减少</p>
          </div>

          <div>
            <Label htmlFor="adjust-reason">调整原因 *</Label>
            <Textarea
              id="adjust-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="如：10/22 盘点发现包装破损 2 件已报废"
              rows={3}
              maxLength={500}
            />
            <p className="mt-1 text-xs text-muted-foreground">至少 2 个字，会写入库存流水留痕</p>
          </div>

          {/* 调整后数量预览 */}
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">在库</span>
              <span className="tabular-nums">
                {currentQuantity}
                <span className="mx-1 text-muted-foreground">→</span>
                <span
                  className={
                    'font-semibold ' + (afterQuantity < 0 ? 'text-red-600' : 'text-foreground')
                  }
                >
                  {afterQuantity}
                </span>
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">可用</span>
              <span className="tabular-nums">
                {currentAvailable}
                <span className="mx-1 text-muted-foreground">→</span>
                <span
                  className={
                    'font-semibold ' + (afterAvailable < 0 ? 'text-red-600' : 'text-foreground')
                  }
                >
                  {afterAvailable}
                </span>
              </span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              变动 {validDelta ? (delta > 0 ? `+${delta}` : delta) : '—'} · 预留{' '}
              {item?.reservedQty ?? 0}
            </div>
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
          <Button onClick={handleSubmit} disabled={submitting || !targetProductId}>
            {submitting ? '提交中...' : '确认调整'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
