'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle, Clock, Phone, Calendar } from 'lucide-react';

interface UserRegistration {
  id: string; username: string; email: string; name: string | null;
  phone: string | null; status: string; rejectReason: string | null; createdAt: string;
}

export default function UserApprovalsTab() {
  const [registrations, setRegistrations] = useState<UserRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [selected, setSelected] = useState<UserRegistration | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [perms, setPerms] = useState<string[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/approvals?status=PENDING');
      const data = await res.json();
      setRegistrations(data.registrations || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); loadPerms(); }, []);

  const loadPerms = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      const user = data.user || data;
      if (user.role === 'ADMIN') { setPerms(['*']); }
      else { const p = user.permissions || []; setPerms(Array.isArray(p) ? p : []); }
    } catch { setPerms([]); }
  };
  const hasPerm = (p: string) => perms.includes(p) || perms.includes('*');

  const handleApprove = async (r: UserRegistration) => {
    if (!confirm(`确认批准 ${r.email} 的注册申请吗？`)) return;
    await fetch(`/api/auth/approvals/${r.id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    fetchData();
  };

  const handleReject = async () => {
    if (!selected || !rejectReason.trim()) { alert('请填写拒绝原因'); return; }
    await fetch(`/api/auth/approvals/${selected.id}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectReason }),
    });
    setRejectOpen(false); fetchData();
  };

  return (
    <div className="space-y-4">
      {loading ? <div className="text-center py-8 text-zinc-500">加载中...</div> :
        registrations.length === 0 ? <div className="text-center py-8 text-zinc-500">暂无待审批用户</div> : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户信息</TableHead>
                  <TableHead>联系方式</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>申请时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.name || r.username}</div>
                      <div className="text-sm text-zinc-500">{r.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-sm"><Phone className="h-4 w-4 mr-1 text-zinc-400" />{r.phone || '-'}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-yellow-100 text-yellow-800 flex w-fit gap-1 items-center">
                        <Clock className="h-3 w-3" />待审批
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-zinc-500">
                      <div className="flex items-center"><Calendar className="h-4 w-4 mr-1" />{new Date(r.createdAt).toLocaleString('zh-CN')}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {hasPerm('user:approve') && (
                          <Button size="sm" onClick={() => handleApprove(r)} className="bg-green-600 hover:bg-green-700">
                            <CheckCircle className="h-4 w-4 mr-1" />批准
                          </Button>
                        )}
                        {hasPerm('user:approve') && (
                          <Button size="sm" variant="destructive" onClick={() => { setSelected(r); setRejectReason(''); setRejectOpen(true); }}>
                            <XCircle className="h-4 w-4 mr-1" />拒绝
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>拒绝注册申请</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea placeholder="请填写拒绝原因..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} />
            {selected && <div className="text-sm text-zinc-500">申请人：{selected.name || selected.username} ({selected.email})</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleReject}>确认拒绝</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
