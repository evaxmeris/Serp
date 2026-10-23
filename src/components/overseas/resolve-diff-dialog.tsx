'use client';

/**
 * 对账差异拉平确认弹窗
 * POST /api/v1/overseas/reconcile/resolve { warehouseId, sku, platformCode, marketplaceId?, reason?, notes? }
 * 口径：按平台可售数为准拉平本地台账，落地为 PLATFORM_DIFF 差异调整流水（不是静默改数）
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { formatSigned, type ReconcileRow } from './reconcile-types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: ReconcileRow | null;
  warehouseCode: string;
  platformCode: string;
  marketplaceId: string | null;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function ResolveDiffDialog({
  open,
  onOpenChange,
  row,
  warehouseCode,
  platformCode,
  marketplaceId,
  onSuccess,
  onError,
}: Props) {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setNotes('');
      setError('');
      setSubmitting(false);
    }
  }, [open, row?.sku]);

  if (!row) return null;

  const platformQty = row.platformQty ?? 0;
  const delta = platformQty - row.localQty;

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/overseas/reconcile/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId: warehouseCode,
          sku: row.sku,
          platformCode,
          marketplaceId: marketplaceId || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess(data.message || `SKU ${row.sku} 已拉平`);
        onOpenChange(false);
      } else {
        setError(data.error || data.message || '拉平失败');
        onError(data.error || data.message || '对账拉平失败');
      }
    } catch (e) {
      console.error('对账拉平失败:', e);
      setError('拉平失败，请稍后重试');
      onError('对账拉平失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>拉平对账差异</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {row.sku}
            {row.productName ? ` · ${row.productName}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-center gap-4 rounded-lg border bg-muted/30 px-4 py-3 text-center">
            <div>
              <div className="text-xs text-muted-foreground">本地台账可用</div>
              <div className="text-xl font-semibold tabular-nums">{row.localQty}</div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">平台可售</div>
              <div className="text-xl font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                {platformQty}
              </div>
            </div>
            <div className="border-l pl-4">
              <div className="text-xs text-muted-foreground">调整量</div>
              <div
                className={
                  delta > 0
                    ? 'text-xl font-semibold tabular-nums text-green-600'
                    : 'text-xl font-semibold tabular-nums text-red-600'
                }
              >
                {formatSigned(delta)}
              </div>
            </div>
          </div>

          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              按平台可售数为准拉平本地台账，将生成平台差异调整流水（ADJUSTMENT / PLATFORM_DIFF），
              台账在库量与可用量同步调整，可在「库存流水」追溯。
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="resolve-notes">备注（可选）</Label>
            <Textarea
              id="resolve-notes"
              rows={2}
              maxLength={500}
              placeholder="补充业务说明，例如：FBA 盘库后数量差异，已核对实物"
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
          <Button onClick={handleSubmit} disabled={submitting || delta === 0}>
            {submitting ? '拉平中…' : '确认拉平'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
