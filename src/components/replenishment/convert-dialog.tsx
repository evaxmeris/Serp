'use client';

/**
 * 补货建议转单弹窗
 * POST /api/v1/replenishment/suggestions/[id]/convert
 *   body: { target: 'PURCHASE_ORDER'|'STOCK_TRANSFER', supplierId?, fromWarehouseId?, quantity?, notes? }
 * 目标单据落地为草稿，需在采购/调拨模块继续审批发货。
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
import { Loader2 } from 'lucide-react';
import type { ReplenishmentSuggestion } from './types';
import { fmtInt } from './types';

type Target = 'PURCHASE_ORDER' | 'STOCK_TRANSFER';

interface Option {
  id: string;
  code?: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestion: ReplenishmentSuggestion | null;
  target: Target;
  suppliers: Option[];
  suppliersLoading: boolean;
  warehouses: Option[];
  warehousesLoading: boolean;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function ConvertDialog({
  open,
  onOpenChange,
  suggestion,
  target,
  suppliers,
  suppliersLoading,
  warehouses,
  warehousesLoading,
  onSuccess,
  onError,
}: Props) {
  const [quantity, setQuantity] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && suggestion) {
      setQuantity(String(suggestion.suggestedQty));
      setSupplierId('');
      setFromWarehouseId('');
      setNotes('');
      setError('');
      setSubmitting(false);
    }
    // 仅在打开或换建议时重置表单，suggestedQty 只是初始值
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, suggestion?.id]);

  if (!suggestion) return null;

  const qty = Number(quantity);
  const qtyValid = Number.isInteger(qty) && qty > 0;
  const isPO = target === 'PURCHASE_ORDER';

  const handleSubmit = async () => {
    setError('');
    if (!qtyValid) {
      setError('转单数量必须是大于 0 的整数');
      return;
    }
    if (isPO && !supplierId) {
      setError('转采购单必须先选供应商');
      return;
    }
    if (!isPO && !fromWarehouseId) {
      setError('转调拨单必须先选国内源仓');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/replenishment/suggestions/${suggestion.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target,
          supplierId: isPO ? supplierId : undefined,
          fromWarehouseId: isPO ? undefined : fromWarehouseId,
          quantity: qty,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess(data.message || '转单成功');
        onOpenChange(false);
      } else {
        // 后端把库存不足等业务校验放在 errors[]，直接拼出来给用户看
        const detail = Array.isArray(data.errors)
          ? data.errors.map((e: { message?: string }) => e.message).filter(Boolean).join('；')
          : '';
        setError(detail || data.error || data.message || '转单失败');
      }
    } catch (e) {
      console.error('补货建议转单失败:', e);
      setError('转单失败，请稍后重试');
      onError('补货建议转单失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isPO ? '转为采购单草稿' : '转为调拨单草稿'}</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {suggestion.sku} · 建议量 {fmtInt(suggestion.suggestedQty)} 件
            {suggestion.product?.name ? ` · ${suggestion.product.name}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isPO ? (
            <div className="space-y-1.5">
              <Label>供应商</Label>
              <Select value={supplierId || undefined} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder={suppliersLoading ? '加载中…' : '选择供应商'} />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>国内源仓</Label>
              <Select value={fromWarehouseId || undefined} onValueChange={setFromWarehouseId}>
                <SelectTrigger>
                  <SelectValue placeholder={warehousesLoading ? '加载中…' : '选择国内源仓'} />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map(w => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                      {w.code ? `（${w.code}）` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="convert-qty">转单数量</Label>
            <Input
              id="convert-qty"
              type="number"
              min={1}
              step="1"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              默认取建议量，可按实际采购/调拨能力调整
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="convert-notes">备注（可选）</Label>
            <Textarea
              id="convert-notes"
              rows={2}
              maxLength={500}
              placeholder="补充业务说明"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !qtyValid}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                转单中…
              </>
            ) : (
              '确认转单'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
