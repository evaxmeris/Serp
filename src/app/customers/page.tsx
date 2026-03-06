'use client';

import { useEffect, useState } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Customer {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  status: string;
  createdAt: string;
  _count?: {
    inquiries: number;
    orders: number;
  };
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    country: '',
  });

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers?search=${search}`);
      const data = await res.json();
      setCustomers(data.data || []);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer),
      });

      if (res.ok) {
        setIsCreateDialogOpen(false);
        setNewCustomer({
          companyName: '',
          contactName: '',
          email: '',
          phone: '',
          country: '',
        });
        fetchCustomers();
      }
    } catch (error) {
      console.error('Failed to create customer:', error);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">客户管理</CardTitle>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>新增客户</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新增客户</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <Input
                    placeholder="公司名称 *"
                    value={newCustomer.companyName}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, companyName: e.target.value })
                    }
                  />
                  <Input
                    placeholder="联系人"
                    value={newCustomer.contactName}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, contactName: e.target.value })
                    }
                  />
                  <Input
                    placeholder="邮箱"
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, email: e.target.value })
                    }
                  />
                  <Input
                    placeholder="电话"
                    value={newCustomer.phone}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, phone: e.target.value })
                    }
                  />
                  <Input
                    placeholder="国家/地区"
                    value={newCustomer.country}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, country: e.target.value })
                    }
                  />
                </div>
                <Button onClick={handleCreate}>保存</Button>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="搜索客户..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>公司名称</TableHead>
                  <TableHead>联系人</TableHead>
                  <TableHead>邮箱</TableHead>
                  <TableHead>电话</TableHead>
                  <TableHead>国家</TableHead>
                  <TableHead>询盘</TableHead>
                  <TableHead>订单</TableHead>
                  <TableHead>创建时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">
                      {customer.companyName}
                    </TableCell>
                    <TableCell>{customer.contactName || '-'}</TableCell>
                    <TableCell>{customer.email || '-'}</TableCell>
                    <TableCell>{customer.phone || '-'}</TableCell>
                    <TableCell>{customer.country || '-'}</TableCell>
                    <TableCell>{customer._count?.inquiries || 0}</TableCell>
                    <TableCell>{customer._count?.orders || 0}</TableCell>
                    <TableCell>
                      {new Date(customer.createdAt).toLocaleDateString('zh-CN')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {customers.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              暂无客户数据
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
