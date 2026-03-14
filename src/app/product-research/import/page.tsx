'use client';

/**
 * 数据导入页面 - Data Import
 * 
 * 功能：
 * - Excel 模板下载
 * - 文件上传（Excel/CSV）
 * - 数据预览和验证
 * - 批量导入到数据库
 * 
 * 路由：/product-research/import
 * 作者：Trade ERP 开发团队
 * 创建日期：2026-03-13
 * 
 * @note 纯客户端组件（避免 xlsx 库与 Next.js 静态生成冲突）
 */

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Download, Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import * as XLSX from 'xlsx';

// ============================================
// 类型定义
// ============================================

interface ImportRow {
  rowNumber: number;
  data: Record<string, string>;
  isValid: boolean;
  errors: string[];
}

interface ImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  data: ImportRow[];
  fileName: string;
}

interface Category {
  id: string;
  name: string;
  code: string;
}

// ============================================
// 主组件（纯客户端）
// ============================================

export default function ImportPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // ============================================
  // 加载品类列表
  // ============================================

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/product-research/categories');
      const result = await response.json();
      if (result.success) {
        setCategories(result.data);
      }
    } catch (error) {
      console.error('加载品类失败:', error);
    }
  };

  // ============================================
  // 模板下载
  // ============================================

  const handleDownloadTemplate = () => {
    const template = [
      {
        '产品名称 *': 'iPhone 15 Pro',
        '英文名称': 'iPhone 15 Pro',
        '品牌 *': 'Apple',
        '型号': 'A3108',
        '品类编码 *': 'electronics-phone',
        '成本价 *': '800',
        '销售价 *': '999',
        '货币': 'USD',
        '来源平台': 'Amazon',
        '状态': 'IN_PROGRESS',
        '调研结论': 'recommended',
        '结论文案': '市场需求高，毛利率良好',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '产品数据模板');

    const guide = [
      ['导入说明'],
      ['1. 带 * 的字段为必填项'],
      ['2. 品类编码请参考系统内的品类列表'],
      ['3. 价格字段只需填写数字，不要带货币符号'],
      ['4. 状态可选值：DRAFT, IN_PROGRESS, REVIEW, APPROVED, REJECTED, ARCHIVED'],
      ['5. 调研结论可选值：recommended, alternative, eliminated'],
      ['6. 支持 .xlsx, .xls, .csv 格式'],
    ];
    const wsGuide = XLSX.utils.aoa_to_sheet(guide);
    XLSX.utils.book_append_sheet(wb, wsGuide, '导入说明');

    XLSX.writeFile(wb, '产品导入模板.xlsx');
  };

  // ============================================
  // 文件上传和解析
  // ============================================

  const handleFileUpload = useCallback(async (file: File) => {
    try {
      setLoading(true);
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (!['xlsx', 'xls', 'csv'].includes(fileExtension || '')) {
        alert('不支持的文件格式，请上传 .xlsx, .xls 或 .csv 文件');
        setLoading(false);
        return;
      }

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        alert('文件为空，请检查文件内容');
        setLoading(false);
        return;
      }

      const validatedData = validateImportData(jsonData);

      setPreview({
        totalRows: validatedData.length,
        validRows: validatedData.filter(r => r.isValid).length,
        invalidRows: validatedData.filter(r => !r.isValid).length,
        data: validatedData,
        fileName: file.name,
      });

      setLoading(false);
    } catch (error) {
      console.error('文件解析失败:', error);
      alert('文件解析失败，请检查文件格式');
      setLoading(false);
    }
  }, []);

  // ============================================
  // 验证导入数据
  // ============================================

  const validateImportData = (data: any[]): ImportRow[] => {
    return data.map((row, index) => {
      const errors: string[] = [];

      // 必填字段验证
      if (!row['产品名称 *']) errors.push('缺少产品名称');
      if (!row['品牌 *']) errors.push('缺少品牌');
      if (!row['品类编码 *']) errors.push('缺少品类编码');
      if (!row['成本价 *']) errors.push('缺少成本价');
      if (!row['销售价 *']) errors.push('缺少销售价');

      // 价格格式验证
      if (row['成本价 *'] && isNaN(parseFloat(row['成本价 *']))) {
        errors.push('成本价格式错误');
      }
      if (row['销售价 *'] && isNaN(parseFloat(row['销售价 *']))) {
        errors.push('销售价格式错误');
      }

      // 品类编码验证
      if (row['品类编码 *'] && !categories.find(c => c.code === row['品类编码 *'])) {
        errors.push('品类编码不存在');
      }

      return {
        rowNumber: index + 2, // Excel 行号从 2 开始（第 1 行是表头）
        data: row,
        isValid: errors.length === 0,
        errors,
      };
    });
  };

  // ============================================
  // 批量导入
  // ============================================

  const handleImport = async () => {
    if (!preview) return;

    try {
      setImporting(true);
      setImportProgress(0);

      const validData = preview.data.filter(r => r.isValid);
      const products = validData.map(row => ({
        name: row.data['产品名称 *'],
        nameEn: row.data['英文名称'] || '',
        brand: row.data['品牌 *'],
        brandEn: '',
        model: row.data['型号'] || '',
        manufacturer: '',
        sourcePlatform: row.data['来源平台'] || '',
        costPrice: parseFloat(row.data['成本价 *']),
        salePrice: parseFloat(row.data['销售价 *']),
        currency: row.data['货币'] || 'USD',
        categoryId: categories.find(c => c.code === row.data['品类编码 *'])?.id || '',
        status: row.data['状态'] || 'DRAFT',
        conclusion: row.data['调研结论'] || null,
        conclusionReason: '',
        assignedTo: '',
        notes: '',
      }));

      // 分批导入（每批 50 个）
      const batchSize = 50;
      const totalBatches = Math.ceil(products.length / batchSize);

      for (let i = 0; i < totalBatches; i++) {
        const start = i * batchSize;
        const end = Math.min(start + batchSize, products.length);
        const batch = products.slice(start, end);

        const response = await fetch('/api/product-research/products/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products: batch }),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(`第${i + 1}批导入失败：${result.error}`);
        }

        setImportProgress(Math.round(((i + 1) / totalBatches) * 100));
      }

      alert(`导入成功！共导入 ${validData.length} 条产品数据`);
      setIsConfirmDialogOpen(false);
      setPreview(null);
      router.push('/product-research/products');

    } catch (error) {
      console.error('导入失败:', error);
      alert('导入失败：' + (error as Error).message);
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  };

  // ============================================
  // 拖拽上传处理
  // ============================================

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
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  // ============================================
  // 导出功能
  // ============================================

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      const response = await fetch('/api/product-research/products?limit=1000');
      const result = await response.json();

      if (!result.success) {
        alert('获取数据失败');
        return;
      }

      const products = result.data;
      const exportData = products.map((p: any) => ({
        '产品名称': p.name,
        '英文名称': p.nameEn || '',
        '品牌': p.brand || '',
        '型号': p.model || '',
        '品类': p.category?.name || '',
        '成本价': p.costPrice || '',
        '销售价': p.salePrice || '',
        '货币': p.currency,
        '状态': p.status,
        '调研结论': p.conclusion || '',
        '创建时间': new Date(p.createdAt).toLocaleString('zh-CN'),
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '产品数据');

      const fileName = format === 'excel'
        ? `产品数据导出-${new Date().toLocaleDateString('zh-CN')}.xlsx`
        : `产品数据导出-${new Date().toLocaleDateString('zh-CN')}.csv`;

      if (format === 'excel') {
        XLSX.writeFile(wb, fileName);
      } else {
        const csv = XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
      }

      alert(`导出成功！共 ${products.length} 条产品数据`);
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败，请重试');
    }
  };

  // ============================================
  // 页面渲染
  // ============================================

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      {/* 页面头部 */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => router.push('/product-research/products')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回列表
        </Button>
        <h1 className="text-2xl font-bold">数据导入导出</h1>
      </div>

      {/* 数据导入卡片 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            数据导入
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 步骤 1：下载模板 */}
          <div>
            <h3 className="text-lg font-semibold mb-2">1. 下载模板</h3>
            <Button onClick={handleDownloadTemplate} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              下载 Excel 模板
            </Button>
          </div>

          {/* 步骤 2：上传文件 */}
          <div>
            <h3 className="text-lg font-semibold mb-2">2. 上传文件</h3>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <div className="text-lg font-medium">点击选择文件 或 拖拽到此处</div>
                <div className="text-sm text-gray-500 mt-2">支持格式：.xlsx, .xls, .csv</div>
              </label>
            </div>
          </div>

          {/* 步骤 3：数据预览 */}
          {preview && (
            <div>
              <h3 className="text-lg font-semibold mb-2">3. 数据预览</h3>
              <div className="mb-4 flex items-center gap-4 flex-wrap">
                <Badge variant="secondary">文件：{preview.fileName}</Badge>
                <Badge variant="secondary">总计：{preview.totalRows} 条</Badge>
                <Badge className="bg-green-100 text-green-800">有效：{preview.validRows} 条</Badge>
                <Badge variant="destructive">无效：{preview.invalidRows} 条</Badge>
              </div>

              <div className="border rounded-md max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>行号</TableHead>
                      <TableHead>产品名称</TableHead>
                      <TableHead>品牌</TableHead>
                      <TableHead>品类编码</TableHead>
                      <TableHead>成本价</TableHead>
                      <TableHead>销售价</TableHead>
                      <TableHead>验证结果</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.data.slice(0, 100).map((row) => (
                      <TableRow key={row.rowNumber}>
                        <TableCell className="text-sm text-gray-500">{row.rowNumber}</TableCell>
                        <TableCell className="font-medium">{row.data['产品名称 *'] || '-'}</TableCell>
                        <TableCell>{row.data['品牌 *'] || '-'}</TableCell>
                        <TableCell>{row.data['品类编码 *'] || '-'}</TableCell>
                        <TableCell>{row.data['成本价 *'] || '-'}</TableCell>
                        <TableCell>{row.data['销售价 *'] || '-'}</TableCell>
                        <TableCell>
                          {row.isValid ? (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              有效
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              无效
                            </Badge>
                          )}
                          {row.errors.length > 0 && (
                            <div className="text-xs text-red-500 mt-1">{row.errors.join('，')}</div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {preview.data.length > 100 && (
                <p className="text-sm text-gray-500 mt-2">仅显示前 100 条，共 {preview.data.length} 条</p>
              )}

              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setPreview(null)}>取消</Button>
                <Button onClick={() => setIsConfirmDialogOpen(true)} disabled={preview.validRows === 0}>
                  导入有效数据（{preview.validRows} 条）
                </Button>
              </div>
            </div>
          )}

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <div className="text-gray-600">正在解析文件...</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 数据导出卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            数据导出
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 mb-4">导出产品数据为 CSV 或 Excel 格式</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleExport('csv')}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              导出 CSV
            </Button>
            <Button variant="outline" onClick={() => handleExport('excel')}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              导出 Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 导入确认对话框 */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认导入</DialogTitle>
            <DialogDescription>
              确定要导入 {preview?.validRows} 条产品数据吗？
              {preview && preview.invalidRows > 0 && (
                <div className="mt-2 text-orange-600">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  注意：有 {preview.invalidRows} 条无效数据将被跳过
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)} disabled={importing}>取消</Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? '导入中...' : '确认导入'}
            </Button>
          </DialogFooter>
          {importing && (
            <div className="mt-4">
              <Progress value={importProgress} className="w-full" />
              <p className="text-sm text-center mt-2">{importProgress}%</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
