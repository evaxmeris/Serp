/**
 * 批量操作组件
 * 支持全选、批量删除、批量导出等功能
 */

'use client';

import { useState } from 'react';
import { Button } from './button';
import { Checkbox } from './checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './dialog';
import { Trash2, Download, CheckSquare, Square } from 'lucide-react';

interface BatchActionsProps<T> {
  items: T[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  getId: (item: T) => string;
  onBatchDelete?: (ids: string[]) => Promise<void>;
  onBatchExport?: (ids: string[]) => Promise<void>;
  deleteConfirmText?: string;
}

export function BatchActions<T>({
  items,
  selectedIds,
  onSelectionChange,
  getId,
  onBatchDelete,
  onBatchExport,
  deleteConfirmText = '确定要删除选中的项目吗？',
}: BatchActionsProps<T>) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);

  const allSelected = items.length > 0 && items.every(item => selectedIds.includes(getId(item)));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(items.map(getId));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter(sid => sid !== id));
    }
  };

  const handleBatchDelete = async () => {
    if (!onBatchDelete) return;
    
    setProcessing(true);
    try {
      await onBatchDelete(selectedIds);
      onSelectionChange([]);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('批量删除失败:', error);
      alert('批量删除失败，请重试');
    } finally {
      setProcessing(false);
    }
  };

  const handleBatchExport = async () => {
    if (!onBatchExport) return;
    
    setProcessing(true);
    try {
      await onBatchExport(selectedIds);
    } catch (error) {
      console.error('批量导出失败:', error);
      alert('批量导出失败，请重试');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4 p-3 bg-muted rounded-lg">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={allSelected}
            onCheckedChange={handleSelectAll}
          />
          <span className="text-sm text-muted-foreground">
            已选择 <span className="font-medium text-foreground">{selectedIds.length}</span> 项
          </span>
        </div>
        
        {selectedIds.length > 0 && (
          <div className="flex gap-2">
            {onBatchExport && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleBatchExport}
                disabled={processing}
              >
                <Download className="w-4 h-4 mr-2" />
                批量导出
              </Button>
            )}
            {onBatchDelete && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={processing}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                批量删除
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              {deleteConfirmText}
            </p>
            <p className="text-sm font-medium mt-2">
              将删除 {selectedIds.length} 个项目
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={processing}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleBatchDelete}
              disabled={processing}
            >
              {processing ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 返回选择渲染函数 */}
      {{
        renderItemCheckbox: (item: T) => (
          <Checkbox
            checked={selectedIds.includes(getId(item))}
            onCheckedChange={(checked) => handleSelectItem(getId(item), checked as boolean)}
          />
        ),
        handleSelectAll,
        handleSelectItem,
      }}
    </>
  );
}

export default BatchActions;
