'use client';

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface ProductImportItem {
  sku: string;
  name: string;
  category?: string;
  costPrice?: number;
  salePrice?: number;
  minOrderQty?: number;
  supplier?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  _rowIndex: number;
  _errors: string[];
  _action: 'create' | 'update' | 'skip' | 'error';
}

export interface BatchResult {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ id: string; message: string }>;
}

interface ProductBatchImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (result: BatchResult) => void;
}

type Step = 'upload' | 'preview' | 'processing' | 'result';

export function ProductBatchImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: ProductBatchImportDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [updateExisting, setUpdateExisting] = useState<boolean>(true);
  const [previewData, setPreviewData] = useState<ProductImportItem[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 下载模板
  const handleDownloadTemplate = () => {
    const headers = [
      'SKU',
      '产品名称',
      '分类',
      '成本价格',
      '销售价格',
      '最小起订量',
      '供应商',
      '重量',
      '长度',
      '宽度',
      '高度',
    ];
    const csvContent = headers.join(',') + '\n' + 'SKU001,产品A,分类1,10.00,20.00,100,供应商甲,0.5,10,10,5\n' + 'SKU002,产品B,分类2,15.00,30.00,50,供应商乙,1.0,15,15,8';
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // 处理文件上传
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setFile(files[0]);
    }
  };

  // 拖放处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setFile(files[0]);
    }
  }, []);

  // 解析文件并预览
  const handlePreview = async () => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      const lines = content.split('\n').filter(line => line.trim());
      
      // 解析 CSV
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const data: ProductImportItem[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(',').map(v => v.trim());
        const item: any = {
          _rowIndex: i,
          _errors: [],
          _action: 'create',
        };
        
        // 根据表头映射字段
        headers.forEach((header, idx) => {
          if (header.includes('sku')) item.sku = values[idx];
          else if (header.includes('名称') || header.includes('name')) item.name = values[idx];
          else if (header.includes('分类') || header.includes('category')) item.category = values[idx];
          else if ((header.includes('成本') || header.includes('cost')) && header.includes('price')) item.costPrice = parseFloat(values[idx]);
          else if ((header.includes('销售') || header.includes('sale')) && header.includes('price')) item.salePrice = parseFloat(values[idx]);
          else if ((header.includes('最小') || header.includes('min')) && header.includes('order')) item.minOrderQty = parseInt(values[idx]);
          else if (header.includes('供应商') || header.includes('supplier')) item.supplier = values[idx];
          else if (header.includes('重量') || header.includes('weight')) item.weight = parseFloat(values[idx]);
          else if (header.includes('长度') || header.includes('length')) item.length = parseFloat(values[idx]);
          else if (header.includes('宽度') || header.includes('width')) item.width = parseFloat(values[idx]);
          else if (header.includes('高度') || header.includes('height')) item.height = parseFloat(values[idx]);
        });
        
        // 验证必填字段
        if (!item.sku) item._errors.push('SKU 为必填项');
        if (!item.name) item._errors.push('产品名称为必填项');
        
        // 判断动作
        if (item._errors.length > 0) {
          item._action = 'error';
        } else {
          // TODO: 检查 SKU 是否已存在（这里简化处理）
          item._action = item.sku ? 'create' : 'error';
        }
        
        data.push(item as ProductImportItem);
      }
      
      setPreviewData(data);
      // 默认选择所有非错误行
      const selected = new Set<number>();
      data.forEach((row, idx) => {
        if (row._action !== 'error') selected.add(idx);
      });
      setSelectedRows(selected);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  // 切换行选中状态
  const toggleRowSelection = (index: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedRows(newSelected);
  };

  // 执行导入
  const handleImport = async () => {
    setStep('processing');
    setProgress(0);
    const selectedData = previewData.filter((_, i) => selectedRows.has(i));
    
    // 模拟进度
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 90) {
          clearInterval(interval);
          return p;
        }
        return p + Math.random() * 15;
      });
    }, 200);
    
    try {
      const formData = new FormData();
      if (file) {
        formData.append('file', file);
      }
      formData.append('updateExisting', String(updateExisting));
      
      const response = await fetch('/api/products/batch/import', {
        method: 'POST',
        body: formData,
      });
      
      const importResult: BatchResult = await response.json();
      clearInterval(interval);
      setProgress(100);
      setResult(importResult);
      setStep('result');
      onImportComplete(importResult);
    } catch (error) {
      clearInterval(interval);
      setResult({
        total: selectedData.length,
        success: 0,
        failed: selectedData.length,
        skipped: 0,
        errors: [{ id: '', message: error instanceof Error ? error.message : '导入失败' }],
      });
      setStep('result');
    }
  };

  // 下载错误报告
  const downloadErrorReport = () => {
    if (!result || !previewData) return;
    const errors = previewData
      .map((row, i) => {
        if (row._errors.length > 0) {
          return `${row._rowIndex + 1},"${row.sku || ''}","${row.name || ''}","${row._errors.join('; ')}"`;
        }
        return null;
      })
      .filter(Boolean);
    
    if (errors.length === 0) return;
    
    const csvContent = '行号,SKU,产品名称,错误原因\n' + errors.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-errors-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 重置状态
  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setPreviewData([]);
    setSelectedRows(new Set());
    setResult(null);
    onOpenChange(false);
  };

  const getActionBadge = (action: ProductImportItem['_action']) => {
    switch (action) {
      case 'create':
        return <Badge className="bg-blue-500">新建</Badge>;
      case 'update':
        return <Badge className="bg-yellow-500">更新</Badge>;
      case 'skip':
        return <Badge className="bg-gray-500">跳过</Badge>;
      case 'error':
        return <Badge className="bg-red-500">错误</Badge>;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>批量导入产品</DialogTitle>
          <DialogDescription>
            通过 Excel/CSV 文件批量导入产品信息，支持新建和更新
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: 上传文件 */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center ${
                isDragging ? 'border-primary bg-primary/5' : 'border-gray-300'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="mb-2 text-sm text-gray-600">
                {file ? `已选择文件：${file.name}` : '拖拽文件到此处或点击选择'}
              </p>
              <p className="text-xs text-gray-400 mb-4">
                支持 .csv 格式，文件大小不超过 10MB
              </p>
              <label>
                <Button variant="outline" className="cursor-pointer">
                  <span>选择文件</span>
                  <input
                    type="file"
                    accept=".csv,.xlsx"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </Button>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                下载导入模板
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm">SKU 已存在时：</span>
                <RadioGroup
                  value={updateExisting ? 'update' : 'skip'}
                  onValueChange={(v) => setUpdateExisting(v === 'update')}
                  className="flex items-center gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="update" id="update" />
                    <Label htmlFor="update">更新</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="skip" id="skip" />
                    <Label htmlFor="skip">跳过</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: 预览数据 */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                共 {previewData.length} 条记录，已选择 {selectedRows.size} 条导入
              </p>
            </div>
            <div className="border rounded-lg max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedRows.size === previewData.length && previewData.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedRows(new Set(previewData.map((_, i) => i)));
                          } else {
                            setSelectedRows(new Set());
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead className="w-16">行号</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>产品名称</TableHead>
                    <TableHead className="w-20">操作</TableHead>
                    <TableHead>错误</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, index) => (
                    <TableRow
                      key={index}
                      className={row._errors.length > 0 ? 'bg-red-50' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedRows.has(index)}
                          disabled={row._action === 'error'}
                          onCheckedChange={() => toggleRowSelection(index)}
                        />
                      </TableCell>
                      <TableCell>{row._rowIndex + 1}</TableCell>
                      <TableCell>{row.sku || '-'}</TableCell>
                      <TableCell>{row.name || '-'}</TableCell>
                      <TableCell>{getActionBadge(row._action)}</TableCell>
                      <TableCell>
                        {row._errors.length > 0 ? (
                          <div className="flex items-center text-red-600 text-sm">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            {row._errors[0]}
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Step 3: 处理中 */}
        {step === 'processing' && (
          <div className="space-y-4 py-8">
            <Progress value={progress} className="w-full" />
            <p className="text-center text-sm text-muted-foreground">
              正在导入，请稍候...
            </p>
          </div>
        )}

        {/* Step 4: 导入结果 */}
        {step === 'result' && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="border rounded-lg p-4 text-center">
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-sm text-muted-foreground">总计</p>
              </div>
              <div className="border rounded-lg p-4 text-center bg-green-50">
                <p className="text-2xl font-bold text-green-600">{result.success}</p>
                <p className="text-sm text-muted-foreground">成功</p>
              </div>
              <div className="border rounded-lg p-4 text-center bg-yellow-50">
                <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
                <p className="text-sm text-muted-foreground">跳过</p>
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
                  {result.errors.slice(0, 10).map((err, i) => (
                    <li key={i}>{err.message}</li>
                  ))}
                  {result.errors.length > 10 && (
                    <li>...还有 {result.errors.length - 10} 个错误</li>
                  )}
                </ul>
              </div>
            )}

            {result.failed > 0 && (
              <div className="flex justify-end">
                <Button variant="outline" onClick={downloadErrorReport}>
                  <Download className="h-4 w-4 mr-2" />
                  下载错误报告
                </Button>
              </div>
            )}

            {result.success === result.total && (
              <div className="flex items-center justify-center p-4 text-green-600 bg-green-50 rounded-lg">
                <CheckCircle className="h-5 w-5 mr-2" />
                <span>全部导入成功！</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {step === 'result' ? '关闭' : '取消'}
          </Button>
          {step === 'upload' && (
            <Button
              onClick={handlePreview}
              disabled={!file}
            >
              下一步
            </Button>
          )}
          {step === 'preview' && (
            <Button
              onClick={() => setStep('upload')}
              variant="outline"
            >
              上一步
            </Button>
          )}
          {step === 'preview' && (
            <Button
              onClick={handleImport}
              disabled={selectedRows.size === 0}
            >
              开始导入
            </Button>
          )}
          {step === 'result' && result && result.success > 0 && (
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
