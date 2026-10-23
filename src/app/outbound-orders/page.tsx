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
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, Search, Eye, CheckCircle, XCircle, AlertCircle, Download, MoreHorizontal } from 'lucide-react';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirmation-dialog';
import { useSortable, SortIndicator } from '@/hooks/use-sortable';

interface OutboundOrder {
  id: string;
  outboundNo: string;
  outboundType?: string;
  orderId: string | null;
  notes?: string | null;
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
  PENDING: '待处理',
  PICKING: '拣货中',
  PACKING: '打包中',
  SHIPPED: '已发货',
  DELIVERED: '已送达',
  CANCELLED: '已取消',
};

/** 出库类型（第一期新增：销售/样品/赠品/内部领用/调拨） */
const OUTBOUND_TYPES: { value: string; label: string }[] = [
  { value: 'SALE', label: '销售出库' },
  { value: 'SAMPLE', label: '样品' },
  { value: 'GIFT', label: '赠品' },
  { value: 'INTERNAL', label: '内部领用' },
  { value: 'TRANSFER', label: '调拨' },
];

const TYPE_LABELS: Record<string, string> = OUTBOUND_TYPES.reduce(
  (acc, t) => ({ ...acc, [t.value]: t.label }),
  {} as Record<string, string>,
);

const TYPE_COLORS: Record<string, string> = {
  SALE: 'bg-blue-100 text-blue-800',
  SAMPLE: 'bg-amber-100 text-amber-800',
  GIFT: 'bg-pink-100 text-pink-800',
  INTERNAL: 'bg-slate-100 text-slate-800',
  TRANSFER: 'bg-teal-100 text-teal-800',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-800',
  PICKING: 'bg-blue-100 text-blue-800',
  PACKING: 'bg-purple-100 text-purple-800',
  SHIPPED: 'bg-green-100 text-green-800',
  DELIVERED: 'bg-teal-100 text-teal-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function OutboundOrdersPage() {
  const router = useRouter();
  const { toasts, removeToast, toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [orders, setOrders] = useState<OutboundOrder[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; code: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [outboundType, setOutboundType] = useState<string>('all');
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

      if (outboundType !== 'all') {
        params.set('outboundType', outboundType);
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
  }, [page, status, outboundType]);

  // 仓库主数据：列表接口只回 warehouseId，需前端映射成仓库名/编码
  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        const res = await fetch('/api/v1/warehouses?limit=100');
        const data = await res.json();
        const list = data?.data?.items || [];
        if (Array.isArray(list)) setWarehouses(list);
      } catch (error) {
        console.error('Failed to fetch warehouses:', error);
      }
    };
    loadWarehouses();
  }, []);

  const warehouseOf = (id?: string) => warehouses.find((w) => w.id === id);

  /** 后端创建出库单时不回写总金额，用明细金额兜底 */
  const amountOf = (order: OutboundOrder) => {
    if (order.totalAmount != null) return Number(order.totalAmount);
    const items = order.items || [];
    if (items.length === 0) return null;
    return items.reduce((sum, it: any) => sum + Number(it.quantity || 0) * Number(it.unitPrice || 0), 0);
  };

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
    const confirmed = await confirm({ title: '确认操作', description: '确认要发货此出库单吗？' });
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/v1/outbound-orders/${id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (result.success) {
        toast.success('出库单已确认发货');
        fetchOrders();
      } else {
        toast.error(`操作失败：${result.message}`);
      }
    } catch (error) {
      console.error('Failed to confirm outbound order:', error);
      toast.error('操作失败，请重试');
    }
  };

  const handleCancel = async (id: string) => {
    const confirmed = await confirm({ title: '确认操作', description: '确认要取消此出库单吗？' });
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/v1/outbound-orders/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (result.success) {
        toast.success('出库单已取消');
        fetchOrders();
      } else {
        toast.error(`操作失败：${result.message}`);
      }
    } catch (error) {
      console.error('Failed to cancel outbound order:', error);
      toast.error('操作失败，请重试');
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
      toast.error('请选择要操作的出库单');
      return;
    }

    const confirmed = await confirm({ title: '确认操作', description: `确认要批量发货选中的 ${selectedIds.size} 个出库单吗？` });
    if (!confirmed) return;

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
        toast.success(`批量确认完成：成功 ${result.data.successCount}，失败 ${result.data.failedCount}`);
        if (result.data.failed.length > 0) {
          console.error('失败的出库单:', result.data.failed);
        }
        setSelectedIds(new Set());
        fetchOrders();
      } else {
        toast.error(`操作失败：${result.message}`);
      }
    } catch (error) {
      console.error('Failed to batch confirm:', error);
      toast.error('操作失败，请重试');
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleBatchCancel = async () => {
    if (selectedIds.size === 0) {
      toast.error('请选择要操作的出库单');
      return;
    }

    const confirmed = await confirm({ title: '确认操作', description: `确认要批量取消选中的 ${selectedIds.size} 个出库单吗？` });
    if (!confirmed) return;

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
        toast.success(`批量取消完成：成功 ${result.data.successCount}，失败 ${result.data.failedCount}`);
        if (result.data.failed.length > 0) {
          console.error('失败的出库单:', result.data.failed);
        }
        setSelectedIds(new Set());
        fetchOrders();
      } else {
        toast.error(`操作失败：${result.message}`);
      }
    } catch (error) {
      console.error('Failed to batch cancel:', error);
      toast.error('操作失败，请重试');
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleBatchExport = async () => {
    if (selectedIds.size === 0) {
      toast.error('请选择要导出的出库单');
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
        toast.success(`成功导出 ${result.data.count} 条记录`);
      } else {
        toast.error(`导出失败：${result.message}`);
      }
    } catch (error) {
      console.error('Failed to batch export:', error);
      toast.error('导出失败，请重试');
    } finally {
      setBatchProcessing(false);
    }
  };

  // 列排序
  const { sorted, requestSort, sortConfig } = useSortable(orders, 'createdAt');

  return (
    <div className="container mx-auto py-6 fade-in">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-2xl">出库单管理</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {selectedIds.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
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
                    <span className="hidden sm:inline">批量确认</span>
                    <span className="sm:hidden">确认</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBatchCancel}
                    disabled={batchProcessing}
                  >
                    <XCircle className="h-4 w-4 mr-1 text-red-600" />
                    <span className="hidden sm:inline">批量取消</span>
                    <span className="sm:hidden">取消</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBatchExport}
                    disabled={batchProcessing}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">批量导出</span>
                    <span className="sm:hidden">导出</span>
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
                <span className="hidden sm:inline">创建出库单</span>
                <span className="sm:hidden">创建</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 筛选栏：搜索靠左，筛选条件右对齐 */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
              <Input
                placeholder="搜索出库单号、备注..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full sm:max-w-sm"
              />
              <Button onClick={handleSearch} variant="outline" className="w-full sm:w-auto">
                <Search className="h-4 w-4 mr-2" />
                搜索
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto sm:ml-auto">
              <Select value={outboundType} onValueChange={(v) => { setOutboundType(v); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="出库类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  {OUTBOUND_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="PENDING">待处理</SelectItem>
                  <SelectItem value="PICKING">拣货中</SelectItem>
                  <SelectItem value="PACKING">打包中</SelectItem>
                  <SelectItem value="SHIPPED">已发货</SelectItem>
                  <SelectItem value="DELIVERED">已送达</SelectItem>
                  <SelectItem value="CANCELLED">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                      onChange={() => {
                        if (orders.every(o => selectedIds.has(o.id))) {
                          setSelectedIds(new Set());
                        } else {
                          setSelectedIds(new Set(orders.map(o => o.id)));
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => requestSort('outboundNo')}
                  >
                    出库单号
                    <SortIndicator field="outboundNo" sortConfig={sortConfig} />
                  </TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => requestSort('saleOrderNo')}
                  >
                    销售订单
                    <SortIndicator field="saleOrderNo" sortConfig={sortConfig} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => requestSort('warehouseName')}
                  >
                    仓库
                    <SortIndicator field="warehouseName" sortConfig={sortConfig} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => requestSort('_count.items')}
                  >
                    商品数
                    <SortIndicator field="_count.items" sortConfig={sortConfig} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => requestSort('totalAmount')}
                  >
                    总金额
                    <SortIndicator field="totalAmount" sortConfig={sortConfig} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => requestSort('status')}
                  >
                    状态
                    <SortIndicator field="status" sortConfig={sortConfig} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => requestSort('createdAt')}
                  >
                    创建时间
                    <SortIndicator field="createdAt" sortConfig={sortConfig} />
                  </TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <>
                  {[1, 2, 3, 4, 5].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))}
                </> : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10}>
                      <EmptyState
                        title="暂无出库单"
                        description="还没有任何出库记录，创建一笔出库单开始使用"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((order) => (
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
                        <Badge className={TYPE_COLORS[order.outboundType || 'SALE'] || 'bg-gray-100'}>
                          {TYPE_LABELS[order.outboundType || 'SALE'] || order.outboundType || '销售出库'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {order.order?.orderNo || '—'}
                        {order.order?.customer && (
                          <div className="text-xs text-muted-foreground">
                            {order.order.customer.companyName}
                          </div>
                        )}
                        {!order.order && order.notes && (
                          <div className="text-xs text-muted-foreground truncate max-w-[220px]" title={order.notes}>
                            {order.notes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {order.warehouse?.name || warehouseOf(order.warehouseId)?.name || '—'}
                        {(order.warehouse?.code || warehouseOf(order.warehouseId)?.code) && (
                          <div className="text-xs text-muted-foreground">
                            {order.warehouse?.code || warehouseOf(order.warehouseId)?.code}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{order._count?.items || order.items?.length || 0}</TableCell>
                      <TableCell>
                        {amountOf(order) != null ? `¥${Number(amountOf(order)).toFixed(2)}` : '—'}
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
                          {order.status === 'PENDING' && (
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
