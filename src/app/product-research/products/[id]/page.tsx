'use client';

/**
 * 产品调研详情页 - Product Research Detail
 * 
 * 功能：
 * - 展示产品详细信息（基本信息 + 动态属性）
 * - 支持编辑模式（修改产品信息和属性值）
 * - 支持删除产品
 * - 返回列表导航
 * 
 * 路由：/product-research/products/[id]
 * 作者：Trade ERP 开发团队
 * 创建日期：2026-03-13
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Edit, Trash2, Save, X, Image as ImageIcon, CheckCircle2 } from 'lucide-react';

// ============================================
// 类型定义
// ============================================

/**
 * 品类类型
 */
interface ProductCategory {
  id: string;
  name: string;
  code: string;
}

/**
 * 属性模板类型
 */
interface AttributeTemplate {
  id: string;
  name: string;
  code: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'MULTI' | 'BOOLEAN';
  unit?: string;
  options?: string[];
  isRequired: boolean;
  description?: string;
}

/**
 * 属性值类型
 */
interface ProductAttributeValue {
  id: string;
  attributeId: string;
  value: string;
  attribute?: AttributeTemplate;
}

/**
 * 产品调研数据类型
 */
interface ProductResearch {
  id: string;
  name: string;
  nameEn: string | null;
  brand: string | null;
  brandEn: string | null;
  model: string | null;
  manufacturer: string | null;
  sourcePlatform: string | null;
  costPrice: number | null;
  salePrice: number | null;
  currency: string;
  categoryId: string;
  category: ProductCategory | null;
  status: 'DRAFT' | 'IN_PROGRESS' | 'REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  conclusion: 'recommended' | 'alternative' | 'eliminated' | null;
  conclusionReason: string | null;
  assignedTo: string | null;
  notes: string | null;
  images: string[];
  attributes: ProductAttributeValue[];
  createdAt: string;
  updatedAt: string;
}

// ============================================
// 状态和结论的显示映射
// ============================================

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'bg-gray-100 text-gray-800' },
  IN_PROGRESS: { label: '调研中', color: 'bg-blue-100 text-blue-800' },
  REVIEW: { label: '待审核', color: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: '已完成', color: 'bg-green-100 text-green-800' },
  REJECTED: { label: '已拒绝', color: 'bg-red-100 text-red-800' },
  ARCHIVED: { label: '已归档', color: 'bg-purple-100 text-purple-800' },
};

const CONCLUSION_MAP: Record<string, { label: string; color: string }> = {
  recommended: { label: '推荐', color: 'bg-green-100 text-green-800' },
  alternative: { label: '备选', color: 'bg-blue-100 text-blue-800' },
  eliminated: { label: '淘汰', color: 'bg-red-100 text-red-800' },
};

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD $' },
  { value: 'CNY', label: 'CNY ¥' },
  { value: 'EUR', label: 'EUR €' },
  { value: 'GBP', label: 'GBP £' },
];

