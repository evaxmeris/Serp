/**
 * 销售报表 API
 * 从 Order 表按时间/产品/客户维度统计销售额
 *
 * GET /api/v1/reports/sales
 *   查询参数:
 *     - startDate (必填): 开始日期 YYYY-MM-DD
 *     - endDate   (必填): 结束日期 YYYY-MM-DD
 *     - period    (可选): day/week/month/quarter/year (默认 month)
 *     - groupBy   (可选): category/product/customer (默认 category)
 *     - customerId (可选): 筛选客户
 *     - productId  (可选): 筛选产品
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { validateOrReturn } from '@/lib/api-validation';
import { SalesReportSchema } from '@/lib/api-schemas';

const ORDER_STATUSES = ['COMPLETED', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];

// ============================================
// 类型定义
// ============================================

interface SalesSummary {
  totalRevenue: number;
  totalOrders: number;
  totalQuantity: number;
  averageOrderValue: number;
  totalCustomers: number;
}

interface GroupedItem {
  name: string;
  revenue: number;
  orders: number;
  quantity: number;
  proportion: number;
}

interface TrendItem {
  date: string;
  revenue: number;
  orders: number;
}

interface TopItem {
  name: string;
  revenue: number;
  growth: number;
  orders: number;
}

// ============================================
// GET 处理器
// ============================================

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
    const groupBy = searchParams.get('groupBy') || 'category';
    const customerId = searchParams.get('customerId');
    const productId = searchParams.get('productId');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: '缺少必要的日期参数 startDate 和 endDate' },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const [summary, groupedData, trends, topProducts, topCustomers] = await Promise.all([
      calculateSummary(start, end, customerId, productId),
      calculateGroupedData(start, end, groupBy, customerId, productId),
      calculateTrends(start, end, period, customerId, productId),
      calculateTopProducts(start, end, customerId, productId),
      calculateTopCustomers(start, end, productId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        summary,
        groupedData,
        trends,
        topProducts,
        topCustomers,
        period: {
          start: startDate,
          end: endDate,
          type: period,
        },
      },
    });
  } catch (error) {
    console.error('获取销售报表失败:', error);
    return NextResponse.json(
      { error: '获取销售报表失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// ============================================
// POST 处理器
// ============================================

export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const v = validateOrReturn(SalesReportSchema, body);
    if (!v.success) return v.response;
    const { period, startDate, endDate, groupBy, reportName } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ error: '缺少必要的日期参数' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const salesData = await calculateSummary(start, end);

    const report = await prisma.reportData.create({
      data: {
        reportId: 'sales-report',
        period: period || 'month',
        periodStart: new Date(startDate),
        periodEnd: new Date(endDate),
        data: salesData,
        metrics: {
          totalRevenue: salesData.totalRevenue,
          totalOrders: salesData.totalOrders,
          averageOrderValue: salesData.averageOrderValue,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: report,
      message: '销售报表生成成功',
    });
  } catch (error) {
    console.error('生成销售报表失败:', error);
    return NextResponse.json(
      { error: '生成销售报表失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// ============================================
// 核心计算函数
// ============================================

/** 构建订单筛选条件 */
function buildOrderWhere(start: Date, end: Date, customerId?: string | null, productId?: string | null) {
  const where: any = {
    status: { in: ORDER_STATUSES },
    completedAt: { gte: start, lte: end },
    deletedAt: null,
  };
  if (customerId) {
    where.customerId = customerId;
  }
  if (productId) {
    where.items = { some: { productId } };
  }
  return where;
}

/**
 * 计算销售汇总
 */
async function calculateSummary(
  start: Date,
  end: Date,
  customerId?: string | null,
  productId?: string | null,
): Promise<SalesSummary> {
  const where = buildOrderWhere(start, end, customerId, productId);

  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      totalAmount: true,
      customerId: true,
    },
  });

  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const totalOrders = orders.length;
  const uniqueCustomers = new Set(orders.map((o) => o.customerId)).size;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // 获取总销售数量（从 OrderItem）
  const orderIds = orders.map((o) => o.id);
  let totalQuantity = 0;
  if (orderIds.length > 0) {
    const items = await prisma.orderItem.findMany({
      where: { orderId: { in: orderIds } },
      select: { quantity: true },
    });
    totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  }

  return {
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalOrders,
    totalQuantity,
    averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
    totalCustomers: uniqueCustomers,
  };
}

