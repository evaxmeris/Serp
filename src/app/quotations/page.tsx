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
import { Textarea } from '@/components/ui/textarea';

interface Quotation {
  id: string;
  quotationNo: string;
  customer: {
    companyName: string;
    contactName: string | null;
  };
  status: string;
  currency: string;
  totalAmount: number;
  createdAt: string;
}

interface Customer {
  id: string;
  companyName: string;
}

interface QuotationItem {
  productName: string;
  specification: string;
  quantity: string;
  unitPrice: string;
  notes: string;
}

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newQuotation, setNewQuotation] = useState({
    customerId: '',
    currency: 'USD',
    paymentTerms: '',
    deliveryTerms: '',
    validityDays: '30',
    notes: '',
  });
  const [items, setItems] = useState<QuotationItem[]>([
    { productName: '', specification: '', quantity: '', unitPrice: '', notes: '' },
  ]);

  useEffect(() => {
    fetchQuotations();
    fetchCustomers();
  }, []);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/quotations');
      const data = await res.json();
      setQuotations(data.data || []);
    } catch (error) {
      console.error('Failed to fetch quotations:', error);
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

  const addItem = () => {
    setItems([...items, { productName: '', specification: '', quantity: '', unitPrice: '', notes: '' }]);
  };

  const updateItem = (index: number, field: keyof QuotationItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newQuotation,
          validityDays: parseInt(newQuotation.validityDays) || 30,
          items,
        }),
      });

      if (res.ok) {
        setIsCreateDialogOpen(false);
        setNewQuotation({
          customerId: '',
          currency: 'USD',
          paymentTerms: '',
          deliveryTerms: '',
          validityDays: '30',
          notes: '',
        });
        setItems([{ productName: '', specification: '', quantity: '', unitPrice: '', notes: '' }]);
        fetchQuotations();
      }
    } catch (error) {
      console.error('Failed to create quotation:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800 草稿',
      SENT: 'bg-blue-100 text-blue-800 已发送',
      VIEWED: 'bg-purple-100 text-purple-800 已查看',
      ACCEPTED: 'bg-green-100 text-green-800 已接受',
      REJECTED: 'bg-red-100 text-red-800 已拒绝',
      EXPIRED: 'bg-orange-100 text-orange-800 已过期',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      DRAFT: '草稿',
      SENT: '已发送',
      VIEWED: '已查看',
      ACCEPTED: '已接受',
      REJECTED: '已拒绝',
      EXPIRED: '已过期',
    };
    return texts[status] || status;
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">报价管理</CardTitle>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>新增报价</Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>新增报价单</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>客户 *</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={newQuotation.customerId}
                        onChange={(e) =>
                          setNewQuotation({ ...newQuotation, customerId: e.target.value })
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
                      <Label>币种</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={newQuotation.currency}
                        onChange={(e) =>
                          setNewQuotation({ ...newQuotation, currency: e.target.value })
                        }
                      >
                        <option value="USD">USD (美元)</option>
                        <option value="EUR">EUR (欧元)</option>
                        <option value="CNY">CNY (人民币)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>付款条件</Label>
                      <Input
                        placeholder="T/T 30% deposit"
                        value={newQuotation.paymentTerms}
                        onChange={(e) =>
                          setNewQuotation({ ...newQuotation, paymentTerms: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>交货条款</Label>
                      <Input
                        placeholder="FOB Shanghai"
                        value={newQuotation.deliveryTerms}
                        onChange={(e) =>
                          setNewQuotation({ ...newQuotation, deliveryTerms: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <Label>有效期（天）</Label>
                    <Input
                      type="number"
                      value={newQuotation.validityDays}
                      onChange={(e) =>
                        setNewQuotation({ ...newQuotation, validityDays: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <Label>产品明细</Label>
                    <div className="space-y-2">
                      {items.map((item, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-start border p-2 rounded">
                          <input
                            className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            placeholder="产品名称"
                            value={item.productName}
                            onChange={(e) => updateItem(index, 'productName', e.target.value)}
                          />
                          <input
                            className="col-span-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            placeholder="规格"
                            value={item.specification}
                            onChange={(e) => updateItem(index, 'specification', e.target.value)}
                          />
                          <input
                            className="col-span-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            placeholder="数量"
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                          />
                          <input
                            className="col-span-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            placeholder="单价"
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(index, 'unitPrice', e.target.value)}
                          />
                          <div className="col-span-3 flex items-center gap-2">
                            <Input
                              placeholder="备注"
                              value={item.notes}
                              onChange={(e) => updateItem(index, 'notes', e.target.value)}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeItem(index)}
                              disabled={items.length === 1}
                            >
                              删除
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={addItem} className="mt-2">
                      + 添加产品
                    </Button>
                  </div>

                  <div>
                    <Label>备注</Label>
                    <Textarea
                      placeholder="其他说明..."
                      value={newQuotation.notes}
                      onChange={(e) =>
                        setNewQuotation({ ...newQuotation, notes: e.target.value })
                      }
                    />
                  </div>
                </div>
                <Button onClick={handleCreate}>保存报价单</Button>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>报价单号</TableHead>
                <TableHead>客户</TableHead>
                <TableHead>币种</TableHead>
                <TableHead>总金额</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
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
                  <TableCell>
                    {quotation.currency} {quotation.totalAmount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(quotation.status).split(' ')[0]}`}>
                      {getStatusText(quotation.status)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {new Date(quotation.createdAt).toLocaleDateString('zh-CN')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {quotations.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              暂无报价数据
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