// ============================================
// 主组件
// ============================================

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  // 数据状态
  const [product, setProduct] = useState<ProductResearch | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [attributeTemplates, setAttributeTemplates] = useState<AttributeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 页面模式：view（查看）或 edit（编辑）
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  // 删除确认对话框
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // 转化确认对话框
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertedProductId, setConvertedProductId] = useState<string | null>(null);

  // 编辑表单数据
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    brand: '',
    brandEn: '',
    model: '',
    manufacturer: '',
    sourcePlatform: '',
    costPrice: '',
    salePrice: '',
    currency: 'USD',
    categoryId: '',
    status: 'DRAFT',
    conclusion: '',
    conclusionReason: '',
    assignedTo: '',
    notes: '',
  });

  // 动态属性值（编辑模式）
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({});

  // ============================================
  // 加载数据
  // ============================================

  useEffect(() => {
    if (productId) {
      loadProduct();
      loadCategories();
    }
  }, [productId]);

  // 加载产品详情
  const loadProduct = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/product-research/products/${productId}`);
      const result = await response.json();
      
      if (result.success) {
        const data = result.data;
        setProduct(data);
        
        // 初始化表单数据
        setFormData({
          name: data.name || '',
          nameEn: data.nameEn || '',
          brand: data.brand || '',
          brandEn: data.brandEn || '',
          model: data.model || '',
          manufacturer: data.manufacturer || '',
          sourcePlatform: data.sourcePlatform || '',
          costPrice: data.costPrice?.toString() || '',
          salePrice: data.salePrice?.toString() || '',
          currency: data.currency || 'USD',
          categoryId: data.categoryId || '',
          status: data.status || 'DRAFT',
          conclusion: data.conclusion || '',
          conclusionReason: data.conclusionReason || '',
          assignedTo: data.assignedTo || '',
          notes: data.notes || '',
        });

        // 初始化属性值
        const attrValues: Record<string, string> = {};
        data.attributes?.forEach((attr: ProductAttributeValue) => {
          attrValues[attr.attributeId] = attr.value;
        });
        setAttributeValues(attrValues);

        // 加载该品类的属性模板
        if (data.categoryId) {
          loadAttributeTemplates(data.categoryId);
        }
      } else {
        alert('加载产品失败：' + result.error);
      }
    } catch (error) {
      console.error('加载产品失败:', error);
      alert('加载产品失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 加载品类列表
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

  // 加载属性模板
  const loadAttributeTemplates = async (categoryId: string) => {
    try {
      const response = await fetch(`/api/product-research/templates?categoryId=${categoryId}`);
      const result = await response.json();
      
      if (result.success) {
        setAttributeTemplates(result.data);
      }
    } catch (error) {
      console.error('加载属性模板失败:', error);
    }
  };

  // ============================================
  // 编辑模式处理
  // ============================================

  // 切换到编辑模式
  const handleEdit = () => {
    setMode('edit');
  };

  // 取消编辑
  const handleCancel = () => {
    setMode('view');
    // 恢复原始数据
    if (product) {
      setFormData({
        name: product.name || '',
        nameEn: product.nameEn || '',
        brand: product.brand || '',
        brandEn: product.brandEn || '',
        model: product.model || '',
        manufacturer: product.manufacturer || '',
        sourcePlatform: product.sourcePlatform || '',
        costPrice: product.costPrice?.toString() || '',
        salePrice: product.salePrice?.toString() || '',
        currency: product.currency || 'USD',
        categoryId: product.categoryId || '',
        status: product.status || 'DRAFT',
        conclusion: product.conclusion || '',
        conclusionReason: product.conclusionReason || '',
        assignedTo: product.assignedTo || '',
        notes: product.notes || '',
      });
    }
  };

  // 保存修改
  const handleSave = async () => {
    try {
      setSaving(true);

      // 验证必填字段
      if (!formData.name || !formData.categoryId) {
        alert('请填写产品名称和选择品类');
        return;
      }

      // 准备提交数据
      const submitData = {
        name: formData.name,
        nameEn: formData.nameEn,
        brand: formData.brand,
        brandEn: formData.brandEn,
        model: formData.model,
        manufacturer: formData.manufacturer,
        sourcePlatform: formData.sourcePlatform,
        costPrice: formData.costPrice ? parseFloat(formData.costPrice) : null,
        salePrice: formData.salePrice ? parseFloat(formData.salePrice) : null,
        currency: formData.currency,
        categoryId: formData.categoryId,
        status: formData.status,
        conclusion: formData.conclusion || null,
        conclusionReason: formData.conclusionReason,
        assignedTo: formData.assignedTo,
        notes: formData.notes,
        attributes: attributeTemplates.map(template => ({
          attributeId: template.id,
          value: attributeValues[template.id] || '',
        })),
      };

      // 调用 API 更新
      const response = await fetch(`/api/product-research/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      const result = await response.json();

      if (result.success) {
        alert('保存成功');
        setMode('view');
        loadProduct(); // 重新加载最新数据
      } else {
        alert('保存失败：' + result.error);
      }
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // 删除产品
  // ============================================

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/product-research/products/${productId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        alert('删除成功');
        router.push('/product-research/products'); // 返回列表页
      } else {
        alert('删除失败：' + result.error);
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请重试');
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  // ============================================
  // 一键转化为正式产品
  // ============================================

  const handleConvertToProduct = async () => {
    try {
      setConverting(true);
      const response = await fetch('/api/v1/products/convert-from-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researchProductId: productId }),
      });
      const result = await response.json();

      if (result.success) {
        setConvertedProductId(result.data.productId);
        // 重新加载产品数据（状态会变为 ARCHIVED）
        await loadProduct();
        alert(`转化成功！正式产品 SKU: ${result.data.sku}`);
      } else {
        alert('转化失败：' + result.error);
      }
    } catch (error) {
      console.error('转化失败:', error);
      alert('转化失败，请重试');
    } finally {
      setConverting(false);
      setIsConvertDialogOpen(false);
    }
  };

  // ============================================
  // 辅助函数
  // ============================================

  // 渲染属性值输入框（根据类型）
  const renderAttributeInput = (template: AttributeTemplate) => {
    const value = attributeValues[template.id] || '';

    switch (template.type) {
      case 'SELECT':
        return (
          <Select value={value} onValueChange={(val) => setAttributeValues({ ...attributeValues, [template.id]: val })}>
            <SelectTrigger>
              <SelectValue placeholder={`请选择${template.name}`} />
            </SelectTrigger>
            <SelectContent>
              {template.options?.map((option, idx) => (
                <SelectItem key={idx} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'BOOLEAN':
        return (
          <Select value={value} onValueChange={(val) => setAttributeValues({ ...attributeValues, [template.id]: val })}>
            <SelectTrigger>
              <SelectValue placeholder="请选择" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">是</SelectItem>
              <SelectItem value="false">否</SelectItem>
            </SelectContent>
          </Select>
        );

      default:
        return (
          <Input
            value={value}
            onChange={(e) => setAttributeValues({ ...attributeValues, [template.id]: e.target.value })}
            placeholder={template.description || `请输入${template.name}`}
          />
        );
    }
  };

  // 渲染属性值显示
  const renderAttributeValue = (template: AttributeTemplate, value: string) => {
    if (!value) return '-';
    
    if (template.type === 'BOOLEAN') {
      return value === 'true' ? '是' : '否';
    }
    
    return value;
  };

  // ============================================
  // 加载状态
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <div className="text-gray-600">加载中...</div>
        </div>
      </div>
    );
  }

  // 产品不存在
  if (!product) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <div className="text-xl font-semibold mb-2">产品不存在</div>
          <Button onClick={() => router.push('/product-research/products')}>
            返回列表
          </Button>
        </div>
      </div>
    );
  }

  // ============================================
  // 页面渲染
  // ============================================

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      {/* 页面头部 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/product-research/products')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回列表
          </Button>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          {product.nameEn && (
            <span className="text-gray-500">{product.nameEn}</span>
          )}
        </div>

        {mode === 'view' ? (
          <div className="flex gap-2">
            {/* 一键转化按钮 - 仅 APPROVED 状态显示 */}
            {product.status === 'APPROVED' && (
              <Button
                variant="default"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => setIsConvertDialogOpen(true)}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                转为正式产品
              </Button>
            )}
            <Button variant="outline" onClick={handleEdit}>
              <Edit className="w-4 h-4 mr-2" />
              编辑
            </Button>
            <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              删除
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? '保存中...' : '保存'}
            </Button>
            <Button variant="outline" onClick={handleCancel}>
              <X className="w-4 h-4 mr-2" />
              取消
            </Button>
          </div>
        )}
      </div>

      {/* 查看模式 */}
      {mode === 'view' && (
        <div className="space-y-6">
          {/* 基本信息卡片 */}
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-gray-500 text-sm">品牌</Label>
                <div className="font-medium">{product.brand || '-'}</div>
              </div>
              <div>
                <Label className="text-gray-500 text-sm">型号</Label>
                <div className="font-medium">{product.model || '-'}</div>
              </div>
              <div>
                <Label className="text-gray-500 text-sm">品类</Label>
                <div className="font-medium">{product.category?.name || '-'}</div>
              </div>
              <div>
                <Label className="text-gray-500 text-sm">制造商</Label>
                <div className="font-medium">{product.manufacturer || '-'}</div>
              </div>
              <div>
                <Label className="text-gray-500 text-sm">来源平台</Label>
                <div className="font-medium">{product.sourcePlatform || '-'}</div>
              </div>
              <div>
                <Label className="text-gray-500 text-sm">状态</Label>
                <Badge className={STATUS_MAP[product.status]?.color}>
                  {STATUS_MAP[product.status]?.label}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* 价格信息卡片 */}
          <Card>
            <CardHeader>
              <CardTitle>价格信息</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-gray-500 text-sm">成本价</Label>
                <div className="font-medium text-lg">
                  {product.costPrice ? `${product.currency} ${product.costPrice.toFixed(2)}` : '-'}
                </div>
              </div>
              <div>
                <Label className="text-gray-500 text-sm">销售价</Label>
                <div className="font-medium text-lg">
                  {product.salePrice ? `${product.currency} ${product.salePrice.toFixed(2)}` : '-'}
                </div>
              </div>
              <div>
                <Label className="text-gray-500 text-sm">毛利率</Label>
                <div className="font-medium text-lg">
                  {product.costPrice && product.salePrice
                    ? `${((product.salePrice - product.costPrice) / product.salePrice * 100).toFixed(1)}%`
                    : '-'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 产品属性卡片 */}
          {attributeTemplates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>产品属性</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {product.attributes.map((attr) => {
                    const template = attributeTemplates.find(t => t.id === attr.attributeId);
                    if (!template) return null;
                    return (
                      <div key={attr.id}>
                        <Label className="text-gray-500 text-sm">{template.name}</Label>
                        <div className="font-medium">
                          {renderAttributeValue(template, attr.value)}
                          {template.unit && attr.value && ` ${template.unit}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 调研结论卡片 */}
          <Card>
            <CardHeader>
              <CardTitle>调研结论</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Label className="text-gray-500 text-sm">结论</Label>
                <div className="mt-1">
                  {product.conclusion ? (
                    <Badge className={CONCLUSION_MAP[product.conclusion]?.color}>
                      {CONCLUSION_MAP[product.conclusion]?.label}
                    </Badge>
                  ) : (
                    <span className="text-gray-400">暂无结论</span>
                  )}
                </div>
              </div>
              {product.conclusionReason && (
                <div>
                  <Label className="text-gray-500 text-sm">理由</Label>
                  <div className="mt-1 text-gray-700 whitespace-pre-wrap">
                    {product.conclusionReason}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 备注信息卡片 */}
          {product.notes && (
            <Card>
              <CardHeader>
                <CardTitle>备注信息</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-gray-700 whitespace-pre-wrap">{product.notes}</div>
              </CardContent>
            </Card>
          )}

          {/* 元信息 */}
          <div className="text-sm text-gray-500 text-center pt-4">
            创建时间：{new Date(product.createdAt).toLocaleString('zh-CN')} | 
            更新时间：{new Date(product.updatedAt).toLocaleString('zh-CN')}
          </div>
        </div>
      )}

      {/* 编辑模式 */}
      {mode === 'edit' && (
        <div className="space-y-6">
          {/* 基本信息表单 */}
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">产品名称 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="输入产品名称"
                />
              </div>
              <div>
                <Label htmlFor="nameEn">英文名称</Label>
                <Input
                  id="nameEn"
                  value={formData.nameEn}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                  placeholder="Product Name in English"
                />
              </div>
              <div>
                <Label htmlFor="brand">品牌</Label>
                <Input
                  id="brand"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  placeholder="输入品牌名称"
                />
              </div>
              <div>
                <Label htmlFor="brandEn">品牌（英文）</Label>
                <Input
                  id="brandEn"
                  value={formData.brandEn}
                  onChange={(e) => setFormData({ ...formData, brandEn: e.target.value })}
                  placeholder="Brand in English"
                />
              </div>
              <div>
                <Label htmlFor="model">型号</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="输入型号"
                />
              </div>
              <div>
                <Label htmlFor="manufacturer">制造商</Label>
                <Input
                  id="manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  placeholder="输入制造商"
                />
              </div>
              <div>
                <Label htmlFor="sourcePlatform">来源平台</Label>
                <Input
                  id="sourcePlatform"
                  value={formData.sourcePlatform}
                  onChange={(e) => setFormData({ ...formData, sourcePlatform: e.target.value })}
                  placeholder="如：Amazon, 1688"
                />
              </div>
              <div>
                <Label htmlFor="categoryId">所属品类 *</Label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(val) => {
                    setFormData({ ...formData, categoryId: val });
                    loadAttributeTemplates(val);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择品类" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">状态</Label>
                <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val as any })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">草稿</SelectItem>
                    <SelectItem value="IN_PROGRESS">调研中</SelectItem>
                    <SelectItem value="REVIEW">待审核</SelectItem>
                    <SelectItem value="APPROVED">已完成</SelectItem>
                    <SelectItem value="REJECTED">已拒绝</SelectItem>
                    <SelectItem value="ARCHIVED">已归档</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="assignedTo">调研人员</Label>
                <Input
                  id="assignedTo"
                  value={formData.assignedTo}
                  onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                  placeholder="输入负责人"
                />
              </div>
            </CardContent>
          </Card>

          {/* 价格信息表单 */}
          <Card>
            <CardHeader>
              <CardTitle>价格信息</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="costPrice">成本价</Label>
                <Input
                  id="costPrice"
                  type="number"
                  step="0.01"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="salePrice">销售价</Label>
                <Input
                  id="salePrice"
                  type="number"
                  step="0.01"
                  value={formData.salePrice}
                  onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="currency">货币</Label>
                <Select value={formData.currency} onValueChange={(val) => setFormData({ ...formData, currency: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* 产品属性表单 */}
          {attributeTemplates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>产品属性</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {attributeTemplates.map((template) => (
                  <div key={template.id}>
                    <Label htmlFor={`attr-${template.id}`}>
                      {template.name}
                      {template.isRequired && <span className="text-red-500"> *</span>}
                    </Label>
                    {renderAttributeInput(template)}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 调研结论表单 */}
          <Card>
            <CardHeader>
              <CardTitle>调研结论</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="conclusion">结论</Label>
                <Select value={formData.conclusion} onValueChange={(val) => setFormData({ ...formData, conclusion: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择结论" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">无结论</SelectItem>
                    <SelectItem value="recommended">推荐</SelectItem>
                    <SelectItem value="alternative">备选</SelectItem>
                    <SelectItem value="eliminated">淘汰</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="conclusionReason">结论文案</Label>
                <Textarea
                  id="conclusionReason"
                  value={formData.conclusionReason}
                  onChange={(e) => setFormData({ ...formData, conclusionReason: e.target.value })}
                  placeholder="说明推荐理由、市场分析、利润空间等..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* 备注信息表单 */}
          <Card>
            <CardHeader>
              <CardTitle>备注信息</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="记录调研过程、重要事项等..."
                rows={4}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* 删除确认对话框 */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除产品"{product.name}"吗？此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 转化确认对话框 */}
      <Dialog open={isConvertDialogOpen} onOpenChange={setIsConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>转为正式产品</DialogTitle>
            <DialogDescription>
              确定要将调研产品"{product.name}"转为正式产品吗？
              <div className="mt-4 p-3 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>转化后将：</strong>
                </p>
                <ul className="text-sm text-blue-700 mt-2 space-y-1">
                  <li>• 生成正式产品 SKU</li>
                  <li>• 复制所有属性和价格信息</li>
                  <li>• 调研产品状态变为"已归档"</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsConvertDialogOpen(false)}
              disabled={converting}
            >
              取消
            </Button>
            <Button
              onClick={handleConvertToProduct}
              disabled={converting}
              className="bg-green-600 hover:bg-green-700"
            >
              {converting ? '转化中...' : '确认转化'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 转化成功提示 */}
      {convertedProductId && (
        <Dialog open={!!convertedProductId} onOpenChange={() => setConvertedProductId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-6 h-6" />
                转化成功
              </DialogTitle>
              <DialogDescription>
                调研产品已成功转为正式产品！
                <div className="mt-4 p-3 bg-green-50 rounded-md">
                  <p className="text-sm text-green-800">
                    正式产品 ID: <strong>{convertedProductId}</strong>
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                onClick={() => {
                  setConvertedProductId(null);
                  router.push(`/products/${convertedProductId}`);
                }}
              >
                查看正式产品
              </Button>
              <Button variant="outline" onClick={() => setConvertedProductId(null)}>
                关闭
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
