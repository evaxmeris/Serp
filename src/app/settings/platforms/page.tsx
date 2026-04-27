'use client';

/**
 * 平台账号管理页面
 * /settings/platforms
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, Link, Globe, RefreshCw } from 'lucide-react';

interface PlatformAccount {
  id: string; platformType: string; platformName: string;
  accountName: string; accountId?: string | null; shopId?: string | null;
  region?: string | null; currency: string; isTest: boolean;
  isActive: boolean; lastSyncAt?: string | null; syncStatus?: string | null;
  createdAt: string;
}

const PLATFORM_TYPES: Record<string, { label: string; color: string }> = {
  alibaba: { label: '阿里国际站', color: 'bg-orange-100 text-orange-800' },
  amazon: { label: 'Amazon', color: 'bg-yellow-100 text-yellow-800' },
  shopify: { label: 'Shopify', color: 'bg-green-100 text-green-800' },
  tiktok: { label: 'TikTok Shop', color: 'bg-pink-100 text-pink-800' },
  pdd: { label: '拼多多', color: 'bg-red-100 text-red-800' },
  taobao: { label: '淘宝', color: 'bg-orange-100 text-orange-800' },
  '1688': { label: '1688', color: 'bg-yellow-100 text-yellow-800' },
};

export default function PlatformsPage() {
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    platformType: 'alibaba', platformName: '', accountName: '',
    accountId: '', shopId: '', region: '', currency: 'USD',
    isTest: false, isActive: true,
  });

  useEffect(() => { fetchAccounts(); }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sync/config');
      const result = await res.json();
      const data = result.data?.items ?? result.data ?? [];
      setAccounts(Array.isArray(data) ? data : []);
    } catch (e) { console.error('加载失败:', e); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ platformType: 'alibaba', platformName: '', accountName: '', accountId: '', shopId: '', region: '', currency: 'USD', isTest: false, isActive: true });
    setDialogOpen(true);
  };

  const openEdit = (a: PlatformAccount) => {
    setEditing(a);
    setForm({ platformType: a.platformType, platformName: a.platformName, accountName: a.accountName, accountId: a.accountId || '', shopId: a.shopId || '', region: a.region || '', currency: a.currency, isTest: a.isTest, isActive: a.isActive });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.platformName || !form.accountName) return;
    setSaving(true);
    try {
      const url = editing ? `/api/sync/config/${editing.id}` : '/api/sync/config';
      const method = editing ? 'PUT' : 'POST';
      await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      setDialogOpen(false);
      fetchAccounts();
    } catch (e) { console.error('保存失败:', e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定删除平台账号「${name}」？`)) return;
    try { await fetch(`/api/sync/config/${id}`, { method: 'DELETE' }); fetchAccounts(); }
    catch (e) { console.error('删除失败:', e); }
  };

  const updateField = (f: string, v: any) => setForm(prev => ({ ...prev, [f]: v }));

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Globe className="h-6 w-6 text-blue-600" />
              平台账号管理
            </CardTitle>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />添加账号</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Link className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>暂无平台账号，点击"添加账号"开始对接</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>平台</TableHead>
                  <TableHead>店铺名称</TableHead>
                  <TableHead>账号</TableHead>
                  <TableHead>地区</TableHead>
                  <TableHead>币种</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>最近同步</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map(a => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={PLATFORM_TYPES[a.platformType]?.color || 'bg-gray-100'}>
                          {PLATFORM_TYPES[a.platformType]?.label || a.platformType}
                        </Badge>
                        {a.isTest && <Badge variant="outline" className="text-xs">测试</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{a.platformName}</TableCell>
                    <TableCell className="text-sm text-gray-500">{a.accountName}</TableCell>
                    <TableCell>{a.region || '-'}</TableCell>
                    <TableCell>{a.currency}</TableCell>
                    <TableCell>
                      <Badge className={a.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {a.isActive ? '启用' : '禁用'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {a.lastSyncAt ? new Date(a.lastSyncAt).toLocaleString('zh-CN') : '从未同步'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(a)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(a.id, a.platformName)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? '编辑平台账号' : '添加平台账号'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>平台类型 *</Label>
                <Select value={form.platformType} onValueChange={v => updateField('platformType', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PLATFORM_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>币种</Label><Select value={form.currency} onValueChange={v => updateField('currency', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">$ USD</SelectItem><SelectItem value="CNY">¥ CNY</SelectItem><SelectItem value="EUR">€ EUR</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>店铺名称 *</Label><Input value={form.platformName} onChange={e => updateField('platformName', e.target.value)} placeholder="如：美国站店铺A" /></div>
              <div><Label>账号名称 *</Label><Input value={form.accountName} onChange={e => updateField('accountName', e.target.value)} placeholder="登录账号/邮箱" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>店铺ID</Label><Input value={form.shopId} onChange={e => updateField('shopId', e.target.value)} /></div>
              <div><Label>地区</Label><Input value={form.region} onChange={e => updateField('region', e.target.value)} placeholder="如：US/CN" /></div>
            </div>
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2"><Label>测试模式</Label><Switch checked={form.isTest} onCheckedChange={v => updateField('isTest', v)} /></div>
              <div className="flex items-center gap-2"><Label>启用</Label><Switch checked={form.isActive} onCheckedChange={v => updateField('isActive', v)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
