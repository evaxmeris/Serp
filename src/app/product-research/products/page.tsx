'use client';

/**
 * 产品列表页面 - Product Research List
 * 
 * 功能：
 * - 搜索功能：按产品名称/品牌搜索
 * - 筛选功能：品类、状态、结论、时间范围
 * - 表格展示：产品信息、操作按钮
 * - 分页功能：每页 20 条
 * - 批量操作：多选、批量删除
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  category: {
    id: string;
    name: string;
    code: string;
  } | null;
  status: 'DRAFT' | 'IN_PROGRESS' | 'REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  conclusion: string | null;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 分页数据类型
 */
interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * 品类数据类型
 */
interface Category {
  id: string;
  name: string;
  code: string;
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

// ============================================
// 主组件
// ============================================

export default function ProductResearchPage() {
  const router = useRouter();
  
  // 数据状态
  const [products, setProducts] = useState<ProductResearch[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // 搜索和筛选状态
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [status, setStatus] = useState('all');
  const [conclusion, setConclusion] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // 批量操作状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // 新建对话框状态
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    nameEn: '',
    brand: '',
    brandEn: '',
    model: '',
    manufacturer: '',
    sourcePlatform: '',
    categoryId: '',
    costPrice: '',
    salePrice: '',
    currency: 'CNY',
    status: 'DRAFT',
  });

  // ============================================
  // 生命周期和数据加载
  // ============================================

  // 加载品类列表（用于筛选）
  useEffect(() => {
    loadCategories();
  }, []);

  // 加载产品列表（当筛选条件变化时）
  useEffect(() => {
    fetchProducts();
  }, [pagination.page, search, categoryId, status, conclusion, dateFrom, dateTo]);

  // 加载品类列表
  const loadCategories = async () => {
    try {
      const response = await fetch('/api/product-research/categories');
      const result = await response.json();
      if (result.success) {
        setCategories(result.data || []);
      }
    } catch (error) {
      console.error('加载品类失败:', error);
    }
  };

