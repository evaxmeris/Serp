'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

interface Customer {
  id: string;
  companyName: string;
  contactName: string | null;
}

interface QuotationItem {
  productName: string;
  specification: string;
  quantity: string;
  unitPrice: string;
  notes: string;
}

export default function NewQuotationPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
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
    fetchCustomers();
  }, []);

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
    setItems([
      ...items,
      { productName: '', specification: '', quantity: '', unitPrice: '', notes: '' },
    ]);
  };

  const updateItem = (index: number, field: keyof QuotationItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unitPrice) || 0;
      return sum + qty * price;
    }, 0);
  };

  const handleSubmit = async () => {
    if (!formData.customerId) {
      alert('请选择客户');
      return;
    }

    // 验证 items
    for (let i = 0; i < items.length; i++) {
      if (!items[i].productName) {
        alert(`第 ${i + 1} 项产品名称必填`);
        return;
      }
      if (!items[i].quantity || parseFloat(items[i].quantity) <= 0) {
        alert(`第 ${i + 1} 项数量必须为正数`);
        return;
      }
      if (!items[i].unitPrice || parseFloat(items[i].unitPrice) < 0) {
        alert(`第 ${i + 1} 项单价不能为负数`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          validityDays: parseInt(formData.validityDays) || 30,
          items: items.map((item) => ({
            productName: item.productName,
            specification: item.specification,
            quantity: parseInt(item.quantity) || 0,
            unitPrice: parseFloat(item.unitPrice) || 0,
            notes: item.notes,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert('报价单创建成功');
        router.push(`/quotations/${data.id}`);
      } else {
        const data = await res.json();
        alert(`创建失败：${data.error}`);
      }
    } catch (error) {
      console.error('Failed to create quotation:', error);
      alert('创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* 头部 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.push('/quotations')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回列表
        </Button>
        <h1 className="text-2xl font-bold">新增报价单</h1>
      </div>

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>客户 *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.customerId}
                onChange={(e) =>
                  setFormData({ ...formData, customerId: e.target.value })
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
                value={formData.currency}
                onChange={(e) =>
                  setFormData({ ...formData, currency: e.target.value })
                }
              >
                <option value="USD">USD (美元)</option>
                <option value="EUR">EUR (欧元)</option>
                <option value="CNY">CNY (人民币)</option>
              </select>
            </div>
            <div>
              <Label>付款条件</Label>
              <Input
                placeholder="T/T 30% deposit"
                value={formData.paymentTerms}
                onChange={(e) =>
                  setFormData({ ...formData, paymentTerms: e.target.value })
                }
              />
            </div>
            <div>
              <Label>交货条款</Label>
              <Input
                placeholder="FOB Shanghai"
                value={formData.deliveryTerms}
                onChange={(e) =>
                  setFormData({ ...formData, deliveryTerms: e.target.value })
                }
              />
            </div>
            <div>
              <Label>有效期（天）</Label>
              <Input
                type="number"
                value={formData.validityDays}
                onChange={(e) =>
                  setFormData({ ...formData, validityDays: e.target.value })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 产品明细 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>产品明细</CardTitle>
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="w-4 h-4 mr-2" />
              添加产品
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-12 gap-2 items-start border p-3 rounded-lg"
              >
                <div className="col-span-3">
                  <Input
                    placeholder="产品名称 *"
                    value={item.productName}
                    onChange={(e) =>
                      updateItem(index, 'productName', e.target.value)
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    placeholder="规格"
                    value={item.specification}
                    onChange={(e) =>
                      updateItem(index, 'specification', e.target.value)
                    }
                  />
                </div>
                <div className="col-span-1">
                  <Input
                    placeholder="数量 *"
                    type="number"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(index, 'quantity', e.target.value)
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    placeholder="单价 *"
                    type="number"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) =>
                      updateItem(index, 'unitPrice', e.target.value)
                    }
                  />
                </div>
                <div className="col-span-3 flex items-center gap-2">
                  <Input
                    placeholder="备注"
                    value={item.notes}
                    onChange={(e) =>
                      updateItem(index, 'notes', e.target.value)
                    }
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="col-span-1 text-right text-sm text-gray-500">
                  小计：{formData.currency}{' '}
                  {((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          {/* 总计 */}
          <div className="mt-4 pt-4 border-t flex justify-end">
            <div className="text-lg font-bold">
              总计：{formData.currency} {calculateTotal().toFixed(2)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 备注 */}
      <Card>
        <CardHeader>
          <CardTitle>备注</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="其他说明..."
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            rows={4}
          />
        </CardContent>
      </Card>

      {/* 提交按钮 */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push('/quotations')}>
          取消
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? '创建中...' : '保存报价单'}
        </Button>
      </div>
    </div>
  );
}
