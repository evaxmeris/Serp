'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

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
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setStatusPriority] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
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

  useEffect(() => {
    fetchInquiries();
    fetchCustomers();
  }, [statusFilter, priorityFilter]);

  const fetchInquiries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...(statusFilter && { status: statusFilter }),
        ...(priorityFilter && { priority: priorityFilter }),
      });
      const res = await fetch(`/api/inquiries?${params}`);
      const data = await res.json();
      setInquiries(data.data || []);
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
      NEW: 'bg-blue-100 text-blue-800 新建',
      CONTACTED: 'bg-yellow-100 text-yellow-800 已联系',
      QUOTED: 'bg-purple-100 text-purple-800 已报价',
      NEGOTIATING: 'bg-orange-100 text-orange-800 谈判中',
      WON: 'bg-green-100 text-green-800 成交',
      LOST: 'bg-red-100 text-red-800 丢失',
    };
    return badges[status] || status;
  };

  const getPriorityBadge = (priority: string) => {
    const badges: Record<string, string> = {
      LOW: 'bg-gray-100 text-gray-800 低',
      MEDIUM: 'bg-blue-100 text-blue-800 中',
      HIGH: 'bg-orange-100 text-orange-800 高',
      URGENT: 'bg-red-100 text-red-800 紧急',
    };
    return badges[priority] || priority;
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
                    <div className="space-y-2">
                      <Label>客户 *</Label>
                      <Select
                        value={newInquiry.customerId}
                        onValueChange={(value) =>
                          setNewInquiry({ ...newInquiry, customerId: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择客户" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.companyName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>来源</Label>
                      <Select
                        value={newInquiry.source}
                        onValueChange={(value) =>
                          setNewInquiry({ ...newInquiry, source: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Website">网站</SelectItem>
                          <SelectItem value="Alibaba">阿里巴巴</SelectItem>
                          <SelectItem value="Email">邮件</SelectItem>
                          <SelectItem value="Exhibition">展会</SelectItem>
                          <SelectItem value="Referral">推荐</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
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
                    <div className="space-y-2">
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
                    <div className="space-y-2">
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

                  <div className="space-y-2">
                    <Label>详细要求</Label>
                    <Textarea
                      placeholder="客户的其他要求..."
                      value={newInquiry.requirements}
                      onChange={(e) =>
                        setNewInquiry({ ...newInquiry, requirements: e.target.value })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>优先级</Label>
                      <Select
                        value={newInquiry.priority}
                        onValueChange={(value) =>
                          setNewInquiry({ ...newInquiry, priority: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">低</SelectItem>
                          <SelectItem value="MEDIUM">中</SelectItem>
                          <SelectItem value="HIGH">高</SelectItem>
                          <SelectItem value="URGENT">紧急</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <Button onClick={handleCreate}>保存</Button>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
                <SelectItem value="NEW">新建</SelectItem>
                <SelectItem value="CONTACTED">已联系</SelectItem>
                <SelectItem value="QUOTED">已报价</SelectItem>
                <SelectItem value="NEGOTIATING">谈判中</SelectItem>
                <SelectItem value="WON">成交</SelectItem>
                <SelectItem value="LOST">丢失</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setStatusPriority}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="优先级" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
                <SelectItem value="LOW">低</SelectItem>
                <SelectItem value="MEDIUM">中</SelectItem>
                <SelectItem value="HIGH">高</SelectItem>
                <SelectItem value="URGENT">紧急</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>询盘编号</TableHead>
                  <TableHead>客户</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead>产品</TableHead>
                  <TableHead>数量</TableHead>
                  <TableHead>目标价</TableHead>
                  <TableHead>优先级</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inquiries.map((inquiry) => (
                  <TableRow key={inquiry.id}>
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
                      {inquiry.targetPrice
                        ? `${inquiry.currency} ${inquiry.targetPrice.toFixed(2)}`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          getPriorityBadge(inquiry.priority).split(' ')[0]
                        }`}
                      >
                        {getPriorityBadge(inquiry.priority).split(' ').slice(1).join(' ')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          getStatusBadge(inquiry.status).split(' ')[0]
                        }`}
                      >
                        {getStatusBadge(inquiry.status).split(' ').slice(1).join(' ')}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(inquiry.createdAt).toLocaleDateString('zh-CN')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {inquiries.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              暂无询盘数据
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