  // 加载产品列表
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(search && { search }),
        ...(categoryId && { categoryId }),
        ...(status && { status }),
        ...(conclusion && { conclusion }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      });

      const response = await fetch(`/api/product-research/products?${params}`);
      const result = await response.json();

      if (result.success) {
        setProducts(result.data || []);
        setPagination(result.pagination || pagination);
      }
    } catch (error) {
      console.error('加载产品列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // 搜索和筛选处理
  // ============================================

  // 处理搜索（防抖）
  const handleSearch = (value: string) => {
    setSearch(value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // 重置筛选条件
  const handleResetFilters = () => {
    setSearch('');
    setCategoryId('');
    setStatus('');
    setConclusion('');
    setDateFrom('');
    setDateTo('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // ============================================
  // 批量操作处理
  // ============================================

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(products.map(p => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // 单选/取消单选
  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) {
      alert('请选择要删除的产品');
      return;
    }

    if (!confirm(`确定要删除选中的 ${selectedIds.size} 个产品吗？此操作不可恢复。`)) {
      return;
    }

    try {
      const response = await fetch('/api/product-research/products/batch-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      const result = await response.json();

      if (result.success) {
        alert('批量删除成功');
        setSelectedIds(new Set());
        fetchProducts();
      } else {
        alert(result.error || '批量删除失败');
      }
    } catch (error) {
      console.error('批量删除失败:', error);
      alert('批量删除失败');
    }

    setIsDeleteDialogOpen(false);
  };

  // ============================================
  // 单个产品操作
  // ============================================

  // 删除单个产品
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除产品"${name}"吗？此操作不可恢复。`)) {
      return;
    }

    try {
      const response = await fetch(`/api/product-research/products/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        alert('删除成功');
        fetchProducts();
      } else {
        alert(result.error || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    }
  };

  // 创建新产品
  const handleCreate = async () => {
    if (!newProduct.name || !newProduct.categoryId) {
      alert('产品名称和所属品类为必填项');
      return;
    }

    try {
      const response = await fetch('/api/product-research/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProduct,
          costPrice: newProduct.costPrice ? parseFloat(newProduct.costPrice) : null,
          salePrice: newProduct.salePrice ? parseFloat(newProduct.salePrice) : null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('产品创建成功');
        setIsCreateDialogOpen(false);
        setNewProduct({
          name: '',
          nameEn: '',
          brand: '',
          brandEn: '',
          model: '',
          manufacturer: '',
          sourcePlatform: '',
          categoryId: '',
          costPrice: '',
          salePrice: '',
          currency: 'CNY',
          status: 'DRAFT',
        });
        fetchProducts();
      } else {
        alert(result.error || '创建失败');
      }
    } catch (error) {
      console.error('创建失败:', error);
      alert('创建失败');
    }
  };

  // ============================================
  // 分页处理
  // ============================================

  // 跳转到指定页
  const handlePageChange = (page: number) => {
    if (page < 1 || page > pagination.totalPages) return;
    setPagination(prev => ({ ...prev, page }));
  };

  // ============================================
  // 渲染辅助函数
  // ============================================

  // 渲染状态标签
  const renderStatusBadge = (status: string) => {
    const config = STATUS_MAP[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  // 渲染结论标签
  const renderConclusionBadge = (conclusion: string | null) => {
    if (!conclusion) return <span className="text-gray-400">-</span>;
    const config = CONCLUSION_MAP[conclusion] || { label: conclusion, color: 'bg-gray-100 text-gray-800' };
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  // 渲染价格
  const renderPrice = (price: number | string | null, currency: string) => {
    if (price === null || price === '') return <span className="text-gray-400">-</span>;
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numPrice)) return <span className="text-gray-400">-</span>;
    return (
      <span>
        {currency} {numPrice.toFixed(2)}
      </span>
    );
  };

  // ============================================
  // 页面渲染
  // ============================================

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">产品调研列表</CardTitle>
            <div className="flex gap-2">
              {/* 批量操作按钮 */}
              {selectedIds.size > 0 && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    批量删除 ({selectedIds.size})
                  </Button>
                  <Button variant="outline" disabled>
                    批量导出
                  </Button>
                </>
              )}
              
              {/* 新建按钮 */}
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>新建产品</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>新建产品调研</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-4 py-4">
                    <div className="col-span-2">
                      <label className="text-sm mb-1 block">产品名称 *</label>
                      <Input
                        placeholder="产品名称"
                        value={newProduct.name}
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, name: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm mb-1 block">英文名称</label>
                      <Input
                        placeholder="English Name"
                        value={newProduct.nameEn}
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, nameEn: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm mb-1 block">品牌</label>
                      <Input
                        placeholder="品牌"
                        value={newProduct.brand}
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, brand: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm mb-1 block">品牌（英文）</label>
                      <Input
                        placeholder="Brand (EN)"
                        value={newProduct.brandEn}
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, brandEn: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm mb-1 block">型号</label>
                      <Input
                        placeholder="型号"
                        value={newProduct.model}
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, model: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm mb-1 block">生产厂家</label>
                      <Input
                        placeholder="生产厂家"
                        value={newProduct.manufacturer}
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, manufacturer: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm mb-1 block">来源平台</label>
                      <Input
                        placeholder="如：1688、淘宝"
                        value={newProduct.sourcePlatform}
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, sourcePlatform: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm mb-1 block">所属品类 *</label>
                      <Select
                        value={newProduct.categoryId}
                        onValueChange={(value) =>
                          setNewProduct({ ...newProduct, categoryId: value })
                        }
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
                      <label className="text-sm mb-1 block">成本价</label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={newProduct.costPrice}
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, costPrice: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm mb-1 block">销售价</label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={newProduct.salePrice}
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, salePrice: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm mb-1 block">币种</label>
                      <Select
                        value={newProduct.currency}
                        onValueChange={(value) =>
                          setNewProduct({ ...newProduct, currency: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CNY">CNY (人民币)</SelectItem>
                          <SelectItem value="USD">USD (美元)</SelectItem>
                          <SelectItem value="EUR">EUR (欧元)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm mb-1 block">状态</label>
                      <Select
                        value={newProduct.status}
                        onValueChange={(value) =>
                          setNewProduct({ ...newProduct, status: value as any })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DRAFT">草稿</SelectItem>
                          <SelectItem value="IN_PROGRESS">调研中</SelectItem>
                          <SelectItem value="REVIEW">待审核</SelectItem>
                          <SelectItem value="APPROVED">已完成</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={handleCreate}>保存</Button>
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      取消
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* 搜索和筛选区域 */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 搜索框 */}
              <div>
                <label className="text-sm mb-1 block">搜索</label>
                <Input
                  placeholder="产品名称/品牌"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>

              {/* 品类筛选 */}
              <div>
                <label className="text-sm mb-1 block">品类</label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="全部品类" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部品类</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 状态筛选 */}
              <div>
                <label className="text-sm mb-1 block">状态</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="全部状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="DRAFT">草稿</SelectItem>
                    <SelectItem value="IN_PROGRESS">调研中</SelectItem>
                    <SelectItem value="REVIEW">待审核</SelectItem>
                    <SelectItem value="APPROVED">已完成</SelectItem>
                    <SelectItem value="REJECTED">已拒绝</SelectItem>
                    <SelectItem value="ARCHIVED">已归档</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 结论筛选 */}
              <div>
                <label className="text-sm mb-1 block">结论</label>
                <Select value={conclusion} onValueChange={setConclusion}>
                  <SelectTrigger>
                    <SelectValue placeholder="全部结论" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部结论</SelectItem>
                    <SelectItem value="recommended">推荐</SelectItem>
                    <SelectItem value="alternative">备选</SelectItem>
                    <SelectItem value="eliminated">淘汰</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 创建时间从 */}
              <div>
                <label className="text-sm mb-1 block">创建时间从</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              {/* 创建时间到 */}
              <div>
                <label className="text-sm mb-1 block">创建时间到</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>

              {/* 重置按钮 */}
              <div className="flex items-end">
                <Button variant="outline" onClick={handleResetFilters}>
                  重置筛选
                </Button>
              </div>
            </div>
          </div>

          {/* 表格区域 */}
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedIds.size === products.length && products.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>产品名称</TableHead>
                      <TableHead>品牌</TableHead>
                      <TableHead>平台</TableHead>
                      <TableHead>成本价</TableHead>
                      <TableHead>销售价</TableHead>
                      <TableHead>品类</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>结论</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(product.id)}
                            onCheckedChange={(checked) =>
                              handleSelectOne(product.id, checked as boolean)
                            }
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div>{product.name}</div>
                          {product.nameEn && (
                            <div className="text-sm text-gray-500">{product.nameEn}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>{product.brand || '-'}</div>
                          {product.brandEn && (
                            <div className="text-sm text-gray-500">{product.brandEn}</div>
                          )}
                        </TableCell>
                        <TableCell>{product.sourcePlatform || '-'}</TableCell>
                        <TableCell>
                          {renderPrice(product.costPrice, product.currency)}
                        </TableCell>
                        <TableCell>
                          {renderPrice(product.salePrice, product.currency)}
                        </TableCell>
                        <TableCell>
                          {product.category?.name || '-'}
                        </TableCell>
                        <TableCell>
                          {renderStatusBadge(product.status)}
                        </TableCell>
                        <TableCell>
                          {renderConclusionBadge(product.conclusion)}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(product.createdAt).toLocaleDateString('zh-CN')}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                操作
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem
                                onClick={() => router.push(`/product-research/products/${product.id}`)}
                              >
                                查看
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => router.push(`/product-research/products/${product.id}/edit`)}
                              >
                                编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(product.id, product.name)}
                                className="text-red-600"
                              >
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 分页区域 */}
              {products.length > 0 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-500">
                    共 {pagination.total} 条，第 {pagination.page} / {pagination.totalPages} 页
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(1)}
                      disabled={pagination.page === 1}
                    >
                      首页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                    >
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                    >
                      下一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.totalPages)}
                      disabled={pagination.page === pagination.totalPages}
                    >
                      末页
                    </Button>
                  </div>
                </div>
              )}

              {products.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500">
                  暂无产品数据
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 批量删除确认对话框 */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认批量删除</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>确定要删除选中的 {selectedIds.size} 个产品吗？</p>
            <p className="text-red-600 mt-2">此操作不可恢复！</p>
          </div>
          <div className="flex gap-3">
            <Button variant="destructive" onClick={handleBatchDelete}>
              确认删除
            </Button>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              取消
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
