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
  AlertCircle,
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import Link from 'next/link';
import { ProductBatchImportDialog } from '@/components/batch-operations/ProductBatchImportDialog';
import { ProductBatchExportDialog } from '@/components/batch-operations/ProductBatchExportDialog';
import { ProductBatchDeleteDialog } from '@/components/batch-operations/ProductBatchDeleteDialog';
import type { BatchResult } from '@/components/batch-operations/ProductBatchImportDialog';

interface ProductCategory {
  id: string;
  name: string;
  code: string;
}

interface AttributeTemplate {
  id: string;
  name: string;
  nameEn?: string;
  code: string;
  categoryId: string;
  type: 'TEXT' | 'NUMBER' | 'DECIMAL' | 'BOOLEAN' | 'DATE' | 'SELECT' | 'MULTI_SELECT' | 'LONG_TEXT';
  unit?: string;
  options: string[];
  isRequired: boolean;
  isComparable: boolean;
  sortOrder: number;
  description?: string;
  validationRule?: string;
  defaultValue?: string;
  placeholder?: string;
  isActive: boolean;
}

interface ProductAttributeValue {
  id: string;
  productId: string;
  attributeId: string;
  valueText?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueDate?: string;
  valueOptions?: string[];
  unit?: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  nameEn?: string;
  category?: string;
  categoryName?: string;
  categoryId?: string;
  costPrice?: number;
  salePrice?: number;
  status: string;
  supplier?: string;
  supplierName?: string;
}

interface EditFormData {
  sku: string;
  name: string;
  nameEn?: string;
  category: string;
  categoryName: string;
  categoryId: string;
  costPrice: string;
  salePrice: string;
  status: string;
}

