'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  costPrice: number;
}

interface Supplier {
  id: string;
  companyName: string;
}

interface OrderItem {
  productId: string;
  expectedQuantity: number;
  unitPrice: number;
  batchNo?: string;
}

export default function NewInboundOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  const [formData, setFormData] = useState({
    type: 'PURCHASE_IN',
    supplierId: '',
    warehouseId: 'default',
    expectedDate: '',
    note: '',
  });

  const [items, setItems] = useState<OrderItem[]>([
    { productId: '', expectedQuantity: 1, unitPrice: 0 },
  ]);

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/v1/products?limit=100');
      const data = await res.json();
      if (data.success) {
        setProducts(data.data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/v1/suppliers?limit=100&status=ACTIVE');
      const data = await res.json();
      if (data.success) {
        setSuppliers(data.data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }
  };

  const addItem = () => {
    setItems([...items, { productId: '', expectedQuantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        expectedDate: formData.expectedDate ? new Date(formData.expectedDate).toISOString() : undefined,
        items: items.map(item => ({
          ...item,
          expectedQuantity: Number(item.expectedQuantity),
          unitPrice: Number(item.unitPrice),
        })),
      };

      const res = await fetch('/api/v1/inbound-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        alert('入库单创建成功');
        router.push(`/inbound-orders/${data.data.id}`);
      } else {
        alert(data.message || '创建失败');
      }
    } catch (error) {
      console.error('Failed to create order:', error);
      alert('创建失败');
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = items.reduce((sum, item) => {
    return sum + (item.expectedQuantity * item.unitPrice);
  }, 0);

  return (
    <div className="container mx-auto py-6 px-4">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        返回
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">创建入库单</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <Label>入库类型 *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PURCHASE_IN">采购入库</SelectItem>
                    <SelectItem value="RETURN_IN">退货入库</SelectItem>
                    <SelectItem value="ADJUSTMENT_IN">调拨入库</SelectItem>
                    <SelectItem value="TRANSFER_IN">转仓入库</SelectItem>
                    <SelectItem value="OTHER_IN">其他入库</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>供应商</Label>
                <Select
                  value={formData.supplierId}
                  onValueChange={(value) => setFormData({ ...formData, supplierId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择供应商" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>预计入库日期</Label>
                <Input
                  type="date"
                  value={formData.expectedDate}
                  onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
                />
              </div>

              <div>
                <Label>备注</Label>
                <Input
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  placeholder="备注信息"
                />
              </div>
            </div>

            {/* 商品明细 */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <Label>商品明细 *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  添加商品
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">商品</TableHead>
                    <TableHead className="w-[120px]">数量</TableHead>
                    <TableHead className="w-[120px]">单价</TableHead>
                    <TableHead className="w-[150px]">批次号</TableHead>
                    <TableHead className="w-[100px] text-right">金额</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Select
                          value={item.productId}
                          onValueChange={(value) => updateItem(index, 'productId', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择商品" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name} ({product.sku})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={item.expectedQuantity}
                          onChange={(e) => updateItem(index, 'expectedQuantity', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(index, 'unitPrice', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.batchNo || ''}
                          onChange={(e) => updateItem(index, 'batchNo', e.target.value)}
                          placeholder="批次号"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        ¥{(item.expectedQuantity * item.unitPrice).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-end mt-4">
                <div className="text-lg font-semibold">
                  总计：¥{totalAmount.toFixed(2)}
                </div>
              </div>
            </div>

            {/* 提交按钮 */}
            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                取消
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? '创建中...' : '创建入库单'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
