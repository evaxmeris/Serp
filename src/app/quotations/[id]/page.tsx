'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Send, FileCheck, Edit, Trash2 } from 'lucide-react';

interface Quotation {
  id: string;
  quotationNo: string;
  customerId: string;
  inquiryId: string | null;
  status: string;
  currency: string;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  validityDays: number | null;
  notes: string | null;
  totalAmount: string | number;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    companyName: string;
    contactName: string | null;
    email: string | null;
    phone: string | null;
  };
  items: {
    id: string;
    productId: string | null;
    productName: string;
    specification: string | null;
    quantity: number | string;
    unitPrice: number | string;
    amount: number | string;
    notes: string | null;
  }[];
}

export default function QuotationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [converting, setConverting] = useState(false);

  // 格式化金额函数 - 处理 string | number 类型
  const formatAmount = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return num.toFixed(2);
  };

  // 格式化数字函数 - 处理 string | number 类型
  const formatNumber = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return num;
  };

  useEffect(() => {
    if (params.id) {
      fetchQuotation(params.id as string);
    }
  }, [params.id]);

  const fetchQuotation = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quotations/${id}`);
      if (!res.ok) {
        throw new Error('Failed to fetch quotation');
      }
      const data = await res.json();
      setQuotation(data);
    } catch (error) {
      console.error('Failed to fetch quotation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!quotation) return;
    
    const customerEmail = quotation.customer.email;
    if (!customerEmail) {
      alert('客户没有邮箱地址，无法发送');
      return;
    }

    if (!confirm(`确定要发送报价单 ${quotation.quotationNo} 给 ${customerEmail} 吗？`)) {
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/quotations/${quotation.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmails: [customerEmail],
          subject: `报价单 ${quotation.quotationNo}`,
          message: `尊敬的 ${quotation.customer.contactName || quotation.customer.companyName}，\n\n请查收我们的报价单。`,
        }),
      });

      if (res.ok) {
        alert('报价单已发送');
        fetchQuotation(quotation.id);
      } else {
        const data = await res.json();
        alert(`发送失败：${data.error}`);
      }
    } catch (error) {
      console.error('Failed to send quotation:', error);
      alert('发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleConvert = async () => {
    if (!quotation) return;

    if (!confirm(`确定要将报价单 ${quotation.quotationNo} 转为订单吗？`)) {
      return;
    }

    setConverting(true);
    try {
      const res = await fetch(`/api/quotations/${quotation.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`报价单已转为订单：${data.order.orderNo}`);
        router.push(`/orders/${data.order.id}`);
      } else {
        const data = await res.json();
        alert(`转换失败：${data.error}`);
      }
    } catch (error) {
      console.error('Failed to convert quotation:', error);
      alert('转换失败');
    } finally {
      setConverting(false);
    }
  };

  const handleDelete = async () => {
    if (!quotation) return;

    if (!confirm(`确定要删除报价单 ${quotation.quotationNo} 吗？此操作不可恢复。`)) {
      return;
    }

    try {
      const res = await fetch(`/api/quotations/${quotation.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        alert('报价单已删除');
        router.push('/quotations');
      } else {
        const data = await res.json();
        alert(`删除失败：${data.error}`);
      }
    } catch (error) {
      console.error('Failed to delete quotation:', error);
      alert('删除失败');
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

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-8">加载中...</div>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-gray-500">报价单不存在</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* 头部操作栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/quotations')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回列表
          </Button>
          <h1 className="text-2xl font-bold">{quotation.quotationNo}</h1>
          {getStatusBadge(quotation.status)}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/quotations/edit/${quotation.id}`)}
          >
            <Edit className="w-4 h-4 mr-2" />
            编辑
          </Button>
          {quotation.status !== 'ACCEPTED' && quotation.status !== 'REJECTED' && (
            <>
              <Button
                variant="outline"
                onClick={handleSend}
                disabled={sending}
              >
                <Send className="w-4 h-4 mr-2" />
                {sending ? '发送中...' : '发送'}
              </Button>
              <Button
                variant="default"
                onClick={handleConvert}
                disabled={converting || quotation.status === 'DRAFT'}
              >
                <FileCheck className="w-4 h-4 mr-2" />
                {converting ? '转换中...' : '转订单'}
              </Button>
            </>
          )}
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-2" />
            删除
          </Button>
        </div>
      </div>

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-500">客户</div>
              <div className="font-medium">{quotation.customer.companyName}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">联系人</div>
              <div className="font-medium">{quotation.customer.contactName || '-'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">邮箱</div>
              <div className="font-medium">{quotation.customer.email || '-'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">电话</div>
              <div className="font-medium">{quotation.customer.phone || '-'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">币种</div>
              <div className="font-medium">{quotation.currency}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">总金额</div>
              <div className="font-medium text-lg">
                {quotation.currency} {formatAmount(quotation.totalAmount)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">付款条件</div>
              <div className="font-medium">{quotation.paymentTerms || '-'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">交货条款</div>
              <div className="font-medium">{quotation.deliveryTerms || '-'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">有效期</div>
              <div className="font-medium">{quotation.validityDays ? `${quotation.validityDays} 天` : '-'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">创建时间</div>
              <div className="font-medium">
                {new Date(quotation.createdAt).toLocaleDateString('zh-CN')}
              </div>
            </div>
          </div>
          {quotation.notes && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-sm text-gray-500 mb-2">备注</div>
              <div className="text-sm">{quotation.notes}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 产品明细 */}
      <Card>
        <CardHeader>
          <CardTitle>产品明细</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>产品名称</TableHead>
                <TableHead>规格</TableHead>
                <TableHead className="text-right">数量</TableHead>
                <TableHead className="text-right">单价</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead>备注</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotation.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.productName}</TableCell>
                  <TableCell>{item.specification || '-'}</TableCell>
                  <TableCell className="text-right">{formatNumber(item.quantity)}</TableCell>
                  <TableCell className="text-right">
                    {quotation.currency} {formatAmount(item.unitPrice)}
                  </TableCell>
                  <TableCell className="text-right">
                    {quotation.currency} {formatAmount(item.amount)}
                  </TableCell>
                  <TableCell>{item.notes || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
