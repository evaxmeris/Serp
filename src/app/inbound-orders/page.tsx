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
import { Plus, Search, Eye, CheckCircle, XCircle } from 'lucide-react';

interface InboundOrder {
  id: string;
  inboundNo: string;
  type: string;
  status: string;
  supplier?: {
    id: string;
    companyName: string;
  };
  warehouse?: {
    id: string;
    name: string;
    code: string;
  };
  totalAmount: number;
  expectedDate?: string;
  actualDate?: string;
  createdAt: string;
  _count?: {
    items: number;
  };
}

interface InboundOrdersResponse {
  data: {
    items: InboundOrder[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

const INBOUND_TYPE: Record<string, string> = {
  PURCHASE_IN: '采购入库',
  RETURN_IN: '退货入库',
  ADJUSTMENT_IN: '调拨入库',
  TRANSFER_IN: '转仓入库',
  OTHER_IN: '其他入库',
};

const INBOUND_STATUS: Record<string, string> = {
  PENDING: '待入库',
  PARTIAL: '部分入库',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PARTIAL: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function InboundOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<InboundOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string>('all');
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
        ...(search && { search }),
        ...(type !== 'all' && { type }),
        ...(status !== 'all' && { status }),
      });

      const res = await fetch(`/api/v1/inbound-orders?${params}`);
      const data: InboundOrdersResponse = await res.json();

      if (data.success) {
        setOrders(data.data.items);
        setTotal(data.data.pagination.total);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch inbound orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page, type, status]);

  const handleSearch = () => {
    setPage(1);
    fetchOrders();
  };

  const handleConfirm = async (id: string) => {
    if (!confirm('确认入库此订单吗？')) return;

    try {
      const res = await fetch(`/api/v1/inbound-orders/${id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (data.success) {
        alert('入库确认成功');
        fetchOrders();
      } else {
        alert(data.message || '入库确认失败');
      }
    } catch (error) {
      console.error('Failed to confirm inbound order:', error);
      alert('入库确认失败');
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('确定要取消此入库单吗？')) return;

    try {
      const res = await fetch(`/api/v1/inbound-orders/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (data.success) {
        alert('入库单已取消');
        fetchOrders();
      } else {
        alert(data.message || '取消失败');
      }
    } catch (error) {
      console.error('Failed to cancel inbound order:', error);
      alert('取消失败');
    }
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl">入库管理</CardTitle>
            <Button onClick={() => router.push('/inbound-orders/new')}>
              <Plus className="mr-2 h-4 w-4" />
              创建入库单
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* 筛选栏 */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="搜索入库单号、备注..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="入库类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="PURCHASE_IN">采购入库</SelectItem>
                <SelectItem value="RETURN_IN">退货入库</SelectItem>
                <SelectItem value="ADJUSTMENT_IN">调拨入库</SelectItem>
                <SelectItem value="TRANSFER_IN">转仓入库</SelectItem>
                <SelectItem value="OTHER_IN">其他入库</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="PENDING">待入库</SelectItem>
                <SelectItem value="PARTIAL">部分入库</SelectItem>
                <SelectItem value="COMPLETED">已完成</SelectItem>
                <SelectItem value="CANCELLED">已取消</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>
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
                    <TableHead>入库单号</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>供应商</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>金额</TableHead>
                    <TableHead>预计日期</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          {order.inboundNo}
                        </TableCell>
                        <TableCell>
                          {INBOUND_TYPE[order.type]}
                        </TableCell>
                        <TableCell>
                          {order.supplier?.companyName || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[order.status] || 'bg-gray-100'}>
                            {INBOUND_STATUS[order.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          ¥{Number(order.totalAmount).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {order.expectedDate 
                            ? new Date(order.expectedDate).toLocaleDateString('zh-CN')
                            : '-'
                          }
                        </TableCell>
                        <TableCell>
                          {new Date(order.createdAt).toLocaleDateString('zh-CN')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/inbound-orders/${order.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {order.status === 'PENDING' && (
                              <>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleConfirm(order.id)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  确认
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleCancel(order.id)}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  取消
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-gray-500">
                    共 {total} 条记录，第 {page}/{totalPages} 页
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
