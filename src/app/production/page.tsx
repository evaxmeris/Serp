'use client';

/**
 * 生产记录管理页面
 *
 * 功能：
 * - 列表展示：搜索框（订单号搜索）+ 状态筛选 + 新建按钮 + 表格(card 包裹)
 * - 表格列：生产单号、订单号、产品、数量、状态 Badge、进度条、计划周期、负责人、操作
 * - Dialog 新建：选择订单、填计划时间、负责人、备注
 * - Dialog 编辑：修改状态、进度、时间、负责人
 * - 删除确认 Dialog
 * - 分页
 */

import { useState, useEffect } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, Search, Edit, Trash2, Loader2 } from 'lucide-react';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { useSortable, SortIndicator } from '@/hooks/use-sortable';

// 生产记录数据类型
interface ProductionRecord {
  id: string;
  productionNo: string;
  orderId: string;
  productId: string | null;
  quantity: number;
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate: string | null;
  actualEndDate: string | null;
  status: string;
  progress: number;
  department: string | null;
  factory: string | null;
  supervisor: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  order?: {
    id: string;
    orderNo: string;
    status?: string;
    items?: {
      id: string;
      productName: string;
      productSku: string | null;
      quantity: number;
    }[];
  };
}

interface ProductionRecordsResponse {
  success: boolean;
  data: {
    items: ProductionRecord[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

// 订单查询接口
interface OrderBrief {
  id: string;
  orderNo: string;
  items?: {
    id: string;
    productName: string;
    productSku: string | null;
    quantity: number;
  }[];
}

// 生产状态映射
const PRODUCTION_STATUS: Record<string, string> = {
  PLANNED: '计划中',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  ON_HOLD: '暂停',
  CANCELLED: '已取消',
};

const STATUS_COLORS: Record<string, string> = {
  PLANNED: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  ON_HOLD: 'bg-yellow-100 text-yellow-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

// 空表单数据
const EMPTY_FORM = {
  orderId: '',
  quantity: 1,
  plannedStartDate: '',
  plannedEndDate: '',
  supervisor: '',
  notes: '',
};

export default function ProductionRecordsPage() {
  const { toasts, removeToast, toast } = useToast();
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // 创建/编辑 dialog 状态
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ProductionRecord | null>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  // 删除确认状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<ProductionRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 列排序
  const { sorted, requestSort, sortConfig } = useSortable(records, 'createdAt');

  // 订单选择下拉数据
  const [orders, setOrders] = useState<OrderBrief[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const fetchRecords = async () => {
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

      const response = await fetch(`/api/v1/production-records?${params.toString()}`);
      const result: ProductionRecordsResponse = await response.json();

      if (result.success) {
        setRecords(result.data.items);
        setTotal(result.data.pagination.total);
        setTotalPages(result.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch production records:', error);
      toast({ title: '获取生产记录失败', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [page, status]);

  const handleSearch = () => {
    setPage(1);
    fetchRecords();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 加载订单列表（用于创建时的下拉选择）
  const loadOrders = async () => {
    setOrdersLoading(true);
    try {
      const response = await fetch('/api/orders?limit=100&sortBy=createdAt&sortOrder=desc');
      const result = await response.json();
      if (result.success) {
        setOrders(result.data?.items || result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setOrdersLoading(false);
    }
  };

  // 创建生产记录
  const handleCreate = async () => {
    if (!formData.orderId) {
      toast({ title: '请选择订单', variant: 'error' });
      return;
    }
    if (!formData.plannedStartDate || !formData.plannedEndDate) {
      toast({ title: '请填写计划时间', variant: 'error' });
      return;
    }

    setSaving(true);
    try {
      // 从订单获取数量
      const selectedOrder = orders.find((o) => o.id === formData.orderId);
      const defaultQty = selectedOrder?.items?.[0]?.quantity || formData.quantity;

      const response = await fetch('/api/v1/production-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: formData.orderId,
          quantity: defaultQty,
          plannedStartDate: formData.plannedStartDate,
          plannedEndDate: formData.plannedEndDate,
          supervisor: formData.supervisor || undefined,
          notes: formData.notes || undefined,
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast({ title: '生产记录创建成功', variant: 'success' });
        setCreateOpen(false);
        setFormData({ ...EMPTY_FORM });
        fetchRecords();
      } else {
        toast({ title: result.message || '创建失败', variant: 'error' });
      }
    } catch (error) {
      console.error('Failed to create production record:', error);
      toast({ title: '创建失败，请重试', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // 打开编辑对话框
  const openEditDialog = (record: ProductionRecord) => {
    setEditingRecord(record);
    setFormData({
      orderId: record.orderId,
      quantity: record.quantity,
      plannedStartDate: record.plannedStartDate
        ? new Date(record.plannedStartDate).toISOString().slice(0, 16)
        : '',
      plannedEndDate: record.plannedEndDate
        ? new Date(record.plannedEndDate).toISOString().slice(0, 16)
        : '',
      supervisor: record.supervisor || '',
      notes: record.notes || '',
    });
    setEditOpen(true);
  };

  // 编辑生产记录
  const handleEdit = async () => {
    if (!editingRecord) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/v1/production-records/${editingRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: formData.quantity,
          plannedStartDate: formData.plannedStartDate || undefined,
          plannedEndDate: formData.plannedEndDate || undefined,
          supervisor: formData.supervisor || null,
          notes: formData.notes || null,
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast({ title: '生产记录更新成功', variant: 'success' });
        setEditOpen(false);
        setEditingRecord(null);
        fetchRecords();
      } else {
        toast({ title: result.message || '更新失败', variant: 'error' });
      }
    } catch (error) {
      console.error('Failed to update production record:', error);
      toast({ title: '更新失败，请重试', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // 删除生产记录
  const handleDelete = async () => {
    if (!deletingRecord) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/v1/production-records/${deletingRecord.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (result.success) {
        toast({ title: '生产记录删除成功', variant: 'success' });
        setDeleteDialogOpen(false);
        setDeletingRecord(null);
        fetchRecords();
      } else {
        toast({ title: result.message || '删除失败', variant: 'error' });
      }
    } catch (error) {
      console.error('Failed to delete production record:', error);
      toast({ title: '删除失败，请重试', variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  // 更新状态快捷操作
  const handleStatusChange = async (record: ProductionRecord, newStatus: string) => {
    try {
      const response = await fetch(`/api/v1/production-records/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const result = await response.json();
      if (result.success) {
        toast({ title: `状态已更新为 ${PRODUCTION_STATUS[newStatus] || newStatus}`, variant: 'success' });
        fetchRecords();
      } else {
        toast({ title: result.message || '状态更新失败', variant: 'error' });
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      toast({ title: '状态更新失败', variant: 'error' });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const getOrderDisplay = (record: ProductionRecord) => {
    if (!record.order) return record.orderId.slice(0, 8) + '...';
    return record.order.orderNo;
  };

  return (
    <div className="container mx-auto py-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-2xl">生产管理</CardTitle>
            <div className="flex items-center gap-2">
              <Dialog open={createOpen} onOpenChange={(open) => {
                setCreateOpen(open);
                if (open) loadOrders();
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    创建生产任务
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>创建生产任务</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="orderId">关联订单 *</Label>
                      <Select
                        value={formData.orderId}
                        onValueChange={(v) => setFormData({ ...formData, orderId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择订单..." />
                        </SelectTrigger>
                        <SelectContent>
                          {ordersLoading ? (
                            <SelectItem value="__loading__" disabled>
                              加载中...
                            </SelectItem>
                          ) : orders.length === 0 ? (
                            <SelectItem value="__empty__" disabled>
                              暂无可用订单
                            </SelectItem>
                          ) : (
                            orders.map((o) => (
                              <SelectItem key={o.id} value={o.id}>
                                {o.orderNo}
                                {o.items?.[0] ? ` - ${o.items[0].productName}` : ''}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="plannedStartDate">计划开始日期 *</Label>
                        <Input
                          id="plannedStartDate"
                          type="datetime-local"
                          value={formData.plannedStartDate}
                          onChange={(e) =>
                            setFormData({ ...formData, plannedStartDate: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="plannedEndDate">计划结束日期 *</Label>
                        <Input
                          id="plannedEndDate"
                          type="datetime-local"
                          value={formData.plannedEndDate}
                          onChange={(e) =>
                            setFormData({ ...formData, plannedEndDate: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="supervisor">负责人</Label>
                      <Input
                        id="supervisor"
                        placeholder="填写负责人姓名"
                        value={formData.supervisor}
                        onChange={(e) =>
                          setFormData({ ...formData, supervisor: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="notes">备注</Label>
                      <Input
                        id="notes"
                        placeholder="生产备注信息"
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData({ ...formData, notes: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>
                      取消
                    </Button>
                    <Button onClick={handleCreate} disabled={saving}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      创建
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 筛选栏 */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
              <Input
                placeholder="搜索订单号、生产单号..."
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
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="PLANNED">计划中</SelectItem>
                <SelectItem value="IN_PROGRESS">进行中</SelectItem>
                <SelectItem value="COMPLETED">已完成</SelectItem>
                <SelectItem value="ON_HOLD">暂停</SelectItem>
                <SelectItem value="CANCELLED">已取消</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 数据表格 */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-gray-100"
                    onClick={() => requestSort('productionNo')}
                  >
                    生产单号
                    <SortIndicator field="productionNo" sortConfig={sortConfig} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-gray-100"
                    onClick={() => requestSort('order.orderNo')}
                  >
                    关联订单
                    <SortIndicator field="order.orderNo" sortConfig={sortConfig} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-gray-100"
                    onClick={() => requestSort('quantity')}
                  >
                    数量
                    <SortIndicator field="quantity" sortConfig={sortConfig} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-gray-100"
                    onClick={() => requestSort('status')}
                  >
                    状态
                    <SortIndicator field="status" sortConfig={sortConfig} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-gray-100"
                    onClick={() => requestSort('progress')}
                  >
                    进度
                    <SortIndicator field="progress" sortConfig={sortConfig} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-gray-100"
                    onClick={() => requestSort('plannedStartDate')}
                  >
                    计划周期
                    <SortIndicator field="plannedStartDate" sortConfig={sortConfig} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-gray-100"
                    onClick={() => requestSort('supervisor')}
                  >
                    负责人
                    <SortIndicator field="supervisor" sortConfig={sortConfig} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-gray-100"
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
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))}
                </> : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <EmptyState
                        title="暂无生产记录"
                        description="还没有任何生产记录，创建一笔生产工单开始使用"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.productionNo}</TableCell>
                      <TableCell>
                        {getOrderDisplay(record)}
                        {record.order?.items?.[0] && (
                          <div className="text-xs text-muted-foreground">
                            {record.order.items[0].productName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{record.quantity}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[record.status] || 'bg-gray-100'}>
                          {PRODUCTION_STATUS[record.status] || record.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                record.progress >= 100
                                  ? 'bg-green-500'
                                  : record.progress > 0
                                  ? 'bg-blue-500'
                                  : 'bg-gray-300'
                              }`}
                              style={{ width: `${Math.min(record.progress, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {record.progress}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div>{formatDate(record.plannedStartDate)}</div>
                        <div>~ {formatDate(record.plannedEndDate)}</div>
                      </TableCell>
                      <TableCell>{record.supervisor || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(record.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {/* 状态快捷操作 */}
                          {record.status === 'PLANNED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStatusChange(record, 'IN_PROGRESS')}
                              title="开始生产"
                            >
                              <span className="text-xs text-blue-600">开始</span>
                            </Button>
                          )}
                          {record.status === 'IN_PROGRESS' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStatusChange(record, 'COMPLETED')}
                              title="完成生产"
                            >
                              <span className="text-xs text-green-600">完成</span>
                            </Button>
                          )}
                          {record.status !== 'COMPLETED' && record.status !== 'CANCELLED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(record)}
                            >
                              <Edit className="h-4 w-4 text-blue-600" />
                            </Button>
                          )}
                          {(record.status === 'PLANNED' || record.status === 'ON_HOLD') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDeletingRecord(record);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
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
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 编辑 Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => {
        setEditOpen(open);
        if (!open) setEditingRecord(null);
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              编辑生产任务 - {editingRecord?.productionNo}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {editingRecord && (
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>当前状态</Label>
                  <Select
                    value={editingRecord.status}
                    onValueChange={(v) =>
                      setEditingRecord({ ...editingRecord, status: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PLANNED">计划中</SelectItem>
                      <SelectItem value="IN_PROGRESS">进行中</SelectItem>
                      <SelectItem value="COMPLETED">已完成</SelectItem>
                      <SelectItem value="ON_HOLD">暂停</SelectItem>
                      <SelectItem value="CANCELLED">已取消</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>进度 (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={editingRecord.progress}
                    onChange={(e) => {
                      const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                      setEditingRecord({ ...editingRecord, progress: val });
                    }}
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-plannedStart">计划开始</Label>
                <Input
                  id="edit-plannedStart"
                  type="datetime-local"
                  value={formData.plannedStartDate}
                  onChange={(e) =>
                    setFormData({ ...formData, plannedStartDate: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-plannedEnd">计划结束</Label>
                <Input
                  id="edit-plannedEnd"
                  type="datetime-local"
                  value={formData.plannedEndDate}
                  onChange={(e) =>
                    setFormData({ ...formData, plannedEndDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-supervisor">负责人</Label>
              <Input
                id="edit-supervisor"
                value={formData.supervisor}
                onChange={(e) =>
                  setFormData({ ...formData, supervisor: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-notes">备注</Label>
              <Input
                id="edit-notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              取消
            </Button>
            <Button
              onClick={async () => {
                if (!editingRecord) return;
                setSaving(true);
                try {
                  const response = await fetch(`/api/v1/production-records/${editingRecord.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      status: editingRecord.status,
                      progress: editingRecord.progress,
                      plannedStartDate: formData.plannedStartDate || undefined,
                      plannedEndDate: formData.plannedEndDate || undefined,
                      supervisor: formData.supervisor || null,
                      notes: formData.notes || null,
                    }),
                  });

                  const result = await response.json();
                  if (result.success) {
                    toast({ title: '生产记录更新成功', variant: 'success' });
                    setEditOpen(false);
                    setEditingRecord(null);
                    fetchRecords();
                  } else {
                    toast({ title: result.message || '更新失败', variant: 'error' });
                  }
                } catch (error) {
                  console.error('Failed to update production record:', error);
                  toast({ title: '更新失败，请重试', variant: 'error' });
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要删除生产单 <strong>{deletingRecord?.productionNo}</strong> 吗？
            此操作不可撤销。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
