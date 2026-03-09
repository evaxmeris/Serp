'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, CheckCircle, XCircle, Download } from 'lucide-react';

interface InboundOrder {
  id: string;
  inboundNo: string;
  type: string;
  status: string;
  supplier?: {
    id: string;
    companyName: string;
  };
  warehouse?: {
    id: string;
    name: string;
    code: string;
  };
  purchaseOrder?: {
    id: string;
    orderNo: string;
  };
  totalAmount: number;
  expectedDate?: string;
  actualDate?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    product: {
      id: string;
      name: string;
      sku: string;
    };
    expectedQuantity: number;
    actualQuantity: number;
    unitPrice: number;
    amount: number;
    batchNo?: string;
  }>;
  inventoryLogs?: Array<{
    id: string;
    type: string;
    quantity: number;
    createdAt: string;
  }>;
}

const INBOUND_TYPE: Record<string, string> = {
  PURCHASE_IN: '采购入库',
  RETURN_IN: '退货入库',
  ADJUSTMENT_IN: '调拨入库',
  TRANSFER_IN: '转仓入库',
  OTHER_IN: '其他入库',
};

const INBOUND_STATUS: Record<string, string> = {
  PENDING: '待入库',
  PARTIAL: '部分入库',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PARTIAL: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function InboundOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [order, setOrder] = useState<InboundOrder | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/v1/inbound-orders/${params.id}`);
      const data = await res.json();

      if (data.success) {
        setOrder(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch order:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) {
      fetchOrder();
    }
  }, [params.id]);

  const handleConfirm = async () => {
    if (!confirm('确认入库此订单吗？')) return;

    try {
      const res = await fetch(`/api/v1/inbound-orders/${params.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (data.success) {
        alert('入库确认成功');
        fetchOrder();
      } else {
        alert(data.message || '入库确认失败');
      }
    } catch (error) {
      console.error('Failed to confirm:', error);
      alert('入库确认失败');
    }
  };

  const handleCancel = async () => {
    if (!confirm('确定要取消此入库单吗？')) return;

    try {
      const res = await fetch(`/api/v1/inbound-orders/${params.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (data.success) {
        alert('入库单已取消');
        fetchOrder();
      } else {
        alert(data.message || '取消失败');
      }
    } catch (error) {
      console.error('Failed to cancel:', error);
      alert('取消失败');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="text-center py-8">加载中...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto py-6 px-4">
        <Card>
          <CardContent className="py-8 text-center">
            入库单不存在
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      {/* 返回按钮 */}
      <Button variant="ghost" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        返回
      </Button>

      {/* 基本信息 */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl mb-2">
                {order.inboundNo}
              </CardTitle>
              <div className="flex gap-4">
                <Badge className={STATUS_COLORS[order.status]}>
                  {INBOUND_STATUS[order.status]}
                </Badge>
                <Badge variant="outline">
                  {INBOUND_TYPE[order.type]}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              {order.status === 'PENDING' && (
                <>
                  <Button onClick={handleConfirm}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    确认入库
                  </Button>
                  <Button variant="destructive" onClick={handleCancel}>
                    <XCircle className="mr-2 h-4 w-4" />
                    取消
                  </Button>
                </>
              )}
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                导出
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-500">供应商</div>
              <div className="font-medium">
                {order.supplier?.companyName || '-'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">仓库</div>
              <div className="font-medium">
                {order.warehouse?.name || '-'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">关联采购单</div>
              <div className="font-medium">
                {order.purchaseOrder?.orderNo || '-'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">预计入库日期</div>
              <div className="font-medium">
                {order.expectedDate 
                  ? new Date(order.expectedDate).toLocaleDateString('zh-CN')
                  : '-'
                }
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">实际入库日期</div>
              <div className="font-medium">
                {order.actualDate 
                  ? new Date(order.actualDate).toLocaleDateString('zh-CN')
                  : '-'
                }
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">总金额</div>
              <div className="font-medium">
                ¥{Number(order.totalAmount).toFixed(2)}
              </div>
            </div>
            {order.note && (
              <div className="col-span-3">
                <div className="text-sm text-gray-500">备注</div>
                <div className="font-medium">{order.note}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 商品明细 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>商品明细</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商品名称</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>批次号</TableHead>
                <TableHead className="text-right">预计数量</TableHead>
                <TableHead className="text-right">实际数量</TableHead>
                <TableHead className="text-right">单价</TableHead>
                <TableHead className="text-right">金额</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.product.name}</TableCell>
                  <TableCell>{item.product.sku}</TableCell>
                  <TableCell>{item.batchNo || '-'}</TableCell>
                  <TableCell className="text-right">
                    {item.expectedQuantity}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={item.actualQuantity >= item.expectedQuantity ? 'default' : 'secondary'}>
                      {item.actualQuantity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    ¥{Number(item.unitPrice).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    ¥{Number(item.amount).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 库存流水 */}
      {order.inventoryLogs && order.inventoryLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>库存流水</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>类型</TableHead>
                  <TableHead>数量</TableHead>
                  <TableHead>时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.inventoryLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.type}</TableCell>
                    <TableCell>{log.quantity}</TableCell>
                    <TableCell>
                      {new Date(log.createdAt).toLocaleString('zh-CN')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
