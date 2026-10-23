'use client';

/**
 * 调拨单操作弹窗：发货（可挂物流单）+ 收货（支持部分收货）
 *   POST /api/v1/stock-transfers/:id/ship     DRAFT → IN_TRANSIT
 *   POST /api/v1/stock-transfers/:id/receive  IN_TRANSIT →（部分）RECEIVED
 */

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { DIRECTION_LABEL, transferFrom, transferTo, type StockTransfer } from './types';

interface ActionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transfer: StockTransfer | null;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

/** 兼容不同错误响应结构 */
function errorMessage(data: any, fallback: string): string {
  if (Array.isArray(data?.errors) && data.errors.length) {
    return data.errors.map((e: { message: string }) => e.message).join('；');
  }
  return data?.message || fallback;
}

/* ------------------------------------------------------------------ */
/* 发货                                                                */
/* ------------------------------------------------------------------ */

export function ShipDialog({ open, onOpenChange, transfer, onSuccess, onError }: ActionProps) {
  const [logisticsOrders, setLogisticsOrders] = useState<
    Array<{ id: string; orderNo: string; status: string }>
  >([]);
  const [logisticsOrderId, setLogisticsOrderId] = useState('NONE');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLogisticsOrderId('NONE');
    setError('');
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/v1/logistics/orders?limit=50&page=1');
        const data = await res.json();
        if (data.success) setLogisticsOrders(data.data.items || []);
      } catch (e) {
        console.error('加载物流订单失败:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const handleSubmit = async () => {
    if (!transfer) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/stock-transfers/${transfer.id}/ship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logisticsOrderId !== 'NONE' ? { logisticsOrderId } : {}),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess(data.message || '调拨单已发货');
        onOpenChange(false);
      } else {
        setError(errorMessage(data, '发货失败'));
      }
    } catch (e) {
      console.error('调拨单发货失败:', e);
      setError('发货失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const from = transfer ? transferFrom(transfer) : null;
  const to = transfer ? transferTo(transfer) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>发货确认</DialogTitle>
          <DialogDescription>
            {transfer?.transferNo} · {transfer ? DIRECTION_LABEL[transfer.direction] : ''} ·{' '}
            {from?.name || '-'} → {to?.name || '-'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            {transfer?.items.map(item => (
              <div key={item.id} className="flex items-center justify-between py-0.5">
                <span className="truncate">{item.product?.name || '-'}</span>
                <span className="tabular-nums text-muted-foreground">
                  {item.product?.sku} × {item.quantity}
                </span>
              </div>
            ))}
          </div>

          <div>
            <Label>挂物流单（可选）</Label>
            <Select value={logisticsOrderId} onValueChange={setLogisticsOrderId}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? '加载中...' : '不挂物流单'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">不挂物流单</SelectItem>
                {logisticsOrders.map(lo => (
                  <SelectItem key={lo.id} value={lo.id}>
                    {lo.orderNo}（{lo.status}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              挂单后物流单号会显示在调拨单列表，方便跟踪在途
            </p>
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
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '提交中...' : '确认发货'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* 收货（可部分）                                                       */
/* ------------------------------------------------------------------ */

export function ReceiveDialog({ open, onOpenChange, transfer, onSuccess, onError }: ActionProps) {
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !transfer) return;
    const init: Record<string, string> = {};
    for (const item of transfer.items) {
      const remaining = Math.max(item.quantity - item.receivedQty, 0);
      init[item.id] = String(remaining);
    }
    setQtys(init);
    setError('');
  }, [open, transfer?.id]);

  const fillAll = useCallback(() => {
    if (!transfer) return;
    const next: Record<string, string> = {};
    for (const item of transfer.items) {
      next[item.id] = String(Math.max(item.quantity - item.receivedQty, 0));
    }
    setQtys(next);
  }, [transfer]);

  const totalRemaining = transfer
    ? transfer.items.reduce((s, i) => s + Math.max(i.quantity - i.receivedQty, 0), 0)
    : 0;
  const totalThisTime = transfer
    ? transfer.items.reduce((s, i) => {
        const q = Number.parseInt(qtys[i.id] ?? '0', 10);
        return s + (Number.isInteger(q) && q > 0 ? q : 0);
      }, 0)
    : 0;

  const handleSubmit = async () => {
    if (!transfer) return;
    setError('');
    const items: Array<{ itemId: string; receivedQty: number }> = [];
    for (const item of transfer.items) {
      const raw = qtys[item.id] ?? '0';
      const qty = Number.parseInt(raw, 10);
      if (raw.trim() === '') continue;
      if (!Number.isInteger(qty) || qty < 0) {
        setError('收货数量必须为不小于 0 的整数');
        return;
      }
      if (qty > item.quantity - item.receivedQty) {
        setError(`收货数量超出剩余：${item.product?.name || '-'} 剩余 ${item.quantity - item.receivedQty}`);
        return;
      }
      if (qty > 0) items.push({ itemId: item.id, receivedQty: qty });
    }
    if (items.length === 0) {
      setError('本次收货数量为 0，请至少填写一项');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/stock-transfers/${transfer.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess(data.message || '收货成功');
        onOpenChange(false);
      } else {
        setError(errorMessage(data, '收货失败'));
      }
    } catch (e) {
      console.error('调拨单收货失败:', e);
      setError('收货失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>收货</DialogTitle>
          <DialogDescription>
            {transfer?.transferNo} · 支持部分收货，未收满可继续收；收满后单据变为「已收货」
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              待收合计 <span className="font-medium text-foreground">{totalRemaining}</span> 件 · 本次收{' '}
              <span className="font-medium text-foreground">{totalThisTime}</span> 件
            </span>
            <Button variant="outline" size="sm" onClick={fillAll}>
              全部收货
            </Button>
          </div>

          <div className="rounded-lg border">
            <div className="grid grid-cols-[1fr_64px_64px_96px] gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>产品</span>
              <span className="text-right">应收</span>
              <span className="text-right">已收</span>
              <span className="text-right">本次收货</span>
            </div>
            <div className="divide-y">
              {transfer?.items.map(item => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_64px_64px_96px] items-center gap-2 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{item.product?.name || '-'}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {item.product?.sku || '-'}
                    </div>
                  </div>
                  <span className="text-right tabular-nums">{item.quantity}</span>
                  <span className="text-right tabular-nums">
                    <Badge
                      variant={item.receivedQty >= item.quantity ? 'secondary' : 'outline'}
                      className="tabular-nums"
                    >
                      {item.receivedQty}
                    </Badge>
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={Math.max(item.quantity - item.receivedQty, 0)}
                    className="h-8 text-right"
                    value={qtys[item.id] ?? ''}
                    onChange={e => setQtys(prev => ({ ...prev, [item.id]: e.target.value }))}
                  />
                </div>
              ))}
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
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '提交中...' : '确认收货'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
