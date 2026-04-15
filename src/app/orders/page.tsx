'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useOrders, useDeleteOrder } from '@/hooks/use-orders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Eye, Edit, XCircle, Trash2, ChevronLeft, ChevronRight, CheckCheck, Truck, CheckSquare, Square } from 'lucide-react';
import { ORDER_STATUS_CONFIG, type OrderStatus } from '@/types/order';
import { OrderBatchConfirmDialog } from '@/components/batch-operations/OrderBatchConfirmDialog';
import { OrderBatchShipDialog } from '@/components/batch-operations/OrderBatchShipDialog';

type OrderItem = {
  id: string;
  orderNo: string;
  customer: {
    companyName: string;
  };
  status: string;
};

const ORDER_STATUS_OPTIONS = [
  { value: 'ALL', label: '全部状态' },
  { value: 'PENDING', label: '待确认' },
  { value: 'CONFIRMED', label: '已确认' },
  { value: 'IN_PRODUCTION', label: '生产中' },
  { value: 'READY', label: '待发货' },
  { value: 'SHIPPED', label: '已发货' },
  { value: 'DELIVERED', label: '已送达' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'CANCELLED', label: '已取消' },
];

export default function OrdersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchConfirmDialogOpen, setBatchConfirmDialogOpen] = useState(false);
  const [batchShipDialogOpen, setBatchShipDialogOpen] = useState(false);

  const { data, isLoading, error } = useOrders({ 
    page, 
    limit, 
    status: (statusFilter === 'ALL' ? undefined : statusFilter) as OrderStatus | undefined, 
    search: search || undefined 
  });
  const deleteOrder = useDeleteOrder();

  const orders = data?.items || [];
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 };

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + A 全选
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        if (orders.length > 0 && orders.length === selectedIds.size) {
          setSelectedIds(new Set());
        } else {
          setSelectedIds(new Set(orders.map(p => p.id)));
        }
        e.preventDefault();
      }
      // Esc 取消选择
      if (e.key === 'Escape') {
        setSelectedIds(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [orders, selectedIds]);

  const handleCancel = (orderId: string) => {
    setSelectedOrderId(orderId);
    setCancelDialogOpen(true);
  };

  const confirmCancel = () => {
    if (!selectedOrderId) return;
    setCancelDialogOpen(false);
    setSelectedOrderId(null);
    setCancelReason('');
  };

  const handleDelete = (orderId: string) => {
    if (!confirm('确定要删除此订单吗？此操作不可恢复。')) {
      return;
    }
    deleteOrder.mutate(orderId, {
      onSuccess: () => {
        alert('订单已删除');
      },
      onError: (err: any) => {
        alert(err.message);
      },
    });
  };

  // 批量选择
  const toggleSelectAll = () => {
    if (orders.length === selectedIds.size) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map(o => o.id)));
    }
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

  const handleBatchConfirmComplete = () => {
    setSelectedIds(new Set());
    window.location.reload();
  };

  const handleBatchShipComplete = () => {
    setSelectedIds(new Set());
    window.location.reload();
  };

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-2xl">订单管理</CardTitle>
            <Button onClick={() => router.push('/orders/new')}>
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">新增订单</span>
              <span className="sm:hidden">新增</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* 筛选区 */}
          <div className="flex flex-col gap-4 mb-6">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="搜索订单号/客户..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 加载状态 */}
          {isLoading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <p className="mt-2 text-gray-500">加载中...</p>
            </div>
          )}

          {/* 错误状态 */}
          {error && (
            <div className="text-center py-8">
              <p className="text-red-500">加载失败：{error.message}</p>
              <Button variant="outline" onClick={() => window.location.reload()} className="mt-4">
                重试
              </Button>
            </div>
          )}

          {/* 数据表格 */}
          {!isLoading && !error && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.size === orders.length && orders.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>订单号</TableHead>
                    <TableHead>客户</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">金额</TableHead>
                    <TableHead className="text-right">已付</TableHead>
                    <TableHead className="text-right">余额</TableHead>
                    <TableHead>交货日期</TableHead>
                    <TableHead className="text-center">收款</TableHead>
                    <TableHead className="text-center">发货</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const statusConfig = ORDER_STATUS_CONFIG[order.status];
                    return (
                      <TableRow key={order.id} className={selectedIds.has(order.id) ? 'bg-muted' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(order.id)}
                            onCheckedChange={() => toggleSelect(order.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link
                            href={`/orders/${order.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {order.orderNo}
                          </Link>
                        </TableCell>
                        <TableCell>{order.customer?.companyName || '-'}</TableCell>
                        <TableCell>
                          <Badge className={statusConfig?.color || 'bg-gray-100 text-gray-800'}>
                            {statusConfig?.label || order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {order.currency} {(order.totalAmount ?? 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {order.currency} {(order.paidAmount ?? 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {order.currency} {((order.totalAmount ?? 0) - (order.paidAmount ?? 0)).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {order.deliveryDate
                            ? new Date(order.deliveryDate).toLocaleDateString('zh-CN')
                            : '-'}
                        </TableCell>
                        <TableCell className="text-center">{order.paymentCount || 0}</TableCell>
                        <TableCell className="text-center">{order.shipmentCount || 0}</TableCell>
                        <TableCell>
                          {new Date(order.createdAt).toLocaleDateString('zh-CN')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/orders/${order.id}`)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {order.status === 'PENDING' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => router.push(`/orders/${order.id}/edit`)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancel(order.id)}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(order.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {orders.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  暂无订单数据
                </div>
              )}

              {/* 分页 */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-gray-500">
                    共 {pagination.total} 条记录，第 {pagination.page} / {pagination.totalPages} 页
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === pagination.totalPages}
                    >
                      下一页
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 底部悬浮批量操作栏 */}
      {selectedIds.size > 0 && (
        <>
          <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg p-4 z-50">
            <div className="container mx-auto flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedIds.size === orders.length ? (
                  <CheckSquare className="h-5 w-5 text-primary" />
                ) : (
                  <Square className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="font-medium">
                  已选择 {selectedIds.size} / {orders.length} 项
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setSelectedIds(new Set())}>
                  取消选择 (Esc)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setBatchConfirmDialogOpen(true)}
                  disabled={selectedIds.size === 0}
                >
                  <CheckCheck className="h-4 w-4 mr-2" />
                  批量确认
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setBatchShipDialogOpen(true)}
                  disabled={selectedIds.size === 0}
                >
                  <Truck className="h-4 w-4 mr-2" />
                  批量发货
                </Button>
              </div>
            </div>
          </div>
          <div className="h-20" />
        </>
      )}

      {/* 取消订单对话框 */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>取消订单</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>取消原因 *</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="请说明取消原因"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmCancel}>
              确认取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量确认对话框 */}
      <OrderBatchConfirmDialog
        open={batchConfirmDialogOpen}
        onOpenChange={setBatchConfirmDialogOpen}
        selectedOrders={Array.from(selectedIds).map(id => {
          const order = orders.find(o => o.id === id);
          return {
            id,
            orderNo: order?.orderNo || '',
            customerName: order?.customer?.companyName || '',
            totalAmount: order?.totalAmount || 0,
            currency: order?.currency || 'CNY',
            status: order?.status || '',
          };
        })}
        onConfirmComplete={handleBatchConfirmComplete}
      />

      {/* 批量发货对话框 */}
      <OrderBatchShipDialog
        open={batchShipDialogOpen}
        onOpenChange={setBatchShipDialogOpen}
        selectedOrders={Array.from(selectedIds).map(id => {
          const order = orders.find(o => o.id === id);
          return {
            id,
            orderNo: order?.orderNo || '',
            customerName: order?.customer?.companyName || '',
            status: order?.status || '',
          };
        })}
        onShipComplete={handleBatchShipComplete}
      />
    </div>
  );
}
