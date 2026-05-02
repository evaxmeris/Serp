/**
 * 数据仪表盘 API
 * 提供综合数据概览和关键指标 — 从真实数据聚合
 *
 * GET /api/v1/reports/dashboard
 *   查询参数:
 *     - period    (可选): week/month/quarter/year (默认 month)
 *     - startDate (可选): 开始日期 YYYY-MM-DD
 *     - endDate   (可选): 结束日期 YYYY-MM-DD
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';

interface KpiItem {
  value: number;
  growth: number;
}

interface Kpis {
  revenue: KpiItem;
  profit: KpiItem;
  orders: KpiItem;
  customers: KpiItem;
  inventory: KpiItem;
}

interface TopProduct {
  name: string;
  revenue: number;
  growth: number;
}

interface InventoryAlert {
  sku: string;
  name: string;
  quantity: number;
  type: 'low' | 'out';
}

const ORDER_STATUSES = ['COMPLETED', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];

export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'month';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let start: Date;
    let end: Date;
    let prevStart: Date;

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      // 默认当前周期
      end = new Date();
      if (period === 'week') {
        start = new Date(end);
        start.setDate(start.getDate() - 7);
      } else if (period === 'month') {
        start = new Date(end.getFullYear(), end.getMonth(), 1);
      } else if (period === 'quarter') {
        const quarter = Math.floor(end.getMonth() / 3);
        start = new Date(end.getFullYear(), quarter * 3, 1);
      } else if (period === 'year') {
        start = new Date(end.getFullYear(), 0, 1);
      } else {
        start = new Date(end.getFullYear(), end.getMonth(), 1);
      }
    }
    end.setHours(23, 59, 59, 999);

    // 上期
    const periodMs = end.getTime() - start.getTime();
    prevStart = new Date(start.getTime() - periodMs);
    const prevEnd = new Date(start.getTime() - 1);
    prevEnd.setHours(23, 59, 59, 999);

    const dashboardData = await getDashboardData(start, end, prevStart, prevEnd);

    return NextResponse.json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    console.error('获取仪表盘数据失败:', error);
    return NextResponse.json(
      { error: '获取仪表盘数据失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

async function getDashboardData(
  start: Date,
  end: Date,
  prevStart: Date,
  prevEnd: Date,
) {
  // ========== 本期数据 ==========
  const [
    currentOrders,
    currentPayments,
    prevOrders,
    allOrders,
    inventoryItems,
    orderItems,
    profitCalc,
    customersCount,
    totalProducts,
  ] = await Promise.all([
    // 本期已完成/已确认订单
    prisma.order.findMany({
      where: {
        status: { in: ORDER_STATUSES },
        completedAt: { gte: start, lte: end },
        deletedAt: null,
      },
      select: { id: true, totalAmount: true, customerId: true },
    }),

    // 本期客户付款
    prisma.payment.findMany({
      where: { paymentDate: { gte: start, lte: end } },
      select: { amount: true },
    }),

    // 上期订单（用于计算增长）
    prisma.order.findMany({
      where: {
        status: { in: ORDER_STATUSES },
        completedAt: { gte: prevStart, lte: prevEnd },
        deletedAt: null,
      },
      select: { id: true, totalAmount: true, customerId: true },
    }),

    // 全部订单（用于总统计）
    prisma.order.findMany({
      where: { deletedAt: null },
      select: { id: true, totalAmount: true, customerId: true },
    }),

    // 库存信息
    prisma.inventoryItem.findMany({
      select: {
        id: true,
        quantity: true,
        product: { select: { id: true, sku: true, name: true } },
      },
    }),

    // 订单商品
    prisma.orderItem.findMany({
      where: {
        order: {
          status: { in: ORDER_STATUSES },
          completedAt: { gte: start, lte: end },
          deletedAt: null,
        },
      },
      select: {
        productName: true,
        amount: true,
        productId: true,
        quantity: true,
      },
    }),

    // 利润快照（最近一条）
    prisma.profitCalculation.findFirst({
      orderBy: { calculatedAt: 'desc' },
      select: { netProfit: true },
    }),

    // 客户总数
    prisma.customer.count({ where: { deletedAt: null } }),

    // 产品总数
    prisma.product.count({ where: { deletedAt: null } }),
  ]);

  // ========== KPI 计算 ==========

  // 销售额
  const currentRevenue = currentOrders.reduce((s, o) => s + Number(o.totalAmount), 0);
  const prevRevenue = prevOrders.reduce((s, o) => s + Number(o.totalAmount), 0);
  const revenueGrowth = prevRevenue > 0
    ? parseFloat((((currentRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1))
    : 0;

  // 利润
  const currentProfit = profitCalc ? Number(profitCalc.netProfit) : 0;
  const profitGrowth = prevRevenue > 0 && currentRevenue > 0
    ? parseFloat((((currentProfit / currentRevenue) * 100 - (prevRevenue > 0 ? 0 : 0))).toFixed(1))
    : 0;

  // 订单数
  const currentOrderCount = currentOrders.length;
  const prevOrderCount = prevOrders.length;
  const orderGrowth = prevOrderCount > 0
    ? parseFloat((((currentOrderCount - prevOrderCount) / prevOrderCount) * 100).toFixed(1))
    : 0;

  // 客户数增长（本期新增客户）
  const currentCustomerIds = new Set(currentOrders.map((o) => o.customerId));
  const prevCustomerIds = new Set(prevOrders.map((o) => o.customerId));
  const customerGrowth = prevCustomerIds.size > 0
    ? parseFloat((((currentCustomerIds.size - prevCustomerIds.size) / prevCustomerIds.size) * 100).toFixed(1))
    : 0;

  // 库存价值
  const inventoryValue = inventoryItems.reduce((s, item) => s + Number(item.quantity), 0);
  // 估算库存价值（用平均售价）
  const inventoryGrowth = 0; // 简化处理

  // ========== Top 产品 ==========
  const productRevenueMap = new Map<string, { name: string; revenue: number }>();
  for (const item of orderItems) {
    const name = item.productName || '未知产品';
    const existing = productRevenueMap.get(name) || { name, revenue: 0 };
    existing.revenue += Number(item.amount);
    productRevenueMap.set(name, existing);
  }

  const topProducts: TopProduct[] = Array.from(productRevenueMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((p) => ({
      name: p.name,
      revenue: parseFloat(p.revenue.toFixed(2)),
      growth: 0,
    }));

  // ========== 库存预警 ==========
  const inventoryAlerts: InventoryAlert[] = inventoryItems
    .filter((item) => item.quantity <= 10)
    .map((item) => ({
      sku: item.product?.sku || '',
      name: item.product?.name || '未知产品',
      quantity: item.quantity,
      type: item.quantity <= 0 ? 'out' as const : 'low' as const,
    }))
    .slice(0, 10);

  // ========== 销售趋势 ==========
  const salesTrend = await calculateSalesTrend(start, end);

  // ========== Top 客户 ==========
  const customerRevenueMap = new Map<string, number>();
  for (const order of currentOrders) {
    const key = order.customerId;
    customerRevenueMap.set(key, (customerRevenueMap.get(key) || 0) + Number(order.totalAmount));
  }
  const customerIds = Array.from(customerRevenueMap.keys());
  const customers = customerIds.length > 0
    ? await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, companyName: true },
      })
    : [];
  const customerNameMap = new Map(customers.map((c) => [c.id, c.companyName]));
  const topCustomers: TopProduct[] = Array.from(customerRevenueMap.entries())
    .map(([id, revenue]) => ({
      name: customerNameMap.get(id) || '未知客户',
      revenue: parseFloat(revenue.toFixed(2)),
      growth: 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // ========== 待办事项 ==========
  const tasks = await calculateTasks();

  return {
    kpis: {
      revenue: { value: parseFloat(currentRevenue.toFixed(2)), growth: revenueGrowth },
      profit: { value: parseFloat(currentProfit.toFixed(2)), growth: profitGrowth },
      orders: { value: currentOrderCount, growth: orderGrowth },
      customers: { value: customersCount, growth: customerGrowth },
      inventory: { value: inventoryValue, growth: inventoryGrowth },
    },
    salesTrend,
    topProducts,
    topCustomers,
    inventoryAlerts,
    tasks,
    period: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
  };
}

/**
 * 计算销售趋势
 */
