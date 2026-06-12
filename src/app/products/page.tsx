'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Download,
  Upload,
  Trash2,
  Plus,
  CheckSquare,
  Square,
  Edit,
  Eye,
  AlertCircle,
  Building2,
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirmation-dialog';
import Link from 'next/link';
import { useSortable, SortIndicator } from '@/hooks/use-sortable';
import { ProductBatchImportDialog } from '@/components/batch-operations/ProductBatchImportDialog';
import { ProductBatchExportDialog } from '@/components/batch-operations/ProductBatchExportDialog';
import { ProductBatchDeleteDialog } from '@/components/batch-operations/ProductBatchDeleteDialog';
import type { BatchResult } from '@/components/batch-operations/ProductBatchImportDialog';
import ProductSupplierSection from '@/components/suppliers/ProductSupplierSection';

interface ProductCategory {
  id: string;
  name: string;
  code: string;
  parentId?: string;
  level: number;
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
  images?: string[];
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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [totalFiltered, setTotalFiltered] = useState(0);
  
  // 弹窗状态
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  // 供应商管理弹窗
  const [supplierDialogProductId, setSupplierDialogProductId] = useState<string | null>(null);
  const [supplierDialogProductName, setSupplierDialogProductName] = useState('');
  const { toast, toasts, removeToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

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
  // 产品图片管理
  const [editImages, setEditImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // 品类列表和属性相关状态
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [attributeTemplates, setAttributeTemplates] = useState<AttributeTemplate[]>([]);
  const [loadingAttributes, setLoadingAttributes] = useState(false);
  const [attributeValues, setAttributeValues] = useState<AttributeValueState>({});
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  // 级联品类选择状态（三级：主品类level1 → 子品类level2 → 三级品类level3）
  const [parentCategories, setParentCategories] = useState<ProductCategory[]>([]);
  const [subCategories, setSubCategories] = useState<ProductCategory[]>([]);
  const [childCategories, setChildCategories] = useState<ProductCategory[]>([]);
  const [selectedParentCategoryId, setSelectedParentCategoryId] = useState<string>('');
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string>('');
  const [loadingSubCategories, setLoadingSubCategories] = useState(false);
  const [loadingChildCategories, setLoadingChildCategories] = useState(false);

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

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
  }, [debouncedSearch]);

