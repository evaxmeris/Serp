'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowLeft, Check, Trash2 } from 'lucide-react';

export default function PurchaseReceiptsPage() {
  const params = useParams(); const router = useRouter();
  const orderId = params.id as string;
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ quantity: '', warehouse: '', notes: '' });

  useEffect(() => { fetchReceipts(); }, []);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/purchase-orders/${orderId}/receipts`);
      const result = await res.json();
      const data = result.data?.items ?? result.data ?? [];
      setReceipts(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.quantity) return;
    try {
      await fetch(`/api/v1/purchase-orders/${orderId}/receipts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, quantity: Number(form.quantity) }) });
      setDialogOpen(false); setForm({ quantity: '', warehouse: '', notes: '' }); fetchReceipts();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-8">
      <Button variant="ghost" onClick={() => router.push(`/purchase-orders/${orderId}`)} className="mb-4"><ArrowLeft className="h-4 w-4 mr-2" />返回订单</Button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">📦 收货记录</h1>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />登记收货</Button>
      </div>
      <Card><CardContent className="p-6">
        {loading ? <div className="text-center py-8">加载中...</div> : receipts.length === 0 ? <div className="text-center py-12 text-gray-500"><p>暂无收货记录</p></div> : (
          <Table><TableHeader><TableRow><TableHead>数量</TableHead><TableHead>仓库</TableHead><TableHead>状态</TableHead><TableHead>备注</TableHead><TableHead>时间</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
            <TableBody>{receipts.map((r: any) => (
              <TableRow key={r.id}><TableCell className="font-bold">{r.quantity}</TableCell><TableCell>{r.warehouse || '-'}</TableCell><TableCell><Badge className={r.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>{r.status === 'COMPLETED' ? '已完成' : '处理中'}</Badge></TableCell><TableCell className="text-sm">{r.notes || '-'}</TableCell><TableCell className="text-sm">{r.createdAt?.slice(0,16)}</TableCell><TableCell><Button variant="ghost" size="sm" className="text-red-600" onClick={async () => { await fetch(`/api/v1/purchase-orders/${orderId}/receipts/${r.id}`, { method: 'DELETE' }); fetchReceipts(); }}><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>
            ))}</TableBody></Table>
        )}
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>登记收货</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div><Label>收货数量 *</Label><input type="number" className="w-full border rounded-md p-2" value={form.quantity} onChange={e => setForm(p => ({...p, quantity: e.target.value}))} /></div>
          <div><Label>入库仓库</Label><input className="w-full border rounded-md p-2" value={form.warehouse} onChange={e => setForm(p => ({...p, warehouse: e.target.value}))} placeholder="默认仓库" /></div>
          <div><Label>备注</Label><input className="w-full border rounded-md p-2" value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button><Button onClick={handleSave}><Check className="h-4 w-4 mr-2" />确认收货</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
