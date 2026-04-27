'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
import { ArrowLeft, Save, Plus, Trash2, AlertTriangle } from 'lucide-react';

interface OutboundOrder {
  id: string;
  outboundNo: string;
  orderId: string;
  warehouseId: string;
  status: string;
  totalAmount: number | null;
  items?: {
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number | null;
    batchNo?: string | null;
    location?: string | null;
    notes?: string | null;
    product?: {
      id: string;
      name: string;
      sku: string;
    };
  }[];
  order?: {
    id: string;
    orderNo: string;
  };
  warehouse?: {
    id: string;
    name: string;
    code: string;
  };
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface OrderItem {
  id?: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  warehouseId: string;
  batchNo?: string;
  location?: string;
  notes?: string;
  isNew?: boolean;
}

export default function EditOutboundOrderPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<OutboundOrder | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);

  // 加载出库单详情
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await fetch(`/api/v1/outbound-orders/${params.id}`);
        const result = await response.json();

        if (result.success) {
          setOrder(result.data);
          
          // 验证状态
          if (result.data.status !== 'PENDING') {
            alert('只有待处理状态的出库单可以编辑');
            router.push(`/outbound-orders/${params.id}`);
            return;
          }

          // 加载商品明细
          if (result.data.items) {
            const orderItems: OrderItem[] = result.data.items.map((item: any) => ({
              id: item.id,
              productId: item.productId,
              productName: item.product?.name || '',
              productSku: item.product?.sku || '',
              quantity: item.quantity,
              unitPrice: item.unitPrice || 0,
              warehouseId: item.warehouseId || result.data.warehouseId,
              batchNo: item.batchNo || '',
              location: item.location || '',
              notes: item.notes || '',
            }));
            setItems(orderItems);
          }
        } else {
          alert('出库单不存在');
          router.push('/outbound-orders');
        }
      } catch (error) {
        console.error('Failed to fetch outbound order:', error);
        alert('加载失败，请重试');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [params.id, router]);

  // 加载仓库列表
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const response = await fetch('/api/v1/warehouses?status=ACTIVE');
        const result = await response.json();
        if (result.success) {
          setWarehouses(result.data.items || []);
        }
      } catch (error) {
        console.error('Failed to fetch warehouses:', error);
      }
    };
    fetchWarehouses();
  }, []);

  // 更新商品数量
  const updateItemQuantity = (index: number, quantity: number) => {
    const newItems = [...items];
    newItems[index].quantity = Math.max(0, quantity);
    setItems(newItems);
  };

  // 更新仓库
  const updateItemWarehouse = (index: number, warehouseId: string) => {
    const newItems = [...items];
    newItems[index].warehouseId = warehouseId;
    setItems(newItems);
  };

  // 更新备注字段
  const updateItemField = (index: number, field: string, value: string) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  // 删除商品行
  const removeItem = (index: number) => {
    const newItems = [...items];
    if (newItems[index].id) {
      // 已存在的商品，标记为待删除（实际删除需要 API 支持）
      if (confirm('确定要删除这个商品吗？')) {
        newItems.splice(index, 1);
        setItems(newItems);
      }
    } else {
      // 新增的商品，直接删除
      newItems.splice(index, 1);
      setItems(newItems);
    }
  };

  // 添加商品行（简化版，实际需要产品选择器）
  const addItem = () => {
    alert('添加商品功能待实现：需要从产品列表选择');
    // TODO: 实现产品选择器
  };

  // 计算总金额
  const totalAmount = items.reduce((sum, item) => {
    return sum + (item.quantity * item.unitPrice);
  }, 0);

  // 保存修改
  const handleSave = async () => {
    if (items.length === 0) {
      alert('出库单至少需要一项商品');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/v1/outbound-orders/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({
            id: item.id,
            productId: item.productId,
            quantity: item.quantity,
            warehouseId: item.warehouseId,
            unitPrice: item.unitPrice,
            batchNo: item.batchNo || undefined,
            location: item.location || undefined,
            notes: item.notes || undefined,
          })),
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('出库单已更新');
        router.push(`/outbound-orders/${params.id}`);
      } else {
        alert(`更新失败：${result.message}`);
      }
    } catch (error) {
      console.error('Failed to update outbound order:', error);
      alert('更新失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            加载中...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!order || order.status !== 'PENDING') {
    return null;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
        </Button>
        <h1 className="text-2xl font-bold">编辑出库单</h1>
        <span className="text-muted-foreground">{order.outboundNo}</span>
      </div>

      <div className="grid gap-6">
        {/* 提示信息 */}
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold mb-1">编辑提示</p>
                <ul className="list-disc list-inside space-y-1 text-yellow-700">
                  <li>只有待处理状态的出库单可以编辑</li>
                  <li>修改后需要重新提交保存</li>
                  <li>保存后出库单仍保持待处理状态</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 基本信息 */}
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">销售订单</div>
                <div className="font-medium">{order.order?.orderNo || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">出库单号</div>
                <div className="font-medium">{order.outboundNo}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">状态</div>
                <div className="font-medium">待处理</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 商品明细编辑 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>商品明细</CardTitle>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-2" />
                添加商品
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>产品编码</TableHead>
                  <TableHead>产品名称</TableHead>
                  <TableHead>仓库</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead className="text-right">单价</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                  <TableHead>批次号</TableHead>
                  <TableHead>库位</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={item.id || `new-${index}`}>
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
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 0)}
                        className="w-24 text-right"
                        min={0}
                      />
                    </TableCell>
                    <TableCell className="text-right">¥{item.unitPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">
                      ¥{(item.quantity * item.unitPrice).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.batchNo || ''}
                        onChange={(e) => updateItemField(index, 'batchNo', e.target.value)}
                        placeholder="批次号"
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.location || ''}
                        onChange={(e) => updateItemField(index, 'location', e.target.value)}
                        placeholder="库位"
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.notes || ''}
                        onChange={(e) => updateItemField(index, 'notes', e.target.value)}
                        placeholder="备注"
                        className="w-40"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
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
                <Button variant="outline" onClick={() => router.back()}>
                  取消
                </Button>
                <Button onClick={handleSave} disabled={submitting || items.length === 0}>
                  <Save className="h-4 w-4 mr-2" />
                  {submitting ? '保存中...' : '保存修改'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
