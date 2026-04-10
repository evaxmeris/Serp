'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Download,
  Upload,
  Trash2,
  Plus,
  CheckSquare,
  Square,
  Edit,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { ProductBatchImportDialog } from '@/components/batch-operations/ProductBatchImportDialog';
import { ProductBatchExportDialog } from '@/components/batch-operations/ProductBatchExportDialog';
import { ProductBatchDeleteDialog } from '@/components/batch-operations/ProductBatchDeleteDialog';
import type { BatchResult } from '@/components/batch-operations/ProductBatchImportDialog';

interface Product {
  id: string;
  sku: string;
  name: string;
  category?: string;
  categoryName?: string;
  costPrice?: number;
  salePrice?: number;
  status: string;
  supplier?: string;
  supplierName?: string;
}

interface EditFormData {
  sku: string;
  name: string;
  category: string;
  categoryName: string;
  costPrice: string;
  salePrice: string;
  status: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [totalFiltered, setTotalFiltered] = useState(0);
  
  // 弹窗状态
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({
    sku: '',
    name: '',
    category: '',
    categoryName: '',
    costPrice: '',
    salePrice: '',
    status: 'active',
  });

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + A 全选
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        if (products.length > 0 && products.length === selectedIds.size) {
          setSelectedIds(new Set());
        } else {
          setSelectedIds(new Set(products.map(p => p.id)));
        }
        e.preventDefault();
      }
      // Esc 取消选择
      if (e.key === 'Escape') {
        setSelectedIds(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, selectedIds]);

  // 获取产品列表
  useEffect(() => {
    fetchProducts();
  }, [search]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products?search=${search}`);
      const data = await res.json();
      setProducts(data.data || []);
      setTotalFiltered(data.pagination?.total || data.data?.length || 0);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取所有分类（用于筛选下拉框）
  const getAllCategories = (): string[] => {
    const categories = new Set<string>();
    products.forEach(product => {
      const cat = product.categoryName || product.category;
      if (cat) categories.add(cat);
    });
    return Array.from(categories).sort();
  };

  // 筛选后的产品
  const getFilteredProducts = (): Product[] => {
    if (!categoryFilter) return products;
    return products.filter(product => {
      const cat = product.categoryName || product.category;
      return cat === categoryFilter;
    });
  };

  // 打开编辑对话框
  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setEditFormData({
      sku: product.sku,
      name: product.name,
      category: product.category || '',
      categoryName: product.categoryName || '',
      costPrice: product.costPrice?.toString() || '',
      salePrice: product.salePrice?.toString() || '',
      status: product.status,
    });
    setEditDialogOpen(true);
  };

  // 保存产品编辑
  const handleSaveEdit = async () => {
    if (!editingProduct) return;

    // 验证必填字段
    if (!editFormData.sku || !editFormData.name) {
      alert('SKU 和产品名称为必填项');
      return;
    }

    try {
      const response = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: editFormData.sku,
          name: editFormData.name,
          category: editFormData.category || undefined,
          categoryName: editFormData.categoryName || undefined,
          costPrice: editFormData.costPrice ? parseFloat(editFormData.costPrice) : undefined,
          salePrice: editFormData.salePrice ? parseFloat(editFormData.salePrice) : undefined,
          status: editFormData.status,
        }),
      });

      const result = await response.json();
      if (result.success) {
        alert('产品更新成功');
        setEditDialogOpen(false);
        fetchProducts();
      } else {
        alert(result.error || '更新失败');
      }
    } catch (error) {
      console.error('Failed to update product:', error);
      alert('更新失败');
    }
  };

  // 切换选中状态
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (products.length === selectedIds.size) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p.id)));
    }
  };

  // 处理批量导入完成
  const handleImportComplete = (result: BatchResult) => {
    if (result.success > 0) {
      // 刷新列表
      setTimeout(() => {
        fetchProducts();
      }, 500);
    }
  };

  // 处理批量导出
  const handleExport = async (ids: string[] | undefined, fields: string[]) => {
    try {
      const response = await fetch('/api/products/batch/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: ids || Array.from(selectedIds),
          fields,
          filters: search ? { search } : undefined,
        }),
      });
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products-${Date.now()}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('导出失败');
      console.error('Export failed:', error);
    }
  };

  // 处理批量删除
  const handleDelete = async (cascade: boolean) => {
    try {
      const response = await fetch('/api/products/batch/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          cascade,
        }),
      });

      const result = await response.json();
      if (result.success) {
        alert(`删除完成：成功 ${result.success} 个，失败 ${result.failed} 个`);
        setSelectedIds(new Set());
        fetchProducts();
      } else {
        alert('删除失败：' + (result.error || '未知错误'));
      }
    } catch (error) {
      alert('删除失败');
      console.error('Delete failed:', error);
    }
  };

  const selectedCount = selectedIds.size;
  const categories = getAllCategories();
  const filteredProducts = getFilteredProducts();

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">产品管理</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setExportDialogOpen(true)}>
                <Download className="h-4 w-4 mr-2" />
                批量导出
              </Button>
              <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                批量导入
              </Button>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={selectedCount === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                批量删除
              </Button>
              <Link href="/products/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  新建产品
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 搜索和筛选栏 */}
          <div className="mb-6 flex flex-wrap gap-4 items-end">
            <div>
              <Label className="mb-2 block text-sm font-medium">搜索</Label>
              <Input
                placeholder="搜索 SKU / 产品名称..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-[280px]"
              />
            </div>
            <div>
              <Label className="mb-2 block text-sm font-medium">分类筛选</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="全部分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部分类</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {categoryFilter && (
              <div>
                <Button
                  variant="outline"
                  size="default"
                  onClick={() => setCategoryFilter('')}
                >
                  清除筛选
                </Button>
              </div>
            )}
          </div>

          {/* 加载状态 */}
          {loading && (
            <div className="text-center py-8 text-muted-foreground">
              加载中...
            </div>
          )}

          {/* 产品列表 - 卡片网格布局 */}
          {!loading && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map((product) => (
                  <Card key={product.id} className="hover:shadow-md transition-shadow cursor-pointer overflow-hidden">
                    <CardContent className="p-4">
                      {/* 头部：选择框 + SKU + 编辑按钮 */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedIds.has(product.id)}
                            onCheckedChange={() => toggleSelection(product.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-sm font-mono text-muted-foreground">
                            {product.sku}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(product);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* 产品名称 */}
                      <h3 className="font-semibold text-base mb-2 line-clamp-2">
                        {product.name}
                      </h3>

                      {/* 分类 */}
                      <div className="mb-3">
                        {(product.categoryName || product.category) ? (
                          <Badge variant="secondary">
                            {product.categoryName || product.category}
                          </Badge>
                        ) : (
                          <Badge variant="outline">未分类</Badge>
                        )}
                      </div>

                      {/* 价格信息 */}
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div>
                          <div className="text-muted-foreground">成本价</div>
                          <div className="font-medium">
                            {product.costPrice ? `¥${Number(product.costPrice).toFixed(2)}` : '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">销售价</div>
                          <div className="font-medium text-green-600">
                            {product.salePrice ? `¥${Number(product.salePrice).toFixed(2)}` : '-'}
                          </div>
                        </div>
                      </div>

                      {/* 供应商 */}
                      {(product.supplierName || product.supplier) && (
                        <div className="text-sm text-muted-foreground mb-3">
                          供应商：{product.supplierName || product.supplier}
                        </div>
                      )}

                      {/* 状态 */}
                      <div className="flex items-center justify-between">
                        <Badge variant={product.status === 'active' ? 'default' : 'outline'}>
                          {product.status === 'active' ? '在售' : product.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          点击编辑
                        </span>
                      </div>
                    </CardContent>
                    <CardFooter className="bg-muted/50 p-2 px-4" onClick={() => openEditDialog(product)}>
                      <div className="flex items-center justify-between w-full text-sm text-muted-foreground">
                        <span>ID: {product.id.slice(0, 8)}...</span>
                        <Edit className="h-4 w-4" />
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>

              {filteredProducts.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="text-4xl mb-2">📦</div>
                  <p>暂无产品数据</p>
                  {categoryFilter && (
                    <p className="text-sm mt-1">当前筛选条件：{categoryFilter}</p>
                  )}
                </div>
              )}
            </>
          )}

          {/* 底部悬浮批量操作栏 */}
          {selectedCount > 0 && (
            <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg p-4 z-50">
              <div className="container mx-auto flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selectedCount === products.length ? (
                    <CheckSquare className="h-5 w-5 text-primary" />
                  ) : (
                    <Square className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="font-medium">
                    已选择 {selectedCount} / {products.length} 项
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setSelectedIds(new Set())}>
                    取消选择 (Esc)
                  </Button>
                  <Button variant="outline" onClick={() => setExportDialogOpen(true)}>
                    <Download className="h-4 w-4 mr-2" />
                    导出选中
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    删除选中
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 批量导入弹窗 */}
      <ProductBatchImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={handleImportComplete}
      />

      {/* 批量导出弹窗 */}
      <ProductBatchExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        selectedCount={selectedCount}
        totalFiltered={totalFiltered}
        onExport={handleExport}
      />

      {/* 批量删除弹窗 */}
      <ProductBatchDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        selectedIds={Array.from(selectedIds)}
        onDelete={handleDelete}
      />

      {/* 编辑产品弹窗 */}
      {editDialogOpen && (
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>编辑产品</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>SKU *</Label>
                  <Input
                    value={editFormData.sku}
                    onChange={(e) => setEditFormData({ ...editFormData, sku: e.target.value })}
                    placeholder="产品 SKU"
                  />
                </div>
                <div>
                  <Label>产品名称 *</Label>
                  <Input
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    placeholder="产品名称"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>分类编码</Label>
                  <Input
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    placeholder="分类编码"
                  />
                </div>
                <div>
                  <Label>分类名称</Label>
                  <Input
                    value={editFormData.categoryName}
                    onChange={(e) => setEditFormData({ ...editFormData, categoryName: e.target.value })}
                    placeholder="分类名称"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>成本价</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editFormData.costPrice}
                    onChange={(e) => setEditFormData({ ...editFormData, costPrice: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>销售价</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editFormData.salePrice}
                    onChange={(e) => setEditFormData({ ...editFormData, salePrice: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <Label>状态</Label>
                <Select
                  value={editFormData.status}
                  onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">在售</SelectItem>
                    <SelectItem value="inactive">下架</SelectItem>
                    <SelectItem value="discontinued">停产</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSaveEdit} className="bg-blue-500 hover:bg-blue-600">
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 给底部操作栏留空间 */}
      {selectedCount > 0 && <div className="h-20" />}
    </div>
  );
}
