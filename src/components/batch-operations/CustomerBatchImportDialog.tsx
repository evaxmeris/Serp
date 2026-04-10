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
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Upload, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface CustomerImportItem {
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  country?: string;
  address?: string;
  source?: string;
  tags?: string;
  salesRepId?: string;
  _rowIndex: number;
  _errors: string[];
  _action: 'create' | 'update' | 'skip' | 'error';
}

export interface CustomerBatchResult {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ id: string; message: string }>;
}

interface CustomerBatchImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (result: CustomerBatchResult) => void;
  salesReps?: Array<{ id: string; name: string }>;
}

type Step = 'upload' | 'preview' | 'processing' | 'result';

export function CustomerBatchImportDialog({
  open,
  onOpenChange,
  onImportComplete,
  salesReps = [],
}: CustomerBatchImportDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [updateExisting, setUpdateExisting] = useState<boolean>(true);
  const [assignSalesRepId, setAssignSalesRepId] = useState<string>('');
  const [previewData, setPreviewData] = useState<CustomerImportItem[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<CustomerBatchResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 下载模板
  const handleDownloadTemplate = () => {
    const headers = [
      '公司名称',
      '联系人',
      '邮箱',
      '电话',
      '公司网址',
      '国家/地区',
      '地址',
      '客户来源',
      '标签',
    ];
    const csvContent = headers.join(',') + '\n' + 'ABC Trading,John Smith,john@abc.com,+1234567890,https://abc.com,United States,123 Business St,Trade Show,VIP,潜在客户\n' + 'XYZ Inc,Mary Brown,mary@xyz.com,+0987654321,https://xyz.com,China,456 Industry Rd,Online Search,';
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer-import-template.csv';
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
      const data: CustomerImportItem[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // 处理带引号的 CSV（简单处理）
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let j = 0; j < line.length; j++) {
          if (line[j] === '"') {
            inQuotes = !inQuotes;
          } else if (line[j] === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += line[j];
          }
        }
        values.push(current.trim());
        
        const item: any = {
          _rowIndex: i,
          _errors: [],
          _action: 'create',
        };
        
        // 根据表头映射字段
        headers.forEach((header, idx) => {
          if (header.includes('公司') || header.includes('name') || header.includes('客户')) item.companyName = values[idx];
          else if (header.includes('联系') || header.includes('contact')) item.contactName = values[idx];
          else if (header.includes('邮箱') || header.includes('email')) item.email = values[idx];
          else if (header.includes('电话') || header.includes('phone')) item.phone = values[idx];
          else if (header.includes('网址') || header.includes('website')) item.website = values[idx];
          else if (header.includes('国家') || header.includes('country') || header.includes('地区')) item.country = values[idx];
          else if (header.includes('地址') || header.includes('address')) item.address = values[idx];
          else if (header.includes('来源') || header.includes('source')) item.source = values[idx];
          else if (header.includes('标签') || header.includes('tag')) item.tags = values[idx];
        });
        
        // 验证必填字段
        if (!item.companyName) item._errors.push('公司名称为必填项');
        
        // 验证邮箱格式
        if (item.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)) {
          item._errors.push('邮箱格式不正确');
        }
        
        // 判断动作
        if (item._errors.length > 0) {
          item._action = 'error';
        } else {
          // TODO: 检查邮箱是否已存在（这里简化处理）
          item._action = item.email ? 'create' : 'error';
        }
        
        data.push(item as CustomerImportItem);
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
      if (assignSalesRepId) {
        formData.append('assignSalesRepId', assignSalesRepId);
      }
      
      const response = await fetch('/api/customers/batch/import', {
        method: 'POST',
        body: formData,
      });
      
      const importResult: CustomerBatchResult = await response.json();
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
          return `${row._rowIndex + 1},"${row.companyName || ''}","${row.email || ''}","${row._errors.join('; ')}"`;
        }
        return null;
      })
      .filter(Boolean);
    
    if (errors.length === 0) return;
    
    const csvContent = '行号,公司名称,邮箱,错误原因\n' + errors.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer-import-errors-${Date.now()}.csv`;
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

  const getActionBadge = (action: CustomerImportItem['_action']) => {
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
          <DialogTitle>批量导入客户</DialogTitle>
          <DialogDescription>
            通过 Excel/CSV 文件批量导入客户信息，支持新建和更新
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

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  下载导入模板
                </Button>
                <div className="flex items-center gap-2">
                  <span className="text-sm">邮箱已存在时：</span>
                  <RadioGroup
                    value={updateExisting ? 'update' : 'skip'}
                    onValueChange={(v) => setUpdateExisting(v === 'update')}
                    className="flex items-center gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="update" id="update-customer" />
                      <Label htmlFor="update-customer">更新</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="skip" id="skip-customer" />
                      <Label htmlFor="skip-customer">跳过</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {salesReps.length > 0 && (
                <div className="flex items-center gap-4">
                  <Label className="min-w-[120px]">统一分配业务员：</Label>
                  <select
                    className="flex-1 px-3 py-2 border rounded-md"
                    value={assignSalesRepId}
                    onChange={(e) => setAssignSalesRepId(e.target.value)}
                  >
                    <option value="">不分配</option>
                    {salesReps.map(rep => (
                      <option key={rep.id} value={rep.id}>{rep.name}</option>
                    ))}
                  </select>
                </div>
              )}
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
                    <TableHead>公司名称</TableHead>
                    <TableHead>联系人</TableHead>
                    <TableHead>邮箱</TableHead>
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
                      <TableCell>{row.companyName || '-'}</TableCell>
                      <TableCell>{row.contactName || '-'}</TableCell>
                      <TableCell>{row.email || '-'}</TableCell>
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
