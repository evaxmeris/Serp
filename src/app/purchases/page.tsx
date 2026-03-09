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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface PurchaseOrder {
  id: string;
  poNo: string;
  supplierId: string;
  supplier: {
    id: string;
    companyName: string;
    contactName: string | null;
  };
  status: string;
  currency: string;
  totalAmount: number;
  deliveryDate: string | null;
  paymentTerms: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    receivedQty: number;
    unitPrice: number;
    amount: number;
  }>;
}

interface Supplier {
  id: string;
  companyName: string;
  contactName: string | null;
}

const PURCHASE_STATUS: Record<string, string> = {
  PENDING: '待确认',
  CONFIRMED: '已确认',
  IN_PRODUCTION: '生产中',
  READY: '待收货',
  RECEIVED: '已收货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  IN_PRODUCTION: 'bg-purple-100 text-purple-800',
  READY: 'bg-green-100 text-green-800',
  RECEIVED: 'bg-indigo-100 text-indigo-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newPurchase, setNewPurchase] = useState({
    supplierId: '',
    currency: 'CNY',
    deliveryDate: '',
    paymentTerms: '',
    notes: '',
  });
  const [purchaseItems, setPurchaseItems] = useState<Array<{
    productId: string;
    productName: string;
    specification: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    notes: string;
  }>>([]);

  useEffect(() => {
    fetchPurchases();
    fetchSuppliers();
  }, [search, statusFilter]);

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter);
      
      const res = await fetch(`/api/purchases?${params.toString()}`);
      const data = await res.json();
      setPurchases(data.data || []);
    } catch (error) {
      console.error('Failed to fetch purchases:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers');
      const result: any = await res.json();
      const suppliersData = Array.isArray(result?.data)
        ? result?.data
        : result?.data?.items || [];
      setSuppliers(suppliersData);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }
  };

  const handleAddItem = () => {
    setPurchaseItems([
      ...purchaseItems,
      {
        productId: '',
        productName: '',
        specification: '',
        quantity: 1,
        unitPrice: 0,
        amount: 0,
        notes: '',
      },
    ]);
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const newItems = [...purchaseItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Auto-calculate amount
    if (field === 'quantity' || field === 'unitPrice') {
      newItems[index].amount = newItems[index].quantity * newItems[index].unitPrice;
    }
    
    setPurchaseItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return purchaseItems.reduce((sum, item) => sum + item.amount, 0);
  };

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newPurchase,
          totalAmount: calculateTotal(),
          items: purchaseItems,
        }),
      });

      if (res.ok) {
        setIsCreateDialogOpen(false);
        setNewPurchase({
          supplierId: '',
          currency: 'CNY',
          deliveryDate: '',
          paymentTerms: '',
          notes: '',
        });
        setPurchaseItems([]);
        fetchPurchases();
      }
    } catch (error) {
      console.error('Failed to create purchase order:', error);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">采购管理</CardTitle>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>新增采购单</Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>新增采购单</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">供应商 *</label>
                      <Select
                        value={newPurchase.supplierId}
                        onValueChange={(value) =>
                          setNewPurchase({ ...newPurchase, supplierId: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择供应商" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.isArray(suppliers) && suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.companyName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">币种</label>
                      <Select
                        value={newPurchase.currency}
                        onValueChange={(value) =>
                          setNewPurchase({ ...newPurchase, currency: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CNY">CNY - 人民币</SelectItem>
                          <SelectItem value="USD">USD - 美元</SelectItem>
                          <SelectItem value="EUR">EUR - 欧元</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">交货日期</label>
                      <Input
                        type="date"
                        value={newPurchase.deliveryDate}
                        onChange={(e) =>
                          setNewPurchase({ ...newPurchase, deliveryDate: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">付款条件</label>
                      <Input
                        placeholder="月结 30 天等"
                        value={newPurchase.paymentTerms}
                        onChange={(e) =>
                          setNewPurchase({ ...newPurchase, paymentTerms: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">采购明细</label>
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>产品名称</TableHead>
                            <TableHead>规格</TableHead>
                            <TableHead className="w-24">数量</TableHead>
                            <TableHead className="w-32">单价</TableHead>
                            <TableHead className="w-32">金额</TableHead>
                            <TableHead className="w-16"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {purchaseItems.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Input
                                  placeholder="产品名称"
                                  value={item.productName}
                                  onChange={(e) =>
                                    handleUpdateItem(index, 'productName', e.target.value)
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  placeholder="规格"
                                  value={item.specification}
                                  onChange={(e) =>
                                    handleUpdateItem(index, 'specification', e.target.value)
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    handleUpdateItem(index, 'quantity', parseInt(e.target.value) || 0)
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={(e) =>
                                    handleUpdateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <span className="font-medium">
                                  {typeof item.amount === 'number' ? item.amount.toFixed(2) : Number(item.amount || 0).toFixed(2)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveItem(index)}
                                >
                                  删除
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddItem}
                      className="mt-2"
                    >
                      + 添加产品
                    </Button>
                  </div>

                  <div className="flex justify-end">
                    <div className="text-right">
                      <span className="text-lg font-semibold">总计：{newPurchase.currency} </span>
                      <span className="text-2xl font-bold">{typeof calculateTotal() === 'number' ? calculateTotal().toFixed(2) : Number(calculateTotal() || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">备注</label>
                    <Input
                      placeholder="备注信息"
                      value={newPurchase.notes}
                      onChange={(e) =>
                        setNewPurchase({ ...newPurchase, notes: e.target.value })
                      }
                    />
                  </div>
                </div>
                <Button onClick={handleCreate} className="w-full">
                  创建采购单
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Input
              placeholder="搜索采购单号/供应商..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部状态</SelectItem>
                {Object.entries(PURCHASE_STATUS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>采购单号</TableHead>
                  <TableHead>供应商</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>交货日期</TableHead>
                  <TableHead>付款条件</TableHead>
                  <TableHead>创建时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell className="font-medium">{purchase.poNo}</TableCell>
                    <TableCell>{purchase.supplier.companyName}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[purchase.status] || 'bg-gray-100'}>
                        {PURCHASE_STATUS[purchase.status] || purchase.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{purchase.currency} {typeof purchase.totalAmount === 'number' ? purchase.totalAmount.toFixed(2) : Number(purchase.totalAmount || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      {purchase.deliveryDate
                        ? new Date(purchase.deliveryDate).toLocaleDateString('zh-CN')
                        : '-'}
                    </TableCell>
                    <TableCell>{purchase.paymentTerms || '-'}</TableCell>
                    <TableCell>
                      {new Date(purchase.createdAt).toLocaleDateString('zh-CN')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {purchases.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              暂无采购数据
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
