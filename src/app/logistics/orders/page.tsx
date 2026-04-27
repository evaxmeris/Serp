'use client';

/**
 * 物流订单管理 — 四级审批流程
 * 提交人 → 校对人 → 审批人 → 财务签收支付
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Truck, X, Check, Ban, Eye, Edit, Trash2, Send, UserCheck, ShieldCheck, Wallet } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'bg-gray-100 text-gray-700' },
  PENDING_REVIEW: { label: '待校对', color: 'bg-yellow-100 text-yellow-700' },
  PENDING_APPROVAL: { label: '待审批', color: 'bg-orange-100 text-orange-700' },
  PENDING_FINANCE: { label: '待财务确认', color: 'bg-purple-100 text-purple-700' },
  APPROVED: { label: '已审批', color: 'bg-blue-100 text-blue-700' },
  REJECTED: { label: '已退回', color: 'bg-red-100 text-red-700' },
  BOOKED: { label: '已订舱', color: 'bg-indigo-100 text-indigo-700' },
  IN_TRANSIT: { label: '运输中', color: 'bg-purple-100 text-purple-700' },
  ARRIVED: { label: '已到港', color: 'bg-teal-100 text-teal-700' },
  DELIVERED: { label: '已送达', color: 'bg-green-100 text-green-700' },
  COMPLETED: { label: '已完成', color: 'bg-green-200 text-green-800' },
  CANCELLED: { label: '已取消', color: 'bg-red-100 text-red-700' },
};

const APPROVAL_STEP_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  PENDING_REVIEW: '待校对',
  PENDING_APPROVAL: '待审批',
  PENDING_FINANCE: '待财务确认',
  APPROVED: '已通过',
  REJECTED: '已退回',
};

const TRANSPORT_METHODS = [
  { value: 'SEA_FREIGHT', label: '海运' },
  { value: 'AIR_FREIGHT', label: '空运' },
  { value: 'RAIL', label: '铁路' },
  { value: 'EXPRESS', label: '快递' },
  { value: 'TRUCK', label: '卡车' },
];

const STATUS_FLOW: Record<string, { next: string; label: string }[]> = {
  DRAFT: [],
  APPROVED: [
    { next: 'BOOKED', label: '已订舱' },
    { next: 'IN_TRANSIT', label: '直接发运' },
  ],
  BOOKED: [{ next: 'IN_TRANSIT', label: '开始运输' }],
  IN_TRANSIT: [{ next: 'ARRIVED', label: '已到港' }],
  ARRIVED: [{ next: 'DELIVERED', label: '已送达' }],
  DELIVERED: [{ next: 'COMPLETED', label: '完成' }],
};

export default function LogisticsOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // 弹窗
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<any>(null);
  const [showView, setShowView] = useState<any>(null);
  const [showSubmit, setShowSubmit] = useState<any>(null);
  const [showDelete, setShowDelete] = useState<any>(null);

  const [form, setForm] = useState({
    providerId: '', destination: '', transportMethod: 'SEA_FREIGHT', origin: '',
    currency: 'CNY', totalQuantity: 1, totalNetWeight: 0, totalGrossWeight: 0,
    totalVolume: 0, totalAmount: 0, insurance: false, insuranceAmount: 0,
    customsBroker: false, notes: '',
  });
  const [feeItems, setFeeItems] = useState<{ feeType: string; description: string; amount: number }[]>([]);
  const [itemList, setItemList] = useState<{ productName: string; quantity: number; netWeight: number; dimensions: string }[]>([]);
  // 提交审批时选择人员
  const [submitForm, setSubmitForm] = useState({ reviewerId: '', approverId: '', financeId: '' });

  const totalPages = Math.ceil(total / 20);

  const fetchData = async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('search', search);
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    const [oRes, pRes, uRes, meRes] = await Promise.all([
      fetch(`/api/v1/logistics/orders?${params}`),
      fetch('/api/v1/logistics/providers?status=ACTIVE&limit=100'),
      fetch('/api/users'),
      fetch('/api/auth/me'),
    ]);
    const oData = await oRes.json();
    if (oData.success) { setOrders(oData.data?.items || oData.data || []); setTotal(oData.data?.pagination?.total || 0); }
    const pData = await pRes.json();
    if (pData.success) setProviders(pData.data?.items || pData.data || []);
    const uData = await uRes.json();
    if (Array.isArray(uData)) setUsers(uData);
    const meData = await meRes.json();
    if (meData.success || meData.id) setCurrentUser(meData.user || meData);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [page, statusFilter]);

  const resetForm = () => {
    setForm({ providerId: '', destination: '', transportMethod: 'SEA_FREIGHT', origin: '', currency: 'CNY', totalQuantity: 1, totalNetWeight: 0, totalGrossWeight: 0, totalVolume: 0, totalAmount: 0, insurance: false, insuranceAmount: 0, customsBroker: false, notes: '' });
    setFeeItems([]); setItemList([]);
  };

  const openEdit = (order: any) => {
    setForm({
      providerId: order.providerId || '', destination: order.destination || '', transportMethod: order.transportMethod || 'SEA_FREIGHT',
      origin: order.origin || '', currency: order.currency || 'CNY', totalQuantity: order.totalQuantity || 1,
      totalNetWeight: Number(order.totalNetWeight) || 0, totalGrossWeight: Number(order.totalGrossWeight) || 0,
      totalVolume: Number(order.totalVolume) || 0, totalAmount: Number(order.totalAmount) || 0,
      insurance: order.insurance || false, insuranceAmount: Number(order.insuranceAmount) || 0,
      customsBroker: order.customsBroker || false, notes: order.notes || '',
    });
    setItemList(Array.isArray(order.items) ? order.items : []);
    setFeeItems(Array.isArray(order.amountBreakdown) ? order.amountBreakdown : []);
    setShowEdit(order);
  };

  const handleCreate = async () => {
    if (!form.providerId || !form.destination) { alert('请选择物流服务商和填写目的地'); return; }
    setSaving(true);
    const body = { ...form, items: itemList, amountBreakdown: feeItems };
    const res = await fetch('/api/v1/logistics/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) { setShowCreate(false); resetForm(); fetchData(); } else { alert('创建失败'); }
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!showEdit) return; setSaving(true);
    const body = { ...form, items: itemList, amountBreakdown: feeItems };
    const res = await fetch(`/api/v1/logistics/orders/${showEdit.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) { setShowEdit(null); fetchData(); } else { alert('更新失败'); }
    setSaving(false);
  };

  const handleSubmit = async () => {
    if (!showSubmit || !submitForm.reviewerId || !submitForm.approverId || !submitForm.financeId) {
      alert('请选择校对人、审批人和财务人员'); return;
    }
    setSaving(true);
    const res = await fetch(`/api/v1/logistics/orders/${showSubmit.id}/submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submitForm),
    });
    if (res.ok) { setShowSubmit(null); fetchData(); } else { const d = await res.json(); alert(d.error || '提交失败'); }
    setSaving(false);
  };

  const handleReview = async (id: string) => {
    const comment = prompt('校对意见（可选）:') || '';
    const res = await fetch(`/api/v1/logistics/orders/${id}/review`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comment }),
    });
    if (res.ok) fetchData(); else alert('操作失败');
  };

  const handleApprove = async (id: string) => {
    const comment = prompt('审批意见（可选）:') || '';
    const res = await fetch(`/api/v1/logistics/orders/${id}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comment }),
    });
    if (res.ok) fetchData(); else alert('操作失败');
  };

  const handleFinanceConfirm = async (id: string) => {
    const comment = prompt('财务确认备注（可选）:') || '';
    const res = await fetch(`/api/v1/logistics/orders/${id}/finance-confirm`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comment }),
    });
    if (res.ok) fetchData(); else alert('操作失败');
  };

  const handleReject = async (id: string) => {
    const reason = prompt('退回原因:') || '';
    if (!reason) return;
    const res = await fetch(`/api/v1/logistics/orders/${id}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
    });
    if (res.ok) fetchData(); else alert('操作失败');
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const res = await fetch(`/api/v1/logistics/orders/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) fetchData(); else alert('操作失败');
  };

  const handleDelete = async () => {
    if (!showDelete) return;
    const res = await fetch(`/api/v1/logistics/orders/${showDelete.id}`, { method: 'DELETE' });
    if (res.ok) { setShowDelete(null); fetchData(); } else { alert('删除失败'); }
  };

  const addFeeItem = () => setFeeItems([...feeItems, { feeType: '', description: '', amount: 0 }]);
  const addItemRow = () => setItemList([...itemList, { productName: '', quantity: 1, netWeight: 0, dimensions: '' }]);

  // 获取用户显示名
  const userName = (u: any) => u?.name || u?.email || '-';

  const renderForm = () => (
    <form autoComplete="off" onSubmit={(e) => e.preventDefault()} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>物流服务商 *</Label>
          <Select value={form.providerId} onValueChange={(v) => setForm({ ...form, providerId: v })}>
            <SelectTrigger><SelectValue placeholder="选择服务商" /></SelectTrigger>
            <SelectContent>{providers.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.companyName}</SelectItem>)}</SelectContent>
          </Select></div>
        <div><Label>运输方式</Label>
          <Select value={form.transportMethod} onValueChange={(v) => setForm({ ...form, transportMethod: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TRANSPORT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select></div>
        <div><Label>起运地</Label><Input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} placeholder="如: 上海" /></div>
        <div><Label>目的地 *</Label><Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="如: 洛杉矶" /></div>
        <div><Label>币种</Label>
          <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="CNY">CNY</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
          </Select></div>
        <div><Label>总件数</Label><Input type="number" value={form.totalQuantity} onChange={(e) => setForm({ ...form, totalQuantity: Number(e.target.value) })} /></div>
        <div><Label>总净重(kg)</Label><Input type="number" value={form.totalNetWeight} onChange={(e) => setForm({ ...form, totalNetWeight: Number(e.target.value) })} /></div>
        <div><Label>总毛重(kg)</Label><Input type="number" value={form.totalGrossWeight} onChange={(e) => setForm({ ...form, totalGrossWeight: Number(e.target.value) })} /></div>
        <div><Label>总体积(cbm)</Label><Input type="number" value={form.totalVolume} onChange={(e) => setForm({ ...form, totalVolume: Number(e.target.value) })} /></div>
        <div><Label>总金额</Label><Input type="number" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: Number(e.target.value) })} /></div>
        <div className="flex items-center gap-2"><input type="checkbox" checked={form.insurance} onChange={(e) => setForm({ ...form, insurance: e.target.checked })} /><Label>投保</Label></div>
        {form.insurance && <div><Label>保险金额</Label><Input type="number" value={form.insuranceAmount} onChange={(e) => setForm({ ...form, insuranceAmount: Number(e.target.value) })} /></div>}
        <div className="flex items-center gap-2"><input type="checkbox" checked={form.customsBroker} onChange={(e) => setForm({ ...form, customsBroker: e.target.checked })} /><Label>含报关</Label></div>
      </div>
      <div><Label>备注</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      {/* 物品明细 */}
      <div>
        <div className="flex items-center justify-between mb-2"><Label>物品明细</Label><Button type="button" variant="outline" size="sm" onClick={addItemRow}>+ 添加</Button></div>
        {itemList.map((item, i) => (
          <div key={i} className="grid grid-cols-4 gap-2 mb-2">
            <Input placeholder="品名" value={item.productName} onChange={(e) => { const n = [...itemList]; n[i].productName = e.target.value; setItemList(n); }} />
            <Input type="number" placeholder="数量" value={item.quantity} onChange={(e) => { const n = [...itemList]; n[i].quantity = Number(e.target.value); setItemList(n); }} />
            <Input type="number" placeholder="净重(kg)" value={item.netWeight} onChange={(e) => { const n = [...itemList]; n[i].netWeight = Number(e.target.value); setItemList(n); }} />
            <div className="flex gap-1"><Input placeholder="尺寸" value={item.dimensions} onChange={(e) => { const n = [...itemList]; n[i].dimensions = e.target.value; setItemList(n); }} /><Button type="button" variant="ghost" size="sm" onClick={() => setItemList(itemList.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button></div>
          </div>
        ))}
      </div>
      {/* 费用明细 */}
      <div>
        <div className="flex items-center justify-between mb-2"><Label>费用明细</Label><Button type="button" variant="outline" size="sm" onClick={addFeeItem}>+ 添加</Button></div>
        {feeItems.map((fee, i) => (
          <div key={i} className="grid grid-cols-4 gap-2 mb-2">
            <Select value={fee.feeType} onValueChange={(v) => { const n = [...feeItems]; n[i].feeType = v; setFeeItems(n); }}>
              <SelectTrigger><SelectValue placeholder="类型" /></SelectTrigger>
              <SelectContent><SelectItem value="OCEAN_FREIGHT">海运费</SelectItem><SelectItem value="AIR_FREIGHT">空运费</SelectItem><SelectItem value="TRUCKING">拖车费</SelectItem><SelectItem value="CUSTOMS">报关费</SelectItem><SelectItem value="PORT_CHARGES">港杂费</SelectItem><SelectItem value="INSURANCE">保险费</SelectItem><SelectItem value="WAREHOUSE">仓储费</SelectItem><SelectItem value="OTHER">其他</SelectItem></SelectContent>
            </Select>
            <Input placeholder="描述" value={fee.description} onChange={(e) => { const n = [...feeItems]; n[i].description = e.target.value; setFeeItems(n); }} />
            <Input type="number" placeholder="金额" value={fee.amount} onChange={(e) => { const n = [...feeItems]; n[i].amount = Number(e.target.value); setFeeItems(n); }} />
            <Button type="button" variant="ghost" size="sm" onClick={() => setFeeItems(feeItems.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button>
          </div>
        ))}
      </div>
    </form>
  );

  const renderActions = (order: any) => {
    const isMyReview = order.reviewerId === currentUser?.id || currentUser?.role === 'ADMIN';
    const isMyApprove = order.approverId === currentUser?.id || currentUser?.role === 'ADMIN';
    const isMyFinance = order.financeId === currentUser?.id || currentUser?.role === 'ADMIN';

    return (
      <div className="flex gap-1 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => setShowView(order)} title="查看详情"><Eye className="h-3 w-3" /></Button>

        {order.status === 'DRAFT' && (
          <>
            <Button size="sm" variant="outline" onClick={() => openEdit(order)} title="编辑"><Edit className="h-3 w-3" /></Button>
            <Button size="sm" variant="outline" className="text-yellow-600 border-yellow-300" onClick={() => { setSubmitForm({ reviewerId: '', approverId: '', financeId: '' }); setShowSubmit(order); }}>
              <Send className="h-3 w-3 mr-1" />提交审批
            </Button>
          </>
        )}

        {order.approvalStep === 'PENDING_REVIEW' && isMyReview && (
          <>
            <Button size="sm" variant="outline" className="text-green-600 border-green-300" onClick={() => handleReview(order.id)}>
              <UserCheck className="h-3 w-3 mr-1" />校对通过
            </Button>
            <Button size="sm" variant="outline" className="text-red-500" onClick={() => handleReject(order.id)}>退回</Button>
          </>
        )}

        {order.approvalStep === 'PENDING_APPROVAL' && isMyApprove && (
          <>
            <Button size="sm" variant="outline" className="text-green-600 border-green-300" onClick={() => handleApprove(order.id)}>
              <ShieldCheck className="h-3 w-3 mr-1" />审批通过
            </Button>
            <Button size="sm" variant="outline" className="text-red-500" onClick={() => handleReject(order.id)}>退回</Button>
          </>
        )}

        {order.approvalStep === 'PENDING_FINANCE' && isMyFinance && (
          <>
            <Button size="sm" variant="outline" className="text-green-600 border-green-300" onClick={() => handleFinanceConfirm(order.id)}>
              <Wallet className="h-3 w-3 mr-1" />财务确认
            </Button>
            <Button size="sm" variant="outline" className="text-red-500" onClick={() => handleReject(order.id)}>退回</Button>
          </>
        )}

        {STATUS_FLOW[order.status]?.map((flow) => (
          <Button key={flow.next} size="sm" variant="outline" onClick={() => handleStatusChange(order.id, flow.next)}>{flow.label}</Button>
        ))}

        {['DRAFT', 'REJECTED'].includes(order.status) && (
          <Button size="sm" variant="outline" className="text-red-500" onClick={() => handleStatusChange(order.id, 'CANCELLED')}><X className="h-3 w-3 mr-1" />取消</Button>
        )}

        {['DRAFT', 'CANCELLED'].includes(order.status) && (
          <Button size="sm" variant="outline" className="text-red-500" onClick={() => setShowDelete(order)}><Trash2 className="h-3 w-3" /></Button>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" />物流订单管理</CardTitle>
          <Dialog open={showCreate} onOpenChange={(v) => { setShowCreate(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild><Button onClick={() => { resetForm(); setShowCreate(true); }}><Plus className="h-4 w-4 mr-1" />新建物流订单</Button></DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>新建物流订单</DialogTitle></DialogHeader>
              {renderForm()}
              <DialogFooter><Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button><Button onClick={handleCreate} disabled={saving}>{saving ? '创建中...' : '创建'}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="flex gap-2 flex-1 min-w-[200px]">
              <Input placeholder="搜索订单号/目的地..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchData()} />
              <Button variant="outline" onClick={fetchData}><Search className="h-4 w-4" /></Button>
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="全部状态" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loading ? <div className="text-center py-8 text-gray-500">加载中...</div> : orders.length === 0 ? <div className="text-center py-8 text-gray-500">暂无物流订单</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>订单号</TableHead>
                  <TableHead>服务商</TableHead>
                  <TableHead>目的地</TableHead>
                  <TableHead>运输</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>审批步骤</TableHead>
                  <TableHead>审批人</TableHead>
                  <TableHead className="w-[280px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order: any) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm">{order.orderNo}</TableCell>
                    <TableCell>{order.provider?.companyName || '-'}</TableCell>
                    <TableCell>{order.destination}</TableCell>
                    <TableCell>{TRANSPORT_METHODS.find(m => m.value === order.transportMethod)?.label || order.transportMethod}</TableCell>
                    <TableCell>{order.currency} {Number(order.totalAmount).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_CONFIG[order.status]?.color || 'bg-gray-100'}>
                        {APPROVAL_STEP_LABELS[order.approvalStep] || STATUS_CONFIG[order.status]?.label || order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      <div>提交: {userName(order.submitter)}</div>
                      <div>校对: {userName(order.reviewer)}</div>
                      <div>审批: {userName(order.approver)}</div>
                      <div>财务: {userName(order.finance)}</div>
                    </TableCell>
                    <TableCell>{renderActions(order)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-gray-500">共 {total} 条，第 {page}/{totalPages} 页</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(1)}>首页</Button>
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 编辑弹窗 */}
      <Dialog open={!!showEdit} onOpenChange={(v) => { if (!v) setShowEdit(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>编辑 — {showEdit?.orderNo}</DialogTitle></DialogHeader>
          {renderForm()}
          <DialogFooter><Button variant="outline" onClick={() => setShowEdit(null)}>取消</Button><Button onClick={handleUpdate} disabled={saving}>保存</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 提交审批弹窗 - 选择校对人/审批人/财务 */}
      <Dialog open={!!showSubmit} onOpenChange={(v) => { if (!v) setShowSubmit(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>提交审批 — {showSubmit?.orderNo}</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500 mb-4">请选择四级审批人员，提交后将依次流转：校对人→审批人→财务签收支付</p>
          <div className="space-y-4">
            <div>
              <Label>校对人 <span className="text-red-500">*</span></Label>
              <Select value={submitForm.reviewerId} onValueChange={(v) => setSubmitForm({ ...submitForm, reviewerId: v })}>
                <SelectTrigger><SelectValue placeholder="选择校对人" /></SelectTrigger>
                <SelectContent>{users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name || u.email} ({u.role})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>审批人 <span className="text-red-500">*</span></Label>
              <Select value={submitForm.approverId} onValueChange={(v) => setSubmitForm({ ...submitForm, approverId: v })}>
                <SelectTrigger><SelectValue placeholder="选择审批人" /></SelectTrigger>
                <SelectContent>{users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name || u.email} ({u.role})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>财务人员 <span className="text-red-500">*</span></Label>
              <Select value={submitForm.financeId} onValueChange={(v) => setSubmitForm({ ...submitForm, financeId: v })}>
                <SelectTrigger><SelectValue placeholder="选择财务人员" /></SelectTrigger>
                <SelectContent>{users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name || u.email} ({u.role})</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmit(null)}>取消</Button>
            <Button onClick={handleSubmit} disabled={saving}>{saving ? '提交中...' : '确认提交'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 查看详情 */}
      <Dialog open={!!showView} onOpenChange={(v) => { if (!v) setShowView(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>详情 — {showView?.orderNo}</DialogTitle></DialogHeader>
          {showView && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><Label>订单号</Label><p className="font-mono">{showView.orderNo}</p></div>
                <div><Label>服务商</Label><p>{showView.provider?.companyName || '-'}</p></div>
                <div><Label>运输方式</Label><p>{TRANSPORT_METHODS.find(m => m.value === showView.transportMethod)?.label}</p></div>
                <div><Label>状态</Label><Badge className={STATUS_CONFIG[showView.status]?.color}>{STATUS_CONFIG[showView.status]?.label}</Badge></div>
                <div><Label>起运地</Label><p>{showView.origin || '-'}</p></div>
                <div><Label>目的地</Label><p>{showView.destination}</p></div>
                <div><Label>总件数 / 净重</Label><p>{showView.totalQuantity} 件 / {Number(showView.totalNetWeight).toLocaleString()} kg</p></div>
                <div><Label>金额</Label><p className="font-semibold">{showView.currency} {Number(showView.totalAmount).toLocaleString()}</p></div>
              </div>
              {/* 审批进度 */}
              <div className="border rounded-lg p-3 bg-gray-50">
                <Label className="mb-2 block">审批流程</Label>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className={`p-2 rounded text-center ${showView.submitter ? 'bg-green-100' : 'bg-gray-200'}`}>
                    <div className="font-medium">① 提交人</div>
                    <div>{userName(showView.submitter)}</div>
                    {showView.submittedAt && <div className="text-gray-500">{new Date(showView.submittedAt).toLocaleString()}</div>}
                  </div>
                  <div className={`p-2 rounded text-center ${showView.reviewedBy ? 'bg-green-100' : showView.approvalStep === 'PENDING_REVIEW' ? 'bg-yellow-100' : 'bg-gray-200'}`}>
                    <div className="font-medium">② 校对人</div>
                    <div>{userName(showView.reviewer)}</div>
                    {showView.reviewedBy && <div className="text-green-600">✓ {userName(showView.reviewedBy)}</div>}
                  </div>
                  <div className={`p-2 rounded text-center ${showView.approvedBy ? 'bg-green-100' : showView.approvalStep === 'PENDING_APPROVAL' ? 'bg-orange-100' : 'bg-gray-200'}`}>
                    <div className="font-medium">③ 审批人</div>
                    <div>{userName(showView.approver)}</div>
                    {showView.approvedBy && <div className="text-green-600">✓ {userName(showView.approvedBy)}</div>}
                  </div>
                  <div className={`p-2 rounded text-center ${showView.financeConfirmedBy ? 'bg-green-100' : showView.approvalStep === 'PENDING_FINANCE' ? 'bg-purple-100' : 'bg-gray-200'}`}>
                    <div className="font-medium">④ 财务</div>
                    <div>{userName(showView.finance)}</div>
                    {showView.financeConfirmedBy && <div className="text-green-600">✓ {userName(showView.financeConfirmedBy)}</div>}
                  </div>
                </div>
              </div>
              {showView.items?.length > 0 && (
                <div><Label className="mb-2 block">物品明细</Label>
                  <Table><TableHeader><TableRow><TableHead>品名</TableHead><TableHead>数量</TableHead><TableHead>净重</TableHead><TableHead>尺寸</TableHead></TableRow></TableHeader>
                    <TableBody>{showView.items.map((item: any, i: number) => (
                      <TableRow key={i}><TableCell>{item.productName}</TableCell><TableCell>{item.quantity}</TableCell><TableCell>{item.netWeight} kg</TableCell><TableCell>{item.dimensions}</TableCell></TableRow>
                    ))}</TableBody></Table>
                </div>)}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setShowView(null)}>关闭</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>确认删除</DialogTitle></DialogHeader>
          <p>确定要删除 <strong>{showDelete?.orderNo}</strong> 吗？</p>
          <DialogFooter><Button variant="outline" onClick={() => setShowDelete(null)}>取消</Button><Button variant="destructive" onClick={handleDelete}>删除</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
