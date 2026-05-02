'use client';

/**
 * 发票列表页面
 * /invoices
 * 卡片+表格列表，状态筛选，搜索，新建按钮
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Eye, FileText, Trash2 } from 'lucide-react';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirmation-dialog';

interface Invoice {
  id: string;
  invoiceNo: string;
  type: string;
  status: string;
  currency: string;
  totalAmount: number;
  issuerName: string;
  recipientName: string | null;
  invoiceDate: string;
  createdAt: string;
  order?: { orderNo: string } | null;
  customer?: { companyName: string } | null;
}

const statusLabels: Record<string, string> = {
  DRAFT: '草稿',
  SENT: '已发送',
  CONFIRMED: '已确认',
  PAID: '已付款',
  CANCELLED: '已取消',
};

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SENT: 'bg-blue-100 text-blue-800',
  CONFIRMED: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const typeLabels: Record<string, string> = {
  PROFORMA: '形式发票',
  COMMERCIAL: '商业发票',
  TAX: '税务发票',
};

const typeColors: Record<string, string> = {
  PROFORMA: 'bg-purple-100 text-purple-800',
  COMMERCIAL: 'bg-indigo-100 text-indigo-800',
  TAX: 'bg-orange-100 text-orange-800',
};

export default function InvoicesPage() {
  const router = useRouter();
  const { toast, toasts, removeToast } = useToast();
  const { confirm, ConfirmDialog: ConfirmDlg } = useConfirm();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      const res = await fetch(`/api/v1/invoices?${params}`);
      const result = await res.json();
      const data = result.data?.items ?? result.data ?? [];
      setInvoices(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('加载发票列表失败:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({ title: '确认删除', description: '确定删除此发票？只有草稿状态可删除。' });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/v1/invoices/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.message || '删除失败');
        return;
      }
      fetchInvoices();
    } catch (e) {
      console.error('删除失败:', e);
    }
  };

  // 统计
  const totalAmount = invoices.reduce((s, i) => s + Number(i.totalAmount || 0), 0);
  const draftCount = invoices.filter((i) => i.status === 'DRAFT').length;
  const sentCount = invoices.filter((i) => i.status === 'SENT').length;
  const paidCount = invoices.filter((i) => i.status === 'PAID').length;

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-8 w-8 text-blue-600" />
            发票管理
          </h1>
          <p className="mt-1 text-gray-500">管理形式发票(PI)、商业发票(CI)和税务发票</p>
        </div>
        <Button onClick={() => router.push('/invoices/new')}>
          <Plus className="h-4 w-4 mr-2" />新建发票
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-500">总发票数</p>
            <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-500">草稿</p>
            <p className="text-2xl font-bold text-gray-500">{draftCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-500">已发送</p>
            <p className="text-2xl font-bold text-blue-600">{sentCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-500">已付款</p>
            <p className="text-2xl font-bold text-green-600">{paidCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          {/* 筛选栏 */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="搜索发票号/开票方/收票方..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="DRAFT">草稿</SelectItem>
                <SelectItem value="SENT">已发送</SelectItem>
                <SelectItem value="CONFIRMED">已确认</SelectItem>
                <SelectItem value="PAID">已付款</SelectItem>
                <SelectItem value="CANCELLED">已取消</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="PROFORMA">形式发票</SelectItem>
                <SelectItem value="COMMERCIAL">商业发票</SelectItem>
                <SelectItem value="TAX">税务发票</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchInvoices}>
              搜索
            </Button>
          </div>

          {/* 表格 */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>暂无发票记录</p>
              <Button variant="outline" className="mt-4" onClick={() => router.push('/invoices/new')}>
                新建第一张发票
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>发票号</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>开票方</TableHead>
                    <TableHead>收票方</TableHead>
                    <TableHead>金额</TableHead>
                    <TableHead>创建日期</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id} className="cursor-pointer hover:bg-gray-50" onClick={() => router.push(`/invoices/${inv.id}`)}>
                      <TableCell className="font-mono font-medium">{inv.invoiceNo}</TableCell>
                      <TableCell>
                        <Badge className={typeColors[inv.type] || 'bg-gray-100'}>
                          {typeLabels[inv.type] || inv.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[inv.status] || 'bg-gray-100'}>
                          {statusLabels[inv.status] || inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">{inv.issuerName}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{inv.recipientName || '-'}</TableCell>
                      <TableCell className="font-bold">
                        {inv.currency} {Number(inv.totalAmount).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/invoices/${inv.id}`)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {inv.status === 'DRAFT' && (
                            <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(inv.id)}>
                              <Trash2 className="h-4 w-4" />
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
        </CardContent>
      </Card>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmDlg />
    </div>
  );
}
