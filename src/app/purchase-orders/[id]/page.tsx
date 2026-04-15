'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';

interface PurchaseOrder {
  id: string;
  poNo: string;
  status: string;
  approvalStatus: string;
  totalAmount: number;
  currency: string;
  supplier: {
    companyName: string;
    contactName?: string;
    email?: string;
    phone?: string;
  };
  deliveryDate?: string;
  paymentTerms?: string;
  notes?: string;
  createdAt: string;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
}

export default function PurchaseOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;

    fetch(`/api/v1/purchase-orders/${params.id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then((data) => {
        setOrder(data.data?.items ?? data.data ?? null);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error:', err);
        setLoading(false);
      });
  }, [params.id]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">加载中...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <h1 className="text-2xl font-bold text-red-600">采购订单不存在</h1>
            <Button className="mt-4" onClick={() => router.push('/purchase-orders')}>
              返回列表
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      PENDING: 'secondary',
      CONFIRMED: 'default',
      IN_PRODUCTION: 'default',
      READY: 'outline',
      RECEIVED: 'default',
      COMPLETED: 'default',
      CANCELLED: 'destructive',
    };
    const statusText: Record<string, string> = {
      PENDING: '待确认',
      CONFIRMED: '已确认',
      IN_PRODUCTION: '生产中',
      READY: '待发货',
      RECEIVED: '已收货',
      COMPLETED: '已完成',
      CANCELLED: '已取消',
    };
    return (
      <Badge variant={statusVariant[status] || 'secondary'}>
        {statusText[status] || status}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push('/purchase-orders')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回列表
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">采购订单详情</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">采购单号</p>
                <p className="font-semibold">{order.poNo}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">状态</p>
                <div>{getStatusBadge(order.status)}</div>
              </div>
              <div>
                <p className="text-sm text-gray-500">供应商</p>
                <p className="font-semibold">{order.supplier.companyName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">联系人</p>
                <p>{order.supplier.contactName || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">总金额</p>
                <p className="font-semibold text-lg">
                  {order.currency} {order.totalAmount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">交货日期</p>
                <p>{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>商品明细</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">产品名称</th>
                  <th className="text-right">数量</th>
                  <th className="text-right">单价</th>
                  <th className="text-right">金额</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-3">{item.productName}</td>
                    <td className="text-right">{item.quantity}</td>
                    <td className="text-right">{(item.unitPrice ?? 0).toFixed(2)}</td>
                    <td className="text-right font-semibold">
                      {(item.amount ?? 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