interface AttributeValueState {
  [attributeId: string]: any;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
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
    nameEn: '',
    category: '',
    categoryName: '',
    categoryId: '',
    costPrice: '',
    salePrice: '',
    status: 'active',
  });
  
  // 品类列表和属性相关状态
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [attributeTemplates, setAttributeTemplates] = useState<AttributeTemplate[]>([]);
  const [loadingAttributes, setLoadingAttributes] = useState(false);
  const [attributeValues, setAttributeValues] = useState<AttributeValueState>({});
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

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
    loadCategories();
  }, [search]);

  // 加载品类列表
  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const res = await fetch('/api/product-research/categories?isActive=true');
      const data = await res.json();
      if (data.success) {
        setProductCategories(data.data?.items ?? data.data ?? []);
      }
    } catch (error) {
      console.error('加载品类失败:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  // 加载品类属性模板
  const loadAttributeTemplates = async (categoryId: string) => {
    setLoadingAttributes(true);
    setAttributeValues({});
    try {
      const res = await fetch(`/api/product-research/templates?categoryId=${categoryId}&isActive=true`);
      const data = await res.json();
      if (data.success) {
        setAttributeTemplates(data.data?.items ?? data.data ?? []);
        // 设置默认值
        const defaults: AttributeValueState = {};
        data.data?.forEach((t: AttributeTemplate) => {
          if (t.defaultValue) {
            defaults[t.id] = t.defaultValue;
          } else if (t.type === 'MULTI_SELECT') {
            defaults[t.id] = [];
          } else if (t.type === 'BOOLEAN') {
            defaults[t.id] = 'false';
          }
        });
        setAttributeValues(defaults);
      } else {
        setAttributeTemplates([]);
      }
    } catch (error) {
      console.error('加载属性模板失败:', error);
      setAttributeTemplates([]);
    } finally {
      setLoadingAttributes(false);
    }
  };

  // 加载产品已有的属性值
  const loadProductAttributeValues = async (productId: string) => {
    try {
      const res = await fetch(`/api/products/${productId}/attributes`);
      const data = await res.json();
      if (data.success && data.data) {
        const values: AttributeValueState = {};
        data.data.forEach((av: ProductAttributeValue) => {
          if (av.valueText !== undefined && av.valueText !== null) {
            values[av.attributeId] = av.valueText;
          } else if (av.valueNumber !== undefined && av.valueNumber !== null) {
            values[av.attributeId] = av.valueNumber.toString();
          } else if (av.valueBoolean !== undefined && av.valueBoolean !== null) {
            values[av.attributeId] = av.valueBoolean.toString();
          } else if (av.valueOptions !== undefined && av.valueOptions !== null) {
            values[av.attributeId] = av.valueOptions;
          }
        });
        setAttributeValues(values);
      }
    } catch (error) {
      console.error('加载产品属性值失败:', error);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products?search=${search}`);
      const data = await res.json();
      setProducts(data.data?.items ?? data.data ?? []);
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
    if (categoryFilter === 'all') return products;
    return products.filter(product => {
      const cat = product.categoryName || product.category;
      return cat === categoryFilter;
    });
  };

  // 打开编辑对话框
  const openEditDialog = async (product: Product) => {
    setEditingProduct(product);
    setEditFormData({
      sku: product.sku,
      name: product.name,
      nameEn: product.nameEn || '',
      category: product.category || '',
      categoryName: product.categoryName || '',
      categoryId: product.categoryId || '',
      costPrice: product.costPrice?.toString() || '',
      salePrice: product.salePrice?.toString() || '',
      status: product.status,
    });
    setSelectedCategoryId(product.categoryId || '');
    setAttributeValues({});
    setAttributeTemplates([]);
    
    if (product.categoryId) {
      await loadAttributeTemplates(product.categoryId);
      await loadProductAttributeValues(product.id);
    }
    
    setEditDialogOpen(true);
  };

  // 品类变更处理
  const handleCategoryChange = async (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    const category = productCategories.find(c => c.id === categoryId);
    if (category) {
      setEditFormData(prev => ({
        ...prev,
        categoryId,
        category: category.code,
        categoryName: category.name,
      }));
      await loadAttributeTemplates(categoryId);
    } else {
      setAttributeTemplates([]);
      setAttributeValues({});
    }
  };

  // 渲染属性输入框
  const renderAttributeInput = (template: AttributeTemplate) => {
    const value = attributeValues[template.id] ?? template.defaultValue ?? '';
    const handleChange = (newValue: any) => {
      setAttributeValues(prev => ({
        ...prev,
        [template.id]: newValue,
      }));
    };

    const isTextType = template.type === 'TEXT' || template.type === 'LONG_TEXT';
    const isNumberType = template.type === 'NUMBER' || template.type === 'DECIMAL';
    const isMultiType = template.type === 'MULTI_SELECT';

    switch (template.type) {
      case 'TEXT':
      case 'LONG_TEXT':
        return (
          <Input
            placeholder={template.placeholder || '请输入'}
            value={value as string}
            onChange={(e) => handleChange(e.target.value)}
          />
        );

      case 'NUMBER':
      case 'DECIMAL':
        return (
          <Input
            type="number"
            step="0.01"
            placeholder={template.placeholder || '请输入数字'}
            value={value as string}
            onChange={(e) => handleChange(e.target.value)}
          />
        );

      case 'DATE':
        return (
          <Input
            type="date"
            value={value as string}
            onChange={(e) => handleChange(e.target.value)}
          />
        );

      case 'SELECT':
        return (
          <Select value={value as string} onValueChange={handleChange}>
            <SelectTrigger>
              <SelectValue placeholder="请选择" />
            </SelectTrigger>
            <SelectContent>
              {template.options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'MULTI_SELECT':
        return (
          <div className="flex flex-wrap gap-2">
            {template.options.map((option) => {
              const selected = (value as string[]) || [];
              const isSelected = selected.includes(option);
              return (
                <Badge
                  key={option}
                  variant={isSelected ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => {
                    const current = (value as string[]) || [];
                    if (isSelected) {
                      handleChange(current.filter(o => o !== option));
                    } else {
                      handleChange([...current, option]);
                    }
                  }}
                >
                  {option}
                </Badge>
              );
            })}
          </div>
        );

      case 'BOOLEAN':
        return (
          <RadioGroup
            value={(value as string) || 'false'}
            onValueChange={handleChange}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="true" id={`${template.id}-true`} />
              <Label htmlFor={`${template.id}-true`}>是</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="false" id={`${template.id}-false`} />
              <Label htmlFor={`${template.id}-false`}>否</Label>
            </div>
          </RadioGroup>
        );

      default:
        return <Input placeholder="暂不支持的类型" disabled />;
    }
  };

  // 保存产品编辑
  const handleSaveEdit = async () => {
    if (!editingProduct) return;

    // 验证必填属性
    const requiredTemplates = attributeTemplates.filter(t => t.isRequired);
    for (const template of requiredTemplates) {
      const value = attributeValues[template.id];
      if (!value || (Array.isArray(value) && value.length === 0)) {
        alert(`请填写必填属性：${template.name}`);
        return;
      }
    }

    // 验证必填字段
    if (!editFormData.sku || !editFormData.name) {
      alert('SKU 和产品名称为必填项');
      return;
    }

    try {
      // 整理属性值数据
      const attributes = Object.entries(attributeValues).map(([attributeId, value]) => {
        const template = attributeTemplates.find(t => t.id === attributeId);
        if (!template) return null;

        const result: any = { attributeId };

        switch (template.type) {
          case 'TEXT':
          case 'LONG_TEXT':
            result.valueText = value as string;
            break;
          case 'NUMBER':
          case 'DECIMAL':
            result.valueNumber = value ? parseFloat(value as string) : null;
            break;
          case 'BOOLEAN':
            result.valueBoolean = value === 'true';
            break;
          case 'DATE':
            result.valueDate = value as string;
            break;
          case 'MULTI_SELECT':
            result.valueOptions = value as string[];
            break;
          case 'SELECT':
            result.valueText = value as string;
            break;
        }

        return result;
      }).filter(Boolean);

      const response = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: editFormData.sku,
          name: editFormData.name,
          nameEn: editFormData.nameEn,
          category: editFormData.category,
          categoryName: editFormData.categoryName,
          categoryId: editFormData.categoryId || undefined,
          costPrice: editFormData.costPrice ? parseFloat(editFormData.costPrice) : undefined,
          salePrice: editFormData.salePrice ? parseFloat(editFormData.salePrice) : undefined,
          status: editFormData.status,
          attributes: attributes,
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
    <div className="w-full px-4 md:px-6 lg:px-8 py-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-2xl">产品管理</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setExportDialogOpen(true)}>
                <Download className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">批量导出</span>
                <span className="sm:hidden">导出</span>
              </Button>
              <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">批量导入</span>
                <span className="sm:hidden">导入</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={selectedCount === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">批量删除</span>
                <span className="sm:hidden">删除</span>
              </Button>
              <Link href="/products/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">新建产品</span>
                  <span className="sm:hidden">新建</span>
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 搜索和筛选栏 */}
          <div className="mb-6 flex flex-col sm:flex-row flex-wrap gap-4 items-end">
            <div className="w-full sm:w-auto">
              <Label className="mb-2 block text-sm font-medium">搜索</Label>
              <Input
                placeholder="搜索 SKU / 产品名称..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-[280px]"
              />
            </div>
            <div className="w-full sm:w-auto">
              <Label className="mb-2 block text-sm font-medium">分类筛选</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="全部分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部分类</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {categoryFilter !== 'all' && (
              <div className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="default"
                  onClick={() => setCategoryFilter('all')}
                  className="w-full sm:w-auto"
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
                  <Card 
                    key={product.id} 
                    className="hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
                    onClick={() => openEditDialog(product)}
                  >
                    <CardContent className="p-4">
                      {/* 头部：选择框 + SKU + 编辑按钮 */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Checkbox
                            checked={selectedIds.has(product.id)}
                            onCheckedChange={() => toggleSelection(product.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-sm font-mono text-muted-foreground break-all">
                            {product.sku}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-7 w-7 shrink-0"
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
                      <div className="flex items-center justify-end">
                        <Badge variant={product.status === 'active' ? 'default' : 'outline'}>
                          {product.status === 'active' ? '在售' : product.status}
                        </Badge>
                      </div>
                    </CardContent>
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
                  <Label>英文名称</Label>
                  <Input
                    value={editFormData.nameEn}
                    onChange={(e) => setEditFormData({ ...editFormData, nameEn: e.target.value })}
                    placeholder="产品英文名称"
                  />
                </div>
                <div>
                  <Label>品类 *</Label>
                  <Select
                    value={editFormData.categoryId}
                    onValueChange={handleCategoryChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="请选择品类" />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingCategories ? (
                        <SelectItem value="loading" disabled>加载中...</SelectItem>
                      ) : (
                        productCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
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

              {/* 品类属性区域 */}
              {selectedCategoryId && (
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-4">品类属性</h4>
                  {loadingAttributes ? (
                    <div className="text-center py-4 text-muted-foreground">
                      加载属性模板中...
                    </div>
                  ) : attributeTemplates.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        该品类暂无属性模板，请先在品类管理中配置属性。
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-4">
                      {attributeTemplates
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((template) => (
                          <div key={template.id} className="p-4 border rounded-lg space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="font-medium">
                                {template.name}
                                {template.isRequired && <span className="text-destructive ml-1">*</span>}
                              </Label>
                              <Badge variant="outline">{template.type}</Badge>
                            </div>

                            {template.description && (
                              <p className="text-sm text-muted-foreground">
                                {template.description}
                              </p>
                            )}

                            {renderAttributeInput(template)}
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              )}
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
