'use client';

/**
 * 产品对比页面 - Product Comparison
 * 
 * 功能：
 * - 选择多个产品（2-5 个）进行并排对比
 * - 显示产品基本信息和动态属性
 * - 自动高亮关键差异（价格、毛利率等）
 * - 支持添加/移除产品
 * - 保存对比报告
 * 
 * 路由：/product-research/comparisons
 * 作者：Trade ERP 开发团队
 * 创建日期：2026-03-13
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Save, Download, X, Search, Star } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ============================================
// 类型定义
// ============================================

/**
 * 产品信息类型
 */
interface Product {
  id: string;
  name: string;
  nameEn: string | null;
  brand: string | null;
  model: string | null;
  costPrice: number | null;
  salePrice: number | null;
  currency: string;
  categoryId: string;
  category: {
    id: string;
    name: string;
    code: string;
  } | null;
  status: string;
  conclusion: string | null;
  attributes: Array<{
    id: string;
    attributeId: string;
    value: string;
    attribute: {
      id: string;
      name: string;
      code: string;
      type: string;
      unit?: string;
    };
  }>;
}

/**
 * 对比报告类型
 */
interface ComparisonReport {
  id: string;
  name: string;
  productIds: string[];
  products: Product[];
  createdAt: string;
}

// ============================================
// 主组件
// ============================================

