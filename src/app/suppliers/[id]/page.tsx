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
import { ArrowLeft, Edit, Package, User } from 'lucide-react';

interface Supplier {
  id: string;
  supplierNo: string;
  companyName: string;
  companyEn?: string;
  contactName?: string;
  contactTitle?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  website?: string;
  products?: string;
  status: string;
  type: string;
  level: string;
  creditTerms?: string;
  currency?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    purchaseOrders: number;
  };
}

interface PurchaseOrder {
  id: string;
  poNo: string;
  status: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  deliveryDate?: string;
}

interface Contact {
  id: string;
  name: string;
  position?: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
}

const SUPPLIER_STATUS: Record<string, string> = {
  ACTIVE: '正常',
  INACTIVE: '停用',
  BLACKLISTED: '黑名单',
  PENDING: '待审核',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
  BLACKLISTED: 'bg-red-100 text-red-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
};

const SUPPLIER_TYPE: Record<string, string> = {
  DOMESTIC: '国内供应商',
  OVERSEAS: '海外供应商',
};

const SUPPLIER_LEVEL: Record<string, string> = {
  STRATEGIC: '战略供应商',
  PREFERRED: '优选供应商',
  NORMAL: '普通供应商',
  RESTRICTED: '限制供应商',
};

const PO_STATUS: Record<string, string> = {
  PENDING: '待确认',
  CONFIRMED: '已确认',
  IN_PRODUCTION: '生产中',
  READY: '待发货',
  RECEIVED: '已收货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchSupplierDetail(params.id as string);
    }
  }, [params.id]);

  const fetchSupplierDetail = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/suppliers/${id}`);
      const data = await res.json();
      if (data.data) {
        setSupplier(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch supplier detail:', error);
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

  if (!supplier) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-gray-500">供应商不存在</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/suppliers')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{supplier.companyName}</h1>
          <p className="text-gray-500">{supplier.supplierNo}</p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/suppliers/${supplier.id}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          编辑
        </Button>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-4">
        <Badge className={STATUS_COLORS[supplier.status] || 'bg-gray-100'}>
          {SUPPLIER_STATUS[supplier.status] || supplier.status}
        </Badge>
        <Badge variant="outline">{SUPPLIER_TYPE[supplier.type] || supplier.type}</Badge>
        <Badge variant="outline">{SUPPLIER_LEVEL[supplier.level] || supplier.level}</Badge>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            基本信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-500">公司名称</label>
              <p className="font-medium">{supplier.companyName}</p>
            </div>
            {supplier.companyEn && (
              <div>
                <label className="text-sm text-gray-500">英文名称</label>
                <p className="font-medium">{supplier.companyEn}</p>
              </div>
            )}
            <div>
              <label className="text-sm text-gray-500">联系人</label>
              <p className="font-medium">{supplier.contactName || '-'}</p>
            </div>
            {supplier.contactTitle && (
              <div>
                <label className="text-sm text-gray-500">职位</label>
                <p className="font-medium">{supplier.contactTitle}</p>
              </div>
            )}
            <div>
              <label className="text-sm text-gray-500">邮箱</label>
              <p className="font-medium">{supplier.email || '-'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">电话</label>
              <p className="font-medium">{supplier.phone || '-'}</p>
            </div>
            {supplier.mobile && (
              <div>
                <label className="text-sm text-gray-500">手机</label>
                <p className="font-medium">{supplier.mobile}</p>
              </div>
            )}
            <div>
              <label className="text-sm text-gray-500">国家/地区</label>
              <p className="font-medium">{supplier.country || '-'}</p>
            </div>
            {supplier.city && (
              <div>
                <label className="text-sm text-gray-500">城市</label>
                <p className="font-medium">{supplier.city}</p>
              </div>
            )}
            {supplier.address && (
              <div className="md:col-span-2 lg:col-span-3">
                <label className="text-sm text-gray-500">地址</label>
                <p className="font-medium">{supplier.address}</p>
              </div>
            )}
            {supplier.website && (
              <div>
                <label className="text-sm text-gray-500">网站</label>
                <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">
                  {supplier.website}
                </a>
              </div>
            )}
            <div>
              <label className="text-sm text-gray-500">供应产品</label>
              <p className="font-medium">{supplier.products || '-'}</p>
            </div>
            {supplier.creditTerms && (
              <div>
                <label className="text-sm text-gray-500">账期</label>
                <p className="font-medium">{supplier.creditTerms}</p>
              </div>
            )}
            <div>
              <label className="text-sm text-gray-500">结算货币</label>
              <p className="font-medium">{supplier.currency || 'CNY'}</p>
            </div>
          </div>
          {supplier.notes && (
            <>
              <Separator className="my-4" />
              <div>
                <label className="text-sm text-gray-500">备注</label>
                <p className="mt-1 text-sm">{supplier.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Purchase Orders History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            采购订单历史
            {supplier._count?.purchaseOrders !== undefined && (
              <Badge variant="secondary">{supplier._count.purchaseOrders} 单</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>订单编号</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>交货日期</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    暂无采购订单
                  </TableCell>
                </TableRow>
              ) : (
                purchaseOrders.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-medium">{po.poNo}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{PO_STATUS[po.status] || po.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {po.currency} {(po.totalAmount ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {po.deliveryDate
                        ? new Date(po.deliveryDate).toLocaleDateString('zh-CN')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {new Date(po.createdAt).toLocaleDateString('zh-CN')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/purchase-orders/${po.id}`)}
                      >
                        查看
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
