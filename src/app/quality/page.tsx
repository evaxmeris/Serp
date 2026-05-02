'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, Search, Edit, Trash2, Eye, ShieldCheck } from 'lucide-react';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirmation-dialog';
import { useSortable, SortIndicator } from '@/hooks/use-sortable';

/** 检测项 */
interface QCItem {
  id?: string;
  itemName: string;
  standard?: string;
  result?: string;
  passed: boolean;
}

/** 质检单（对齐 Prisma QualityCheck 模型） */
interface QualityCheck {
  id: string;
  qcNo: string;
  orderId: string;
  type: string;
  inspector?: string;
  inspectionDate: string;
  status: string;
  passRate?: number;
  defectCount?: number;
  defectReasons: string[];
  photos: string[];
  report?: string;
  notes?: string;
  createdAt: string;
  order?: { id: string; orderNo: string };
  items: QCItem[];
}

const QC_TYPES: Record<string, string> = {
  RAW_MATERIAL: '来料检验',
  IN_PROCESS: '过程检验',
  FINAL: '成品检验',
  PRE_SHIPMENT: '出货前检验',
};

const QC_STATUS: Record<string, string> = {
  PENDING: '待检验',
  IN_PROGRESS: '检验中',
  PASSED: '已通过',
  FAILED: '未通过',
  CONDITIONAL: '让步接收',
};

const TYPE_COLORS: Record<string, string> = {
  RAW_MATERIAL: 'bg-purple-100 text-purple-800',
  IN_PROCESS: 'bg-blue-100 text-blue-800',
  FINAL: 'bg-green-100 text-green-800',
  PRE_SHIPMENT: 'bg-orange-100 text-orange-800',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  PASSED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  CONDITIONAL: 'bg-teal-100 text-teal-800',
};

const PASS_OPTIONS = [
  { value: 'true', label: '合格' },
  { value: 'false', label: '不合格' },
];

