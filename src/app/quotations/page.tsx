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
      setQuotations(data.data || []);
      setPagination(data.pagination || pagination);
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

  const formatAmount = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return num.toFixed(2);
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">报价管理</CardTitle>
            <Button onClick={() => router.push('/quotations/new')}>
              <Plus className="w-4 h-4 mr-2" />
              新增报价
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* 筛选和搜索 */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="搜索报价单号、客户名称..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
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
            <div className="text-center py-8">加载中...</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>报价单号</TableHead>
                    <TableHead>客户</TableHead>
                    <TableHead>币种</TableHead>
                    <TableHead className="text-right">总金额</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotations.map((quotation) => (
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
                <div className="text-center py-8 text-gray-500">
                  暂无报价数据
                </div>
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
