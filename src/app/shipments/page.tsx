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
import { Plus, Search, Edit, Trash2, Ship } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirmation-dialog';

/** 发货记录类型（对齐 Prisma Shipment 模型） */
interface Shipment {
  id: string;
  shipmentNo: string;
  orderId: string;
  carrier?: string;
  trackingNo?: string;
  etd?: string;
  eta?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  containerNo?: string;
  sealNo?: string;
  packages?: number;
  grossWeight?: number;
  volume?: number;
  status: string;
  notes?: string;
  createdAt: string;
  order?: { id: string; orderNo: string };
}

const SHIPMENT_STATUS: Record<string, string> = {
  PENDING: '待发运',
  IN_TRANSIT: '运输中',
  ARRIVED: '已到港',
  DELIVERED: '已送达',
  CANCELLED: '已取消',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  IN_TRANSIT: 'bg-blue-100 text-blue-800',
  ARRIVED: 'bg-teal-100 text-teal-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [saving, setSaving] = useState(false);

  // 弹窗状态
  const [showCreate, setShowCreate] = useState(false);
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [showDelete, setShowDelete] = useState<Shipment | null>(null);

  // 表单（新建/编辑共用）
  const { toast, toasts, removeToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [form, setForm] = useState({
    orderId: '', carrier: '', trackingNo: '', etd: '', eta: '',
    portOfLoading: '', portOfDischarge: '', containerNo: '', sealNo: '',
    packages: '', grossWeight: '', volume: '', notes: '', status: 'PENDING',
  });

  /** 获取发货列表 */
  const fetchShipments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/v1/shipments?${params}`);
      const data = await res.json();
      if (data.success) {
        setShipments(data.data?.items || data.data || []);
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

  useEffect(() => { fetchShipments(); }, [page]);
  useEffect(() => { fetchOrders(); }, []);

  const resetForm = () => setForm({
    orderId: '', carrier: '', trackingNo: '', etd: '', eta: '',
    portOfLoading: '', portOfDischarge: '', containerNo: '', sealNo: '',
    packages: '', grossWeight: '', volume: '', notes: '', status: 'PENDING',
  });

  /** 打开编辑 */
  const openEdit = (s: Shipment) => {
    setEditingShipment(s);
    setForm({
      orderId: s.orderId, carrier: s.carrier || '', trackingNo: s.trackingNo || '',
      etd: s.etd ? new Date(s.etd).toISOString().slice(0, 16) : '',
      eta: s.eta ? new Date(s.eta).toISOString().slice(0, 16) : '',
      portOfLoading: s.portOfLoading || '', portOfDischarge: s.portOfDischarge || '',
      containerNo: s.containerNo || '', sealNo: s.sealNo || '',
      packages: s.packages?.toString() || '', grossWeight: s.grossWeight?.toString() || '',
      volume: s.volume?.toString() || '', notes: s.notes || '', status: s.status,
    });
  };

  /** 创建 */
  const handleCreate = async () => {
    if (!form.orderId) { toast.warning('请选择关联订单'); return; }
    setSaving(true);
    const res = await fetch('/api/v1/shipments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.success) { setShowCreate(false); resetForm(); fetchShipments(); }
    else { toast.error(data.message || data.error || '创建失败'); }
    setSaving(false);
  };

  /** 更新 */
  const handleUpdate = async () => {
    if (!editingShipment) return;
    setSaving(true);
    const res = await fetch('/api/v1/shipments', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipmentId: editingShipment.id, ...form }),
    });
    const data = await res.json();
    if (data.success) { setEditingShipment(null); fetchShipments(); }
    else { toast.error(data.message || data.error || '更新失败'); }
    setSaving(false);
  };

  /** 删除 */
  const handleDelete = async () => {
    if (!showDelete) return;
    const res = await fetch(`/api/v1/shipments?id=${showDelete.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) { setShowDelete(null); fetchShipments(); }
    else { toast.error(data.message || data.error || '删除失败'); }
  };

  const renderForm = () => (
    <div className="grid grid-cols-2 gap-4 py-2">
      {!editingShipment && (
        <div className="col-span-2">
          <Label>关联订单 *</Label>
          <Select value={form.orderId} onValueChange={v => setForm({ ...form, orderId: v })}>
            <SelectTrigger><SelectValue placeholder="选择销售订单" /></SelectTrigger>
            <SelectContent>
              {orders.map((o: any) => (
                <SelectItem key={o.id} value={o.id}>{o.orderNo} {o.customer?.companyName ? `- ${o.customer.companyName}` : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div><Label>承运商</Label><Input value={form.carrier} onChange={e => setForm({ ...form, carrier: e.target.value })} placeholder="如：Maersk" /></div>
      <div><Label>物流单号</Label><Input value={form.trackingNo} onChange={e => setForm({ ...form, trackingNo: e.target.value })} placeholder="运单号" /></div>
      <div><Label>装货港</Label><Input value={form.portOfLoading} onChange={e => setForm({ ...form, portOfLoading: e.target.value })} placeholder="如：上海" /></div>
      <div><Label>卸货港</Label><Input value={form.portOfDischarge} onChange={e => setForm({ ...form, portOfDischarge: e.target.value })} placeholder="如：洛杉矶" /></div>
      <div><Label>箱号</Label><Input value={form.containerNo} onChange={e => setForm({ ...form, containerNo: e.target.value })} placeholder="集装箱号" /></div>
      <div><Label>封号</Label><Input value={form.sealNo} onChange={e => setForm({ ...form, sealNo: e.target.value })} placeholder="铅封号" /></div>
      <div><Label>预计发运</Label><Input type="datetime-local" value={form.etd} onChange={e => setForm({ ...form, etd: e.target.value })} /></div>
      <div><Label>预计到达</Label><Input type="datetime-local" value={form.eta} onChange={e => setForm({ ...form, eta: e.target.value })} /></div>
      <div><Label>件数</Label><Input type="number" value={form.packages} onChange={e => setForm({ ...form, packages: e.target.value })} /></div>
      <div><Label>毛重(kg)</Label><Input type="number" step="0.01" value={form.grossWeight} onChange={e => setForm({ ...form, grossWeight: e.target.value })} /></div>
      <div><Label>体积(m³)</Label><Input type="number" step="0.001" value={form.volume} onChange={e => setForm({ ...form, volume: e.target.value })} /></div>
      <div>
        <Label>状态</Label>
        <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(SHIPMENT_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2"><Label>备注</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
    </div>
  );

  return (<>
    <div className="w-full px-4 md:px-6 lg:px-8 py-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl flex items-center gap-2"><Ship className="h-5 w-5" />发货记录</CardTitle>
          <Button onClick={() => { resetForm(); setShowCreate(true); }}><Plus className="h-4 w-4 mr-1" />新增发货</Button>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Input placeholder="搜索发货单号、物流单号..." value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (setPage(1), fetchShipments())} />
            </div>
            <Button onClick={() => { setPage(1); fetchShipments(); }}><Search className="mr-2 h-4 w-4" />搜索</Button>
          </div>

          {loading ? <div className="text-center py-8">加载中...</div> : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>发货单号</TableHead>
                    <TableHead>关联订单</TableHead>
                    <TableHead>承运商</TableHead>
                    <TableHead>物流单号</TableHead>
                    <TableHead>起运港 → 目的港</TableHead>
                    <TableHead>ETD</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipments.length === 0 ? (
                    <TableRow><TableCell colSpan={8}>
                      <EmptyState
                        title="暂无发货记录"
                        description="还没有任何发货记录，创建一笔发货开始使用"
                      />
                    </TableCell></TableRow>
                  ) : shipments.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-sm">{s.shipmentNo}</TableCell>
                      <TableCell className="font-mono text-sm">{s.order?.orderNo || '-'}</TableCell>
                      <TableCell>{s.carrier || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{s.trackingNo || '-'}</TableCell>
                      <TableCell className="text-sm">{s.portOfLoading || '?'} → {s.portOfDischarge || '?'}</TableCell>
                      <TableCell className="text-sm">{s.etd ? new Date(s.etd).toLocaleDateString('zh-CN') : '-'}</TableCell>
                      <TableCell><Badge className={STATUS_COLORS[s.status] || 'bg-gray-100'}>{SHIPMENT_STATUS[s.status] || s.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="outline" size="sm" onClick={() => openEdit(s)}><Edit className="h-3 w-3" /></Button>
                          <Button variant="outline" size="sm" className="text-red-400" onClick={() => setShowDelete(s)}><Trash2 className="h-3 w-3" /></Button>
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
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>上一页</Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 新建对话框 */}
      <Dialog open={showCreate} onOpenChange={v => { if (!v) setShowCreate(false); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>新增发货记录</DialogTitle></DialogHeader>
          {renderForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? '创建中...' : '创建'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑对话框 */}
      <Dialog open={!!editingShipment} onOpenChange={v => { if (!v) setEditingShipment(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>编辑发货记录 — {editingShipment?.shipmentNo}</DialogTitle></DialogHeader>
          {renderForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingShipment(null)}>取消</Button>
            <Button onClick={handleUpdate} disabled={saving}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>确认删除</DialogTitle></DialogHeader>
          <p>确定要删除发货记录 <strong>{showDelete?.shipmentNo}</strong> 吗？此操作不可撤销。</p>
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
