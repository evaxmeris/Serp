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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface CustomerItem {
  id: string;
  companyName: string;
  tags: string[];
}

interface BatchResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ id: string; message: string }>;
}

interface CustomerBatchTagsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCustomers: CustomerItem[];
  availableTags: string[];
  onComplete: (result: BatchResult) => void;
}

export function CustomerBatchTagsDialog({
  open,
  onOpenChange,
  selectedCustomers,
  availableTags,
  onComplete,
}: CustomerBatchTagsDialogProps) {
  const [action, setAction] = useState<'add' | 'remove'>('add');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);

  const toggleTag = (tag: string) => {
    const newSelected = new Set(selectedTags);
    if (newSelected.has(tag)) {
      newSelected.delete(tag);
    } else {
      newSelected.add(tag);
    }
    setSelectedTags(newSelected);
  };

  const selectAllTags = () => {
    setSelectedTags(new Set(availableTags));
  };

  const clearAllTags = () => {
    setSelectedTags(new Set());
  };

  const handleConfirm = async () => {
    if (selectedTags.size === 0) {
      alert(`请至少选择一个标签要${action === 'add' ? '添加' : '移除'}`);
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch('/api/customers/batch/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedCustomers.map(c => c.id),
          action,
          tags: Array.from(selectedTags),
        }),
      });

      const batchResult: BatchResult = await response.json();
      setResult(batchResult);
      onComplete(batchResult);
    } catch (error) {
      setResult({
        total: selectedCustomers.length,
        success: 0,
        failed: selectedCustomers.length,
        errors: [{
          id: '',
          message: error instanceof Error ? error.message : '操作失败',
        }],
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setAction('add');
    setSelectedTags(new Set());
    setProcessing(false);
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>批量标签操作</DialogTitle>
          <DialogDescription>
            对选中的 {selectedCustomers.length} 个客户批量添加或移除标签
          </DialogDescription>
        </DialogHeader>

        {!result && (
          <div className="space-y-4">
            <div>
              <Label className="mb-3 block">操作类型</Label>
              <RadioGroup value={action} onValueChange={(v) => setAction(v as any)} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="add" id="action-add" />
                  <Label htmlFor="action-add" className="font-normal">
                    添加标签（保留原有标签）
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="remove" id="action-remove" />
                  <Label htmlFor="action-remove" className="font-normal">
                    移除标签
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label>选择标签</Label>
                <div className="space-x-2">
                  <Button variant="ghost" size="sm" onClick={selectAllTags}>
                    全选
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearAllTags}>
                    清空
                  </Button>
                </div>
              </div>
              <div className="border rounded-lg p-4 grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                {availableTags.map((tag) => (
                  <div key={tag} className="flex items-center space-x-2">
                    <Checkbox
                      id={`tag-${tag}`}
                      checked={selectedTags.has(tag)}
                      onCheckedChange={() => toggleTag(tag)}
                    />
                    <Label
                      htmlFor={`tag-${tag}`}
                      className="font-normal cursor-pointer flex-1"
                    >
                      <Badge variant="outline">{tag}</Badge>
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                已选择 {selectedTags.size} 个标签
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-700">
                将对 {selectedCustomers.length} 个客户批量 {action === 'add' ? '添加' : '移除'} 选中的 {selectedTags.size} 个标签
              </p>
            </div>
          </div>
        )}

        {/* 处理结果 */}
        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="border rounded-lg p-4 text-center">
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-sm text-muted-foreground">总计</p>
              </div>
              <div className="border rounded-lg p-4 text-center bg-green-50">
                <p className="text-2xl font-bold text-green-600">{result.success}</p>
                <p className="text-sm text-muted-foreground">成功</p>
              </div>
              <div className="border rounded-lg p-4 text-center bg-red-50">
                <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                <p className="text-sm text-muted-foreground">失败</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <p className="font-medium text-red-600">错误信息</p>
                </div>
                <ul className="text-sm text-red-600 list-disc list-inside">
                  {result.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.success === result.total && (
              <div className="flex items-center justify-center p-4 text-green-600 bg-green-50 rounded-lg">
                <CheckCircle2 className="h-5 w-5 mr-2" />
                <span>全部操作成功！</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? '关闭' : '取消'}
          </Button>
          {!result && (
            <Button
              onClick={handleConfirm}
              disabled={processing || selectedTags.size === 0}
            >
              {processing ? '处理中...' : `确认${action === 'add' ? '添加' : '移除'}`}
            </Button>
          )}
          {result && result.success > 0 && (
            <Button
              onClick={() => {
                handleClose();
                window.location.reload();
              }}
            >
              完成
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
