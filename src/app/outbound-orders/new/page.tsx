'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

interface Order {
  id: string;
  orderNo: string;
  customer?: {
    id: string;
    companyName: string;
  };
  status: string;
  items: {
    id: string;
    productId: string;
    productName: string;
    productSku: string;
    quantity: number;
    shippedQty: number;
    unitPrice: number;
  }[];
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface OrderItem {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  warehouseId: string;
  batchNo?: string;
  location?: string;
  notes?: string;
  maxQuantity: number;
}

export default function CreateOutboundOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // 销售订单选择
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  // 仓库选择
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  
  // 商品明细
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  
  // 搜索
  const [searchOrder, setSearchOrder] = useState('');

  // 加载仓库列表
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const response = await fetch('/api/v1/warehouses?status=ACTIVE');
        const result = await response.json();
        if (result.success) {
          setWarehouses(result.data.items || []);
          if (result.data.items?.length > 0) {
            setSelectedWarehouseId(result.data.items[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch warehouses:', error);
      }
    };
    fetchWarehouses();
  }, []);

  // 搜索销售订单
  const searchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: 'CONFIRMED',
        limit: '20',
      });
      if (searchOrder) {
        params.set('search', searchOrder);
      }
      
      const response = await fetch(`/api/v1/orders?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setOrders(result.data.items || []);
      }
    } catch (error) {
      console.error('Failed to search orders:', error);
    } finally {
      setLoading(false);
    }
  };

  // 选择销售订单后加载商品
  useEffect(() => {
    if (selectedOrderId) {
      const order = orders.find(o => o.id === selectedOrderId);
      setSelectedOrder(order || null);
      
      if (order) {
        const items: OrderItem[] = order.items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          productSku: item.productSku,
          quantity: item.quantity - item.shippedQty, // 可出库数量
          unitPrice: item.unitPrice,
          warehouseId: selectedWarehouseId,
          maxQuantity: item.quantity - item.shippedQty,
        }));
        setOrderItems(items);
      }
    }
  }, [selectedOrderId, orders, selectedWarehouseId]);

  // 更新商品数量
  const updateItemQuantity = (index: number, quantity: number) => {
    const newItems = [...orderItems];
    newItems[index].quantity = Math.max(0, Math.min(quantity, newItems[index].maxQuantity));
    setOrderItems(newItems);
  };

  // 更新仓库
  const updateItemWarehouse = (index: number, warehouseId: string) => {
    const newItems = [...orderItems];
    newItems[index].warehouseId = warehouseId;
    setOrderItems(newItems);
  };

  // 更新备注
  const updateItemNotes = (index: number, field: string, value: string) => {
    const newItems = [...orderItems];
    (newItems[index] as any)[field] = value;
    setOrderItems(newItems);
  };

  // 计算总金额
  const totalAmount = orderItems.reduce((sum, item) => {
    return sum + (item.quantity * item.unitPrice);
  }, 0);

  // 提交创建
  const handleSubmit = async () => {
    if (!selectedOrderId) {
      alert('请选择销售订单');
      return;
    }

    if (orderItems.length === 0) {
      alert('请至少添加一个商品');
      return;
    }

    const items = orderItems.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      warehouseId: item.warehouseId,
      unitPrice: item.unitPrice,
      batchNo: item.batchNo || undefined,
      location: item.location || undefined,
      notes: item.notes || undefined,
    }));

    setSubmitting(true);
    try {
      const response = await fetch('/api/v1/outbound-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrderId,
          items,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('出库单创建成功');
        router.push(`/outbound-orders/${result.data.id}`);
      } else {
        alert(`创建失败：${result.message}`);
      }
    } catch (error) {
      console.error('Failed to create outbound order:', error);
      alert('创建失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => router.push('/outbound-orders')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
        </Button>
        <h1 className="text-2xl font-bold">创建出库单</h1>
      </div>

      <div className="grid gap-6">
        {/* 选择销售订单 */}
        <Card>
          <CardHeader>
            <CardTitle>选择销售订单</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <Input
                placeholder="搜索订单号、客户名称..."
                value={searchOrder}
                onChange={(e) => setSearchOrder(e.target.value)}
                className="max-w-sm"
              />
              <Button onClick={searchOrders} disabled={loading}>
                搜索
              </Button>
            </div>

            {loading && <div className="text-sm text-muted-foreground">加载中...</div>}

            {!loading && orders.length > 0 && (
              <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择销售订单" />
                </SelectTrigger>
                <SelectContent>
                  {orders.map(order => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.orderNo} - {order.customer?.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {selectedOrder && (
              <div className="mt-4 p-4 bg-muted rounded-md">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">订单号：</span>
                    <span className="font-medium">{selectedOrder.orderNo}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">客户：</span>
                    <span className="font-medium">{selectedOrder.customer?.companyName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">状态：</span>
                    <span className="font-medium">{selectedOrder.status}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 商品明细 */}
        {orderItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>商品明细</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>产品编码</TableHead>
                    <TableHead>产品名称</TableHead>
                    <TableHead>仓库</TableHead>
                    <TableHead className="text-right">可出库数量</TableHead>
                    <TableHead className="text-right">出库数量</TableHead>
                    <TableHead className="text-right">单价</TableHead>
                    <TableHead className="text-right">金额</TableHead>
                    <TableHead>批次号</TableHead>
                    <TableHead>库位</TableHead>
                    <TableHead>备注</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderItems.map((item, index) => (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium">{item.productSku}</TableCell>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell>
                        <Select
                          value={item.warehouseId}
                          onValueChange={(v) => updateItemWarehouse(index, v)}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {warehouses.map(wh => (
                              <SelectItem key={wh.id} value={wh.id}>
                                {wh.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">{item.maxQuantity}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 0)}
                          className="w-24 text-right"
                          min={0}
                          max={item.maxQuantity}
                        />
                      </TableCell>
                      <TableCell className="text-right">¥{item.unitPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">
                        ¥{(item.quantity * item.unitPrice).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.batchNo || ''}
                          onChange={(e) => updateItemNotes(index, 'batchNo', e.target.value)}
                          placeholder="批次号"
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.location || ''}
                          onChange={(e) => updateItemNotes(index, 'location', e.target.value)}
                          placeholder="库位"
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.notes || ''}
                          onChange={(e) => updateItemNotes(index, 'notes', e.target.value)}
                          placeholder="备注"
                          className="w-40"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator className="my-4" />

              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">
                  总金额：¥{totalAmount.toFixed(2)}
                </div>
                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => router.push('/outbound-orders')}>
                    取消
                  </Button>
                  <Button onClick={handleSubmit} disabled={submitting}>
                    {submitting ? '创建中...' : '创建出库单'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
