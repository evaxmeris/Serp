'use client';

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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Eye } from 'lucide-react';

interface PurchaseOrder {
  id: string;
  poNo: string;
  status: string;
  approvalStatus: string;
  totalAmount: number;
  currency: string;
  supplier: {
    id: string;
    companyName: string;
    contactName?: string;
    email?: string;
    phone?: string;
  };
  purchaser?: {
    id: string;
    name: string;
    email: string;
  };
  deliveryDate?: string;
  createdAt: string;
  _count?: {
    items: number;
    receipts: number;
  };
}

interface SuppliersResponse {
  data: Array<{
    id: string;
    companyName: string;
  }>;
}

const PO_STATUS: Record<string, string> = {
  PENDING: '待确认',
  CONFIRMED: '已确认',
  IN_PRODUCTION: '生产中',
  READY: '待发货',
  RECEIVED: '已收货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  IN_PRODUCTION: 'bg-purple-100 text-purple-800',
  READY: 'bg-green-100 text-green-800',
  RECEIVED: 'bg-cyan-100 text-cyan-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const APPROVAL_STATUS: Record<string, string> = {
  NOT_REQUIRED: '无需审批',
  PENDING: '审批中',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
};

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; companyName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    fetchPurchaseOrders();
  }, [page, search, statusFilter, supplierFilter]);

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/v1/suppliers?limit=100');
      const result: any = await res.json();
      // 处理两种格式：{ data: [...] } 或 { data: { items: [...] } }
      const suppliersData = Array.isArray(result?.data)
        ? result?.data
        : result?.data?.items || [];
      setSuppliers(suppliersData.map((s: any) => ({ id: s.id, companyName: s.companyName })));
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }
  };

  const fetchPurchaseOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      if (search) params.append('search', search);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (supplierFilter !== 'all') params.append('supplierId', supplierFilter);

      const res = await fetch(`/api/v1/purchase-orders?${params}`);
      const result = await res.json();
      // API 返回格式：{ success: true, data: { items: [], pagination: {} } }
      const poList = Array.isArray(result?.data?.items) ? result.data.items : [];
      setPurchaseOrders(poList);
      setTotalPages(result.data?.pagination?.totalPages || 1);
      setTotal(result.data?.pagination?.total || 0);
    } catch (error) {
      console.error('Failed to fetch purchase orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPurchaseOrders();
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setSupplierFilter('all');
    setPage(1);
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">采购订单管理</CardTitle>
            <Button onClick={() => router.push('/purchase-orders/new')}>
              <Plus className="h-4 w-4 mr-2" />
              创建采购订单
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <form onSubmit={handleSearch} className="mb-6 space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="搜索订单号、供应商..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="PENDING">待确认</SelectItem>
                  <SelectItem value="CONFIRMED">已确认</SelectItem>
                  <SelectItem value="IN_PRODUCTION">生产中</SelectItem>
                  <SelectItem value="READY">待发货</SelectItem>
                  <SelectItem value="RECEIVED">已收货</SelectItem>
                  <SelectItem value="COMPLETED">已完成</SelectItem>
                  <SelectItem value="CANCELLED">已取消</SelectItem>
                </SelectContent>
              </Select>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="供应商" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部供应商</SelectItem>
                  {Array.isArray(suppliers) && suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" variant="outline">
                搜索
              </Button>
              <Button type="button" variant="ghost" onClick={resetFilters}>
                重置
              </Button>
            </div>
          </form>

          {/* Table */}
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>订单编号</TableHead>
                    <TableHead>供应商</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>审批状态</TableHead>
                    <TableHead>商品数</TableHead>
                    <TableHead>总金额</TableHead>
                    <TableHead>交货日期</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrders.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-medium">{po.poNo}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{po.supplier.companyName}</div>
                          {po.supplier.contactName && (
                            <div className="text-sm text-gray-500">
                              {po.supplier.contactName}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[po.status] || 'bg-gray-100'}>
                          {PO_STATUS[po.status] || po.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {APPROVAL_STATUS[po.approvalStatus] || po.approvalStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>{po._count?.items || 0}</TableCell>
                      <TableCell>
                        {po.currency} {po.totalAmount.toFixed(2)}
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
                          <Eye className="h-4 w-4 mr-1" />
                          查看
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {purchaseOrders.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500">
                  暂无采购订单数据
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-500">
                    共 {total} 条记录，第 {page} / {totalPages} 页
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
                      disabled={page === totalPages}
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
