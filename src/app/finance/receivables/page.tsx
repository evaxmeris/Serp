'use client';

/**
 * 应收账款管理
 * /finance/receivables
 * 管理客户欠款，来源于销售订单
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ArrowDownCircle, ArrowLeft } from 'lucide-react';

interface Order {
  id: string; orderNo: string; totalAmount: number; paidAmount: number;
  balance: number; currency: string; status: string; createdAt: string;
  customer?: { id: string; companyName: string };
}

const STATUS_COLORS: Record<string, string> = {
  UNPAID: 'bg-red-100 text-red-800',
  PARTIAL: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-green-100 text-green-800',
};

export default function ReceivablesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', paymentStatus: 'UNPAID,PARTIAL' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/orders?${params}`);
      const data = await res.json();
      if (data.success) {
        const items = (data.data?.items || data.data || []).map((o: any) => ({
          ...o,
          paidAmount: o.paidAmount || 0,
          balance: (o.totalAmount || 0) - (o.paidAmount || 0),
        }));
        // Filter by payment status in frontend
        let filtered = items;
        if (statusFilter === 'UNPAID') filtered = items.filter((o: any) => o.balance === o.totalAmount);
        else if (statusFilter === 'PARTIAL') filtered = items.filter((o: any) => o.balance > 0 && o.balance < o.totalAmount);
        setOrders(filtered);
        setTotal(filtered.length);
        setTotalPages(Math.ceil(filtered.length / 20));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page, statusFilter]);

  const totalReceivable = orders.reduce((sum, o) => sum + o.balance, 0);

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => window.location.href = '/finance'}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ArrowDownCircle className="h-6 w-6 text-blue-600" />应收账款</h1>
          <p className="text-gray-500">客户欠款管理</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card><CardHeader className="pb-2"><p className="text-sm text-gray-500">应收总额</p></CardHeader>
          <CardContent><p className="text-2xl font-bold text-blue-600">¥{totalReceivable.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><p className="text-sm text-gray-500">未收笔数</p></CardHeader>
          <CardContent><p className="text-2xl font-bold">{orders.filter(o => o.balance === o.totalAmount).length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><p className="text-sm text-gray-500">部分收款</p></CardHeader>
          <CardContent><p className="text-2xl font-bold text-yellow-600">{orders.filter(o => o.balance > 0 && o.balance < o.totalAmount).length}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>应收列表</CardTitle>
          <div className="flex gap-2">
            <Input placeholder="搜索订单号/客户..." value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchData()} className="w-48" />
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-28"><SelectValue placeholder="状态" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="UNPAID">未收款</SelectItem>
                <SelectItem value="PARTIAL">部分收款</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchData}><Search className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="text-center py-8">加载中...</div> : orders.length === 0 ? <div className="text-center py-8 text-gray-500">暂无应收账款</div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>订单号</TableHead><TableHead>客户</TableHead><TableHead>订单金额</TableHead><TableHead>已收金额</TableHead><TableHead>未收金额</TableHead><TableHead>状态</TableHead><TableHead>日期</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {orders.map(o => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono">{o.orderNo}</TableCell>
                    <TableCell>{o.customer?.companyName || '-'}</TableCell>
                    <TableCell>{o.currency || 'CNY'} {(o.totalAmount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-green-600">{(o.paidAmount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="font-bold text-red-600">{o.balance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[o.balance === o.totalAmount ? 'UNPAID' : o.balance > 0 ? 'PARTIAL' : 'PAID']}>
                      {o.balance === o.totalAmount ? '未收' : o.balance > 0 ? '部分' : '已收'}</Badge></TableCell>
                    <TableCell className="text-sm text-gray-500">{new Date(o.createdAt).toLocaleDateString('zh-CN')}</TableCell>
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
