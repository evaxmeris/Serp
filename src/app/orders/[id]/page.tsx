'use client';

import { useParams, useRouter } from 'next/navigation';
import { useOrder, useConfirmOrder, useCancelOrder, useDeleteOrder } from '@/hooks/use-orders';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  Edit,
  CheckCircle,
  XCircle,
  Trash2,
  Package,
  DollarSign,
  Clock,
  FileText,
} from 'lucide-react';
import { ORDER_STATUS_CONFIG, APPROVAL_STATUS_CONFIG } from '@/types/order';
import { useState } from 'react';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: order, isLoading, error } = useOrder(id);
  const confirmOrder = useConfirmOrder();
  const cancelOrder = useCancelOrder();
  const deleteOrder = useDeleteOrder();

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const handleConfirm = () => {
    confirmOrder.mutate(
      { id },
      {
        onSuccess: () => {
          alert('订单已确认');
        },
        onError: (err) => {
          alert(err.message);
        },
      }
    );
  };

  const handleCancel = () => {
    if (!cancelReason.trim()) {
      alert('请填写取消原因');
      return;
    }
    cancelOrder.mutate(
      { id, cancelReason },
      {
        onSuccess: () => {
          setCancelDialogOpen(false);
          setCancelReason('');
          alert('订单已取消');
        },
        onError: (err) => {
          alert(err.message);
        },
      }
    );
  };

  const handleDelete = () => {
    if (!confirm('确定要删除此订单吗？此操作不可恢复。')) {
      return;
    }
    deleteOrder.mutate(id, {
      onSuccess: () => {
        router.push('/orders');
      },
      onError: (err) => {
        alert(err.message);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-8">加载中...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-red-500">订单不存在或加载失败</p>
            <Button onClick={() => router.push('/orders')} className="mt-4">
              返回订单列表
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = ORDER_STATUS_CONFIG[order.status];
  const approvalConfig = APPROVAL_STATUS_CONFIG[order.approvalStatus];

  return (
    <div className="container mx-auto py-8">
      {/* 头部操作区 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/orders')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{order.orderNo}</h1>
            <p className="text-sm text-gray-500">创建于 {new Date(order.createdAt).toLocaleDateString('zh-CN')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
          <Badge variant="outline" className={approvalConfig.color}>{approvalConfig.label}</Badge>
          
          {order.status === 'PENDING' && (
            <>
              <Button onClick={handleConfirm} className="ml-2">
                <CheckCircle className="w-4 h-4 mr-2" />
                确认订单
              </Button>
              <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <XCircle className="w-4 h-4 mr-2" />
                    取消订单
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>取消订单</DialogTitle>
                  </DialogHeader>
                  <div className="py-4">
                    <Label>取消原因 *</Label>
                    <Textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="请说明取消原因"
                      className="mt-2"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
                      取消
                    </Button>
                    <Button variant="destructive" onClick={handleCancel}>
                      确认取消
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button variant="ghost" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                删除
              </Button>
            </>
          )}

          <Button variant="outline" onClick={() => router.push(`/orders/${id}/edit`)}>
            <Edit className="w-4 h-4 mr-2" />
            编辑
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* 基本信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              订单基本信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">客户</p>
                <p className="font-medium">{order.customer.companyName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">订单金额</p>
                <p className="font-medium">{order.currency} {order.totalAmount.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">已付金额</p>
                <p className="font-medium">{order.currency} {order.paidAmount.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">余额</p>
                <p className="font-medium">{order.currency} {order.balanceAmount.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">付款条件</p>
                <p className="font-medium">{order.paymentTerms || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">交货条款</p>
                <p className="font-medium">{order.deliveryTerms || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">交货日期</p>
                <p className="font-medium">
                  {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('zh-CN') : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">业务员</p>
                <p className="font-medium">{order.salesRep?.name || '-'}</p>
              </div>
            </div>
            {order.shippingAddress && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500">收货地址</p>
                <p className="font-medium">{order.shippingAddress}</p>
                {order.shippingContact && (
                  <p className="text-sm mt-1">联系人：{order.shippingContact} {order.shippingPhone && `(${order.shippingPhone})`}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 商品列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              商品明细
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>产品名称</TableHead>
                  <TableHead>规格</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead className="text-right">单价</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                  <TableHead>生产状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell>{item.specification || '-'}</TableCell>
                    <TableCell>{item.productSku || '-'}</TableCell>
                    <TableCell className="text-right">{item.quantity} {item.unit}</TableCell>
                    <TableCell className="text-right">{order.currency} {item.unitPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{order.currency} {item.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {item.productionStatus === 'NOT_STARTED' && '未开始'}
                        {item.productionStatus === 'IN_PROGRESS' && '生产中'}
                        {item.productionStatus === 'COMPLETED' && '已完成'}
                        {item.productionStatus === 'DELAYED' && '延期'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex justify-end">
              <div className="text-right">
                <span className="text-lg font-semibold">总计：{order.currency} </span>
                <span className="text-2xl font-bold">{order.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 收款记录 */}
        {order.payments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                收款记录
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>收款单号</TableHead>
                    <TableHead>金额</TableHead>
                    <TableHead>付款方式</TableHead>
                    <TableHead>收款日期</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.paymentNo}</TableCell>
                      <TableCell>{payment.currency} {payment.amount.toFixed(2)}</TableCell>
                      <TableCell>{payment.paymentMethod || '-'}</TableCell>
                      <TableCell>
                        {payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('zh-CN') : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {payment.status === 'PENDING' && '待处理'}
                          {payment.status === 'PROCESSING' && '处理中'}
                          {payment.status === 'COMPLETED' && '已完成'}
                          {payment.status === 'FAILED' && '失败'}
                          {payment.status === 'CANCELLED' && '已取消'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* 发货记录 */}
        {order.shipments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                发货记录
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>发货单号</TableHead>
                    <TableHead>承运商</TableHead>
                    <TableHead>追踪号</TableHead>
                    <TableHead>ETD</TableHead>
                    <TableHead>ETA</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.shipments.map((shipment) => (
                    <TableRow key={shipment.id}>
                      <TableCell className="font-medium">{shipment.shipmentNo}</TableCell>
                      <TableCell>{shipment.carrier || '-'}</TableCell>
                      <TableCell>{shipment.trackingNo || '-'}</TableCell>
                      <TableCell>
                        {shipment.etd ? new Date(shipment.etd).toLocaleDateString('zh-CN') : '-'}
                      </TableCell>
                      <TableCell>
                        {shipment.eta ? new Date(shipment.eta).toLocaleDateString('zh-CN') : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {shipment.status === 'PENDING' && '待发货'}
                          {shipment.status === 'BOOKED' && '已订舱'}
                          {shipment.status === 'IN_TRANSIT' && '运输中'}
                          {shipment.status === 'SHIPPED' && '已发货'}
                          {shipment.status === 'DELIVERED' && '已送达'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* 生产记录 */}
        {order.productionRecords.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                生产记录
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>生产单号</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>进度</TableHead>
                    <TableHead>计划开始</TableHead>
                    <TableHead>计划结束</TableHead>
                    <TableHead>实际开始</TableHead>
                    <TableHead>实际结束</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.productionRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.productionNo}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {record.status === 'PLANNED' && '已计划'}
                          {record.status === 'IN_PROGRESS' && '进行中'}
                          {record.status === 'COMPLETED' && '已完成'}
                          {record.status === 'ON_HOLD' && '暂停'}
                          {record.status === 'CANCELLED' && '已取消'}
                        </Badge>
                      </TableCell>
                      <TableCell>{record.progress}%</TableCell>
                      <TableCell>
                        {record.plannedStartDate ? new Date(record.plannedStartDate).toLocaleDateString('zh-CN') : '-'}
                      </TableCell>
                      <TableCell>
                        {record.plannedEndDate ? new Date(record.plannedEndDate).toLocaleDateString('zh-CN') : '-'}
                      </TableCell>
                      <TableCell>
                        {record.actualStartDate ? new Date(record.actualStartDate).toLocaleDateString('zh-CN') : '-'}
                      </TableCell>
                      <TableCell>
                        {record.actualEndDate ? new Date(record.actualEndDate).toLocaleDateString('zh-CN') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* 质检记录 */}
        {order.qualityChecks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>质检记录</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>质检单号</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>检验日期</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.qualityChecks.map((check) => (
                    <TableRow key={check.id}>
                      <TableCell className="font-medium">{check.qcNo}</TableCell>
                      <TableCell>
                        {check.type === 'RAW_MATERIAL' && '来料检验'}
                        {check.type === 'IN_PROCESS' && '过程检验'}
                        {check.type === 'FINAL' && '最终检验'}
                        {check.type === 'PRE_SHIPMENT' && '出货前检验'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {check.status === 'PENDING' && '待检验'}
                          {check.status === 'IN_PROGRESS' && '检验中'}
                          {check.status === 'PASSED' && '合格'}
                          {check.status === 'FAILED' && '不合格'}
                          {check.status === 'CONDITIONAL' && '条件接收'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {check.inspectionDate ? new Date(check.inspectionDate).toLocaleDateString('zh-CN') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* 备注 */}
        {order.notes && (
          <Card>
            <CardHeader>
              <CardTitle>备注</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{order.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
