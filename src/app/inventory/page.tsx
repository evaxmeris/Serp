'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Plus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { useSortable, SortIndicator } from '@/hooks/use-sortable';

interface Inventory {
  id: string;
  product: {
    id: string;
    name: string;
    sku: string;
    unit: string;
  };
  warehouse: string | { id: string; name: string; code: string };
  quantity: number;
  availableQuantity: number;
  lockedQuantity: number;
  minStock?: number;
  maxStock?: number;
  lastInboundDate?: string;
  lastOutboundDate?: string;
  updatedAt: string;
}

interface InventoryResponse {
  success: boolean;
  data: {
    items: Inventory[];
    pagination: {
      page: number;
      limit: number;
      total: number;
    };
  };
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
}

export default function InventoryPage() {
  const { toasts, removeToast, toast } = useToast();
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // 仓库和产品列表
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [adjustForm, setAdjustForm] = useState({
    productId: '',
    warehouseId: '',
    quantity: 0,
    type: 'IN' as string,
    note: '',
  });

  // 仓库筛选
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');

  // 列排序
  const { sorted, requestSort, sortConfig } = useSortable(inventories, 'product.name');

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(search && { search }),
      });
      // 添加仓库筛选
      if (warehouseFilter !== 'ALL') {
        params.set('warehouseId', warehouseFilter);
      }

      const res = await fetch(`/api/v1/inventory?${params}`);
      const data: InventoryResponse = await res.json();

      if (data.success) {
        setInventories(data.data.items);
        setTotal(data.data.pagination.total);
        setTotalPages(Math.ceil(data.data.pagination.total / 50));
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载仓库和产品列表
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const res = await fetch('/api/v1/warehouses?status=ACTIVE&limit=100');
        const data = await res.json();
        if (data.success) {
          setWarehouses(data.data.items || []);
        }
      } catch (error) {
        console.error('Failed to fetch warehouses:', error);
      }
    };

    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/v1/products?limit=500&page=1');
        const data = await res.json();
        if (data.success) {
          setProducts(data.data.items || []);
        }
      } catch (error) {
        console.error('Failed to fetch products:', error);
      }
    };

    fetchWarehouses();
    fetchProducts();
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [page, search, warehouseFilter]);

  const handleAdjust = async () => {
    try {
      const res = await fetch('/api/v1/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjustForm),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('库存调整成功');
        setAdjustDialogOpen(false);
        fetchInventory();
        setAdjustForm({
          productId: '',
          warehouseId: warehouses.length > 0 ? warehouses[0].code : '',
          quantity: 0,
          type: 'IN',
          note: '',
        });
      } else {
        toast.error(data.message || '调整失败');
      }
    } catch (error) {
      console.error('Failed to adjust:', error);
      toast.error('调整失败');
    }
  };

  // 打开调整对话框时设置默认值
  const openAdjustDialog = () => {
    setAdjustForm({
      productId: '',
      warehouseId: warehouses.length > 0 ? warehouses[0].code : '',
      quantity: 0,
      type: 'IN',
      note: '',
    });
    setAdjustDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl">库存管理</CardTitle>
            <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openAdjustDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  库存调整
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>库存调整</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div>
                    <Label>调整类型</Label>
                    <select
                      className="w-full border rounded-md p-2"
                      value={adjustForm.type}
                      onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}
                    >
                      <option value="IN">入库</option>
                      <option value="OUT">出库</option>
                      <option value="ADJUSTMENT">调整</option>
                      <option value="TRANSFER">调拨</option>
                      <option value="RETURN">退货</option>
                    </select>
                  </div>
                  <div>
                    <Label>仓库 *</Label>
                    <Select
                      value={adjustForm.warehouseId}
                      onValueChange={(value) => setAdjustForm({ ...adjustForm, warehouseId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择仓库" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((wh) => (
                          <SelectItem key={wh.id} value={wh.code}>
                            {wh.name} ({wh.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>产品 *</Label>
                    <Select
                      value={adjustForm.productId}
                      onValueChange={(value) => setAdjustForm({ ...adjustForm, productId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择产品" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} ({product.sku})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>调整数量</Label>
                    <Input
                      type="number"
                      value={adjustForm.quantity}
                      onChange={(e) => setAdjustForm({ ...adjustForm, quantity: Number(e.target.value) })}
                      placeholder="正数增加，负数减少"
                    />
                  </div>
                  <div>
                    <Label>备注</Label>
                    <Input
                      value={adjustForm.note}
                      onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })}
                      placeholder="调整原因"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>
                      取消
                    </Button>
                    <Button onClick={handleAdjust}>确认调整</Button>
                  </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* 搜索栏 */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="搜索产品名称、SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    setPage(1);
                    fetchInventory();
                  }
                }}
              />
            </div>
            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="全部仓库" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部仓库</SelectItem>
                {warehouses.map((wh) => (
                  <SelectItem key={wh.id} value={wh.code}>
                    {wh.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => { setPage(1); fetchInventory(); }}>
              <Search className="mr-2 h-4 w-4" />
              搜索
            </Button>
          </div>

          {/* 数据表格 */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-1/4" />
                  <Skeleton className="h-5 w-20 shrink-0" />
                  <Skeleton className="h-5 w-20 shrink-0" />
                  <Skeleton className="h-5 w-16 shrink-0 ml-auto" />
                  <Skeleton className="h-5 w-16 shrink-0 ml-auto" />
                  <Skeleton className="h-5 w-16 shrink-0 ml-auto" />
                  <Skeleton className="h-5 w-12 shrink-0 ml-auto" />
                  <Skeleton className="h-5 w-20 shrink-0" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">序号</TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => requestSort('product.name')}
                    >
                      产品名称
                      <SortIndicator field="product.name" sortConfig={sortConfig} />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => requestSort('product.sku')}
                    >
                      SKU
                      <SortIndicator field="product.sku" sortConfig={sortConfig} />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => requestSort('warehouse')}
                    >
                      仓库
                      <SortIndicator field="warehouse" sortConfig={sortConfig} />
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => requestSort('quantity')}
                    >
                      库存数量
                      <SortIndicator field="quantity" sortConfig={sortConfig} />
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => requestSort('availableQuantity')}
                    >
                      可用数量
                      <SortIndicator field="availableQuantity" sortConfig={sortConfig} />
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => requestSort('lockedQuantity')}
                    >
                      锁定数量
                      <SortIndicator field="lockedQuantity" sortConfig={sortConfig} />
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => requestSort('product.unit')}
                    >
                      单位
                      <SortIndicator field="product.unit" sortConfig={sortConfig} />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => requestSort('lastInboundDate')}
                    >
                      最后入库
                      <SortIndicator field="lastInboundDate" sortConfig={sortConfig} />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <EmptyState
                          title="暂无库存数据"
                          description="还没有任何库存记录，入库后将自动生成库存数据"
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    sorted.map((inv, idx) => (
                      <TableRow key={inv.id}>
                        <TableCell className="text-center text-muted-foreground text-sm">{(page - 1) * 50 + idx + 1}</TableCell>
                        <TableCell className="font-medium">
                          {inv.product.name}
                        </TableCell>
                        <TableCell>{inv.product.sku}</TableCell>
                        <TableCell>{(() => {
                          const whCode = typeof inv.warehouse === 'string' ? inv.warehouse : inv.warehouse?.code || '';
                          const wh = warehouses.find(w => w.code === whCode);
                          return wh?.name || whCode || '-';
                        })()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {inv.quantity > 0 ? (
                              <ArrowUpRight className="h-4 w-4 text-green-600" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 text-red-600" />
                            )}
                            <Badge variant={inv.quantity > 0 ? 'default' : 'destructive'}>
                              {inv.quantity}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {inv.availableQuantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {inv.lockedQuantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {inv.product.unit}
                        </TableCell>
                        <TableCell>
                          {inv.lastInboundDate
                            ? new Date(inv.lastInboundDate).toLocaleDateString('zh-CN')
                            : '-'
                          }
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* 分页 */}
              {total > 50 && (
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-gray-500">
                    共 {total} 条记录
                  </div>
                  <div className="flex gap-2 items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      上一页
                    </Button>
                    <div className="flex items-center gap-1 text-sm">
                      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 7) {
                          pageNum = i + 1;
                        } else if (page <= 4) {
                          pageNum = i + 1;
                        } else if (page >= totalPages - 3) {
                          pageNum = totalPages - 6 + i;
                        } else {
                          pageNum = page - 3 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={pageNum === page ? 'default' : 'outline'}
                            size="sm"
                            className="min-w-[32px]"
                            onClick={() => setPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <span className="text-sm text-gray-500">/ {totalPages} 页</span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">跳至</span>
                      <Input
                        type="number"
                        min={1}
                        max={totalPages}
                        className="w-16 h-8 text-sm"
                        placeholder="页"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = parseInt((e.target as HTMLInputElement).value);
                            if (val >= 1 && val <= totalPages) setPage(val);
                          }
                        }}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