export default function QualityChecksPage() {
  const [checks, setChecks] = useState<QualityCheck[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [saving, setSaving] = useState(false);

  // 列排序
  const { sorted, requestSort, sortConfig } = useSortable(checks, 'createdAt');

  // 弹窗状态
  const [showCreate, setShowCreate] = useState(false);
  const [editingQC, setEditingQC] = useState<QualityCheck | null>(null);
  const [viewingQC, setViewingQC] = useState<QualityCheck | null>(null);
  const [showDelete, setShowDelete] = useState<QualityCheck | null>(null);

  const { toast, toasts, removeToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  // 表单
  const [form, setForm] = useState({
    orderId: '', type: 'FINAL', inspector: '', inspectionDate: '',
    notes: '', status: 'PENDING', passRate: '', defectCount: '',
    defectReasons: '', report: '',
  });
  const [formItems, setFormItems] = useState<QCItem[]>([]);

  /** 获取质检列表 */
  const fetchChecks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      const res = await fetch(`/api/v1/quality-checks?${params}`);
      const data = await res.json();
      if (data.success) {
        setChecks(data.data?.items || data.data || []);
        setTotal(data.data?.pagination?.total || 0);
        setTotalPages(data.data?.pagination?.totalPages || 1);
      }
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  /** 获取订单列表（用于新建时选择） */
  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders?limit=100');
      const data = await res.json();
      if (data.success) setOrders(data.data?.items || data.data || []);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => { fetchChecks(); }, [page, statusFilter, typeFilter]);
  useEffect(() => { fetchOrders(); }, []);

  const resetForm = () => {
    setForm({
      orderId: '', type: 'FINAL', inspector: '', inspectionDate: '',
      notes: '', status: 'PENDING', passRate: '', defectCount: '',
      defectReasons: '', report: '',
    });
    setFormItems([]);
  };

  /** 打开编辑 */
  const openEdit = async (qc: QualityCheck) => {
    // 获取完整详情（含 items）
    try {
      const res = await fetch(`/api/v1/quality-checks/${qc.id}`);
      const data = await res.json();
      if (data.success) {
        const full = data.data;
        setEditingQC(full);
        setForm({
          orderId: full.orderId,
          type: full.type,
          inspector: full.inspector || '',
          inspectionDate: full.inspectionDate
            ? new Date(full.inspectionDate).toISOString().slice(0, 16) : '',
          notes: full.notes || '',
          status: full.status,
          passRate: full.passRate?.toString() || '',
          defectCount: full.defectCount?.toString() || '',
          defectReasons: (full.defectReasons || []).join(', '),
          report: full.report || '',
        });
        setFormItems(full.items || []);
      }
    } catch (e) { console.error(e); }
  };

  /** 打开详情 */
  const openView = async (qc: QualityCheck) => {
    try {
      const res = await fetch(`/api/v1/quality-checks/${qc.id}`);
      const data = await res.json();
      if (data.success) setViewingQC(data.data);
    } catch (e) { console.error(e); }
  };

  /** 添加检测项 */
  const addItem = () => {
    setFormItems([...formItems, { itemName: '', standard: '', result: '', passed: true }]);
  };

  /** 更新检测项 */
  const updateItem = (index: number, field: keyof QCItem, value: any) => {
    const updated = [...formItems];
    (updated[index] as any)[field] = value;
    setFormItems(updated);
  };

  /** 删除检测项 */
  const removeItem = (index: number) => {
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  /** 创建 */
  const handleCreate = async () => {
    if (!form.orderId) { toast.warning('请选择关联订单'); return; }
    setSaving(true);
    const body: any = {
      orderId: form.orderId,
      type: form.type,
      inspector: form.inspector || undefined,
      inspectionDate: form.inspectionDate || undefined,
      notes: form.notes || undefined,
    };
    if (formItems.length > 0) {
      body.items = formItems.map(item => ({
        itemName: item.itemName,
        standard: item.standard || null,
        result: item.result || null,
        passed: item.passed,
      }));
    }
    const res = await fetch('/api/v1/quality-checks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.success) { setShowCreate(false); resetForm(); fetchChecks(); }
    else { toast.error(data.message || data.error || '创建失败'); }
    setSaving(false);
  };

  /** 更新 */
  const handleUpdate = async () => {
    if (!editingQC) return;
    setSaving(true);
    const body: any = {
      type: form.type,
      inspector: form.inspector || null,
      inspectionDate: form.inspectionDate || undefined,
      status: form.status,
      notes: form.notes || null,
    };
    if (form.passRate) body.passRate = form.passRate;
    if (form.defectCount) body.defectCount = form.defectCount;
    if (form.defectReasons) body.defectReasons = form.defectReasons.split(',').map((s: string) => s.trim()).filter(Boolean);
    if (form.report) body.report = form.report;
    if (formItems.length > 0) {
      body.items = formItems.map(item => ({
        itemName: item.itemName,
        standard: item.standard || null,
        result: item.result || null,
        passed: item.passed,
      }));
    }
    const res = await fetch(`/api/v1/quality-checks/${editingQC.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.success) { setEditingQC(null); fetchChecks(); }
    else { toast.error(data.message || data.error || '更新失败'); }
    setSaving(false);
  };

  /** 删除 */
  const handleDelete = async () => {
    if (!showDelete) return;
    const res = await fetch(`/api/v1/quality-checks/${showDelete.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) { setShowDelete(null); fetchChecks(); }
    else { toast.error(data.message || data.error || '删除失败'); }
  };

  /** 渲染检测项表单 */
  const renderItemsForm = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">检测项列表</Label>
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="h-3 w-3 mr-1" />添加检测项
        </Button>
      </div>
      {formItems.length === 0 && (
        <p className="text-sm text-gray-400">暂无检测项，请点击"添加检测项"</p>
      )}
      {formItems.map((item, idx) => (
        <div key={idx} className="flex items-start gap-2 p-3 border rounded-lg bg-gray-50">
          <div className="flex-1 grid grid-cols-4 gap-2">
            <div className="col-span-1">
              <Label className="text-xs">检测项目 *</Label>
              <Input size={1} className="h-8 text-sm" value={item.itemName}
                onChange={e => updateItem(idx, 'itemName', e.target.value)}
                placeholder="如：外观检查" />
            </div>
            <div className="col-span-1">
              <Label className="text-xs">标准要求</Label>
              <Input size={1} className="h-8 text-sm" value={item.standard || ''}
                onChange={e => updateItem(idx, 'standard', e.target.value)}
                placeholder="如：无异物" />
            </div>
            <div className="col-span-1">
              <Label className="text-xs">检测结果</Label>
              <Input size={1} className="h-8 text-sm" value={item.result || ''}
                onChange={e => updateItem(idx, 'result', e.target.value)}
                placeholder="如：OK / NG" />
            </div>
            <div className="col-span-1">
              <Label className="text-xs">是否合格</Label>
              <Select value={String(item.passed)} onValueChange={v => updateItem(idx, 'passed', v === 'true')}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PASS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-red-400 mt-5 h-8"
            onClick={() => removeItem(idx)}>✕</Button>
        </div>
      ))}
    </div>
  );

  /** 渲染详情检测项列表（只读） */
  const renderViewItems = (items: QCItem[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>检测项目</TableHead>
          <TableHead>标准要求</TableHead>
          <TableHead>检测结果</TableHead>
          <TableHead>判定</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow><TableCell colSpan={4}>
            <EmptyState title="暂无检测项" description="请添加检测项开始检验" />
          </TableCell></TableRow>
        ) : items.map((item, idx) => (
          <TableRow key={item.id || idx}>
            <TableCell>{item.itemName}</TableCell>
            <TableCell className="text-sm text-gray-500">{item.standard || '-'}</TableCell>
            <TableCell>{item.result || '-'}</TableCell>
            <TableCell>
              <Badge className={item.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                {item.passed ? '合格' : '不合格'}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  /** 渲染表单（新建/编辑共用） */
  const renderForm = (isEdit: boolean) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {!isEdit && (
          <div className="col-span-2">
            <Label>关联订单 *</Label>
            <Select value={form.orderId} onValueChange={v => setForm({ ...form, orderId: v })}>
              <SelectTrigger><SelectValue placeholder="选择销售订单" /></SelectTrigger>
              <SelectContent>
                {orders.map((o: any) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.orderNo} {o.customer?.companyName ? `- ${o.customer.companyName}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label>质检类型</Label>
          <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(QC_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>质检人</Label>
          <Input value={form.inspector} onChange={e => setForm({ ...form, inspector: e.target.value })} placeholder="检验员姓名" />
        </div>
        <div>
          <Label>检验日期</Label>
          <Input type="datetime-local" value={form.inspectionDate} onChange={e => setForm({ ...form, inspectionDate: e.target.value })} />
        </div>
        {isEdit && (
          <>
            <div>
              <Label>状态</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(QC_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>合格率(%)</Label>
              <Input type="number" step="0.01" min="0" max="100" value={form.passRate}
                onChange={e => setForm({ ...form, passRate: e.target.value })} />
            </div>
            <div>
              <Label>缺陷数</Label>
              <Input type="number" min="0" value={form.defectCount}
                onChange={e => setForm({ ...form, defectCount: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>缺陷原因</Label>
              <Input value={form.defectReasons} onChange={e => setForm({ ...form, defectReasons: e.target.value })} placeholder="多个原因用逗号分隔" />
            </div>
          </>
        )}
        <div className="col-span-2">
          <Label>备注</Label>
          <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="备注信息" />
        </div>
      </div>
      {/* 检测项管理 */}
      {renderItemsForm()}
    </div>
  );

  return (<>
    <div className="w-full px-4 md:px-6 lg:px-8 py-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />质检管理
          </CardTitle>
          <Button onClick={() => { resetForm(); setShowCreate(true); }}>
            <Plus className="h-4 w-4 mr-1" />新增质检单
          </Button>
        </CardHeader>
        <CardContent>
          {/* 筛选区 */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Input placeholder="搜索质检单号、检验人、订单号..." value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (setPage(1), fetchChecks())} />
            </div>
            <div className="w-40">
              <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="质检类型" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  {Object.entries(QC_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="质检状态" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {Object.entries(QC_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => { setPage(1); fetchChecks(); }}>
              <Search className="mr-2 h-4 w-4" />搜索
            </Button>
          </div>

          {loading ? <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-5 w-28 shrink-0" />
                <Skeleton className="h-5 w-28 shrink-0" />
                <Skeleton className="h-5 w-16 shrink-0" />
                <Skeleton className="h-5 w-16 shrink-0" />
                <Skeleton className="h-5 w-12 shrink-0" />
                <Skeleton className="h-5 w-16 shrink-0" />
                <Skeleton className="h-5 w-20 shrink-0" />
                <Skeleton className="h-5 w-16 shrink-0 ml-auto" />
              </div>
            ))}
          </div> : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => requestSort('qcNo')}
                    >
                      质检单号
                      <SortIndicator field="qcNo" sortConfig={sortConfig} />
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
                      onClick={() => requestSort('type')}
                    >
                      质检类型
                      <SortIndicator field="type" sortConfig={sortConfig} />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => requestSort('status')}
                    >
                      状态
                      <SortIndicator field="status" sortConfig={sortConfig} />
                    </TableHead>
                    <TableHead>检测项数</TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => requestSort('inspector')}
                    >
                      检验人
                      <SortIndicator field="inspector" sortConfig={sortConfig} />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => requestSort('inspectionDate')}
                    >
                      检验日期
                      <SortIndicator field="inspectionDate" sortConfig={sortConfig} />
                    </TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checks.length === 0 ? (
                    <TableRow><TableCell colSpan={8}>
                      <EmptyState
                        title="暂无质检记录"
                        description="还没有任何质检记录，创建一笔质检记录开始使用"
                      />
                    </TableCell></TableRow>
                  ) : sorted.map(qc => (
                    <TableRow key={qc.id}>
                      <TableCell className="font-mono text-sm">{qc.qcNo}</TableCell>
                      <TableCell className="font-mono text-sm">{qc.order?.orderNo || '-'}</TableCell>
                      <TableCell>
                        <Badge className={TYPE_COLORS[qc.type] || 'bg-gray-100'}>
                          {QC_TYPES[qc.type] || qc.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[qc.status] || 'bg-gray-100'}>
                          {QC_STATUS[qc.status] || qc.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{qc.items?.length || 0} 项</TableCell>
                      <TableCell>{qc.inspector || '-'}</TableCell>
                      <TableCell className="text-sm">
                        {qc.inspectionDate ? new Date(qc.inspectionDate).toLocaleDateString('zh-CN') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="outline" size="sm" onClick={() => openView(qc)} title="查看详情">
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEdit(qc)} title="编辑">
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm" className="text-red-400"
                            onClick={() => setShowDelete(qc)} title="删除">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                  <span className="text-sm text-gray-500">共 {total} 条，第 {page}/{totalPages} 页</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1}
                      onClick={() => setPage(page - 1)}>上一页</Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}>下一页</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 新建对话框 */}
      <Dialog open={showCreate} onOpenChange={v => { if (!v) setShowCreate(false); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>新增质检单</DialogTitle></DialogHeader>
          {renderForm(false)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? '创建中...' : '创建'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑对话框 */}
      <Dialog open={!!editingQC} onOpenChange={v => { if (!v) setEditingQC(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>编辑质检单 — {editingQC?.qcNo}</DialogTitle></DialogHeader>
          {editingQC && renderForm(true)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingQC(null)}>取消</Button>
            <Button onClick={handleUpdate} disabled={saving}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 详情对话框 */}
      <Dialog open={!!viewingQC} onOpenChange={v => { if (!v) setViewingQC(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>质检详情 — {viewingQC?.qcNo}</DialogTitle></DialogHeader>
          {viewingQC && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">关联订单：</span>{viewingQC.order?.orderNo || '-'}</div>
                <div><span className="text-gray-500">质检类型：</span>
                  <Badge className={TYPE_COLORS[viewingQC.type]}>{QC_TYPES[viewingQC.type] || viewingQC.type}</Badge>
                </div>
                <div><span className="text-gray-500">状态：</span>
                  <Badge className={STATUS_COLORS[viewingQC.status]}>{QC_STATUS[viewingQC.status] || viewingQC.status}</Badge>
                </div>
                <div><span className="text-gray-500">检验人：</span>{viewingQC.inspector || '-'}</div>
                <div><span className="text-gray-500">检验日期：</span>
                  {viewingQC.inspectionDate ? new Date(viewingQC.inspectionDate).toLocaleString('zh-CN') : '-'}</div>
                <div><span className="text-gray-500">合格率：</span>
                  {viewingQC.passRate != null ? `${viewingQC.passRate}%` : '-'}</div>
                <div><span className="text-gray-500">缺陷数：</span>{viewingQC.defectCount ?? '-'}</div>
                {viewingQC.defectReasons?.length > 0 && (
                  <div className="col-span-2"><span className="text-gray-500">缺陷原因：</span>{viewingQC.defectReasons.join(', ')}</div>
                )}
                {viewingQC.notes && (
                  <div className="col-span-2"><span className="text-gray-500">备注：</span>{viewingQC.notes}</div>
                )}
              </div>
              <div>
                <Label className="text-base font-semibold">检测项明细</Label>
                {renderViewItems(viewingQC.items || [])}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingQC(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>确认删除</DialogTitle></DialogHeader>
          <p>确定要删除质检单 <strong>{showDelete?.qcNo}</strong> 吗？此操作不可撤销，关联的检测项也将一并删除。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmDialog />
    </>
  );
}