  // 加载品类列表（全量用于筛选栏 + level=1 用于主品类下拉）
  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const allRes = await fetch('/api/product-research/categories?isActive=true');
      const allData = await allRes.json();
      if (allData.success) {
        const all = allData.data?.items ?? allData.data ?? [];
        setProductCategories(all);
        // 主品类下拉显示一级品类（B01 美妆类, C01 个护类）
        setParentCategories(all.filter((c: ProductCategory) => c.level === 1));
      }
    } catch (error) {
      console.error('加载品类失败:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  // 加载子品类（根据主品类ID，加载level=2）
  const loadSubCategories = async (parentId: string): Promise<ProductCategory[]> => {
    setLoadingSubCategories(true);
    setSubCategories([]);
    try {
      const res = await fetch(`/api/product-research/categories?parentId=${parentId}&isActive=true`);
      const data = await res.json();
      if (data.success) {
        const children = data.data?.items ?? data.data ?? [];
        setSubCategories(children);
        return children;
      }
      return [];
    } catch (error) {
      console.error('加载子品类失败:', error);
      return [];
    } finally {
      setLoadingSubCategories(false);
    }
  };

  // 加载三级品类（根据子品类ID，加载level=3）
  const loadChildCategories = async (parentId: string): Promise<ProductCategory[]> => {
    setLoadingChildCategories(true);
    setChildCategories([]);
    try {
      const res = await fetch(`/api/product-research/categories?parentId=${parentId}&isActive=true`);
      const data = await res.json();
      if (data.success) {
        const children = data.data?.items ?? data.data ?? [];
        setChildCategories(children);
        return children;
      }
      return [];
    } catch (error) {
      console.error('加载三级品类失败:', error);
      return [];
    } finally {
      setLoadingChildCategories(false);
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

  // 筛选后的产品
  const getFilteredProducts = (): Product[] => {
    if (categoryFilter === 'all') return products;
    return products.filter(product => {
      return product.categoryId === categoryFilter ||
             product.category === categoryFilter ||
             product.categoryName === categoryFilter;
    });
  };

  // 获取当前用户（判断权限）
  const getCurrentUser = () => {
    if (typeof window === 'undefined') return null;
    try {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u) : null;
    } catch { return null; }
  };
  const currentUser = getCurrentUser();
  const canEdit = currentUser?.role === 'ADMIN' || currentUser?.role === 'SALES';
  const canDelete = currentUser?.role === 'ADMIN';

  // 单个删除
  const handleSingleDelete = async (product: Product) => {
    if (!await confirm({ title: '确认删除', description: `确定要删除产品 "${product.name}" (${product.sku}) 吗？` })) return;
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { fetchProducts(); selectedIds.delete(product.id); setSelectedIds(new Set(selectedIds)); }
      else { toast.error(data.error || '删除失败'); }
    } catch { toast.error('删除失败'); }
  };

  // 打开编辑对话框（product 为 null 时表示新建产品）
  const openEditDialog = async (product: Product | null) => {
    // 先重置所有品类相关状态
    setSelectedCategoryId('');
    setSelectedParentCategoryId('');
    setSelectedSubCategoryId('');
    setSubCategories([]);
    setChildCategories([]);
    setAttributeValues({});
    setAttributeTemplates([]);

    if (product) {
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
      setEditImages(product.images || []);

      // 三级级联回显
      if (product.categoryId) {
        const category = productCategories.find(c => c.id === product.categoryId);
        if (category) {
          if (category.level === 3) {
            // level 3 → 回显主品类(level1) + 子品类(level2) + 三级品类
            const level2 = productCategories.find(c => c.id === category.parentId);
            const level1Id = level2?.parentId || '';
            setSelectedParentCategoryId(level1Id);
            await loadSubCategories(level1Id);
            setSelectedSubCategoryId(category.parentId || '');
            await loadChildCategories(category.parentId || '');
            setSelectedCategoryId(product.categoryId);
          } else if (category.level === 2) {
            // level 2 → 回显主品类(level1) + 子品类(level2)，三级无
            const level1Id = category.parentId || '';
            setSelectedParentCategoryId(level1Id);
            await loadSubCategories(level1Id);
            setSelectedSubCategoryId(product.categoryId);
            // 尝试加载三级（会返回空，三级品类不出现）
            await loadChildCategories(product.categoryId);
            setSelectedCategoryId(product.categoryId);
          } else {
            // level 1（不应出现，兜底）
            setSelectedParentCategoryId(product.categoryId);
            await loadSubCategories(product.categoryId);
          }
        } else {
          setSelectedCategoryId(product.categoryId);
        }

        await loadAttributeTemplates(product.categoryId);
        await loadProductAttributeValues(product.id);
      }
    } else {
      setEditingProduct(null);
      setEditFormData({
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
      setEditImages([]);
    }

    setEditDialogOpen(true);
  };

  // 主品类变更处理（选择level 1 → 加载level 2）
  const handleParentCategoryChange = async (parentId: string) => {
    setSelectedParentCategoryId(parentId);
    setSelectedSubCategoryId('');
    setSelectedCategoryId('');
    setSubCategories([]);
    setChildCategories([]);
    setAttributeTemplates([]);
    setAttributeValues({});

    setEditFormData(prev => ({
      ...prev,
      categoryId: '',
      category: '',
      categoryName: '',
    }));

    if (parentId) {
      await loadSubCategories(parentId);
    }
  };

  // 子品类变更处理（选择level 2 → 加载level 3 或自动选中）
  const handleSubCategoryChange = async (categoryId: string) => {
    setSelectedSubCategoryId(categoryId);
    setSelectedCategoryId('');
    setChildCategories([]);
    setAttributeTemplates([]);
    setAttributeValues({});

    setEditFormData(prev => ({
      ...prev,
      categoryId: '',
      category: '',
      categoryName: '',
    }));

    if (categoryId) {
      const grandChildren = await loadChildCategories(categoryId);
      // 无三级品类 → 自动使用当前子品类作为最终品类
      if (grandChildren.length === 0) {
        const category = productCategories.find(c => c.id === categoryId);
        if (category) {
          setSelectedCategoryId(categoryId);
          setEditFormData(prev => ({
            ...prev,
            categoryId,
            category: category.code,
            categoryName: category.name,
          }));
          await loadAttributeTemplates(categoryId);
        }
      }
    }
  };

  // 三级品类变更处理（选择level 3 → 加载属性模板）
  const handleChildCategoryChange = async (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setAttributeTemplates([]);
    setAttributeValues({});

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
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
            {template.options.map((option) => {
              const selected = (value as string[]) || [];
              const isSelected = selected.includes(option);
              return (
                <label
                  key={option}
                  className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    const current = (value as string[]) || [];
                    if (isSelected) {
                      handleChange(current.filter(o => o !== option));
                    } else {
                      handleChange([...current, option]);
                    }
                  }}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => {
                      const current = (value as string[]) || [];
                      if (isSelected) {
                        handleChange(current.filter(o => o !== option));
                      } else {
                        handleChange([...current, option]);
                      }
                    }}
                    className="h-4 w-4"
                  />
                  <span className="text-xs text-gray-700 leading-tight select-none">{option}</span>
                </label>
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

  // 保存产品（新建或编辑）
  const handleSaveEdit = async () => {
    // 验证必填属性
    const requiredTemplates = attributeTemplates.filter(t => t.isRequired);
    for (const template of requiredTemplates) {
      const value = attributeValues[template.id];
      if (!value || (Array.isArray(value) && value.length === 0)) {
        toast.warning(`请填写必填属性：${template.name}`);
        return;
      }
    }

    // 验证必填字段
    if (!editFormData.sku || !editFormData.name) {
      toast.error('SKU 和产品名称为必填项');
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

      const isNew = !editingProduct;
      const url = isNew ? '/api/products' : `/api/products/${editingProduct.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
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
          images: editImages,
          attributes: attributes,
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast.error(isNew ? '产品创建成功' : '产品更新成功');
        setEditDialogOpen(false);
        fetchProducts();
      } else {
        toast.error(result.error || (isNew ? '创建失败' : '更新失败'));
      }
    } catch (error) {
      console.error('Failed to save product:', error);
      toast.error('保存失败');
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
      toast.error('导出失败');
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
        toast.error(`删除完成：成功 ${result.success} 个，失败 ${result.failed} 个`);
        setSelectedIds(new Set());
        fetchProducts();
      } else {
        toast.error('删除失败：' + (result.error || '未知错误'));
      }
    } catch (error) {
      toast.error('删除失败');
      console.error('Delete failed:', error);
    }
  };

  const selectedCount = selectedIds.size;
  const filteredProducts = getFilteredProducts();

  // 列排序
  const { sorted, requestSort, sortConfig } = useSortable(filteredProducts, 'sku');

  return (<>
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
              <Button
                onClick={() => openEditDialog(null)}
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">新建产品</span>
                <span className="sm:hidden">新建</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 分类筛选 - 读取品类管理数据 */}
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
                  {productCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name} ({cat.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {categoryFilter !== 'all' && (
              <div className="w-full sm:w-auto">
                <Button variant="outline" size="default" onClick={() => setCategoryFilter('all')} className="w-full sm:w-auto">
                  清除筛选
                </Button>
              </div>
            )}
          </div>

          {/* 加载状态 */}
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-5 shrink-0" />
                  <Skeleton className="h-5 w-20 shrink-0" />
                  <Skeleton className="h-5 w-1/4" />
                  <Skeleton className="h-5 w-16 shrink-0" />
                  <Skeleton className="h-5 w-16 shrink-0" />
                  <Skeleton className="h-5 w-16 shrink-0" />
                  <Skeleton className="h-5 w-12 shrink-0" />
                  <Skeleton className="h-5 w-20 shrink-0" />
                </div>
              ))}
            </div>
          )}

          {/* 产品表格 */}
          {!loading && (
            <>
              {filteredProducts.length === 0 ? (
                <EmptyState
                  icon={<div className="text-4xl">📦</div>}
                  title="暂无产品数据"
                  description={categoryFilter !== 'all' ? "当前筛选条件已生效" : "还没有任何产品记录，创建一款产品开始使用"}
                />
              ) : (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={filteredProducts.length > 0 && filteredProducts.every(p => selectedIds.has(p.id))}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead className="w-14">图片</TableHead>
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => requestSort('sku')}
                        >
                          SKU
                          <SortIndicator field="sku" sortConfig={sortConfig} />
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => requestSort('name')}
                        >
                          产品名称
                          <SortIndicator field="name" sortConfig={sortConfig} />
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => requestSort('categoryName')}
                        >
                          品类
                          <SortIndicator field="categoryName" sortConfig={sortConfig} />
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => requestSort('costPrice')}
                        >
                          成本价
                          <SortIndicator field="costPrice" sortConfig={sortConfig} />
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => requestSort('salePrice')}
                        >
                          销售价
                          <SortIndicator field="salePrice" sortConfig={sortConfig} />
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => requestSort('status')}
                        >
                          状态
                          <SortIndicator field="status" sortConfig={sortConfig} />
                        </TableHead>
                        <TableHead className="text-right w-28">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sorted.map(product => (
                        <TableRow key={product.id} className={selectedIds.has(product.id) ? 'bg-muted/50' : ''}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(product.id)}
                              onCheckedChange={() => toggleSelection(product.id)}
                            />
                          </TableCell>
                          <TableCell>
                            {product.images && product.images.length > 0 ? (
                              <img
                                src={product.images[0]}
                                alt={product.name}
                                className="w-10 h-10 object-cover rounded border"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-gray-300 text-xs">
                                📷
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>
                            {(product.categoryName || product.category) ? (
                              <Badge variant="secondary">{product.categoryName || product.category}</Badge>
                            ) : <span className="text-gray-400">-</span>}
                          </TableCell>
                          <TableCell>{product.costPrice ? `¥${Number(product.costPrice).toFixed(2)}` : '-'}</TableCell>
                          <TableCell className="text-green-600 font-medium">{product.salePrice ? `¥${Number(product.salePrice).toFixed(2)}` : '-'}</TableCell>
                          <TableCell>
                            <Badge variant={product.status === 'active' ? 'default' : 'outline'}>
                              {product.status === 'active' ? '在售' : product.status === 'inactive' ? '下架' : product.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditDialog(product)} title="查看/编辑">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              {canEdit && (
                                <Button variant="ghost" size="sm" onClick={() => openEditDialog(product)} title="编辑">
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button variant="ghost" size="sm" className="text-red-400" onClick={() => handleSingleDelete(product)} title="删除">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" className="text-blue-400" onClick={() => { setSupplierDialogProductId(product.id); setSupplierDialogProductName(product.name); }} title="供应商">
                                <Building2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>编辑产品</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* 产品图片 */}
              <div>
                <Label>产品图片</Label>
                <div className="flex flex-wrap gap-3 mt-1">
                  {editImages.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img src={img} alt={`产品图 ${idx + 1}`} className="w-20 h-20 object-cover rounded border" />
                      <button
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setEditImages(editImages.filter((_, i) => i !== idx))}
                      >×</button>
                    </div>
                  ))}
                  <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    {uploadingImage ? (
                      <span className="text-xs text-gray-400">上传中...</span>
                    ) : (
                      <span className="text-2xl text-gray-400">+</span>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={uploadingImage}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingImage(true);
                        try {
                          const formData = new FormData();
                          formData.append('file', file);
                          const res = await fetch('/api/upload', {
                            method: 'POST',
                            body: formData,
                          });
                          const data = await res.json();
                          if (data.success && data.data?.url) {
                            setEditImages([...editImages, data.data.url]);
                          } else {
                            toast.error(data.message || '上传失败');
                          }
                        } catch {
                          toast.error('图片上传失败');
                        } finally {
                          setUploadingImage(false);
                          e.target.value = '';
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-gray-600">SKU *</Label>
                  <Input
                    value={editFormData.sku}
                    onChange={(e) => setEditFormData({ ...editFormData, sku: e.target.value })}
                    placeholder="产品 SKU"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600">产品名称 *</Label>
                  <Input
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    placeholder="产品名称"
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-gray-600">英文名称</Label>
                  <Input
                    value={editFormData.nameEn}
                    onChange={(e) => setEditFormData({ ...editFormData, nameEn: e.target.value })}
                    placeholder="产品英文名称"
                    className="h-9"
                  />
                </div>
                <div></div>
              </div>

              {/* 品类选择 - 三级级联 */}
              <div className="bg-gradient-to-br from-blue-50/40 to-slate-50/40 border border-blue-100/60 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1 h-4 bg-blue-500 rounded-full" />
                  <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">品类选择</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-gray-600">主品类 *</Label>
                    <Select
                      value={selectedParentCategoryId}
                      onValueChange={handleParentCategoryChange}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="请选择主品类" />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingCategories ? (
                          <SelectItem value="loading" disabled>加载中...</SelectItem>
                        ) : (
                          parentCategories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-600">子品类 *</Label>
                    <Select
                      value={selectedSubCategoryId}
                      onValueChange={handleSubCategoryChange}
                      disabled={!selectedParentCategoryId || loadingSubCategories}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={loadingSubCategories ? '加载中...' : selectedParentCategoryId ? '请选择子品类' : '请先选择主品类'} />
                      </SelectTrigger>
                      <SelectContent>
                        {subCategories.length === 0 ? (
                          <SelectItem value="none" disabled>暂无子品类</SelectItem>
                        ) : (
                          subCategories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600">三级品类</Label>
                  <Select
                    value={childCategories.length > 0 ? editFormData.categoryId : ''}
                    onValueChange={handleChildCategoryChange}
                    disabled={childCategories.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={childCategories.length > 0 ? '请选择三级品类' : '无三级分类'} />
                    </SelectTrigger>
                    <SelectContent>
                      {childCategories.length === 0 ? (
                        <SelectItem value="none" disabled>无可选项</SelectItem>
                      ) : (
                        childCategories.map((category) => (
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
                  <Label className="text-xs font-medium text-gray-600">成本价（元）</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editFormData.costPrice}
                    onChange={(e) => setEditFormData({ ...editFormData, costPrice: e.target.value })}
                    placeholder="0.00"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600">销售价（元）</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editFormData.salePrice}
                    onChange={(e) => setEditFormData({ ...editFormData, salePrice: e.target.value })}
                    placeholder="0.00"
                    className="h-9"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-gray-600">状态</Label>
                <Select
                  value={editFormData.status}
                  onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
                >
                  <SelectTrigger className="h-9">
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
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-50/30 rounded-lg px-4 py-3 mb-5">
                    <h4 className="text-sm font-bold text-blue-800 flex items-center gap-2">
                      <div className="w-1.5 h-5 bg-blue-500 rounded-full" />
                      品类属性
                      <span className="text-xs font-normal text-blue-400 ml-1">
                        {attributeTemplates.length} 项
                      </span>
                    </h4>
                  </div>
                  {loadingAttributes ? (
                    <div className="text-center py-6 text-gray-400 text-sm">
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
                    <div className="space-y-5">
                      {(() => {
                        const groups = [
                          // 皂基 (S012)
                          { title: '基础信息', codes: ['S012_brand', 'S012_model', 'S012_origin', 'S012_color'] },
                          { title: '物理规格', codes: ['S012_form', 'S012_size_type', 'S012_style', 'S012_regular_size', 'S012_regular_weight', 'S012_shelf_life'] },
                          { title: '产品特性', codes: ['S012_function', 'S012_handmade', 'S012_transparent', 'S012_medicinal', 'S012_skin_type'] },
                          { title: '成分与描述', codes: ['S012_ingredients', 'S012_fragrance', 'S012_use', 'S012_effect'] },
                          { title: '定制与包装', codes: ['S012_customizable', 'S012_customization', 'S012_packaging'] },
                          { title: '认证标准', codes: ['S012_certifications'] },
                          // 成品皂 (S011)
                          { title: '基础信息', codes: ['S011_type', 'S011_brand', 'S011_model', 'S011_origin', 'S011_color', 'S011_keywords'] },
                          { title: '物理规格', codes: ['S011_form', 'S011_size_type', 'S011_style', 'S011_regular_size', 'S011_pkg_size', 'S011_regular_weight', 'S011_gross_weight', 'S011_shelf_life'] },
                          { title: '产品特性', codes: ['S011_function', 'S011_body_part', 'S011_skin_type', 'S011_age_group', 'S011_handmade', 'S011_transparent', 'S011_medicinal'] },
                          { title: '成分与描述', codes: ['S011_ingredients', 'S011_material', 'S011_fragrance', 'S011_usage', 'S011_effect'] },
                          { title: '定制与服务', codes: ['S011_customization', 'S011_customizable', 'S011_service', 'S011_packaging'] },
                          { title: '认证标准', codes: ['S011_certifications'] },
                          // 香水 (B015)
                          {
                            title: '基础信息',
                            codes: ['B015_brand', 'B015_model', 'B015_origin', 'B015_color', 'B015_keywords'],
                            cols: 4,
                          },
                          {
                            title: '香型规格',
                            codes: ['B015_product_type', 'B015_fragrance_family', 'B015_fragrance_notes', 'B015_fragrance_series', 'B015_concentration', 'B015_gender'],
                          },
                          { title: '物理规格', codes: ['B015_capacity', 'B015_form', 'B015_shelf_life'] },
                          { title: '瓶器规格', codes: ['B015_bottle_material', 'B015_cap_material', 'B015_neck_finish', 'B015_spray_type'] },
                          {
                            title: '定制与包装',
                            codes: ['B015_moq', 'B015_customizable', 'B015_customization', 'B015_sales_unit', 'B015_individual_pkg', 'B015_outer_pkg'],
                          },
                          { title: '包装与物流', codes: ['B015_pkg_size', 'B015_gross_weight'] },
                          { title: '认证标准', codes: ['B015_certifications'] },
                          // 眼影 (B011)
                          {
                            title: '基础信息',
                            codes: ['B011_brand', 'B011_model', 'B011_origin', 'B011_color_family', 'B011_keywords'],
                            cols: 4,
                          },
                          {
                            title: '产品规格',
                            codes: ['B011_product_type', 'B011_texture', 'B011_shade', 'B011_pan_count', 'B011_net_weight', 'B011_longevity', 'B011_waterproof', 'B011_sweatproof', 'B011_shelf_life'],
                          },
                          { title: '成分特性', codes: ['B011_ingredients'] },
                          { title: '定制与包装', codes: ['B011_moq', 'B011_customizable', 'B011_customization', 'B011_sales_unit', 'B011_individual_pkg', 'B011_outer_pkg'] },
                          { title: '包装与物流', codes: ['B011_pkg_size', 'B011_gross_weight'] },
                          { title: '认证标准', codes: ['B011_certifications'] },
                          // 腮红 (B012)
                          {
                            title: '基础信息',
                            codes: ['B012_brand', 'B012_model', 'B012_origin', 'B012_color_family', 'B012_keywords'],
                            cols: 4,
                          },
                          {
                            title: '产品规格',
                            codes: ['B012_product_type', 'B012_texture', 'B012_shade', 'B012_net_weight', 'B012_longevity', 'B012_shelf_life'],
                          },
                          { title: '成分特性', codes: ['B012_ingredients'] },
                          { title: '定制与包装', codes: ['B012_moq', 'B012_customizable', 'B012_customization', 'B012_sales_unit', 'B012_individual_pkg', 'B012_outer_pkg'] },
                          { title: '包装与物流', codes: ['B012_pkg_size', 'B012_gross_weight'] },
                          { title: '认证标准', codes: ['B012_certifications'] },
                          // 唇彩 (B013)
                          {
                            title: '基础信息',
                            codes: ['B013_brand', 'B013_model', 'B013_origin', 'B013_color_family', 'B013_keywords'],
                            cols: 4,
                          },
                          {
                            title: '产品规格',
                            codes: ['B013_product_type', 'B013_texture', 'B013_shade', 'B013_net_weight', 'B013_longevity', 'B013_staining', 'B013_moisturizing', 'B013_shelf_life'],
                          },
                          { title: '成分特性', codes: ['B013_ingredients'] },
                          { title: '定制与包装', codes: ['B013_moq', 'B013_customizable', 'B013_customization', 'B013_sales_unit', 'B013_individual_pkg', 'B013_outer_pkg'] },
                          { title: '包装与物流', codes: ['B013_pkg_size', 'B013_gross_weight'] },
                          { title: '认证标准', codes: ['B013_certifications'] },
                          // 粉底液 (B014)
                          {
                            title: '基础信息',
                            codes: ['B014_brand', 'B014_model', 'B014_origin', 'B014_tone', 'B014_keywords'],
                            cols: 4,
                          },
                          {
                            title: '产品规格',
                            codes: ['B014_product_type', 'B014_finish', 'B014_skin_type', 'B014_coverage', 'B014_shade', 'B014_net_weight', 'B014_spf', 'B014_longevity', 'B014_oil_control', 'B014_moisturizing', 'B014_shelf_life'],
                          },
                          { title: '成分特性', codes: ['B014_ingredients'] },
                          { title: '定制与包装', codes: ['B014_moq', 'B014_customizable', 'B014_customization', 'B014_sales_unit', 'B014_individual_pkg', 'B014_outer_pkg'] },
                          { title: '包装与物流', codes: ['B014_pkg_size', 'B014_gross_weight'] },
                          { title: '认证标准', codes: ['B014_certifications'] },
                          // 洗发产品 (C0111)
                          {
                            title: '基础信息',
                            codes: ['C0111_brand', 'C0111_model', 'C0111_origin', 'C0111_hair_type', 'C0111_keywords'],
                            cols: 4,
                          },
                          {
                            title: '产品规格',
                            codes: ['C0111_product_type', 'C0111_form', 'C0111_net_weight', 'C0111_ph', 'C0111_sulfate_free', 'C0111_silicone_free', 'C0111_scalp_care', 'C0111_shelf_life'],
                          },
                          { title: '成分特性', codes: ['C0111_ingredients'] },
                          { title: '定制与包装', codes: ['C0111_moq', 'C0111_customizable', 'C0111_customization', 'C0111_sales_unit', 'C0111_individual_pkg', 'C0111_outer_pkg'] },
                          { title: '包装与物流', codes: ['C0111_pkg_size', 'C0111_gross_weight'] },
                          { title: '认证标准', codes: ['C0111_certifications'] },
                          // 护发/造型 (C0112)
                          {
                            title: '基础信息',
                            codes: ['C0112_brand', 'C0112_model', 'C0112_origin', 'C0112_hair_type', 'C0112_keywords'],
                            cols: 4,
                          },
                          {
                            title: '产品规格',
                            codes: ['C0112_product_type', 'C0112_form', 'C0112_net_weight', 'C0112_leave_in', 'C0112_effect', 'C0112_hold_level', 'C0112_shelf_life'],
                          },
                          { title: '成分特性', codes: ['C0112_ingredients'] },
                          { title: '定制与包装', codes: ['C0112_moq', 'C0112_customizable', 'C0112_customization', 'C0112_sales_unit', 'C0112_individual_pkg', 'C0112_outer_pkg'] },
                          { title: '包装与物流', codes: ['C0112_pkg_size', 'C0112_gross_weight'] },
                          { title: '认证标准', codes: ['C0112_certifications'] },
                          // 洁面/卸妆 (C0121)
                          {
                            title: '基础信息',
                            codes: ['C0121_brand', 'C0121_model', 'C0121_origin', 'C0121_skin_type', 'C0121_keywords'],
                            cols: 4,
                          },
                          {
                            title: '产品规格',
                            codes: ['C0121_product_type', 'C0121_foam_type', 'C0121_ph', 'C0121_net_weight', 'C0121_effect', 'C0121_shelf_life'],
                          },
                          { title: '成分特性', codes: ['C0121_ingredients'] },
                          { title: '定制与包装', codes: ['C0121_moq', 'C0121_customizable', 'C0121_customization', 'C0121_sales_unit', 'C0121_individual_pkg', 'C0121_outer_pkg'] },
                          { title: '包装与物流', codes: ['C0121_pkg_size', 'C0121_gross_weight'] },
                          { title: '认证标准', codes: ['C0121_certifications'] },
                          // 精华/面霜/乳液 (C0122)
                          {
                            title: '基础信息',
                            codes: ['C0122_brand', 'C0122_model', 'C0122_origin', 'C0122_skin_type', 'C0122_keywords'],
                            cols: 4,
                          },
                          {
                            title: '产品规格',
                            codes: ['C0122_product_type', 'C0122_texture', 'C0122_net_weight', 'C0122_effect', 'C0122_active', 'C0122_shelf_life'],
                          },
                          { title: '成分特性', codes: ['C0122_ingredients'] },
                          { title: '定制与包装', codes: ['C0122_moq', 'C0122_customizable', 'C0122_customization', 'C0122_sales_unit', 'C0122_individual_pkg', 'C0122_outer_pkg'] },
                          { title: '包装与物流', codes: ['C0122_pkg_size', 'C0122_gross_weight'] },
                          { title: '认证标准', codes: ['C0122_certifications'] },
                          // 面膜/防晒 (C0123)
                          {
                            title: '基础信息',
                            codes: ['C0123_brand', 'C0123_model', 'C0123_origin', 'C0123_skin_type', 'C0123_keywords'],
                            cols: 4,
                          },
                          {
                            title: '产品规格',
                            codes: ['C0123_product_type', 'C0123_mask_material', 'C0123_sheet_count', 'C0123_spf', 'C0123_pa', 'C0123_waterproof', 'C0123_net_weight', 'C0123_effect', 'C0123_shelf_life'],
                          },
                          { title: '成分特性', codes: ['C0123_ingredients'] },
                          { title: '定制与包装', codes: ['C0123_moq', 'C0123_customizable', 'C0123_customization', 'C0123_sales_unit', 'C0123_individual_pkg', 'C0123_outer_pkg'] },
                          { title: '包装与物流', codes: ['C0123_pkg_size', 'C0123_gross_weight'] },
                          { title: '认证标准', codes: ['C0123_certifications'] },
                          // 身体护理 (C013)
                          {
                            title: '基础信息',
                            codes: ['C013_brand', 'C013_model', 'C013_origin', 'C013_skin_type', 'C013_keywords'],
                            cols: 4,
                          },
                          {
                            title: '产品规格',
                            codes: ['C013_product_type', 'C013_form', 'C013_ph', 'C013_net_weight', 'C013_effect', 'C013_shelf_life'],
                          },
                          { title: '成分特性', codes: ['C013_ingredients'] },
                          { title: '定制与包装', codes: ['C013_moq', 'C013_customizable', 'C013_customization', 'C013_sales_unit', 'C013_individual_pkg', 'C013_outer_pkg'] },
                          { title: '包装与物流', codes: ['C013_pkg_size', 'C013_gross_weight'] },
                          { title: '认证标准', codes: ['C013_certifications'] },
                        ];
                        const groupedCodes = new Set(groups.flatMap(g => g.codes));
                        const sorted = [...attributeTemplates].sort((a: any, b: any) => a.sortOrder - b.sortOrder);
                        const ungrouped = sorted.filter((t: any) => !groupedCodes.has(t.code));

                        const renderAttrField = (template: any, fullWidth = false) => {
                          // MULTI_SELECT 字段：占整行宽度，选项水平 flex wrap 排列
                          if (template.type === 'MULTI_SELECT') {
                            const value = attributeValues[template.id] ?? template.defaultValue ?? [];
                            const selected = Array.isArray(value) ? value : [];
                            return (
                              <div key={template.id} className="col-span-full">
                                <label className="block text-xs font-medium text-gray-600 mb-2">
                                  {template.name}
                                  {template.isRequired && <span className="text-red-500 ml-0.5">*</span>}
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                  {template.options.map((option: string) => {
                                    const isSelected = selected.includes(option);
                                    return (
                                      <label
                                        key={option}
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                                          isSelected
                                            ? 'border-blue-300 bg-blue-50 text-blue-700'
                                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          const current = [...selected];
                                          if (isSelected) {
                                            handleChange(current.filter((o: string) => o !== option));
                                          } else {
                                            handleChange([...current, option]);
                                          }
                                        }}
                                      >
                                        <Checkbox
                                          checked={isSelected}
                                          onCheckedChange={() => {
                                            if (isSelected) {
                                              handleChange(selected.filter((o: string) => o !== option));
                                            } else {
                                              handleChange([...selected, option]);
                                            }
                                          }}
                                          className="h-3.5 w-3.5"
                                        />
                                        <span className="select-none">{option}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div key={template.id} className={fullWidth ? 'col-span-full' : ''}>
                              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                {template.name}
                                {template.isRequired && <span className="text-red-500 ml-0.5">*</span>}
                              </label>
                            {template.code === 'S012_regular_size' || template.code === 'S011_regular_size' || template.code === 'S011_pkg_size' || template.code === 'B015_pkg_size' || template.code === 'B011_pkg_size' || template.code === 'B012_pkg_size' || template.code === 'B013_pkg_size' || template.code === 'B014_pkg_size' || template.code === 'C0111_pkg_size' || template.code === 'C0112_pkg_size' || template.code === 'C0121_pkg_size' || template.code === 'C0122_pkg_size' || template.code === 'C0123_pkg_size' || template.code === 'C013_pkg_size' ? (
                              <Input
                                value={attributeValues[template.id] ?? ''}
                                onChange={(e) => setAttributeValues({...attributeValues, [template.id]: e.target.value})}
                                placeholder={template.code === 'S011_pkg_size' ? '8 × 7 × 3 cm' : template.code.startsWith('B015') ? '20×20×8 cm' : template.code.startsWith('B011') ? '12×8×2 cm' : template.code.startsWith('B012') ? '8×8×2 cm' : template.code.startsWith('B013') ? '12×3×2 cm' : template.code.startsWith('B014') ? '15×5×4 cm' : template.code.startsWith('C0111') ? '20×7×7 cm' : template.code.startsWith('C0112') ? '16×5×5 cm' : template.code.startsWith('C0121') ? '16×6×6 cm' : template.code.startsWith('C0122') ? '12×5×5 cm' : template.code.startsWith('C0123') ? '16×12×3 cm' : template.code.startsWith('C013') ? '20×8×8 cm' : '长 × 宽 × 高 (mm)'}
                                className="h-9 text-sm"
                              />
                            ) : template.code === 'S012_regular_weight' || template.code === 'S011_regular_weight' || template.code === 'S011_gross_weight' || template.code === 'B015_gross_weight' || template.code === 'B011_gross_weight' || template.code === 'B012_gross_weight' || template.code === 'B013_gross_weight' || template.code === 'B014_gross_weight' || template.code === 'C0111_gross_weight' || template.code === 'C0112_gross_weight' || template.code === 'C0121_gross_weight' || template.code === 'C0122_gross_weight' || template.code === 'C0123_gross_weight' || template.code === 'C013_gross_weight' ? (
                              <div className="relative">
                                <Input
                                  type="number" step="0.01" min="0"
                                  value={attributeValues[template.id] ?? ''}
                                  onChange={(e) => setAttributeValues({...attributeValues, [template.id]: e.target.value})}
                                  placeholder="0.00"
                                  className="h-9 text-sm pr-8"
                                />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">kg</span>
                              </div>
                            ) : template.code === 'B015_capacity' ? (
                              <div className="relative">
                                <Input
                                  type="number" step="0.1" min="0"
                                  value={attributeValues[template.id] ?? ''}
                                  onChange={(e) => setAttributeValues({...attributeValues, [template.id]: e.target.value})}
                                  placeholder="100"
                                  className="h-9 text-sm pr-8"
                                />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">ml</span>
                              </div>
                            ) : (
                              (() => {
                                // 把 renderAttributeInput 的 label 替换掉
                                const el = renderAttributeInput(template);
                                // BOOLEAN 类型不需要额外的 label
                                return el;
                              })()
                            )}
                          </div>
                        );
                      };
                        return (
                          <>
                            {groups.map(group => {
                              const tpls = group.codes.map(c => sorted.find((t: any) => t.code === c)).filter(Boolean);
                              if (tpls.length === 0) return null;
                              const isFourCol = group.title === '产品特性' || group.cols === 4;
                              return (
                                <div key={group.title} className="bg-white/60 border border-gray-100/80 rounded-lg p-4">
                                  <div className="flex items-center gap-2.5 mb-4">
                                    <div className="w-1 h-4 bg-blue-400 rounded-full" />
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{group.title}</span>
                                  </div>
                                  <div className={`grid grid-cols-1 sm:grid-cols-2 ${isFourCol ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-x-5 gap-y-4`}>
                                    {tpls.map((t: any) => {
                                      const wide = ['S012_ingredients', 'S012_use', 'S012_effect'].includes(t.code);
                                      return renderAttrField(t, wide);
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                            {ungrouped.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2.5 mb-4">
                                  <div className="w-1 h-4 bg-gray-300 rounded-full" />
                                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">其他</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-4">
                                  {ungrouped.map((t: any) => renderAttrField(t))}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
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

      {/* 供应商管理弹窗 */}
      {supplierDialogProductId && (
        <Dialog open={!!supplierDialogProductId} onOpenChange={(open) => { if (!open) setSupplierDialogProductId(null); }}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                供应商管理 — {supplierDialogProductName}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <ProductSupplierSection
                productId={supplierDialogProductId}
                onSupplierClick={(id) => window.open(`/suppliers/${id}`, '_blank')}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSupplierDialogProductId(null)}>关闭</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 给底部操作栏留空间 */}
      {selectedCount > 0 && <div className="h-20" />}
    </div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmDialog />
    </>
  );
}
