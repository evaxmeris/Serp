'use client';

import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateOrder, useCustomers, useProducts } from '@/hooks/use-orders';
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
import { ArrowLeft, Plus, Trash2, Calculator } from 'lucide-react';
import { useState } from 'react';

export default function CreateOrderPage() {
  const router = useRouter();
  const createOrder = useCreateOrder();
  const { data: customers, isLoading: customersLoading } = useCustomers();
  const { data: products, isLoading: productsLoading } = useProducts();

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      customerId: '',
      currency: 'USD',
      exchangeRate: 1,
      paymentTerms: '',
      deliveryTerms: '',
      deliveryDate: '',
      shippingAddress: '',
      shippingContact: '',
      shippingPhone: '',
      salesRepId: '',
      notes: '',
      internalNotes: '',
      items: [
        {
          productId: '',
          productName: '',
          productSku: '',
          specification: '',
          quantity: 1,
          unit: 'PCS',
          unitPrice: 0,
          discountRate: 0,
          notes: '',
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  // 计算总金额
  const items = form.watch('items');
  const totalAmount = items.reduce((sum, item) => {
    const discount = item.discountRate || 0;
    const itemAmount = (item.quantity || 0) * (item.unitPrice || 0) * (1 - (discount || 0) / 100);
    return sum + itemAmount;
  }, 0);

  // 选择产品时自动填充
  const handleProductSelect = (index: number, productId: string) => {
    const product = products?.find((p) => p.id === productId);
    if (product) {
      form.setValue(`items.${index}.productId`, productId);
      form.setValue(`items.${index}.productName`, product.name);
      form.setValue(`items.${index}.productSku`, product.sku);
      form.setValue(`items.${index}.specification`, product.specification || '');
      form.setValue(`items.${index}.unitPrice`, Number(product.salePrice));
    }
  };

  const onSubmit = (data: OrderFormValues) => {
    const orderData = {
      ...data,
      items: data.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        specification: item.specification,
        quantity: Number(item.quantity),
        unit: item.unit || 'PCS',
        unitPrice: Number(item.unitPrice),
        discountRate: Number(item.discountRate || 0),
        notes: item.notes,
      })),
    };

    createOrder.mutate(orderData as any, {
      onSuccess: () => {
        alert('订单创建成功');
        router.push('/orders');
      },
      onError: (err: any) => {
        alert(err.message);
      },
    });
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => router.push('/orders')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </Button>
        <h1 className="text-2xl font-bold">创建订单</h1>
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
                        <FormLabel>客户 *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择客户" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {customersLoading ? (
                              <SelectItem value="loading">加载中...</SelectItem>
                            ) : (
                              customers?.map((customer) => (
                                <SelectItem key={customer.id} value={customer.id}>
                                  {customer.companyName}
                                </SelectItem>
                              ))
                            )}
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        <FormControl>
                          <Input placeholder="T/T, L/C 等" {...field} />
                        </FormControl>
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
                        <FormControl>
                          <Input placeholder="FOB, CIF, EXW 等" {...field} />
                        </FormControl>
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
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="salesRepId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>业务员</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择业务员" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">未指定</SelectItem>
                          </SelectContent>
                        </Select>
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
                          <Textarea placeholder="详细收货地址" {...field} />
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
                          <Input placeholder="联系人姓名" {...field} />
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
                          <Input placeholder="联系电话" {...field} />
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
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => (
                      <TableRow key={field.id}>
                        <TableCell>
                          <Controller
                            control={form.control}
                            name={`items.${index}.productId`}
                            render={({ field }) => (
                              <Select
                                value={field.value}
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  handleProductSelect(index, value);
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="选择产品" />
                                </SelectTrigger>
                                <SelectContent>
                                  {productsLoading ? (
                                    <SelectItem value="loading">加载中...</SelectItem>
                                  ) : (
                                    products?.map((product) => (
                                      <SelectItem key={product.id} value={product.id}>
                                        {product.name}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Controller
                            control={form.control}
                            name={`items.${index}.specification`}
                            render={({ field }) => (
                              <Input placeholder="规格" {...field} />
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
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {form.watch('currency') || 'USD'}{' '}
                          {(
                            (form.watch(`items.${index}.quantity`) || 0) *
                            (form.watch(`items.${index}.unitPrice`) || 0) *
                            (1 - ((form.watch(`items.${index}.discountRate`) || 0) / 100))
                          ).toFixed(2)}
                        </TableCell>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {items.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    暂无商品，请点击"添加商品"
                  </div>
                )}

                <div className="mt-4 flex justify-end items-center gap-4">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Calculator className="w-4 h-4" />
                    <span>共 {items.length} 项商品</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-semibold">总计：{form.watch('currency') || 'USD'} </span>
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
              <Button type="button" variant="outline" onClick={() => router.push('/orders')}>
                取消
              </Button>
              <Button type="submit" disabled={createOrder.isPending}>
                {createOrder.isPending ? '创建中...' : '创建订单'}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
