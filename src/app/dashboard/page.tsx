'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { DollarSign, BarChart3, Package } from 'lucide-react';

interface DashboardData {
  sales: {
    totalOrders: number;
    totalRevenue: number;
    avgOrderValue: number;
    activeCustomers: number;
    growth: number;
  };
  customers: {
    totalCustomers: number;
    newCustomers: number;
    activeCustomers: number;
  };
  products: {
    totalProducts: number;
    activeProducts: number;
    newProducts: number;
  };
  conversion: {
    totalInquiries: number;
    totalQuotations: number;
    totalOrders: number;
    inquiryToQuotationRate: number;
    quotationToOrderRate: number;
  };
  alerts: {
    lowStockItems: number;
    pendingOrders: number;
  };
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    fetchDashboardData();
  }, [period]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dashboard/overview?days=${period}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Data Dashboard</h1>
          <p className="text-muted-foreground">Overview of your business metrics</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data?.sales.totalRevenue || 0)}</div>
            <p className={`text-xs ${data?.sales.growth && data.sales.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data?.sales.growth && data.sales.growth >= 0 ? '+' : ''}{data?.sales.growth || 0}% from previous period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data?.sales.totalOrders || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Avg: {formatCurrency(data?.sales.avgOrderValue || 0)} per order
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data?.sales.activeCustomers || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(data?.customers.newCustomers || 0)} new this period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.conversion.quotationToOrderRate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              Quote to Order
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sales Metrics</CardTitle>
              <CardDescription>Detailed sales performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="text-lg font-semibold">Order Statistics</h3>
                  <div className="mt-2 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Orders</span>
                      <span className="font-medium">{formatNumber(data?.sales.totalOrders || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Revenue</span>
                      <span className="font-medium">{formatCurrency(data?.sales.totalRevenue || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Average Order Value</span>
                      <span className="font-medium">{formatCurrency(data?.sales.avgOrderValue || 0)}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Conversion Funnel</h3>
                  <div className="mt-2 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Inquiries</span>
                      <span className="font-medium">{formatNumber(data?.conversion.totalInquiries || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Quotations</span>
                      <span className="font-medium">{formatNumber(data?.conversion.totalQuotations || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Orders</span>
                      <span className="font-medium">{formatNumber(data?.conversion.totalOrders || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Inquiry → Quotation</span>
                      <span className="font-medium">{data?.conversion.inquiryToQuotationRate || 0}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Quotation → Order</span>
                      <span className="font-medium">{data?.conversion.quotationToOrderRate || 0}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Metrics</CardTitle>
              <CardDescription>Customer base overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <h3 className="text-lg font-semibold">Total Customers</h3>
                  <p className="text-3xl font-bold mt-2">{formatNumber(data?.customers.totalCustomers || 0)}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">New Customers</h3>
                  <p className="text-3xl font-bold mt-2 text-green-600">{formatNumber(data?.customers.newCustomers || 0)}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Active Customers</h3>
                  <p className="text-3xl font-bold mt-2">{formatNumber(data?.customers.activeCustomers || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Product Metrics</CardTitle>
              <CardDescription>Product portfolio overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <h3 className="text-lg font-semibold">Total Products</h3>
                  <p className="text-3xl font-bold mt-2">{formatNumber(data?.products.totalProducts || 0)}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Active Products</h3>
                  <p className="text-3xl font-bold mt-2 text-green-600">{formatNumber(data?.products.activeProducts || 0)}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">New Products</h3>
                  <p className="text-3xl font-bold mt-2">{formatNumber(data?.products.newProducts || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alerts & Notifications</CardTitle>
              <CardDescription>Items requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <Card className={data?.alerts.lowStockItems ? 'border-red-500' : ''}>
                  <CardHeader>
                    <CardTitle className="text-red-600">Low Stock Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{data?.alerts.lowStockItems || 0}</p>
                    <p className="text-sm text-muted-foreground">Products below minimum stock level</p>
                  </CardContent>
                </Card>
                <Card className={data?.alerts.pendingOrders ? 'border-yellow-500' : ''}>
                  <CardHeader>
                    <CardTitle className="text-yellow-600">Pending Orders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{data?.alerts.pendingOrders || 0}</p>
                    <p className="text-sm text-muted-foreground">Orders awaiting processing</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 财务报表快捷入口 */}
      <Card className="border-2 border-purple-200 bg-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            📊 财务报表中心（✅ 已上线）
          </CardTitle>
          <CardDescription>
            快速访问常用财务报表，全面掌握企业经营状况
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 bg-white hover:bg-purple-100" asChild>
              <Link href="/reports/profit">
                <DollarSign className="h-8 w-8 text-purple-600" />
                <div className="text-sm font-medium">利润报表</div>
                <p className="text-xs text-muted-foreground text-center">分析企业利润状况</p>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 bg-white hover:bg-purple-100" asChild>
              <Link href="/reports/sales">
                <BarChart3 className="h-8 w-8 text-purple-600" />
                <div className="text-sm font-medium">销售报表</div>
                <p className="text-xs text-muted-foreground text-center">查看销售数据分析</p>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 bg-white hover:bg-purple-100" asChild>
              <Link href="/reports/inventory">
                <Package className="h-8 w-8 text-purple-600" />
                <div className="text-sm font-medium">库存报表</div>
                <p className="text-xs text-muted-foreground text-center">监控库存周转情况</p>
              </Link>
            </Button>
          </div>
          <div className="mt-4 flex items-center justify-center">
            <Button variant="default" className="bg-purple-600 hover:bg-purple-700" asChild>
              <Link href="/reports">
                进入报表中心 →
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
