'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, Calculator } from 'lucide-react';

const formSchema = z.object({
  supplierId: z.string().min(1, '请选择供应商'),
  currency: z.string().optional(),
  exchangeRate: z.number().positive().optional(),
  deliveryDate: z.string().optional(),
  deliveryDeadline: z.string().optional(),
  deliveryAddress: z.string().optional(),
  shippingMethod: z.string().optional(),
  paymentTerms: z.string().optional(),
  paymentDeadline: z.string().optional(),
  purchaserId: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string().optional(),
      productName: z.string().min(1, '请输入产品名称'),
      productSku: z.string().optional(),
      specification: z.string().optional(),
      unit: z.string().optional(),
      quantity: z.number().int().positive('数量必须为正整数'),
      unitPrice: z.number().nonnegative('单价不能为负数'),
      discountRate: z.number().min(0).max(100).optional(),
      taxRate: z.number().min(0).max(100).optional(),
      expectedDeliveryDate: z.string().optional(),
      notes: z.string().optional(),
    })
  ).min(1, '请至少添加一项商品'),
});

type FormValues = z.infer<typeof formSchema>;

interface Supplier {
  id: string;
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  currency?: string;
  creditTerms?: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  specification?: string;
  unit: string;
  costPrice: number;
  salePrice: number;
}

export default function CreatePurchaseOrderPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState({
    subtotal: 0,
    tax: 0,
    total: 0,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplierId: '',
      currency: 'CNY',
      exchangeRate: 1,
      deliveryDate: '',
      deliveryDeadline: '',
      deliveryAddress: '',
      shippingMethod: '',
      paymentTerms: '',
      paymentDeadline: '',
      purchaserId: '',
      notes: '',
      internalNotes: '',
      items: [
        {
          productName: '',
          productSku: '',
          specification: '',
          unit: 'PCS',
          quantity: 1,
          unitPrice: 0,
          discountRate: 0,
          taxRate: 0,
          notes: '',
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
  }, []);

  useEffect(() => {
    calculateTotals();
  }, [form.watch('items'), form.watch('currency'), form.watch('exchangeRate')]);

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/v1/suppliers?limit=100&status=ACTIVE');
      const result: any = await res.json();
      const suppliersData = Array.isArray(result?.data)
        ? result?.data
        : result?.data?.items || [];
      setSuppliers(suppliersData);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products?limit=100');
      const data = await res.json();
      setProducts(data.data?.items ?? data.data ?? []);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const calculateTotals = () => {
    const items = form.getValues('items');
    let subtotal = 0;
    let tax = 0;

    items.forEach((item) => {
      const amount = item.quantity * item.unitPrice * (1 - (item.discountRate || 0) / 100);
      const itemTax = amount * ((item.taxRate || 0) / 100);
      subtotal += amount;
      tax += itemTax;
    });

    setTotals({
      subtotal,
      tax,
      total: subtotal + tax,
    });
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      form.setValue(`items.${index}.productId`, product.id);
      form.setValue(`items.${index}.productName`, product.name);
      form.setValue(`items.${index}.productSku`, product.sku);
      form.setValue(`items.${index}.specification`, product.specification || '');
      form.setValue(`items.${index}.unit`, product.unit);
      form.setValue(`items.${index}.unitPrice`, Number(product.costPrice) || 0);
    }
  };

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (res.ok) {
        router.push('/purchase-orders');
      } else {
        form.setError('root', {
          message: result.message || '创建采购订单失败',
        });
      }
    } catch (error) {
      form.setError('root', {
        message: '创建采购订单失败，请重试',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">创建采购订单</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Supplier Selection */}
          <Card>
            <CardHeader>
              <CardTitle>供应商信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>供应商 *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择供应商" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.isArray(suppliers) && suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.companyName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>货币</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="CNY">CNY - 人民币</SelectItem>
                          <SelectItem value="USD">USD - 美元</SelectItem>
                          <SelectItem value="EUR">EUR - 欧元</SelectItem>
                          <SelectItem value="GBP">GBP - 英镑</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="exchangeRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>汇率</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.0001"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Items */}
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
                      productName: '',
                      productSku: '',
                      specification: '',
                      unit: 'PCS',
                      quantity: 1,
                      unitPrice: 0,
                      discountRate: 0,
                      taxRate: 0,
                      notes: '',
                    })
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  添加商品
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">商品 {index + 1}</h3>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name={`items.${index}.productId`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>产品</FormLabel>
                            <Select
                              onValueChange={(value) => handleProductSelect(index, value)}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="选择产品" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {products.map((product) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    {product.name} ({product.sku})
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
                        name={`items.${index}.productName`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>产品名称 *</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.productSku`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SKU</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.specification`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>规格</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.unit`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>单位</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="PCS">PCS - 件</SelectItem>
                                <SelectItem value="SET">SET - 套</SelectItem>
                                <SelectItem value="KG">KG - 千克</SelectItem>
                                <SelectItem value="M">M - 米</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>数量 *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.unitPrice`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>单价 *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.discountRate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>折扣率 (%)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.taxRate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>税率 (%)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name={`items.${index}.notes`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>备注</FormLabel>
                          <FormControl>
                            <Textarea {...field} rows={2} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
              </div>

              {form.formState.errors.items && (
                <div className="text-red-600 text-sm mt-2">
                  {form.formState.errors.items.message}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                金额汇总
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">小计</span>
                  <span className="font-medium">
                    {form.getValues('currency')} {(totals.subtotal ?? 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">税额</span>
                  <span className="font-medium">
                    {form.getValues('currency')} {(totals.tax ?? 0).toFixed(2)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>总计</span>
                  <span>
                    {form.getValues('currency')} {(totals.total ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery & Payment Terms */}
          <Card>
            <CardHeader>
              <CardTitle>交货与付款条款</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  name="deliveryDeadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>最晚交货日期</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="deliveryAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>交货地址</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="shippingMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>运输方式</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="如：海运/空运/陆运" />
                      </FormControl>
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
                        <Input {...field} placeholder="如：T/T 30% 定金" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="paymentDeadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>付款截止日期</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>备注</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>备注（对客户可见）</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
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
                      <Textarea {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Submit */}
          {form.formState.errors.root && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg">
              {form.formState.errors.root.message}
            </div>
          )}

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '创建中...' : '创建采购订单'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
