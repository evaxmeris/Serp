'use client';

/**
 * 生成补货建议弹窗
 * POST /api/v1/replenishment/generate { overseasWarehouseId?, manualDailySales?, manualTargetDays? }
 * 幂等：同 (SKU, 海外仓) 的 PENDING 原地刷新；APPROVED/CONVERTED/DISMISSED 不被改写
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

export interface GenerateTotals {
  created: number;
  refreshed: number;
  cleared: number;
  skippedDismissed: number;
  rows: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseCode: string;
  warehouseName?: string;
  onDone: (totals: GenerateTotals) => void;
  onError: (message: string) => void;
}

export default function GenerateDialog({
  open,
  onOpenChange,
  warehouseCode,
  warehouseName,
  onDone,
  onError,
}: Props) {
  const [manualDailySales, setManualDailySales] = useState('');
  const [manualTargetDays, setManualTargetDays] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setManualDailySales('');
      setManualTargetDays('');
      setError('');
      setRunning(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    setError('');
    const daily = manualDailySales.trim() === '' ? null : Number(manualDailySales);
    const target = manualTargetDays.trim() === '' ? null : Number(manualTargetDays);
    if (daily !== null && (!Number.isFinite(daily) || daily < 0)) {
      setError('手工日均销量必须是非负数字');
      return;
    }
    if (target !== null && (!Number.isInteger(target) || target < 1)) {
      setError('目标周转天数必须是正整数');
      return;
    }

    setRunning(true);
    try {
      const res = await fetch('/api/v1/replenishment/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overseasWarehouseId: warehouseCode || undefined,
          manualDailySales: daily ?? undefined,
          manualTargetDays: target ?? undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onDone(data.data.totals as GenerateTotals);
        onOpenChange(false);
      } else {
        setError(data.error || data.message || '生成失败');
      }
    } catch (e) {
      console.error('生成补货建议失败:', e);
      setError('生成失败，请稍后重试');
      onError('生成补货建议失败');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>生成补货建议</DialogTitle>
          <DialogDescription>
            {warehouseName ? `${warehouseName}（${warehouseCode}）` : '全部启用中的海外仓'}
            <br />
            按近 30 天平台订单估日均销量 + z 值安全库存计算；无销量数据时用下方手工日均降级。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="manual-daily">手工日均销量（可选）</Label>
              <Input
                id="manual-daily"
                type="number"
                min={0}
                step="0.1"
                placeholder="如 1"
                value={manualDailySales}
                onChange={e => setManualDailySales(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="manual-target">目标周转天数（可选）</Label>
              <Input
                id="manual-target"
                type="number"
                min={1}
                step="1"
                placeholder="仅记录"
                value={manualTargetDays}
                onChange={e => setManualTargetDays(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            幂等：同一 SKU 的待处理建议原地刷新；建议量归零的待处理行会被清除；已转单/已忽略不被改写。
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={running}>
            {running ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                生成中…
              </>
            ) : (
              '开始生成'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
