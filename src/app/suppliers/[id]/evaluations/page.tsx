'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, ArrowLeft, Trash2, Star } from 'lucide-react';

export default function SupplierEvaluationsPage() {
  const params = useParams();
  const router = useRouter();
  const supplierId = params.id as string;
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [supplier, setSupplier] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ deliveryScore: 5, qualityScore: 5, priceScore: 5, serviceScore: 5, comment: '' });

  useEffect(() => { fetchSupplier(); fetchEvaluations(); }, []);

  const fetchSupplier = async () => {
    try {
      const res = await fetch(`/api/v1/suppliers/${supplierId}`);
      const result = await res.json();
      if (result.success) setSupplier(result.data);
    } catch (e) { console.error(e); }
  };

  const fetchEvaluations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/suppliers/${supplierId}/evaluations`);
      const result = await res.json();
      const data = result.data?.items ?? result.data ?? [];
      setEvaluations(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/v1/suppliers/${supplierId}/evaluations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, score: Math.round((form.deliveryScore + form.qualityScore + form.priceScore + form.serviceScore) / 4) }),
      });
      setDialogOpen(false); fetchEvaluations();
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除？')) return;
    await fetch(`/api/v1/suppliers/${supplierId}/evaluations/${id}`, { method: 'DELETE' });
    fetchEvaluations();
  };

  const StarRating = ({ value, onChange }: { value: number; onChange?: (v: number) => void }) => (
    <div className="flex gap-1">{ [1,2,3,4,5].map(i => <button key={i} type="button" onClick={() => onChange?.(i)} className={`text-xl ${i <= value ? 'text-yellow-400' : 'text-gray-300'}`}>{i <= value ? '★' : '☆'}</button>)}</div>
  );

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-8">
      <Button variant="ghost" onClick={() => router.push(`/suppliers/${supplierId}`)} className="mb-4"><ArrowLeft className="h-4 w-4 mr-2" />返回供应商</Button>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-3xl font-bold">📊 供应商评估</h1><p className="text-gray-600 mt-1">{supplier?.companyName || '供应商'}</p></div>
        <Button onClick={() => { setForm({ deliveryScore: 5, qualityScore: 5, priceScore: 5, serviceScore: 5, comment: '' }); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />新增评估</Button>
      </div>

      <Card><CardContent className="p-6">
        {loading ? <div className="text-center py-8">加载中...</div> : evaluations.length === 0 ? <div className="text-center py-12 text-gray-500"><p>暂无评估记录</p></div> : (
          <Table><TableHeader><TableRow><TableHead>总分</TableHead><TableHead>交付</TableHead><TableHead>质量</TableHead><TableHead>价格</TableHead><TableHead>服务</TableHead><TableHead>评价</TableHead><TableHead>日期</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
            <TableBody>{evaluations.map((ev: any) => (
              <TableRow key={ev.id}><TableCell className="font-bold text-lg">{ev.score || '-'}</TableCell><TableCell><StarRating value={ev.deliveryScore || 0} /></TableCell><TableCell><StarRating value={ev.qualityScore || 0} /></TableCell><TableCell><StarRating value={ev.priceScore || 0} /></TableCell><TableCell><StarRating value={ev.serviceScore || 0} /></TableCell><TableCell className="text-sm text-gray-500 max-w-xs truncate">{ev.comment || '-'}</TableCell><TableCell className="text-sm">{ev.evaluatedAt?.slice(0,10) || ev.createdAt?.slice(0,10)}</TableCell><TableCell><Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(ev.id)}><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>
            ))}</TableBody></Table>
        )}
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>新增供应商评估</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          {[{key:'deliveryScore',label:'交付能力'},{key:'qualityScore',label:'产品质量'},{key:'priceScore',label:'价格竞争力'},{key:'serviceScore',label:'服务水平'}].map(({key,label}) => (
            <div key={key} className="flex items-center justify-between"><Label>{label}</Label><StarRating value={(form as any)[key]} onChange={v => setForm(p => ({...p,[key]:v}))} /></div>
          ))}
          <div><Label>评价备注</Label><textarea className="w-full border rounded-md p-2 text-sm" rows={3} value={form.comment} onChange={e => setForm(p => ({...p,comment:e.target.value}))} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button><Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