export default function ComparisonsPage() {
  const router = useRouter();

  // 数据状态
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 对话框状态
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 属性合并（所有选中产品的属性并集）
  const [allAttributes, setAllAttributes] = useState<Array<{
    id: string;
    name: string;
    code: string;
    type: string;
    unit?: string;
  }>>([]);

  // ============================================
  // 加载数据
  // ============================================

  useEffect(() => {
    loadProducts();
  }, []);

  // 加载产品列表
  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/product-research/products?limit=100');
      const result = await response.json();
      
      if (result.success) {
        setAvailableProducts(result.data);
      }
    } catch (error) {
      console.error('加载产品失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // 产品选择处理
  // ============================================

  // 添加产品到对比
  const handleAddProduct = (product: Product) => {
    if (selectedProducts.length >= 5) {
      alert('最多只能对比 5 个产品');
      return;
    }

    if (selectedProducts.find(p => p.id === product.id)) {
      alert('该产品已在对比列表中');
      return;
    }

    setSelectedProducts([...selectedProducts, product]);
    setIsAddDialogOpen(false);
    setSearchTerm('');
  };

  // 从对比中移除产品
  const handleRemoveProduct = (productId: string) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== productId));
  };

  // 清空对比
  const handleClearAll = () => {
    setSelectedProducts([]);
  };

  // ============================================
  // 属性合并
  // ============================================

  useEffect(() => {
    if (selectedProducts.length === 0) {
      setAllAttributes([]);
      return;
    }

    // 收集所有产品的属性模板（去重）
    const attributeMap = new Map<string, any>();

    selectedProducts.forEach(product => {
      product.attributes?.forEach(attr => {
        if (!attributeMap.has(attr.attribute.id)) {
          attributeMap.set(attr.attribute.id, {
            id: attr.attribute.id,
            name: attr.attribute.name,
            code: attr.attribute.code,
            type: attr.attribute.type,
            unit: attr.attribute.unit,
          });
        }
      });
    });

    setAllAttributes(Array.from(attributeMap.values()));
  }, [selectedProducts]);

  // ============================================
  // 保存对比报告
  // ============================================

  const handleSave = async () => {
    if (selectedProducts.length < 2) {
      alert('请至少选择 2 个产品进行对比');
      return;
    }

    try {
      setSaving(true);

      const submitData = {
        name: `产品对比 - ${new Date().toLocaleDateString('zh-CN')}`,
        products: selectedProducts.map(p => ({ productId: p.id })),
      };

      const response = await fetch('/api/product-research/comparisons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      const result = await response.json();

      if (result.success) {
        alert('对比报告已保存');
        // 可以跳转到详情页或刷新列表
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
  // 辅助函数
  // ============================================

  // 获取属性值
  const getAttributeValue = (product: Product, attributeId: string): string => {
    const attr = product.attributes?.find(a => a.attributeId === attributeId);
    return attr?.value || '-';
  };

  // 计算毛利率
  const calculateMargin = (product: Product): number | null => {
    if (product.costPrice && product.salePrice && product.salePrice > 0) {
      return ((product.salePrice - product.costPrice) / product.salePrice) * 100;
    }
    return null;
  };

  // 格式化价格
  const formatPrice = (price: number | string | null, currency: string): string => {
    if (price === null || price === '') return '-';
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numPrice)) return '-';
    return `${currency} ${numPrice.toFixed(2)}`;
  };

  // 查找最低/最高价
  const findMinPrice = (): number | null => {
    const prices = selectedProducts
      .map(p => p.salePrice)
      .filter((p): p is number => p !== null);
    return prices.length > 0 ? Math.min(...prices) : null;
  };

  const findMaxPrice = (): number | null => {
    const prices = selectedProducts
      .map(p => p.salePrice)
      .filter((p): p is number => p !== null);
    return prices.length > 0 ? Math.max(...prices) : null;
  };

  // 查找最高毛利率
  const findMaxMargin = (): number | null => {
    const margins = selectedProducts
      .map(p => calculateMargin(p))
      .filter((m): m is number => m !== null);
    return margins.length > 0 ? Math.max(...margins) : null;
  };

  // 过滤可用产品（搜索 + 排除已选）
  const filteredProducts = availableProducts.filter(product => {
    const isSearched = searchTerm === '' || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand?.toLowerCase().includes(searchTerm.toLowerCase());
    const isSelected = selectedProducts.find(p => p.id === product.id);
    return isSearched && !isSelected;
  });

  // ============================================
  // 空状态
  // ============================================

  if (selectedProducts.length === 0) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">产品对比</h1>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            添加产品
          </Button>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold mb-2">暂无对比产品</h3>
            <p className="text-gray-500 mb-4">选择 2-5 个产品进行并排对比</p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              添加产品
            </Button>
          </CardContent>
        </Card>

        {/* 添加产品对话框 */}
        <AddProductDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          products={filteredProducts}
          onAddProduct={handleAddProduct}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />
      </div>
    );
  }

  // ============================================
  // 对比表格
  // ============================================

  const minPrice = findMinPrice();
  const maxPrice = findMaxPrice();
  const maxMargin = findMaxMargin();

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* 页面头部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">产品对比</h1>
          <p className="text-gray-500">
            已选择 {selectedProducts.length} 个产品（最多 5 个）
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            添加产品
          </Button>
          <Button variant="outline" onClick={handleClearAll} disabled={selectedProducts.length === 0}>
            <X className="w-4 h-4 mr-2" />
            清空
          </Button>
          <Button onClick={handleSave} disabled={saving || selectedProducts.length < 2}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? '保存中...' : '保存报告'}
          </Button>
        </div>
      </div>

      {/* 对比表格 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px] bg-gray-50">属性名称</TableHead>
                  {selectedProducts.map((product) => (
                    <TableHead key={product.id} className="min-w-[180px]">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{product.name}</div>
                          {product.brand && (
                            <div className="text-sm text-gray-500">{product.brand}</div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveProduct(product.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* 基础信息 */}
                <TableRow>
                  <TableCell className="font-medium bg-gray-50">产品名称</TableCell>
                  {selectedProducts.map((product) => (
                    <TableCell key={product.id}>
                      <div>{product.name}</div>
                      {product.nameEn && (
                        <div className="text-sm text-gray-500">{product.nameEn}</div>
                      )}
                    </TableCell>
                  ))}
                </TableRow>

                <TableRow>
                  <TableCell className="font-medium bg-gray-50">品牌</TableCell>
                  {selectedProducts.map((product) => (
                    <TableCell key={product.id}>{product.brand || '-'}</TableCell>
                  ))}
                </TableRow>

                <TableRow>
                  <TableCell className="font-medium bg-gray-50">型号</TableCell>
                  {selectedProducts.map((product) => (
                    <TableCell key={product.id}>{product.model || '-'}</TableCell>
                  ))}
                </TableRow>

                <TableRow>
                  <TableCell className="font-medium bg-gray-50">品类</TableCell>
                  {selectedProducts.map((product) => (
                    <TableCell key={product.id}>
                      {product.category?.name || '-'}
                    </TableCell>
                  ))}
                </TableRow>

                {/* 价格信息 */}
                <TableRow className="bg-blue-50">
                  <TableCell className="font-medium bg-gray-50">成本价</TableCell>
                  {selectedProducts.map((product) => (
                    <TableCell key={product.id}>
                      {formatPrice(product.costPrice, product.currency)}
                    </TableCell>
                  ))}
                </TableRow>

                <TableRow className="bg-blue-50">
                  <TableCell className="font-medium bg-gray-50">销售价</TableCell>
                  {selectedProducts.map((product) => {
                    const isMin = product.salePrice === minPrice;
                    const isMax = product.salePrice === maxPrice;
                    return (
                      <TableCell key={product.id}>
                        <div className="flex items-center gap-2">
                          {formatPrice(product.salePrice, product.currency)}
                          {isMin && selectedProducts.length > 1 && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              最低
                            </Badge>
                          )}
                          {isMax && selectedProducts.length > 1 && (
                            <Badge variant="secondary" className="bg-red-100 text-red-800">
                              最高
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>

                <TableRow className="bg-blue-50">
                  <TableCell className="font-medium bg-gray-50">毛利率</TableCell>
                  {selectedProducts.map((product) => {
                    const margin = calculateMargin(product);
                    const isMax = margin === maxMargin;
                    return (
                      <TableCell key={product.id}>
                        <div className="flex items-center gap-2">
                          {margin ? `${margin.toFixed(1)}%` : '-'}
                          {isMax && margin && selectedProducts.length > 1 && (
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                              <Star className="w-3 h-3 mr-1" />
                              最高
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>

                {/* 动态属性 */}
                {allAttributes.length > 0 && (
                  <>
                    <TableRow>
                      <TableCell colSpan={selectedProducts.length + 1} className="bg-gray-100 font-semibold">
                        产品属性
                      </TableCell>
                    </TableRow>
                    {allAttributes.map((attr) => (
                      <TableRow key={attr.id}>
                        <TableCell className="font-medium bg-gray-50">
                          {attr.name}
                          {attr.unit && <span className="text-gray-500 text-sm"> ({attr.unit})</span>}
                        </TableCell>
                        {selectedProducts.map((product) => {
                          const value = getAttributeValue(product, attr.id);
                          return (
                            <TableCell key={product.id}>{value}</TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </>
                )}

                {/* 调研结论 */}
                <TableRow>
                  <TableCell className="font-medium bg-gray-50">调研结论</TableCell>
                  {selectedProducts.map((product) => {
                    const conclusionMap: Record<string, { label: string; color: string }> = {
                      recommended: { label: '推荐', color: 'bg-green-100 text-green-800' },
                      alternative: { label: '备选', color: 'bg-blue-100 text-blue-800' },
                      eliminated: { label: '淘汰', color: 'bg-red-100 text-red-800' },
                    };
                    const conclusion = product.conclusion ? conclusionMap[product.conclusion] : null;
                    return (
                      <TableCell key={product.id}>
                        {conclusion ? (
                          <Badge className={conclusion.color}>{conclusion.label}</Badge>
                        ) : (
                          <span className="text-gray-400">暂无</span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 添加产品对话框 */}
      <AddProductDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        products={filteredProducts}
        onAddProduct={handleAddProduct}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />
    </div>
  );
}

// ============================================
// 添加产品对话框组件
// ============================================

interface AddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  onAddProduct: (product: Product) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

function AddProductDialog({
  open,
  onOpenChange,
  products,
  onAddProduct,
  searchTerm,
  onSearchChange,
}: AddProductDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>添加产品到对比</DialogTitle>
          <DialogDescription>
            选择要对比的产品（最多 5 个）
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="搜索产品名称或品牌..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* 产品列表 */}
          <div className="max-h-96 overflow-y-auto border rounded-md">
            {products.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? '未找到匹配的产品' : '暂无产品'}
              </div>
            ) : (
              <div className="divide-y">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer"
                    onClick={() => onAddProduct(product)}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-gray-500">
                        {product.brand || '无品牌'} · {product.category?.name || '无分类'}
                        {product.salePrice && ` · ${product.currency} ${typeof product.salePrice === 'string' ? product.salePrice : product.salePrice.toFixed(2)}`}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
