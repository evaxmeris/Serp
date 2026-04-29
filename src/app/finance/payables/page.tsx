'use client';

/**
 * 应付账款管理
 * /finance/payables
 * 管理供应商欠款，来源于采购订单
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ArrowUpCircle, ArrowLeft } from 'lucide-react';

interface Purchase {
  id: string; purchaseNo: string; totalAmount: number; paidAmount: number;
  balance: number; currency: string; status: string; createdAt: string;
  supplier?: { id: string; companyName: string };
}

const STATUS_COLORS: Record<string, string> = {
  UNPAID: 'bg-red-100 text-red-800',
  PARTIAL: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-green-100 text-green-800',
};

export default function PayablesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/purchases?${params}`);
      const data = await res.json();
      if (data.success) {
        const items = (data.data?.items || data.data || []).map((p: any) => ({
          ...p,
          paidAmount: p.paidAmount || 0,
          balance: (p.totalAmount || 0) - (p.paidAmount || 0),
        }));
        // Filter unpaid/partial
        let filtered = items.filter((p: any) => p.balance > 0);
        if (statusFilter === 'UNPAID') filtered = filtered.filter((p: any) => p.balance === p.totalAmount);
        else if (statusFilter === 'PARTIAL') filtered = filtered.filter((p: any) => p.balance > 0 && p.balance < p.totalAmount);
        setPurchases(filtered);
        setTotal(filtered.length);
        setTotalPages(Math.ceil(filtered.length / 20));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page, statusFilter]);

  const totalPayable = purchases.reduce((sum, p) => sum + p.balance, 0);

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => window.location.href = '/finance'}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ArrowUpCircle className="h-6 w-6 text-red-600" />应付账款</h1>
          <p className="text-gray-500">供应商欠款管理</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card><CardHeader className="pb-2"><p className="text-sm text-gray-500">应付总额</p></CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-600">¥{totalPayable.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><p className="text-sm text-gray-500">未付笔数</p></CardHeader>
          <CardContent><p className="text-2xl font-bold">{purchases.filter(p => p.balance === p.totalAmount).length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><p className="text-sm text-gray-500">部分付款</p></CardHeader>
          <CardContent><p className="text-2xl font-bold text-yellow-600">{purchases.filter(p => p.balance > 0 && p.balance < p.totalAmount).length}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>应付列表</CardTitle>
          <div className="flex gap-2">
            <Input placeholder="搜索采购单号/供应商..." value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchData()} className="w-48" />
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-28"><SelectValue placeholder="状态" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部未付</SelectItem>
                <SelectItem value="UNPAID">未付款</SelectItem>
                <SelectItem value="PARTIAL">部分付款</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchData}><Search className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="text-center py-8">加载中...</div> : purchases.length === 0 ? <div className="text-center py-8 text-gray-500">暂无应付账款</div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>采购单号</TableHead><TableHead>供应商</TableHead><TableHead>采购金额</TableHead><TableHead>已付金额</TableHead><TableHead>未付金额</TableHead><TableHead>状态</TableHead><TableHead>日期</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {purchases.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono">{p.purchaseNo}</TableCell>
                    <TableCell>{p.supplier?.companyName || '-'}</TableCell>
                    <TableCell>{p.currency || 'CNY'} {(p.totalAmount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-green-600">{(p.paidAmount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="font-bold text-red-600">{p.balance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[p.balance === p.totalAmount ? 'UNPAID' : p.balance > 0 ? 'PARTIAL' : 'PAID']}>
                      {p.balance === p.totalAmount ? '未付' : p.balance > 0 ? '部分' : '已付'}</Badge></TableCell>
                    <TableCell className="text-sm text-gray-500">{new Date(p.createdAt).toLocaleDateString('zh-CN')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