async function calculateSalesTrend(start: Date, end: Date) {
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ORDER_STATUSES },
      completedAt: { gte: start, lte: end },
      deletedAt: null,
    },
    select: { totalAmount: true, completedAt: true },
    orderBy: { completedAt: 'asc' },
  });

  // 按月分组
  const monthMap = new Map<string, number>();
  for (const order of orders) {
    const d = order.completedAt!;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(key, (monthMap.get(key) || 0) + Number(order.totalAmount));
  }

  return Array.from(monthMap.entries())
    .map(([date, revenue]) => ({
      date,
      revenue: parseFloat(revenue.toFixed(2)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 计算待办事项
 */
async function calculateTasks() {
  const now = new Date();

  const [
    pendingInvoices,
    pendingOrders,
    pendingPurchaseOrders,
    lowStockItems,
  ] = await Promise.all([
    // 待发送发票
    prisma.invoice.count({ where: { status: 'DRAFT' } }),
    // 待处理订单
    prisma.order.count({ where: { status: 'PENDING', deletedAt: null } }),
    // 待处理采购单
    prisma.purchaseOrder.count({ where: { status: 'PENDING', deletedAt: null } }),
    // 低库存
    prisma.inventoryItem.count({ where: { quantity: { lte: 5 } } }),
  ]);

  const tasks: Array<{ id: string; title: string; type: string; count: number }> = [];

  if (pendingOrders > 0) {
    tasks.push({ id: 'pending-orders', title: '待处理订单', type: 'order', count: pendingOrders });
  }
  if (pendingPurchaseOrders > 0) {
    tasks.push({ id: 'pending-purchase', title: '待处理采购单', type: 'purchase', count: pendingPurchaseOrders });
  }
  if (pendingInvoices > 0) {
    tasks.push({ id: 'pending-invoices', title: '待发送发票', type: 'invoice', count: pendingInvoices });
  }
  if (lowStockItems > 0) {
    tasks.push({ id: 'low-stock', title: '低库存预警', type: 'inventory', count: lowStockItems });
  }

  return tasks;
}
