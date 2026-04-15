'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Edit, Building2, Calendar, CreditCard } from 'lucide-react';

interface PurchaseOrder {
  id: string;
  poNo: string;
  status: string;
  currency: string;
  totalAmount: number;
  deliveryDate: string | null;
  paymentTerms: string | null;
  notes: string | null;
  supplierId: string;
  supplier: {
    id: string;
    companyName: string;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  items: Array<{
    id: string;
    productName: string;
    specification: string | null;
    quantity: number;
    receivedQty: number;
    unitPrice: number;
    amount: number;
    notes: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

const PURCHASE_STATUS: Record<string, string> = {
  PENDING: '待确认',
  CONFIRMED: '已确认',
  IN_PRODUCTION: '生产中',
  READY: '待收货',
  RECEIVED: '已收货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  IN_PRODUCTION: 'bg-purple-100 text-purple-800',
  READY: 'bg-green-100 text-green-800',
  RECEIVED: 'bg-indigo-100 text-indigo-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function PurchaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [purchase, setPurchase] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchPurchaseDetail(params.id as string);
    }
  }, [params.id]);

  const fetchPurchaseDetail = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/purchases/${id}`);
      const data = await res.json();
      if (data) {
        setPurchase(data);
      }
    } catch (error) {
      console.error('Failed to fetch purchase detail:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-8">加载中...</div>
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-gray-500">采购单不存在</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/purchases')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{purchase.poNo}</h1>
          <p className="text-gray-500">创建于 {new Date(purchase.createdAt).toLocaleString('zh-CN')}</p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/purchases/${purchase.id}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          编辑
        </Button>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-4">
        <Badge className={STATUS_COLORS[purchase.status] || 'bg-gray-100'}>
          {PURCHASE_STATUS[purchase.status] || purchase.status}
        </Badge>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            基本信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-500">供应商</label>
              <p className="font-medium">{purchase.supplier.companyName}</p>
              {purchase.supplier.contactName && (
                <p className="text-sm text-gray-500">联系人：{purchase.supplier.contactName}</p>
              )}
              {purchase.supplier.email && (
                <p className="text-sm text-gray-500">邮箱：{purchase.supplier.email}</p>
              )}
              {purchase.supplier.phone && (
                <p className="text-sm text-gray-500">电话：{purchase.supplier.phone}</p>
              )}
              {purchase.supplier.address && (
                <p className="text-sm text-gray-500">地址：{purchase.supplier.address}</p>
              )}
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-gray-500" />
                <div>
                  <label className="text-sm text-gray-500">金额</label>
                  <p className="font-medium">{purchase.currency} {(purchase.totalAmount ?? 0).toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <div>
                  <label className="text-sm text-gray-500">交货日期</label>
                  <p className="font-medium">
                    {purchase.deliveryDate ? new Date(purchase.deliveryDate).toLocaleDateString('zh-CN') : '-'}
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500">付款条件</label>
                <p className="font-medium">{purchase.paymentTerms || '-'}</p>
              </div>
            </div>
          </div>

          {purchase.notes && (
            <>
              <Separator className="my-4" />
              <div>
                <label className="text-sm text-gray-500">备注</label>
                <p className="mt-1 text-sm">{purchase.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>采购明细</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>产品名称</TableHead>
                <TableHead>规格</TableHead>
                <TableHead className="text-right">数量</TableHead>
                <TableHead className="text-right">已收货</TableHead>
                <TableHead className="text-right">单价</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead>备注</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchase.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.productName}</TableCell>
                  <TableCell>{item.specification || '-'}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{item.receivedQty}</TableCell>
                  <TableCell className="text-right">{(item.unitPrice ?? 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">{(item.amount ?? 0).toFixed(2)}</TableCell>
                  <TableCell>{item.notes || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-end mt-4">
            <div className="text-right">
              <span className="text-lg font-semibold">总计：</span>
              <span className="text-2xl font-bold ml-2">
                {purchase.currency} {(purchase.totalAmount ?? 0).toFixed(2)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
