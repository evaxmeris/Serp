'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';

interface ProductBatchDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onDelete: (cascade: boolean) => void;
}

export function ProductBatchDeleteDialog({
  open,
  onOpenChange,
  selectedIds,
  onDelete,
}: ProductBatchDeleteDialogProps) {
  const [cascade, setCascade] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleDelete = () => {
    onDelete(cascade);
    onOpenChange(false);
  };

  const expectedConfirm = '删除';
  const isConfirmed = confirmText.trim() === expectedConfirm;
  const count = selectedIds.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            确认批量删除
          </DialogTitle>
          <DialogDescription>
            你正在删除选中的 {count} 个产品，此操作不可恢复。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-medium text-red-800 mb-2">删除警告</h4>
            <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
              <li>已有关联订单的产品无法删除</li>
              <li>删除操作会记入操作日志</li>
              <li>此操作不可撤销，请确认后再继续</li>
            </ul>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="cascade"
              checked={cascade}
              onCheckedChange={(checked) => setCascade(checked as boolean)}
            />
            <Label htmlFor="cascade" className="font-normal">
              同时删除关联的库存和 SKU 记录（级联删除）
            </Label>
          </div>

          <div>
            <Label htmlFor="confirm">
              请输入 "{expectedConfirm}" 确认删除
            </Label>
            <input
              id="confirm"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="输入 删除 确认"
              className="mt-2 w-full px-3 py-2 border rounded-md"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed}
          >
            确认删除 {count} 个产品
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
