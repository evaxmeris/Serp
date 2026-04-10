'use client';

import { useParams, useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useOrder, useUpdateOrder } from '@/hooks/use-orders';
import { orderFormSchema, type OrderFormValues } from '@/lib/schemas/order-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ArrowLeft, Plus, Trash2, Calculator, Save } from 'lucide-react';
import { useEffect } from 'react';
import { getIncotermOptions, getPaymentTermOptions } from '@/lib/trade-terms';

export default function EditOrderPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: order, isLoading } = useOrder(id);
  const updateOrder = useUpdateOrder();

  const incotermOptions = getIncotermOptions();
  const paymentTermOptions = getPaymentTermOptions();

  const form = useForm<OrderFormValues>();

  // 加载订单数据时填充表单
  useEffect(() => {
    if (order) {
      form.reset({
        customerId: order.customerId,
        currency: order.currency,
        exchangeRate: order.exchangeRate,
        paymentTerms: order.paymentTerms || '',
        deliveryTerms: order.deliveryTerms || '',
        deliveryDate: order.deliveryDate ? order.deliveryDate.split('T')[0] : '',
        shippingAddress: order.shippingAddress || '',
        shippingContact: order.shippingContact || '',
        shippingPhone: order.shippingPhone || '',
        salesRepId: order.salesRepId || '',
        notes: order.notes || '',
        internalNotes: order.internalNotes || '',
        items: order.items.map((item) => ({
          productId: item.productId || '',
          productName: item.productName,
          productSku: item.productSku || '',
          specification: item.specification || '',
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          discountRate: item.discountRate,
          notes: item.notes || '',
        })),
      });
    }
  }, [order, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  // 计算总金额
  const items = form.watch('items') || [];
  const currency = form.watch('currency') || 'USD';
  const totalAmount = items.reduce((sum, item) => {
    const discount = item.discountRate || 0;
    const itemAmount = (item.quantity || 0) * (item.unitPrice || 0) * (1 - (discount || 0) / 100);
    return sum + itemAmount;
  }, 0);

  const onSubmit = (data: OrderFormValues) => {
    const orderData: any = {
      ...data,
      items: data.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discountRate: Number(item.discountRate || 0),
      })),
    };

    updateOrder.mutate(
      { id, data: orderData },
      {
        onSuccess: () => {
          alert('订单更新成功');
          router.push(`/orders/${id}`);
        },
        onError: (err: any) => {
          alert(err.message);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-8">加载中...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-red-500">订单不存在</p>
            <Button onClick={() => router.push('/orders')} className="mt-4">
              返回订单列表
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 已确认或更高级状态的订单只能编辑部分字段
  const isReadOnly = ['CONFIRMED', 'IN_PRODUCTION', 'READY', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(order.status);

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => router.push(`/orders/${id}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </Button>
        <h1 className="text-2xl font-bold">编辑订单 {order.orderNo}</h1>
        {isReadOnly && (
          <span className="text-sm text-yellow-600 bg-yellow-100 px-3 py-1 rounded">
            只读模式：订单已确认，仅可编辑备注信息
          </span>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-6">
            {/* 基本信息 */}
            <Card>
              <CardHeader>
                <CardTitle>基本信息</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>客户</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={order.customer.id}>{order.customer.companyName}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>币种</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="USD">USD - 美元</SelectItem>
                            <SelectItem value="EUR">EUR - 欧元</SelectItem>
                            <SelectItem value="CNY">CNY - 人民币</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="paymentTerms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>付款条件</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择付款方式" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">不指定</SelectItem>
                            {paymentTermOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="deliveryTerms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>交货条款</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择贸易术语" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">不指定</SelectItem>
                            {incotermOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="deliveryDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>交货日期</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} disabled={isReadOnly} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <FormField
                    control={form.control}
                    name="shippingAddress"
                    render={({ field }) => (
                      <FormItem className="md:col-span-3">
                        <FormLabel>收货地址</FormLabel>
                        <FormControl>
                          <Textarea placeholder="详细收货地址" {...field} disabled={isReadOnly} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="shippingContact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>收货联系人</FormLabel>
                        <FormControl>
                          <Input placeholder="联系人姓名" {...field} disabled={isReadOnly} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="shippingPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>联系电话</FormLabel>
                        <FormControl>
                          <Input placeholder="联系电话" {...field} disabled={isReadOnly} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 商品明细 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>商品明细</CardTitle>
                  {!isReadOnly && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        append({
                          productId: '',
                          productName: '',
                          productSku: '',
                          specification: '',
                          quantity: 1,
                          unit: 'PCS',
                          unitPrice: 0,
                          discountRate: 0,
                          notes: '',
                        })
                      }
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      添加商品
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">产品</TableHead>
                      <TableHead>规格</TableHead>
                      <TableHead className="w-24">数量</TableHead>
                      <TableHead className="w-32">单价</TableHead>
                      <TableHead className="w-24">折扣 %</TableHead>
                      <TableHead className="w-32 text-right">金额</TableHead>
                      {!isReadOnly && <TableHead className="w-16"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => (
                      <TableRow key={field.id}>
                        <TableCell>
                          <Controller
                            control={form.control}
                            name={`items.${index}.productName`}
                            render={({ field }) => (
                              <Input placeholder="产品名称" {...field} disabled={isReadOnly} />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Controller
                            control={form.control}
                            name={`items.${index}.specification`}
                            render={({ field }) => (
                              <Input placeholder="规格" {...field} disabled={isReadOnly} />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Controller
                            control={form.control}
                            name={`items.${index}.quantity`}
                            render={({ field }) => (
                              <Input
                                type="number"
                                min="1"
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                                disabled={isReadOnly}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Controller
                            control={form.control}
                            name={`items.${index}.unitPrice`}
                            render={({ field }) => (
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                                disabled={isReadOnly}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Controller
                            control={form.control}
                            name={`items.${index}.discountRate`}
                            render={({ field }) => (
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                                disabled={isReadOnly}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {currency}{' '}
                          {(
                            ((form.watch(`items.${index}.quantity`) as number) || 0) *
                            ((form.watch(`items.${index}.unitPrice`) as number) || 0) *
                            (1 - (((form.watch(`items.${index}.discountRate`) as number) || 0) / 100))
                          ).toFixed(2)}
                        </TableCell>
                        {!isReadOnly && (
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => remove(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="mt-4 flex justify-end items-center gap-4">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Calculator className="w-4 h-4" />
                    <span>共 {items.length} 项商品</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-semibold">总计：{currency} </span>
                    <span className="text-2xl font-bold">{totalAmount.toFixed(2)}</span>
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
                <div className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>备注（客户可见）</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="给客户的备注信息"
                            className="min-h-[80px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="internalNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>内部备注</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="内部备注，客户不可见"
                            className="min-h-[80px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 提交按钮 */}
            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => router.push(`/orders/${id}`)}>
                取消
              </Button>
              <Button type="submit" disabled={updateOrder.isPending}>
                <Save className="w-4 h-4 mr-2" />
                {updateOrder.isPending ? '保存中...' : '保存修改'}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