/**
 * 按维度分组统计
 */
async function calculateGroupedData(
  start: Date,
  end: Date,
  groupBy: string,
  customerId?: string | null,
  productId?: string | null,
): Promise<GroupedItem[]> {
  const where = buildOrderWhere(start, end, customerId, productId);

  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      totalAmount: true,
      customerId: true,
    },
  });

  const orderIds = orders.map((o) => o.id);
  if (orderIds.length === 0) return [];

  const items = await prisma.orderItem.findMany({
    where: { orderId: { in: orderIds } },
    select: {
      orderId: true,
      productId: true,
      productName: true,
      quantity: true,
      amount: true,
    },
  });

  const orderAmountMap = new Map<string, number>();
  for (const o of orders) {
    orderAmountMap.set(o.id, Number(o.totalAmount));
  }

  if (groupBy === 'customer') {
    // 按客户维度
    const customerIds = Array.from(new Set(orders.map((o) => o.customerId)));
    const customers = customerIds.length > 0
      ? await prisma.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, companyName: true },
        })
      : [];
    const customerNameMap = new Map(customers.map((c) => [c.id, c.companyName]));

    const groupMap = new Map<string, { revenue: number; orders: number; quantity: number }>();
    for (const order of orders) {
      const name = customerNameMap.get(order.customerId) || '未知客户';
      const group = groupMap.get(name) || { revenue: 0, orders: 0, quantity: 0 };
      group.revenue += Number(order.totalAmount);
      group.orders += 1;
      groupMap.set(name, group);
    }
    // 加上 items 数量
    for (const item of items) {
      const order = orders.find((o) => o.id === item.orderId);
      if (order) {
        const name = customerNameMap.get(order.customerId) || '未知客户';
        const group = groupMap.get(name)!;
        group.quantity += item.quantity;
      }
    }

    return groupBy === 'customer'
      ? Array.from(groupMap.entries())
          .map(([name, g]) => ({
            name,
            revenue: parseFloat(g.revenue.toFixed(2)),
            orders: g.orders,
            quantity: g.quantity,
            proportion: 0,
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 20)
      : [];
  }

  if (groupBy === 'product') {
    // 按产品维度
    const productMap = new Map<string, { name: string; revenue: number; orders: Set<string>; quantity: number }>();
    for (const item of items) {
      const key = item.productId || item.productName;
      const name = item.productName || '未知产品';
      const group = productMap.get(key) || { name, revenue: 0, orders: new Set<string>(), quantity: 0 };
      group.revenue += Number(item.amount);
      group.orders.add(item.orderId);
      group.quantity += item.quantity;
      productMap.set(key, group);
    }

    return Array.from(productMap.entries())
      .map(([, g]) => ({
        name: g.name,
        revenue: parseFloat(g.revenue.toFixed(2)),
        orders: g.orders.size,
        quantity: g.quantity,
        proportion: 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20);
  }

  // 默认按品类分组 — 从 Product 的 category 关联获取
  const productIds = Array.from(new Set(items.filter((i) => i.productId).map((i) => i.productId!)));
  const productCategoryMap = new Map<string, string>();
  if (productIds.length > 0) {
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, categoryId: true },
    });
    const categoryIds = Array.from(new Set(products.filter((p) => p.categoryId).map((p) => p.categoryId!)));
    const categories = categoryIds.length > 0
      ? await prisma.productCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        })
      : [];
    const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]));
    for (const p of products) {
      productCategoryMap.set(p.id, categoryNameMap.get(p.categoryId!) || '未分类');
    }
  }

  const categoryMap = new Map<string, { revenue: number; orders: Set<string>; quantity: number }>();
  for (const item of items) {
    const catName = item.productId ? (productCategoryMap.get(item.productId) || '未分类') : '未分类';
    const group = categoryMap.get(catName) || { revenue: 0, orders: new Set<string>(), quantity: 0 };
    group.revenue += Number(item.amount);
    group.orders.add(item.orderId);
    group.quantity += item.quantity;
    categoryMap.set(catName, group);
  }

  const groupedArray = Array.from(categoryMap.entries())
    .map(([name, g]) => ({
      name,
      revenue: parseFloat(g.revenue.toFixed(2)),
      orders: g.orders.size,
      quantity: g.quantity,
      proportion: 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // 计算占比
  const totalRev = groupedArray.reduce((s, g) => s + g.revenue, 0);
  for (const g of groupedArray) {
    g.proportion = totalRev > 0 ? parseFloat(((g.revenue / totalRev) * 100).toFixed(1)) : 0;
  }

  return groupedArray;
}

/**
 * 按期间计算销售趋势
 */
async function calculateTrends(
  start: Date,
  end: Date,
  period: string,
  customerId?: string | null,
  productId?: string | null,
): Promise<TrendItem[]> {
  const where = buildOrderWhere(start, end, customerId, productId);

  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      totalAmount: true,
      completedAt: true,
    },
    orderBy: { completedAt: 'asc' },
  });

  if (orders.length === 0) return [];

  // 按期间分组
  const periodGroups = new Map<string, { revenue: number; orders: number }>();

  for (const order of orders) {
    const key = formatPeriodKey(order.completedAt!, period);
    const group = periodGroups.get(key) || { revenue: 0, orders: 0 };
    group.revenue += Number(order.totalAmount);
    group.orders += 1;
    periodGroups.set(key, group);
  }

  return Array.from(periodGroups.entries())
    .map(([date, g]) => ({
      date,
      revenue: parseFloat(g.revenue.toFixed(2)),
      orders: g.orders,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Top 产品排名
 */
async function calculateTopProducts(
  start: Date,
  end: Date,
  customerId?: string | null,
  productId?: string | null,
): Promise<TopItem[]> {
  const where = buildOrderWhere(start, end, customerId, productId);

  const orders = await prisma.order.findMany({
    where,
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);
  if (orderIds.length === 0) return [];

  const items = await prisma.orderItem.findMany({
    where: { orderId: { in: orderIds } },
    select: {
      productName: true,
      amount: true,
      quantity: true,
      productId: true,
    },
  });

  const productMap = new Map<string, { name: string; revenue: number; orders: number }>();
  for (const item of items) {
    const name = item.productName || '未知产品';
    const group = productMap.get(name) || { name, revenue: 0, orders: 0 };
    group.revenue += Number(item.amount);
    group.orders += item.quantity;
    productMap.set(name, group);
  }

  return Array.from(productMap.values())
    .map((p) => ({
      name: p.name,
      revenue: parseFloat(p.revenue.toFixed(2)),
      growth: 0, // 简化处理，不计算同比
      orders: p.orders,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

/**
 * Top 客户排名
 */
async function calculateTopCustomers(
  start: Date,
  end: Date,
  productId?: string | null,
): Promise<TopItem[]> {
  const where = buildOrderWhere(start, end, null, productId);

  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      totalAmount: true,
      customerId: true,
    },
  });

  if (orders.length === 0) return [];

  const customerIds = Array.from(new Set(orders.map((o) => o.customerId)));
  const customers = customerIds.length > 0
    ? await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, companyName: true },
      })
    : [];
  const nameMap = new Map(customers.map((c) => [c.id, c.companyName]));

  const custMap = new Map<string, { name: string; revenue: number; orders: number }>();
  for (const order of orders) {
    const name = nameMap.get(order.customerId) || '未知客户';
    const group = custMap.get(name) || { name, revenue: 0, orders: 0 };
    group.revenue += Number(order.totalAmount);
    group.orders += 1;
    custMap.set(name, group);
  }

  return Array.from(custMap.values())
    .map((c) => ({
      name: c.name,
      revenue: parseFloat(c.revenue.toFixed(2)),
      growth: 0,
      orders: c.orders,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

// ============================================
// 辅助函数
// ============================================

/**
 * 格式化期间键值
 */
function formatPeriodKey(date: Date, period: string): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const week = getWeekNumber(date);

  switch (period) {
    case 'day':
      return `${y}-${m}-${d}`;
    case 'week':
      return `${y}-W${String(week).padStart(2, '0')}`;
    case 'month':
      return `${y}-${m}`;
    case 'quarter':
      return `${y}-Q${Math.ceil(date.getMonth() / 3)}`;
    case 'year':
      return String(y);
    default:
      return `${y}-${m}`;
  }
}

/**
 * 获取 ISO 周数
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
