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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, Eye, Edit, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/toast';

interface Inquiry {
  id: string;
  inquiryNo: string;
  customer: {
    companyName: string;
    contactName: string | null;
  };
  source: string | null;
  status: string;
  priority: string;
  products: string | null;
  quantity: number | null;
  targetPrice: number | null;
  currency: string;
  createdAt: string;
}

interface Customer {
  id: string;
  companyName: string;
}

export default function InquiriesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [newInquiry, setNewInquiry] = useState({
    customerId: '',
    source: 'Website',
    products: '',
    quantity: '',
    targetPrice: '',
    currency: 'USD',
    requirements: '',
    priority: 'MEDIUM',
  });

  const statusOptions = [
    { value: 'all', label: '全部状态' },
    { value: 'NEW', label: '新建' },
    { value: 'CONTACTED', label: '已联系' },
    { value: 'QUOTED', label: '已报价' },
    { value: 'NEGOTIATING', label: '谈判中' },
    { value: 'WON', label: '成交' },
    { value: 'LOST', label: '丢失' },
  ];

  useEffect(() => {
    fetchInquiries();
    fetchCustomers();
  }, [page, search, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPage(1);
    setSelectedIds([]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === inquiries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(inquiries.map(i => i.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      toast.warning('请选择要删除的询盘');
      return;
    }
    if (!confirm(`确定要删除选中的 ${selectedIds.length} 个询盘吗？此操作不可撤销。`)) {
      return;
    }

    setDeleteLoading(true);
    try {
      await Promise.all(
        selectedIds.map(id =>
          fetch(`/api/inquiries/${id}`, { method: 'DELETE' })
        )
      );
      toast.success(`成功删除 ${selectedIds.length} 个询盘`);
      setSelectedIds([]);
      fetchInquiries();
    } catch (error) {
      console.error('Failed to batch delete:', error);
      toast.error('批量删除失败');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个询盘吗？此操作不可撤销。')) {
      return;
    }

    try {
      const res = await fetch(`/api/inquiries/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('删除成功');
        fetchInquiries();
      } else {
        toast.error('删除失败');
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('删除失败');
    }
  };

  const fetchInquiries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (search) params.append('search', search);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const res = await fetch(`/api/inquiries?${params}`);
      const result = await res.json();
      const inquiriesData = Array.isArray(result?.data)
        ? result?.data
        : result?.data?.items || [];
      setInquiries(inquiriesData);
      setTotalPages(result.pagination?.totalPages || 1);
      setTotal(result.pagination?.total || 0);
    } catch (error) {
      console.error('Failed to fetch inquiries:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(data.data || []);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  };

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newInquiry,
          quantity: parseInt(newInquiry.quantity) || null,
          targetPrice: parseFloat(newInquiry.targetPrice) || null,
        }),
      });

      if (res.ok) {
        setIsCreateDialogOpen(false);
        setNewInquiry({
          customerId: '',
          source: 'Website',
          products: '',
          quantity: '',
          targetPrice: '',
          currency: 'USD',
          requirements: '',
          priority: 'MEDIUM',
        });
        fetchInquiries();
      }
    } catch (error) {
      console.error('Failed to create inquiry:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      NEW: 'bg-blue-100 text-blue-800',
      CONTACTED: 'bg-yellow-100 text-yellow-800',
      QUOTED: 'bg-purple-100 text-purple-800',
      NEGOTIATING: 'bg-orange-100 text-orange-800',
      WON: 'bg-green-100 text-green-800',
      LOST: 'bg-red-100 text-red-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      NEW: '新建',
      CONTACTED: '已联系',
      QUOTED: '已报价',
      NEGOTIATING: '谈判中',
      WON: '成交',
      LOST: '丢失',
    };
    return texts[status] || status;
  };

  const getPriorityText = (priority: string) => {
    const texts: Record<string, string> = {
      LOW: '低',
      MEDIUM: '中',
      HIGH: '高',
      URGENT: '紧急',
    };
    return texts[priority] || priority;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      LOW: 'bg-gray-100 text-gray-800',
      MEDIUM: 'bg-blue-100 text-blue-800',
      HIGH: 'bg-orange-100 text-orange-800',
      URGENT: 'bg-red-100 text-red-800',
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">询盘管理</CardTitle>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>新增询盘</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>新增询盘</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>客户 *</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={newInquiry.customerId}
                        onChange={(e) =>
                          setNewInquiry({ ...newInquiry, customerId: e.target.value })
                        }
                      >
                        <option value="">选择客户</option>
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.companyName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>来源</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={newInquiry.source}
                        onChange={(e) =>
                          setNewInquiry({ ...newInquiry, source: e.target.value })
                        }
                      >
                        <option value="Website">网站</option>
                        <option value="Alibaba">阿里巴巴</option>
                        <option value="Email">邮件</option>
                        <option value="Exhibition">展会</option>
                        <option value="Referral">推荐</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label>产品需求</Label>
                    <Textarea
                      placeholder="描述客户需要的产品..."
                      value={newInquiry.products}
                      onChange={(e) =>
                        setNewInquiry({ ...newInquiry, products: e.target.value })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>数量</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={newInquiry.quantity}
                        onChange={(e) =>
                          setNewInquiry({ ...newInquiry, quantity: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>目标价格</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={newInquiry.targetPrice}
                        onChange={(e) =>
                          setNewInquiry({ ...newInquiry, targetPrice: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <Label>详细要求</Label>
                    <Textarea
                      placeholder="客户的其他要求..."
                      value={newInquiry.requirements}
                      onChange={(e) =>
                        setNewInquiry({ ...newInquiry, requirements: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <Label>优先级</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newInquiry.priority}
                      onChange={(e) =>
                        setNewInquiry({ ...newInquiry, priority: e.target.value })
                      }
                    >
                      <option value="LOW">低</option>
                      <option value="MEDIUM">中</option>
                      <option value="HIGH">高</option>
                      <option value="URGENT">紧急</option>
                    </select>
                  </div>
                </div>
                <Button onClick={handleCreate}>保存</Button>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          {/* 搜索筛选栏 */}
          <form onSubmit={handleSearch} className="mb-6 space-y-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="搜索询盘编号、产品..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="状态筛选" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" variant="outline">
                搜索
              </Button>
              <Button type="button" variant="ghost" onClick={resetFilters}>
                重置
              </Button>
              {selectedIds.length > 0 && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleBatchDelete}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? '删除中...' : `批量删除 (${selectedIds.length})`}
                </Button>
              )}
            </div>
          </form>

          {/* 表格 */}
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        className="h-4 w-4 cursor-pointer"
                        checked={inquiries.length > 0 && selectedIds.length === inquiries.length}
                        onClick={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>询盘编号</TableHead>
                    <TableHead>客户</TableHead>
                    <TableHead>来源</TableHead>
                    <TableHead>产品</TableHead>
                    <TableHead>数量</TableHead>
                    <TableHead>目标价</TableHead>
                    <TableHead>优先级</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inquiries.map((inquiry) => (
                    <TableRow key={inquiry.id}>
                      <TableCell>
                        <Checkbox
                          className="h-4 w-4 cursor-pointer"
                          checked={selectedIds.includes(inquiry.id)}
                          onClick={() => toggleSelect(inquiry.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {inquiry.inquiryNo}
                      </TableCell>
                      <TableCell>{inquiry.customer.companyName}</TableCell>
                      <TableCell>{inquiry.source || '-'}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {inquiry.products || '-'}
                      </TableCell>
                      <TableCell>{inquiry.quantity || '-'}</TableCell>
                      <TableCell>
                        {inquiry.targetPrice && typeof inquiry.targetPrice === 'number'
                          ? `${inquiry.currency} ${inquiry.targetPrice.toFixed(2)}`
                          : inquiry.targetPrice
                          ? `${inquiry.currency} ${Number(inquiry.targetPrice).toFixed(2)}`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${getPriorityColor(inquiry.priority)}`}>
                          {getPriorityText(inquiry.priority)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(inquiry.status)}`}>
                          {getStatusText(inquiry.status)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {new Date(inquiry.createdAt).toLocaleDateString('zh-CN')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/inquiries/${inquiry.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            查看
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/inquiries/${inquiry.id}/edit`)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            编辑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(inquiry.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            删除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {inquiries.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500">
                  暂无询盘数据
                </div>
              )}

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-500">
                    共 {total} 条记录，第 {page} / {totalPages} 页
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === totalPages}
                      onClick={() => setPage(page + 1)}
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
