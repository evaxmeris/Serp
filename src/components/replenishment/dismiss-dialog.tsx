'use client';

/**
 * 忽略补货建议弹窗（原因必填，便于事后复盘「为什么不补」）
 * POST /api/v1/replenishment/suggestions/[id]/dismiss { reason }
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
import { Loader2 } from 'lucide-react';
import type { ReplenishmentSuggestion } from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestion: ReplenishmentSuggestion | null;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function DismissDialog({ open, onOpenChange, suggestion, onSuccess, onError }: Props) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
      setError('');
      setSubmitting(false);
    }
  }, [open, suggestion?.id]);

  if (!suggestion) return null;

  const handleSubmit = async () => {
    setError('');
    if (reason.trim().length < 2) {
      setError('必须填写忽略原因（至少 2 个字）');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/replenishment/suggestions/${suggestion.id}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess(data.message || '补货建议已忽略');
        onOpenChange(false);
      } else {
        setError(data.error || data.message || '忽略失败');
      }
    } catch (e) {
      console.error('忽略补货建议失败:', e);
      setError('忽略失败，请稍后重试');
      onError('忽略补货建议失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>忽略补货建议</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {suggestion.sku} · 建议量 {suggestion.suggestedQty} 件
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="dismiss-reason">忽略原因</Label>
            <Textarea
              id="dismiss-reason"
              rows={3}
              maxLength={500}
              placeholder="例如：该 SKU 即将停售 / 已在途足够 / 转由其他仓供货"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">忽略后状态变为「已忽略」，重新生成建议不会复活该行</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                提交中…
              </>
            ) : (
              '确认忽略'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
