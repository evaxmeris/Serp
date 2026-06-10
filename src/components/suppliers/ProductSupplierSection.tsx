'use client';

/**
 * 产品-供应商关联管理组件
 * 可在供应商详情页或产品编辑弹窗中使用
 *
 * @用法
 * <ProductSupplierSection
 *   productId="xxx"          // 按产品查（用在产品页）
 *   supplierId="xxx"         // 按供应商查（用在供应商详情页）
 *   onSupplierClick={(id) => router.push(`/suppliers/${id}`)}
 *   onProductClick={(id) => {}}
 * />
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { Plus, Trash2, Star, Search, Package, Building2 } from 'lucide-react';

interface ProductInfo {
  id: string;
  name: string;
  sku: string;
  specification?: string;
  unit?: string;
  images?: string[];
}

interface SupplierInfo {
  id: string;
  companyName: string;
  companyEn?: string;
  supplierNo: string;
  status: string;
  contactName?: string;
  email?: string;
  phone?: string;
}

interface ProductSupplierRecord {
  id: string;
  productId: string;
  supplierId: string;
  supplierSKU?: string | null;
  unitPrice?: number | null;
  currency: string;
  moq?: number | null;
  leadTime?: number | null;
  isPreferred: boolean;
  rating?: number | null;
  notes?: string | null;
  createdAt: string;
  product: ProductInfo;
  supplier: SupplierInfo;
}

interface ProductSupplierSectionProps {
  productId?: string;
  supplierId?: string;
  onSupplierClick?: (id: string) => void;
  onProductClick?: (id: string) => void;
}

const CURRENCY_MAP: Record<string, string> = {
  CNY: '¥', USD: '$', EUR: '€', GBP: '£', JPY: '¥',
};

export default function ProductSupplierSection({
  productId,
  supplierId,
  onSupplierClick,
  onProductClick,
}: ProductSupplierSectionProps) {
  const [records, setRecords] = useState<ProductSupplierRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const { toast, toasts, removeToast } = useToast();

  // 添加表单状态
  const [addProductId, setAddProductId] = useState('');
  const [addSupplierId, setAddSupplierId] = useState('');
  const [addSupplierSKU, setAddSupplierSKU] = useState('');
  const [addUnitPrice, setAddUnitPrice] = useState('');
  const [addCurrency, setAddCurrency] = useState('CNY');
  const [addMoq, setAddMoq] = useState('');
  const [addLeadTime, setAddLeadTime] = useState('');
  const [addIsPreferred, setAddIsPreferred] = useState(false);
  const [addRating, setAddRating] = useState('');
  const [addNotes, setAddNotes] = useState('');

  // 搜索产品/供应商列表
  const [productSearch, setProductSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [productOptions, setProductOptions] = useState<ProductInfo[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<SupplierInfo[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  
  // 全量供应商列表（预加载用于下拉选择）
  const [allSuppliers, setAllSuppliers] = useState<SupplierInfo[]>([]);
  const [allSuppliersLoaded, setAllSuppliersLoaded] = useState(false);

  // 品类层级选择
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedLevel1, setSelectedLevel1] = useState('');
  const [selectedLevel2, setSelectedLevel2] = useState('');
  const [categoryProducts, setCategoryProducts] = useState<any[]>([]);
  const [loadingCategoryProducts, setLoadingCategoryProducts] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (productId) params.set('productId', productId);
      if (supplierId) params.set('supplierId', supplierId);
      params.set('limit', '100');
      const res = await fetch(`/api/v1/product-suppliers?${params}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.data?.items ?? []);
      }
    } catch (e) {
      console.error('加载关联失败:', e);
    } finally {
      setLoading(false);
    }
  }, [productId, supplierId]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // 搜索产品列表（用于添加）
  const searchProducts = async (q: string) => {
    setProductSearch(q);
    if (!q.trim()) { setProductOptions([]); return; }
    setLoadingOptions(true);
    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(q)}&limit=20`);
      const data = await res.json();
      setProductOptions(data.data?.items ?? data.data ?? []);
    } catch { setProductOptions([]); }
    finally { setLoadingOptions(false); }
  };

  // 搜索供应商列表
  const searchSuppliers = async (q: string) => {
    setSupplierSearch(q);
    if (!q.trim()) { setSupplierOptions([]); return; }
    setLoadingOptions(true);
    try {
      const res = await fetch(`/api/v1/suppliers?search=${encodeURIComponent(q)}&limit=20`);
      const data = await res.json();
      setSupplierOptions(data.data?.items ?? data.data ?? []);
    } catch { setSupplierOptions([]); }
    finally { setLoadingOptions(false); }
  };

  // 打开添加弹窗
  const openAddDialog = async () => {
    setAddProductId(productId || '');
    setAddSupplierId(supplierId || '');
    setAddSupplierSKU('');
    setAddUnitPrice('');
    setAddCurrency('CNY');
    setAddMoq('');
    setAddLeadTime('');
    setAddIsPreferred(false);
    setAddRating('');
    setAddNotes('');
    setProductSearch('');
    setSupplierSearch('');
    setProductOptions([]);
    setSupplierOptions([]);
    setSelectedLevel1('');
    setSelectedLevel2('');
    setCategoryProducts([]);
    setSelectedProductIds(new Set());
    setAddDialogOpen(true);

    // 预加载所有供应商，方便下拉选择
    if (!allSuppliersLoaded && !supplierId) {
      setLoadingOptions(true);
      try {
        const res = await fetch('/api/v1/suppliers?limit=200');
        const data = await res.json();
        const list = data.data?.items ?? data.data ?? [];
        setAllSuppliers(list);
        setAllSuppliersLoaded(true);
      } catch { /* 失败则走搜索模式 */ }
      finally { setLoadingOptions(false); }
    }

    // 加载品类树（仅在供应商模式时需要）
    if (!productId) {
      try {
        const res = await fetch('/api/product-research/categories?limit=100');
        const data = await res.json();
        const catList = data.data ?? data.data?.items ?? [];
        setCategories(catList);
      } catch {}
    }
  };

  // 品类变更 - 加载该品类下的产品
  const loadCategoryProducts = async (catId: string) => {
    if (!catId) { setCategoryProducts([]); return; }
    setLoadingCategoryProducts(true);
    try {
      const res = await fetch(`/api/products?limit=200`);
      const data = await res.json();
      const allProducts = data.data?.items ?? data.data ?? [];
      // 按 categoryId 本地过滤（API 暂不支持服务端按 categoryId 筛选）
      const filtered = allProducts.filter((p: any) => p.categoryId === catId);
      setCategoryProducts(filtered);
      setSelectedProductIds(new Set());
    } catch { setCategoryProducts([]); }
    finally { setLoadingCategoryProducts(false); }
  };

  // 品类一级变更
  const handleLevel1Change = (catId: string) => {
    setSelectedLevel1(catId);
    setSelectedLevel2('');
    setCategoryProducts([]);
    setSelectedProductIds(new Set());
    // 如果没有子品类，直接加载产品
    const hasChildren = categories.filter(c => c.parentId === catId).length > 0;
    if (!hasChildren) loadCategoryProducts(catId);
  };

  // 品类二级变更
  const handleLevel2Change = (catId: string) => {
    setSelectedLevel2(catId);
    loadCategoryProducts(catId);
  };

  // 切换产品选中
  const toggleProductSelect = (pid: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  // 批量提交添加
  const handleBatchAdd = async () => {
    if (selectedProductIds.size === 0 || !addSupplierId) {
      toast.error('请先选择品类和产品');
      return;
    }
    let success = 0;
    let fail = 0;
    for (const pid of selectedProductIds) {
      try {
        const res = await fetch('/api/v1/product-suppliers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: pid,
            supplierId: addSupplierId,
            supplierSKU: addSupplierSKU || null,
            unitPrice: addUnitPrice ? parseFloat(addUnitPrice) : null,
            currency: addCurrency,
            moq: addMoq ? parseInt(addMoq) : null,
            leadTime: addLeadTime ? parseInt(addLeadTime) : null,
            isPreferred: addIsPreferred,
            rating: addRating ? parseInt(addRating) : null,
            notes: addNotes || null,
          }),
        });
        const d = await res.json();
        if (d.success) success++;
        else fail++;
      } catch { fail++; }
    }
    if (success > 0) {
      toast.success(`成功添加 ${success} 个产品${fail > 0 ? `，${fail} 个失败` : ''}`);
      setAddDialogOpen(false);
      fetchRecords();
    } else {
      toast.error('添加失败，请重试');
    }
  };

  // 选择供应商后自动填充供应商SKU
  const handleSupplierSelect = (supplier: SupplierInfo) => {
    setAddSupplierId(supplier.id);
    setSupplierSearch(supplier.companyName);
    setSupplierOptions([]);
    // 自动填充供应商SKU（用供应商编号）
    setAddSupplierSKU(supplier.supplierNo);
  };

  // 提交添加
  const handleAdd = async () => {
    if (!addProductId || !addSupplierId) {
      toast.error('请选择产品和供应商');
      return;
    }
    try {
      const res = await fetch('/api/v1/product-suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: addProductId,
          supplierId: addSupplierId,
          supplierSKU: addSupplierSKU || null,
          unitPrice: addUnitPrice ? parseFloat(addUnitPrice) : null,
          currency: addCurrency,
          moq: addMoq ? parseInt(addMoq) : null,
          leadTime: addLeadTime ? parseInt(addLeadTime) : null,
          isPreferred: addIsPreferred,
          rating: addRating ? parseInt(addRating) : null,
          notes: addNotes || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`关联创建成功`);
        setAddDialogOpen(false);
        fetchRecords();
      } else {
        toast.error(data.message || data.error || '创建失败');
      }
    } catch {
      toast.error('创建关联失败');
    }
  };

  // 删除关联
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/product-suppliers/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('关联已删除');
        fetchRecords();
      } else {
        toast.error(data.error || '删除失败');
      }
    } catch {
      toast.error('删除失败');
    }
  };

  // 切换首选
  const togglePreferred = async (record: ProductSupplierRecord) => {
    try {
      const res = await fetch(`/api/v1/product-suppliers/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPreferred: !record.isPreferred }),
      });
      const data = await res.json();
      if (data.success) {
        fetchRecords();
      }
    } catch {
      toast.error('更新失败');
    }
  };

  const title = productId ? '关联供应商' : '供应产品';
  const icon = productId ? <Building2 className="h-5 w-5" /> : <Package className="h-5 w-5" />;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon}
            {title}
            <Badge variant="secondary">{records.length}</Badge>
            <div className="ml-auto">
              <Button size="sm" onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-1" />添加
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : records.length === 0 ? (
            <EmptyState
              title={productId ? '暂无关联供应商' : '暂无供应产品'}
              description="点击「添加」按钮建立产品与供应商的关联"
            />
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    {productId ? (
                      <>
                        <TableHead>供应商</TableHead>
                        <TableHead>联系人</TableHead>
                      </>
                    ) : (
                      <TableHead>产品</TableHead>
                    )}
                    <TableHead>供应商SKU</TableHead>
                    <TableHead>报价</TableHead>
                    <TableHead>MOQ</TableHead>
                    <TableHead>交期</TableHead>
                    <TableHead>首选</TableHead>
                    <TableHead className="w-20">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id} className={r.isPreferred ? 'bg-yellow-50/50' : ''}>
                      {productId ? (
                        <>
                          <TableCell>
                            <div>
                              <button
                                className="font-medium text-blue-600 hover:underline text-left"
                                onClick={() => onSupplierClick?.(r.supplier.id)}
                              >
                                {r.supplier.companyName}
                              </button>
                              <div className="text-xs text-gray-500">{r.supplier.supplierNo}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.supplier.contactName && <div>{r.supplier.contactName}</div>}
                            {r.supplier.email && <div className="text-xs text-gray-400">{r.supplier.email}</div>}
                          </TableCell>
                        </>
                      ) : (
                        <TableCell>
                          <div>
                            <span className="font-medium">{r.product.name}</span>
                            <span className="text-xs text-gray-500 ml-2">{r.product.sku}</span>
                            {r.product.specification && (
                              <div className="text-xs text-gray-400">{r.product.specification}</div>
                            )}
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="text-sm font-mono">{r.supplierSKU || '-'}</TableCell>
                      <TableCell className="text-sm">
                        {r.unitPrice != null
                          ? `${CURRENCY_MAP[r.currency] || r.currency} ${Number(r.unitPrice).toFixed(2)}`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm">{r.moq ?? '-'}</TableCell>
                      <TableCell className="text-sm">{r.leadTime != null ? `${r.leadTime}天` : '-'}</TableCell>
                      <TableCell>
                        <button onClick={() => togglePreferred(r)} className="cursor-pointer">
                          <Star className={`h-4 w-4 ${r.isPreferred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                        </button>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-red-400" onClick={() => handleDelete(r.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 添加关联弹窗 */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>添加{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 产品选择 - 品类级联+多选列表 */}
            {!productId && (
              <div className="space-y-3">
                <Label>选择品类 *</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Select value={selectedLevel1} onValueChange={handleLevel1Change}>
                      <SelectTrigger><SelectValue placeholder="选一级品类" /></SelectTrigger>
                      <SelectContent>
                        {categories.filter((c: any) => c.level === 1 || !c.parentId).map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Select
                      value={selectedLevel2}
                      onValueChange={handleLevel2Change}
                      disabled={!selectedLevel1 || categories.filter((c: any) => c.parentId === selectedLevel1).length === 0}
                    >
                      <SelectTrigger><SelectValue placeholder="选子品类（可选）" /></SelectTrigger>
                      <SelectContent>
                        {categories.filter((c: any) => c.parentId === selectedLevel1).map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 产品列表 */}
                {(selectedLevel1 || selectedLevel2) && (
                  <div className="mt-2">
                    <Label className="mb-1 block">
                      选择产品
                      {selectedProductIds.size > 0 && (
                        <span className="text-blue-600 ml-2 text-xs">已选 {selectedProductIds.size} 项</span>
                      )}
                    </Label>
                    {loadingCategoryProducts ? (
                      <div className="text-sm text-gray-400 py-4 text-center">加载产品列表中...</div>
                    ) : categoryProducts.length === 0 ? (
                      <div className="text-sm text-gray-400 py-4 text-center border rounded-md">
                        该品类下暂无产品
                      </div>
                    ) : (
                      <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
                        {categoryProducts.map((p: any) => {
                          const alreadyLinked = records.some(r => r.productId === p.id);
                          return (
                            <div
                              key={p.id}
                              className={`px-3 py-2 flex items-center gap-3 text-sm cursor-pointer hover:bg-blue-50
                                ${selectedProductIds.has(p.id) ? 'bg-blue-50' : ''}
                                ${alreadyLinked ? 'opacity-50 pointer-events-none' : ''}`}
                              onClick={() => { if (!alreadyLinked) toggleProductSelect(p.id); }}
                            >
                              <Checkbox checked={selectedProductIds.has(p.id)} disabled={alreadyLinked} />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{p.name}</div>
                                <div className="text-xs text-gray-400">{p.sku}{p.specification ? ` | ${p.specification}` : ''}</div>
                              </div>
                              {alreadyLinked && <span className="text-xs text-gray-400 shrink-0">已关联</span>}
                              {p.costPrice != null && (
                                <span className="text-xs text-gray-500 shrink-0">¥{Number(p.costPrice).toFixed(2)}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 供应商选择 */}
            {!supplierId && (
              <div>
                <Label>选择供应商 *</Label>
                <div className="relative mt-1">
                  <Input
                    placeholder="输入名称搜索供应商..."
                    value={supplierSearch}
                    onChange={(e) => {
                      const q = e.target.value;
                      setSupplierSearch(q);
                      if (q.trim()) {
                        // 走 API 搜索（更精准）
                        searchSuppliers(q);
                      } else {
                        setSupplierOptions([]);
                      }
                    }}
                    onFocus={() => {
                      // 聚焦时展示所有供应商列表
                      if (allSuppliers.length > 0 && !supplierSearch.trim()) {
                        setSupplierOptions(allSuppliers);
                      }
                    }}
                  />
                </div>
                {loadingOptions && <p className="text-xs text-gray-400 mt-1">加载供应商列表...</p>}
                <div className="mt-1 border rounded-md max-h-40 overflow-y-auto">
                  {supplierOptions.length > 0 ? (
                    supplierOptions.map((s) => (
                      <div
                        key={s.id}
                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 flex items-center justify-between ${addSupplierId === s.id ? 'bg-blue-50 font-medium' : ''}`}
                        onClick={() => handleSupplierSelect(s)}
                      >
                        <div>
                          <div>{s.companyName}</div>
                          <div className="text-xs text-gray-400">{s.supplierNo}{s.contactName ? ` · ${s.contactName}` : ''}</div>
                        </div>
                        {addSupplierId === s.id && <span className="text-blue-600 text-xs">✓ 已选</span>}
                      </div>
                    ))
                  ) : supplierSearch.trim() && !loadingOptions ? (
                    <div className="px-3 py-4 text-sm text-gray-400 text-center">
                      未找到匹配供应商，请尝试其他关键词
                    </div>
                  ) : allSuppliersLoaded && !supplierSearch.trim() ? (
                    <div className="px-3 py-4 text-sm text-gray-400 text-center">
                      输入名称开始搜索供应商
                    </div>
                  ) : null}
                </div>
                {addSupplierId && (
                  <div className="mt-1 text-xs text-green-600">
                    ✓ 已选择：{supplierSearch}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>供应商SKU/料号</Label>
                <Input value={addSupplierSKU} onChange={(e) => setAddSupplierSKU(e.target.value)} placeholder="可选" />
              </div>
              <div>
                <Label>报价</Label>
                <div className="flex gap-2 mt-1">
                  <div className="w-20">
                    <Select value={addCurrency} onValueChange={setAddCurrency}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CNY">CNY</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    type="number" step="0.01" min="0"
                    value={addUnitPrice} onChange={(e) => setAddUnitPrice(e.target.value)}
                    placeholder="单价"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>MOQ</Label>
                <Input type="number" min="1" value={addMoq} onChange={(e) => setAddMoq(e.target.value)} placeholder="最小起订量" />
              </div>
              <div>
                <Label>交期（天）</Label>
                <Input type="number" min="1" value={addLeadTime} onChange={(e) => setAddLeadTime(e.target.value)} placeholder="交期" />
              </div>
              <div>
                <Label>评分（1-5）</Label>
                <Input type="number" min="1" max="5" value={addRating} onChange={(e) => setAddRating(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox checked={addIsPreferred} onCheckedChange={(v) => setAddIsPreferred(!!v)} id="preferred" />
              <Label htmlFor="preferred" className="cursor-pointer">设为该产品首选供应商</Label>
            </div>

            <div>
              <Label>备注</Label>
              <Input value={addNotes} onChange={(e) => setAddNotes(e.target.value)} placeholder="可选备注" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>取消</Button>
            <Button onClick={!productId ? handleBatchAdd : handleAdd} disabled={!productId && selectedProductIds.size === 0}>
              {!productId && selectedProductIds.size > 0
                ? `添加选中（${selectedProductIds.size} 项）`
                : '确认添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
}
