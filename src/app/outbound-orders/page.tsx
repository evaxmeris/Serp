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
import { Plus, Search, Eye, CheckCircle, XCircle, AlertCircle, Download, MoreHorizontal } from 'lucide-react';

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
  PROCESSING: '处理中',
  PICKED: '已拣货',
  SHIPPED: '已发货',
  CANCELLED: '已取消',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  PICKED: 'bg-purple-100 text-purple-800',
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
  
  // 批量操作状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [showBatchMenu, setShowBatchMenu] = useState(false);

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

  // 批量操作相关函数
  const toggleSelectAll = (currentPageOrderIds: string[]) => {
    const allSelected = currentPageOrderIds.every(id => selectedIds.has(id));
    const newSelected = new Set(selectedIds);
    
    if (allSelected) {
      currentPageOrderIds.forEach(id => newSelected.delete(id));
    } else {
      currentPageOrderIds.forEach(id => newSelected.add(id));
    }
    
    setSelectedIds(newSelected);
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBatchConfirm = async () => {
    if (selectedIds.size === 0) {
      alert('请选择要操作的出库单');
      return;
    }

    if (!confirm(`确认要批量发货选中的 ${selectedIds.size} 个出库单吗？`)) return;

    setBatchProcessing(true);
    try {
      const response = await fetch('/api/v1/outbound-orders/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          action: 'confirm',
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`批量确认完成：成功 ${result.data.successCount}，失败 ${result.data.failedCount}`);
        if (result.data.failed.length > 0) {
          console.error('失败的出库单:', result.data.failed);
        }
        setSelectedIds(new Set());
        fetchOrders();
      } else {
        alert(`操作失败：${result.message}`);
      }
    } catch (error) {
      console.error('Failed to batch confirm:', error);
      alert('操作失败，请重试');
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleBatchCancel = async () => {
    if (selectedIds.size === 0) {
      alert('请选择要操作的出库单');
      return;
    }

    if (!confirm(`确认要批量取消选中的 ${selectedIds.size} 个出库单吗？`)) return;

    setBatchProcessing(true);
    try {
      const response = await fetch('/api/v1/outbound-orders/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          action: 'cancel',
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`批量取消完成：成功 ${result.data.successCount}，失败 ${result.data.failedCount}`);
        if (result.data.failed.length > 0) {
          console.error('失败的出库单:', result.data.failed);
        }
        setSelectedIds(new Set());
        fetchOrders();
      } else {
        alert(`操作失败：${result.message}`);
      }
    } catch (error) {
      console.error('Failed to batch cancel:', error);
      alert('操作失败，请重试');
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleBatchExport = async () => {
    if (selectedIds.size === 0) {
      alert('请选择要导出的出库单');
      return;
    }

    setBatchProcessing(true);
    try {
      const response = await fetch('/api/v1/outbound-orders/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          action: 'export',
        }),
      });

      const result = await response.json();

      if (result.success) {
        // 下载 CSV 文件
        const blob = new Blob([result.data.data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `出库单导出_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        alert(`成功导出 ${result.data.count} 条记录`);
      } else {
        alert(`导出失败：${result.message}`);
      }
    } catch (error) {
      console.error('Failed to batch export:', error);
      alert('导出失败，请重试');
    } finally {
      setBatchProcessing(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">出库单管理</CardTitle>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 mr-4">
                  <span className="text-sm text-muted-foreground">
                    已选择 {selectedIds.size} 个
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBatchConfirm}
                    disabled={batchProcessing}
                  >
                    <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                    批量确认
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBatchCancel}
                    disabled={batchProcessing}
                  >
                    <XCircle className="h-4 w-4 mr-1 text-red-600" />
                    批量取消
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBatchExport}
                    disabled={batchProcessing}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    批量导出
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    取消选择
                  </Button>
                </div>
              )}
              <Button onClick={() => router.push('/outbound-orders/new')}>
                <Plus className="mr-2 h-4 w-4" />
                创建出库单
              </Button>
            </div>
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
                  <TableHead className="w-[50px]">
                    <input
                      type="checkbox"
                      checked={orders.length > 0 && orders.every(o => selectedIds.has(o.id))}
                      onChange={() => toggleSelectAll(orders.map(o => o.id))}
                      className="rounded border-gray-300"
                    />
                  </TableHead>
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
                    <TableCell colSpan={9} className="text-center py-8">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      暂无出库单
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow key={order.id} className={selectedIds.has(order.id) ? 'bg-muted' : ''}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(order.id)}
                          onChange={() => toggleSelect(order.id)}
                          className="rounded border-gray-300"
                        />
                      </TableCell>
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
                        {order.totalAmount != null ? `¥${Number(order.totalAmount).toFixed(2)}` : '-'}
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
