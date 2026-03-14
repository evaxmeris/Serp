'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, CheckCircle, XCircle, Edit, Truck } from 'lucide-react';

interface OutboundOrder {
  id: string;
  outboundNo: string;
  orderId: string;
  warehouseId: string;
  status: string;
  totalAmount: number | null;
  createdAt: string;
  updatedAt: string;
  items?: {
    id: string;
    productId: string;
    quantity: number;
    shippedQuantity: number;
    unitPrice: number | null;
    batchNo?: string | null;
    location?: string | null;
    notes?: string | null;
    product?: {
      id: string;
      name: string;
      sku: string;
      unit?: string | null;
    };
  }[];
  order?: {
    id: string;
    orderNo: string;
    customerId?: string;
    customer?: {
      id: string;
      companyName: string;
      contactName?: string | null;
      email?: string | null;
    };
  };
  warehouse?: {
    id: string;
    name: string;
    code: string;
    address?: string | null;
  };
}

interface OutboundOrderResponse {
  success: boolean;
  data: OutboundOrder;
}

const OUTBOUND_STATUS: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '待发货',
  SHIPPED: '已发货',
  CANCELLED: '已取消',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  SHIPPED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function OutboundOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [order, setOrder] = useState<OutboundOrder | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/outbound-orders/${params.id}`);
      const result = await response.json();

      if (result.success) {
        setOrder(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch outbound order:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [params.id]);

  const handleConfirm = async () => {
    if (!confirm('确认要发货此出库单吗？')) return;

    try {
      const response = await fetch(`/api/v1/outbound-orders/${params.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (result.success) {
        alert('出库单已确认发货');
        fetchOrder();
      } else {
        alert(`操作失败：${result.message}`);
      }
    } catch (error) {
      console.error('Failed to confirm outbound order:', error);
      alert('操作失败，请重试');
    }
  };

  const handleCancel = async () => {
    if (!confirm('确认要取消此出库单吗？')) return;

    try {
      const response = await fetch(`/api/v1/outbound-orders/${params.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (result.success) {
        alert('出库单已取消');
        fetchOrder();
      } else {
        alert(`操作失败：${result.message}`);
      }
    } catch (error) {
      console.error('Failed to cancel outbound order:', error);
      alert('操作失败，请重试');
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

  if (!order) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            出库单不存在
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
        </Button>
        <h1 className="text-2xl font-bold">{order.outboundNo}</h1>
        <Badge className={STATUS_COLORS[order.status] || 'bg-gray-100'}>
          {OUTBOUND_STATUS[order.status] || order.status}
        </Badge>
      </div>

      <div className="grid gap-6">
        {/* 基本信息 */}
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">销售订单</div>
                <div className="font-medium">
                  {order.order?.orderNo || '-'}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">客户</div>
                <div className="font-medium">
                  {order.order?.customer?.companyName || '-'}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">仓库</div>
                <div className="font-medium">
                  {order.warehouse?.name || '-'}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">创建时间</div>
                <div className="font-medium">
                  {new Date(order.createdAt).toLocaleString('zh-CN')}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">更新时间</div>
                <div className="font-medium">
                  {new Date(order.updatedAt).toLocaleString('zh-CN')}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">总金额</div>
                <div className="font-medium">
                  {order.totalAmount ? `¥${order.totalAmount.toFixed(2)}` : '-'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 商品明细 */}
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
                  <TableHead>单位</TableHead>
                  <TableHead className="text-right">出库数量</TableHead>
                  <TableHead className="text-right">单价</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                  <TableHead>批次号</TableHead>
                  <TableHead>库位</TableHead>
                  <TableHead>备注</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.product?.sku || '-'}</TableCell>
                    <TableCell>{item.product?.name || '-'}</TableCell>
                    <TableCell>{item.product?.unit || 'PCS'}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      {item.unitPrice ? `¥${item.unitPrice.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.unitPrice ? `¥${(item.quantity * item.unitPrice).toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>{item.batchNo || '-'}</TableCell>
                    <TableCell>{item.location || '-'}</TableCell>
                    <TableCell>{item.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 操作按钮 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              {order.status === 'PENDING' && (
                <>
                  <Button onClick={handleConfirm} className="bg-green-600 hover:bg-green-700">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    确认发货
                  </Button>
                  <Button variant="outline" onClick={handleCancel}>
                    <XCircle className="h-4 w-4 mr-2" />
                    取消出库单
                  </Button>
                </>
              )}
              {order.status === 'DRAFT' && (
                <Button onClick={() => router.push(`/outbound-orders/${order.id}/edit`)}>
                  <Edit className="h-4 w-4 mr-2" />
                  编辑出库单
                </Button>
              )}
              {order.status === 'SHIPPED' && (
                <Button onClick={() => router.push(`/outbound-orders/${order.id}/ship`)}>
                  <Truck className="h-4 w-4 mr-2" />
                  录入发货信息
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
