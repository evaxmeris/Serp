'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSortable, SortIndicator } from '@/hooks/use-sortable';
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, Search, Eye } from 'lucide-react';

interface Quotation {
  id: string;
  quotationNo: string;
  customer: {
    companyName: string;
    contactName: string | null;
  };
  status: string;
  currency: string;
  totalAmount: string | number;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function QuotationsPage() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchQuotations();
  }, [pagination.page, statusFilter, debouncedSearch]);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
      });
      if (statusFilter) params.append('status', statusFilter);
      if (debouncedSearch) params.append('search', debouncedSearch);

      const res = await fetch(`/api/quotations?${params}`);
      const data = await res.json();
      setQuotations(data.data?.items ?? data.data ?? []);
      setPagination(data.data?.pagination || data.pagination || pagination);
    } catch (error) {
      console.error('Failed to fetch quotations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      DRAFT: 'secondary',
      SENT: 'default',
      VIEWED: 'outline',
      ACCEPTED: 'default',
      REJECTED: 'destructive',
      EXPIRED: 'secondary',
    };

    const labels: Record<string, string> = {
      DRAFT: '草稿',
      SENT: '已发送',
      VIEWED: '已查看',
      ACCEPTED: '已接受',
      REJECTED: '已拒绝',
      EXPIRED: '已过期',
    };

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {labels[status] || status}
      </Badge>
    );
  };

  const handlePageChange = (newPage: number) => {
    setPagination({ ...pagination, page: newPage });
  };

  // 列排序
  const { sorted, requestSort, sortConfig } = useSortable(quotations, 'createdAt');

  const formatAmount = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return num.toFixed(2);
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-2xl">报价管理</CardTitle>
            <Button onClick={() => router.push('/quotations/new')}>
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">新增报价</span>
              <span className="sm:hidden">新增</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* 筛选和搜索 */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="搜索报价单号、客户名称..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm max-w-[200px]"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination({ ...pagination, page: 1 });
              }}
            >
              <option value="">全部状态</option>
              <option value="DRAFT">草稿</option>
              <option value="SENT">已发送</option>
              <option value="VIEWED">已查看</option>
              <option value="ACCEPTED">已接受</option>
              <option value="REJECTED">已拒绝</option>
              <option value="EXPIRED">已过期</option>
            </select>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-28 shrink-0" />
                  <Skeleton className="h-5 w-1/4" />
                  <Skeleton className="h-5 w-12 shrink-0" />
                  <Skeleton className="h-5 w-20 shrink-0 ml-auto" />
                  <Skeleton className="h-5 w-16 shrink-0" />
                  <Skeleton className="h-5 w-20 shrink-0" />
                  <Skeleton className="h-5 w-16 shrink-0" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => requestSort('quotationNo')}
                    >
                      报价单号
                      <SortIndicator field="quotationNo" sortConfig={sortConfig} />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => requestSort('customer.companyName')}
                    >
                      客户
                      <SortIndicator field="customer.companyName" sortConfig={sortConfig} />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => requestSort('currency')}
                    >
                      币种
                      <SortIndicator field="currency" sortConfig={sortConfig} />
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => requestSort('totalAmount')}
                    >
                      总金额
                      <SortIndicator field="totalAmount" sortConfig={sortConfig} />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => requestSort('status')}
                    >
                      状态
                      <SortIndicator field="status" sortConfig={sortConfig} />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => requestSort('createdAt')}
                    >
                      创建时间
                      <SortIndicator field="createdAt" sortConfig={sortConfig} />
                    </TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((quotation) => (
                    <TableRow key={quotation.id}>
                      <TableCell className="font-medium">
                        {quotation.quotationNo}
                      </TableCell>
                      <TableCell>{quotation.customer.companyName}</TableCell>
                      <TableCell>{quotation.currency}</TableCell>
                      <TableCell className="text-right">
                        {quotation.currency} {formatAmount(quotation.totalAmount)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(quotation.status)}
                      </TableCell>
                      <TableCell>
                        {new Date(quotation.createdAt).toLocaleDateString('zh-CN')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/quotations/${quotation.id}`)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {quotations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState
                      title="暂无报价数据"
                      description="还没有任何报价记录，创建一份报价开始使用"
                    />
                  </TableCell>
                </TableRow>
              )}

              {/* 分页 */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-gray-500">
                    共 {pagination.total} 条，第 {pagination.page} / {pagination.totalPages} 页
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                    >
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
