'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Payment {
  id: string; type: string; amount: number; currency: string;
  counterparty: string; referenceNo?: string; status: string;
  paymentDate: string; notes?: string; createdAt: string;
}

export default function PaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: 'INCOME', amount: '', currency: 'CNY', counterparty: '', referenceNo: '', paymentDate: new Date().toISOString().slice(0,10), notes: '' });

  useEffect(() => { fetchPayments(); }, []);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      const res = await fetch(`/api/v1/payments?${params}`);
      const result = await res.json();
      const data = result.data?.items ?? result.data ?? [];
      setPayments(Array.isArray(data) ? data : []);
    } catch (e) { console.error('加载失败:', e); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ type: 'INCOME', amount: '', currency: 'CNY', counterparty: '', referenceNo: '', paymentDate: new Date().toISOString().slice(0,10), notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (p: Payment) => {
    setEditing(p);
    setForm({ type: p.type, amount: String(p.amount), currency: p.currency, counterparty: p.counterparty, referenceNo: p.referenceNo || '', paymentDate: p.paymentDate?.slice(0,10) || '', notes: p.notes || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.amount || !form.counterparty) return;
    setSaving(true);
    try {
      const payload = { ...form, amount: Number(form.amount), status: 'COMPLETED' };
      const url = editing ? `/api/v1/payments/${editing.id}` : '/api/v1/payments';
      const method = editing ? 'PUT' : 'POST';
      await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      setDialogOpen(false);
      fetchPayments();
    } catch (e) { console.error('保存失败:', e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除？')) return;
    await fetch(`/api/v1/payments/${id}`, { method: 'DELETE' });
    fetchPayments();
  };

  const update = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  const totalIncome = payments.filter(p => p.type === 'INCOME').reduce((s, p) => s + Number(p.amount), 0);
  const totalExpense = payments.filter(p => p.type === 'EXPENSE').reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-8">
      <Button variant="ghost" onClick={() => router.push('/finance')} className="mb-4"><ArrowLeft className="h-4 w-4 mr-2" />返回</Button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">💰 收付款记录</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />新增记录</Button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">收款总额</p><p className="text-2xl font-bold text-green-600">¥{totalIncome.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">付款总额</p><p className="text-2xl font-bold text-red-600">¥{totalExpense.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">净额</p><p className={`text-2xl font-bold ${totalIncome >= totalExpense ? 'text-green-600' : 'text-red-600'}`}>¥{(totalIncome - totalExpense).toLocaleString()}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex gap-3 mb-6">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="搜索对方名称/单号..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" /></div>
            <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-32"><SelectValue placeholder="类型" /></SelectTrigger><SelectContent><SelectItem value="all">全部</SelectItem><SelectItem value="INCOME">收款</SelectItem><SelectItem value="EXPENSE">付款</SelectItem></SelectContent></Select>
            <Button variant="outline" onClick={fetchPayments}>搜索</Button>
          </div>

          {loading ? <div className="text-center py-8">加载中...</div> : payments.length === 0 ? <div className="text-center py-12 text-gray-500"><p>暂无收付款记录</p></div> : (
            <Table><TableHeader><TableRow><TableHead>类型</TableHead><TableHead>金额</TableHead><TableHead>对方</TableHead><TableHead>单号</TableHead><TableHead>日期</TableHead><TableHead>备注</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
              <TableBody>{payments.map(p => (
                <TableRow key={p.id}><TableCell><Badge className={p.type === 'INCOME' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>{p.type === 'INCOME' ? '收款' : '付款'}</Badge></TableCell><TableCell className="font-bold">{p.currency} {Number(p.amount).toLocaleString()}</TableCell><TableCell>{p.counterparty}</TableCell><TableCell className="text-sm text-gray-500">{p.referenceNo || '-'}</TableCell><TableCell>{p.paymentDate?.slice(0,10)}</TableCell><TableCell className="text-sm text-gray-500">{p.notes || '-'}</TableCell>
                  <TableCell><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4" /></Button></div></TableCell></TableRow>
              ))}</TableBody></Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? '编辑记录' : '新增收付款'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>类型</Label><Select value={form.type} onValueChange={v => update('type', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INCOME">收款</SelectItem><SelectItem value="EXPENSE">付款</SelectItem></SelectContent></Select></div>
            <div><Label>币种</Label><Select value={form.currency} onValueChange={v => update('currency', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CNY">¥ CNY</SelectItem><SelectItem value="USD">$ USD</SelectItem></SelectContent></Select></div>
          </div>
          <div><Label>金额 *</Label><Input type="number" value={form.amount} onChange={e => update('amount', e.target.value)} placeholder="0.00" /></div>
          <div><Label>对方名称 *</Label><Input value={form.counterparty} onChange={e => update('counterparty', e.target.value)} placeholder="客户/供应商名称" /></div>
          <div className="grid grid-cols-2 gap-4"><div><Label>参考单号</Label><Input value={form.referenceNo} onChange={e => update('referenceNo', e.target.value)} /></div><div><Label>日期</Label><Input type="date" value={form.paymentDate} onChange={e => update('paymentDate', e.target.value)} /></div></div>
          <div><Label>备注</Label><Input value={form.notes} onChange={e => update('notes', e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button><Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
