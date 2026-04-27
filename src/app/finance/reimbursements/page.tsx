'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowLeft, Edit, Trash2 } from 'lucide-react';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待审批', color: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: '已批准', color: 'bg-blue-100 text-blue-800' },
  REJECTED: { label: '已驳回', color: 'bg-red-100 text-red-800' },
  PAID: { label: '已支付', color: 'bg-green-100 text-green-800' },
};

const CATEGORIES = ['TRAVEL', 'OFFICE', 'TRANSPORT', 'FOOD', 'OTHER'];
const CAT_LABELS: Record<string, string> = { TRAVEL: '差旅', OFFICE: '办公', TRANSPORT: '交通', FOOD: '餐饮', OTHER: '其他' };

export default function ReimbursementsPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', amount: '', currency: 'CNY', category: 'TRAVEL', description: '', status: 'PENDING' });

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/reimbursements');
      const result = await res.json();
      const data = result.data?.items ?? result.data ?? [];
      setItems(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const openCreate = () => { setEditing(null); setForm({ title: '', amount: '', currency: 'CNY', category: 'TRAVEL', description: '', status: 'PENDING' }); setDialogOpen(true); };
  const openEdit = (r: any) => { setEditing(r); setForm({ title: r.title, amount: String(r.amount), currency: r.currency || 'CNY', category: r.category || 'TRAVEL', description: r.description || '', status: r.status || 'PENDING' }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.title || !form.amount) return;
    setSaving(true);
    try {
      const payload = { ...form, amount: Number(form.amount) };
      const url = editing ? `/api/v1/reimbursements/${editing.id}` : '/api/v1/reimbursements';
      const method = editing ? 'PUT' : 'POST';
      await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      setDialogOpen(false); fetchItems();
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => { if (!confirm('确定删除？')) return; await fetch(`/api/v1/reimbursements/${id}`, { method: 'DELETE' }); fetchItems(); };
  const update = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-8">
      <Button variant="ghost" onClick={() => router.push('/finance')} className="mb-4"><ArrowLeft className="h-4 w-4 mr-2" />返回</Button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">📋 费用报销</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />新增报销</Button>
      </div>
      <Card><CardContent className="p-6">
        {loading ? <div className="text-center py-8">加载中...</div> : items.length === 0 ? <div className="text-center py-12 text-gray-500"><p>暂无报销记录</p></div> : (
          <Table><TableHeader><TableRow><TableHead>标题</TableHead><TableHead>金额</TableHead><TableHead>类别</TableHead><TableHead>状态</TableHead><TableHead>日期</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
            <TableBody>{items.map((r: any) => (
              <TableRow key={r.id}><TableCell className="font-medium">{r.title}</TableCell><TableCell>¥{Number(r.amount).toLocaleString()}</TableCell><TableCell>{CAT_LABELS[r.category] || r.category}</TableCell><TableCell><Badge className={STATUS_MAP[r.status]?.color}>{STATUS_MAP[r.status]?.label || r.status}</Badge></TableCell><TableCell className="text-sm text-gray-500">{r.submittedAt?.slice(0,10) || r.createdAt?.slice(0,10)}</TableCell>
                <TableCell><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => openEdit(r)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4" /></Button></div></TableCell></TableRow>
            ))}</TableBody></Table>
        )}
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? '编辑报销' : '新增报销'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div><Label>标题 *</Label><Input value={form.title} onChange={e => update('title', e.target.value)} placeholder="报销事由" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>金额 *</Label><Input type="number" value={form.amount} onChange={e => update('amount', e.target.value)} /></div>
            <div><Label>币种</Label><Select value={form.currency} onValueChange={v => update('currency', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CNY">¥ CNY</SelectItem><SelectItem value="USD">$ USD</SelectItem></SelectContent></Select></div>
          </div>
          <div><Label>类别</Label><Select value={form.category} onValueChange={v => update('category', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{CAT_LABELS[c]}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>描述</Label><Input value={form.description} onChange={e => update('description', e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button><Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
