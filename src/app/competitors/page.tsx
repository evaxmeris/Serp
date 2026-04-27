'use client';

/**
 * 竞品分析管理页面
 * /competitors
 * 
 * 功能：列表展示 / 新建 / 编辑 / 删除竞品分析
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Edit, Trash2, Swords, Eye } from 'lucide-react';

interface Competitor {
  id: string;
  competitorName: string;
  competitorNameEn?: string | null;
  website?: string | null;
  country: string;
  type: string;
  productName: string;
  productModel?: string | null;
  category?: string | null;
  price?: number | null;
  currency: string;
  features: string[];
  strengths: string[];
  weaknesses: string[];
  vsOurProduct?: string | null;
  suggestion?: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = { DOMESTIC: '国内竞品', OVERSEAS: '海外竞品' };
const TYPE_COLORS: Record<string, string> = { DOMESTIC: 'bg-blue-100 text-blue-800', OVERSEAS: 'bg-purple-100 text-purple-800' };

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<Competitor | null>(null);
  const [viewing, setViewing] = useState<Competitor | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    competitorName: '', website: '', country: 'CN', type: 'DOMESTIC',
    productName: '', productModel: '', category: '', price: '', currency: 'CNY',
    strengths: '', weaknesses: '', features: '', vsOurProduct: '', suggestion: '',
  });

  useEffect(() => { fetchCompetitors(); }, []);

  const fetchCompetitors = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      const res = await fetch(`/api/v1/competitors?${params}`);
      const result = await res.json();
      setCompetitors(result.data?.items ?? result.data ?? []);
    } catch (e) { console.error('加载失败:', e); }
    finally { setLoading(false); }
  };

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); fetchCompetitors(); };

  const openCreate = () => {
    setEditing(null);
    setForm({ competitorName: '', website: '', country: 'CN', type: 'DOMESTIC', productName: '', productModel: '', category: '', price: '', currency: 'CNY', strengths: '', weaknesses: '', features: '', vsOurProduct: '', suggestion: '' });
    setDialogOpen(true);
  };

  const openEdit = (c: Competitor) => {
    setEditing(c);
    setForm({
      competitorName: c.competitorName, website: c.website || '', country: c.country, type: c.type,
      productName: c.productName, productModel: c.productModel || '', category: c.category || '',
      price: c.price != null ? String(c.price) : '', currency: c.currency,
      strengths: c.strengths?.join(', ') || '', weaknesses: c.weaknesses?.join(', ') || '',
      features: c.features?.join(', ') || '', vsOurProduct: c.vsOurProduct || '', suggestion: c.suggestion || '',
    });
    setDialogOpen(true);
  };

  const openDetail = (c: Competitor) => { setViewing(c); setDetailOpen(true); };

  const handleSave = async () => {
    if (!form.competitorName || !form.productName) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: form.price ? Number(form.price) : null,
        strengths: form.strengths ? form.strengths.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        weaknesses: form.weaknesses ? form.weaknesses.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        features: form.features ? form.features.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      };
      const url = editing ? `/api/v1/competitors/${editing.id}` : '/api/v1/competitors';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { setDialogOpen(false); fetchCompetitors(); }
    } catch (e) { console.error('保存失败:', e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定删除竞品「${name}」？`)) return;
    try {
      await fetch(`/api/v1/competitors/${id}`, { method: 'DELETE' });
      fetchCompetitors();
    } catch (e) { console.error('删除失败:', e); }
  };

  const updateField = (f: string, v: string) => setForm(prev => ({ ...prev, [f]: v }));

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Swords className="h-6 w-6 text-orange-600" />
              竞品分析
            </CardTitle>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />新建竞品</Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* 筛选栏 */}
          <form onSubmit={handleSearch} className="flex gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="搜索竞品名称/产品名..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32"><SelectValue placeholder="类型" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="DOMESTIC">国内</SelectItem>
                <SelectItem value="OVERSEAS">海外</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" variant="outline">搜索</Button>
          </form>

          {/* 列表 */}
          {loading ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : competitors.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Swords className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>暂无竞品分析数据</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>竞品名称</TableHead>
                  <TableHead>产品</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>价格</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {competitors.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.competitorName}</TableCell>
                    <TableCell>{c.productName}</TableCell>
                    <TableCell><Badge className={TYPE_COLORS[c.type]}>{TYPE_LABELS[c.type]}</Badge></TableCell>
                    <TableCell>{c.price ? `${c.currency} ${c.price}` : '-'}</TableCell>
                    <TableCell className="text-sm text-gray-500">{new Date(c.createdAt).toLocaleDateString('zh-CN')}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(c)}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(c.id, c.competitorName)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 新建/编辑 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? '编辑竞品' : '新建竞品分析'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>竞品名称 *</Label><Input value={form.competitorName} onChange={e => updateField('competitorName', e.target.value)} placeholder="竞品公司/品牌名" /></div>
              <div><Label>产品名称 *</Label><Input value={form.productName} onChange={e => updateField('productName', e.target.value)} placeholder="对标的竞品产品名" /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>类型</Label><Select value={form.type} onValueChange={v => updateField('type', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DOMESTIC">国内竞品</SelectItem><SelectItem value="OVERSEAS">海外竞品</SelectItem></SelectContent></Select></div>
              <div><Label>国家</Label><Input value={form.country} onChange={e => updateField('country', e.target.value)} /></div>
              <div><Label>网站</Label><Input value={form.website} onChange={e => updateField('website', e.target.value)} placeholder="https://..." /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>型号</Label><Input value={form.productModel} onChange={e => updateField('productModel', e.target.value)} /></div>
              <div><Label>品类</Label><Input value={form.category} onChange={e => updateField('category', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>价格</Label><Input type="number" value={form.price} onChange={e => updateField('price', e.target.value)} /></div>
                <div><Label>币种</Label><Select value={form.currency} onValueChange={v => updateField('currency', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CNY">¥ CNY</SelectItem><SelectItem value="USD">$ USD</SelectItem><SelectItem value="EUR">€ EUR</SelectItem></SelectContent></Select></div>
              </div>
            </div>
            <div><Label>产品特性（逗号分隔）</Label><Input value={form.features} onChange={e => updateField('features', e.target.value)} placeholder="防水, 轻量, 快充..." /></div>
            <div><Label>优势（逗号分隔）</Label><Input value={form.strengths} onChange={e => updateField('strengths', e.target.value)} placeholder="价格低, 品牌知名度高..." /></div>
            <div><Label>劣势（逗号分隔）</Label><Input value={form.weaknesses} onChange={e => updateField('weaknesses', e.target.value)} placeholder="售后差, 交期长..." /></div>
            <div><Label>对比我们的产品</Label><Textarea value={form.vsOurProduct} onChange={e => updateField('vsOurProduct', e.target.value)} rows={2} placeholder="与我们的产品对比分析..." /></div>
            <div><Label>建议</Label><Textarea value={form.suggestion} onChange={e => updateField('suggestion', e.target.value)} rows={2} placeholder="基于分析的行动建议..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 详情 Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewing?.competitorName}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">产品：</span>{viewing.productName}</div>
                <div><span className="text-gray-500">型号：</span>{viewing.productModel || '-'}</div>
                <div><span className="text-gray-500">类型：</span><Badge className={TYPE_COLORS[viewing.type]}>{TYPE_LABELS[viewing.type]}</Badge></div>
                <div><span className="text-gray-500">价格：</span>{viewing.price ? `${viewing.currency} ${viewing.price}` : '-'}</div>
                <div><span className="text-gray-500">国家：</span>{viewing.country}</div>
                <div><span className="text-gray-500">网站：</span>{viewing.website || '-'}</div>
              </div>
              {viewing.features?.length > 0 && <div><span className="text-sm text-gray-500">特性：</span><div className="flex flex-wrap gap-1 mt-1">{viewing.features.map((f, i) => <Badge key={i} variant="outline">{f}</Badge>)}</div></div>}
              {viewing.strengths?.length > 0 && <div><span className="text-sm text-gray-500">优势：</span><p className="text-green-700">{viewing.strengths.join('、')}</p></div>}
              {viewing.weaknesses?.length > 0 && <div><span className="text-sm text-gray-500">劣势：</span><p className="text-red-700">{viewing.weaknesses.join('、')}</p></div>}
              {viewing.vsOurProduct && <div><span className="text-sm text-gray-500">对比分析：</span><p className="mt-1">{viewing.vsOurProduct}</p></div>}
              {viewing.suggestion && <div><span className="text-sm text-gray-500">建议：</span><p className="mt-1 text-blue-700">{viewing.suggestion}</p></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
