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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Download } from 'lucide-react';

interface ProductBatchExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  totalFiltered: number;
  onExport: (ids: string[] | undefined, fields: string[]) => void;
}

interface FieldOption {
  id: string;
  label: string;
  defaultChecked: boolean;
}

const fieldOptions: FieldOption[] = [
  { id: 'sku', label: 'SKU', defaultChecked: true },
  { id: 'name', label: '产品名称', defaultChecked: true },
  { id: 'category', label: '分类', defaultChecked: true },
  { id: 'costPrice', label: '成本价格', defaultChecked: true },
  { id: 'salePrice', label: '销售价格', defaultChecked: true },
  { id: 'minOrderQty', label: '最小起订量', defaultChecked: false },
  { id: 'supplier', label: '供应商', defaultChecked: true },
  { id: 'weight', label: '重量', defaultChecked: false },
  { id: 'length', label: '长度', defaultChecked: false },
  { id: 'width', label: '宽度', defaultChecked: false },
  { id: 'height', label: '高度', defaultChecked: false },
  { id: 'description', label: '描述', defaultChecked: false },
  { id: 'status', label: '状态', defaultChecked: false },
  { id: 'createdAt', label: '创建时间', defaultChecked: false },
  { id: 'updatedAt', label: '更新时间', defaultChecked: false },
];

export function ProductBatchExportDialog({
  open,
  onOpenChange,
  selectedCount,
  totalFiltered,
  onExport,
}: ProductBatchExportDialogProps) {
  const [scope, setScope] = useState<'selected' | 'all'>(selectedCount > 0 ? 'selected' : 'all');
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(fieldOptions.filter(f => f.defaultChecked).map(f => f.id))
  );

  const toggleField = (fieldId: string) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(fieldId)) {
      newSelected.delete(fieldId);
    } else {
      newSelected.add(fieldId);
    }
    setSelectedFields(newSelected);
  };

  const selectAllFields = () => {
    setSelectedFields(new Set(fieldOptions.map(f => f.id)));
  };

  const clearAllFields = () => {
    setSelectedFields(new Set());
  };

  const handleExport = () => {
    const fields = Array.from(selectedFields);
    if (scope === 'selected') {
      // 父组件传入 selectedIds，这里只传递范围指示
      onExport(undefined, fields);
    } else {
      onExport(undefined, fields);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>批量导出产品</DialogTitle>
          <DialogDescription>
            选择导出范围和字段，导出为 Excel 文件
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 导出范围 */}
          <div>
            <Label className="mb-3 block">导出范围</Label>
            <RadioGroup
              value={scope}
              onValueChange={(v) => setScope(v as 'selected' | 'all')}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="selected" id="scope-selected" disabled={selectedCount === 0} />
                <Label htmlFor="scope-selected" className="font-normal">
                  仅导出选中产品 {selectedCount > 0 && `(${selectedCount} 项)`}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="scope-all" />
                <Label htmlFor="scope-all" className="font-normal">
                  导出当前筛选条件下所有产品 ({totalFiltered} 项)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* 导出字段 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>选择导出字段</Label>
              <div className="space-x-2">
                <Button variant="ghost" size="sm" onClick={selectAllFields}>
                  全选
                </Button>
                <Button variant="ghost" size="sm" onClick={clearAllFields}>
                  清空
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 border rounded-lg p-4">
              {fieldOptions.map((field) => (
                <div key={field.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`field-${field.id}`}
                    checked={selectedFields.has(field.id)}
                    onCheckedChange={() => toggleField(field.id)}
                  />
                  <Label
                    htmlFor={`field-${field.id}`}
                    className="font-normal cursor-pointer"
                  >
                    {field.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleExport}
            disabled={selectedFields.size === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            开始导出
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
