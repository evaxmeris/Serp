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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Search, Plus, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface Inventory {
  id: string;
  product: {
    id: string;
    name: string;
    sku: string;
    unit: string;
  };
  warehouse: {
    id: string;
    name: string;
    code: string;
  };
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

export default function InventoryPage() {
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const [adjustForm, setAdjustForm] = useState({
    productId: '',
    warehouseId: 'default',
    quantity: 0,
    type: 'IN',
    note: '',
  });

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(search && { search }),
      });

      const res = await fetch(`/api/v1/inventory?${params}`);
      const data: InventoryResponse = await res.json();

      if (data.success) {
        setInventories(data.data.items);
        setTotal(data.data.pagination.total);
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [page, search]);

  const handleAdjust = async () => {
    try {
      const res = await fetch('/api/v1/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjustForm),
      });

      const data = await res.json();

      if (data.success) {
        alert('库存调整成功');
        setAdjustDialogOpen(false);
        fetchInventory();
        setAdjustForm({
          productId: '',
          warehouseId: 'default',
          quantity: 0,
          type: 'IN',
          note: '',
        });
      } else {
        alert(data.message || '调整失败');
      }
    } catch (error) {
      console.error('Failed to adjust:', error);
      alert('调整失败');
    }
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl">库存管理</CardTitle>
            <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
              <DialogTrigger asChild>
                <Button>
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
                    <Label>产品 ID</Label>
                    <Input
                      value={adjustForm.productId}
                      onChange={(e) => setAdjustForm({ ...adjustForm, productId: e.target.value })}
                      placeholder="产品 ID"
                    />
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
                  <Button onClick={handleAdjust}>确认调整</Button>
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
            <Button onClick={() => { setPage(1); fetchInventory(); }}>
              <Search className="mr-2 h-4 w-4" />
              搜索
            </Button>
          </div>

          {/* 数据表格 */}
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>产品名称</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>仓库</TableHead>
                    <TableHead className="text-right">库存数量</TableHead>
                    <TableHead className="text-right">可用数量</TableHead>
                    <TableHead className="text-right">锁定数量</TableHead>
                    <TableHead className="text-right">单位</TableHead>
                    <TableHead>最后入库</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    inventories.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">
                          {inv.product.name}
                        </TableCell>
                        <TableCell>{inv.product.sku}</TableCell>
                        <TableCell>{inv.warehouse.name}</TableCell>
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
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={inventories.length < 50}
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
    </div>
  );
}
