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
import { Plus, Search, Eye, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

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
    product?: {
      id: string;
      name: string;
      sku: string;
    };
  }[];
  order?: {
    id: string;
    orderNo: string;
    customerId?: string;
    customer?: {
      id: string;
      companyName: string;
    };
  };
  warehouse?: {
    id: string;
    name: string;
    code: string;
  };
  _count?: {
    items: number;
  };
}

interface OutboundOrdersResponse {
  success: boolean;
  data: {
    items: OutboundOrder[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
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

export default function OutboundOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OutboundOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      if (search) {
        params.set('search', search);
      }

      if (status !== 'all') {
        params.set('status', status);
      }

      const response = await fetch(`/api/v1/outbound-orders?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setOrders(result.data.items);
        setTotal(result.data.pagination.total);
        setTotalPages(result.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch outbound orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page, status]);

  const handleSearch = () => {
    setPage(1);
    fetchOrders();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleConfirm = async (id: string) => {
    if (!confirm('确认要发货此出库单吗？')) return;

    try {
      const response = await fetch(`/api/v1/outbound-orders/${id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (result.success) {
        alert('出库单已确认发货');
        fetchOrders();
      } else {
        alert(`操作失败：${result.message}`);
      }
    } catch (error) {
      console.error('Failed to confirm outbound order:', error);
      alert('操作失败，请重试');
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('确认要取消此出库单吗？')) return;

    try {
      const response = await fetch(`/api/v1/outbound-orders/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (result.success) {
        alert('出库单已取消');
        fetchOrders();
      } else {
        alert(`操作失败：${result.message}`);
      }
    } catch (error) {
      console.error('Failed to cancel outbound order:', error);
      alert('操作失败，请重试');
    }
  };

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">出库单管理</CardTitle>
            <Button onClick={() => router.push('/outbound-orders/new')}>
              <Plus className="mr-2 h-4 w-4" />
              创建出库单
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* 筛选栏 */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 flex items-center gap-2">
              <Input
                placeholder="搜索出库单号、备注..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={handleKeyPress}
                className="max-w-sm"
              />
              <Button onClick={handleSearch} variant="outline">
                <Search className="h-4 w-4 mr-2" />
                搜索
              </Button>
            </div>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="DRAFT">草稿</SelectItem>
                <SelectItem value="PENDING">待发货</SelectItem>
                <SelectItem value="SHIPPED">已发货</SelectItem>
                <SelectItem value="CANCELLED">已取消</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 数据表格 */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>出库单号</TableHead>
                  <TableHead>销售订单</TableHead>
                  <TableHead>仓库</TableHead>
                  <TableHead>商品数</TableHead>
                  <TableHead>总金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      暂无出库单
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.outboundNo}</TableCell>
                      <TableCell>
                        {order.order?.orderNo || '-'}
                        {order.order?.customer && (
                          <div className="text-xs text-muted-foreground">
                            {order.order.customer.companyName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {order.warehouse?.name || '-'}
                        {order.warehouse?.code && (
                          <div className="text-xs text-muted-foreground">
                            {order.warehouse.code}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{order._count?.items || order.items?.length || 0}</TableCell>
                      <TableCell>
                        {order.totalAmount ? `¥${order.totalAmount.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[order.status] || 'bg-gray-100'}>
                          {OUTBOUND_STATUS[order.status] || order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(order.createdAt).toLocaleString('zh-CN')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/outbound-orders/${order.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {order.status === 'PENDING' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleConfirm(order.id)}
                              >
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancel(order.id)}
                              >
                                <XCircle className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          )}
                          {order.status === 'DRAFT' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/outbound-orders/${order.id}/edit`)}
                            >
                              <AlertCircle className="h-4 w-4 text-blue-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                共 {total} 条记录，第 {page}/{totalPages} 页
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
