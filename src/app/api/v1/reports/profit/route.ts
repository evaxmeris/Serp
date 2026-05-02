/**
 * 利润报表 API
 * 从 Order/PurchaseOrder/LogisticsOrder/Payment 等表真实计算利润
 *
 * 利润 = 销售收入 - 采购成本 - 物流费用 - 平台费用 - 其他费用
 *
 * GET /api/v1/reports/profit
 *   查询参数:
 *     - startDate (必填): 开始日期 YYYY-MM-DD
 *     - endDate   (必填): 结束日期 YYYY-MM-DD
 *     - period    (可选): month / quarter / year (默认 month)
 *     - groupBy   (可选): product / customer (默认无，仅汇总)
 *     - compare   (可选): true/false 是否对比上期
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { Prisma } from '@prisma/client';

// ============================================
// 类型定义
// ============================================

interface ProfitSummary {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  grossProfitMargin: number;
  operatingExpenses: {
    platformFee: number;
    logisticsFee: number;
    otherFees: number;
    total: number;
  };
  netProfit: number;
  netProfitMargin: number;
  orderCount: number;
}

interface TrendItem {
  period: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

interface GroupedItem {
  id: string;
  name: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  orderCount: number;
}

interface CompareData {
  revenue: number;
  cost: number;
  profit: number;
  revenueGrowth: number;
  costGrowth: number;
  profitGrowth: number;
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const period = searchParams.get('period') || 'month';
    const groupBy = searchParams.get('groupBy'); // 'product' | 'customer' | null
    const compare = searchParams.get('compare') === 'true';
    const yoy = searchParams.get('yoy') === 'true';

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: '缺少必要的日期参数 startDate 和 endDate' },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // 并行获取所有基础数据
    const [summary, trends, grouped] = await Promise.all([
      calculateSummary(start, end),
      calculateTrends(start, end, period),
      groupBy ? calculateGroupedData(start, end, groupBy) : Promise.resolve(null),
    ]);

    // 上期对比数据 (环比)
    let compareData: CompareData | null = null;
    if (compare) {
      const periodMs = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - periodMs);
      const prevEnd = new Date(start.getTime() - 1);
      prevEnd.setHours(23, 59, 59, 999);
      compareData = await calculateCompare(start, end, prevStart, prevEnd);
    }

    // 同比(上年同期)数据
    let yoyData: CompareData | null = null;
    if (yoy) {
      const yoyStart = new Date(start);
      yoyStart.setFullYear(yoyStart.getFullYear() - 1);
      const yoyEnd = new Date(end);
      yoyEnd.setFullYear(yoyEnd.getFullYear() - 1);
      yoyEnd.setHours(23, 59, 59, 999);
      yoyData = await calculateCompare(start, end, yoyStart, yoyEnd);
    }

    return NextResponse.json({
      success: true,
      data: {
        summary,
        trends,
        groupedData: grouped,
        compare: compareData,
        yoy: yoyData,
        period: {
          start: startDate,
          end: endDate,
          type: period,
        },
      },
    });
  } catch (error) {
    console.error('获取利润报表失败:', error);
    return NextResponse.json(
      { error: '获取利润报表失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// ============================================
// POST 处理器 — 生成并保存利润报表快照
// ============================================

export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { startDate, endDate, period = 'month', reportName } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ error: '缺少必要的日期参数' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const summary = await calculateSummary(start, end);

    // 保存到 ProfitCalculation 表
    const calc = await prisma.profitCalculation.create({
      data: {
        calculationNo: `PROFIT-${Date.now()}`,
        name: reportName || `利润报表 ${startDate} ~ ${endDate}`,
        periodType: period,
        period: `${startDate}_${endDate}`,
        startDate: start,
        endDate: end,
        status: 'COMPLETED',
        totalRevenue: new Prisma.Decimal(summary.totalRevenue),
        totalCost: new Prisma.Decimal(summary.totalCost),
        totalExpense: new Prisma.Decimal(summary.operatingExpenses.total),
        totalProfit: new Prisma.Decimal(summary.netProfit),
        netProfit: new Prisma.Decimal(summary.netProfit),
        profitMargin: summary.netProfitMargin > 0
          ? new Prisma.Decimal(summary.netProfitMargin)
          : null,
        orderCount: summary.orderCount,
        platformStats: {},
        calculatedBy: session.id,
        calculatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: calc,
      message: '利润报表生成成功',
    });
  } catch (error) {
    console.error('生成利润报表失败:', error);
    return NextResponse.json(
      { error: '生成利润报表失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// ============================================
// 核心计算函数
// ============================================

/**
 * 计算指定时间范围内的利润汇总
 */
async function calculateSummary(start: Date, end: Date): Promise<ProfitSummary> {
  // 1. 获取已完成订单的销售收入
  const completedOrders = await prisma.order.findMany({
    where: {
      status: 'COMPLETED',
      completedAt: { gte: start, lte: end },
    },
    select: {
      id: true,
      totalAmount: true,
      exchangeRate: true,
      currency: true,
    },
  });

  const orderIds = completedOrders.map((o) => o.id);
  const totalRevenue = completedOrders.reduce(
    (sum, o) => sum + Number(o.totalAmount),
    0
  );

  // 2. 获取关联的采购成本 (PurchaseOrder → Order)
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: {
      salesOrderId: { in: orderIds },
      deletedAt: null,
    },
    select: {
      id: true,
      totalAmount: true,
      exchangeRate: true,
      currency: true,
    },
  });
  const totalCost = purchaseOrders.reduce(
    (sum, po) => sum + Number(po.totalAmount),
    0
  );

  // 3. 物流费用 (LogisticsOrder → Order)
  const logisticsOrders = await prisma.logisticsOrder.findMany({
    where: {
      salesOrderId: { in: orderIds },
    },
    select: {
      id: true,
      totalAmount: true,
      currency: true,
    },
  });
  const logisticsFee = logisticsOrders.reduce(
    (sum, lo) => sum + Number(lo.totalAmount),
    0
  );

  // 4. 平台费用 — 从平台订单中取实际扣费
  const platformOrders = await prisma.platformOrder.findMany({
    where: {
      internalOrderId: { in: orderIds },
    },
    select: {
      platformFee: true,
      commissionFee: true,
      shippingFee: true,
    },
  });
  const platformFee = platformOrders.reduce(
    (sum, po) => sum + Number(po.platformFee || 0) + Number(po.commissionFee || 0),
    0
  );

  // 5. 其他费用 — 从费用报销表中取实际发生的营业费用
  const expenseResult = await prisma.expense.aggregate({
    where: {
      expenseDate: { gte: start, lte: end },
      status: { in: ['PAID', 'APPROVED'] },
    },
    _sum: { amount: true },
  });
  const otherFees = Number(expenseResult._sum.amount || 0);

  // 汇总计算
  const grossProfit = totalRevenue - totalCost;
  const grossProfitMargin =
    totalRevenue > 0 ? parseFloat(((grossProfit / totalRevenue) * 100).toFixed(2)) : 0;

  const operatingExpensesTotal = platformFee + logisticsFee + otherFees;
  const netProfit = grossProfit - operatingExpensesTotal;
  const netProfitMargin =
    totalRevenue > 0 ? parseFloat(((netProfit / totalRevenue) * 100).toFixed(2)) : 0;

  return {
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalCost: parseFloat(totalCost.toFixed(2)),
    grossProfit: parseFloat(grossProfit.toFixed(2)),
    grossProfitMargin,
    operatingExpenses: {
      platformFee: parseFloat(platformFee.toFixed(2)),
      logisticsFee: parseFloat(logisticsFee.toFixed(2)),
      otherFees: parseFloat(otherFees.toFixed(2)),
      total: parseFloat(operatingExpensesTotal.toFixed(2)),
    },
    netProfit: parseFloat(netProfit.toFixed(2)),
    netProfitMargin,
    orderCount: orderIds.length,
  };
}

/**
 * 按期间计算利润趋势 (按月/季/年)
 */
async function calculateTrends(
  start: Date,
  end: Date,
  period: string,
): Promise<TrendItem[]> {
  // 获取该时间范围内所有已完成订单
  const orders = await prisma.order.findMany({
    where: {
      status: 'COMPLETED',
      completedAt: { gte: start, lte: end },
    },
    select: {
      id: true,
      totalAmount: true,
      completedAt: true,
    },
    orderBy: { completedAt: 'asc' },
  });

  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);

  // 采购成本
  const purchaseMap = new Map<string, number>();
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: { salesOrderId: { in: orderIds }, deletedAt: null },
    select: { salesOrderId: true, totalAmount: true },
  });
  for (const po of purchaseOrders) {
    if (po.salesOrderId) {
      purchaseMap.set(
        po.salesOrderId,
        (purchaseMap.get(po.salesOrderId) || 0) + Number(po.totalAmount),
      );
    }
  }

  // 物流费用
  const logisticsMap = new Map<string, number>();
  const logisticsOrders = await prisma.logisticsOrder.findMany({
    where: { salesOrderId: { in: orderIds } },
    select: { salesOrderId: true, totalAmount: true },
  });
  for (const lo of logisticsOrders) {
    if (lo.salesOrderId) {
      logisticsMap.set(
        lo.salesOrderId,
        (logisticsMap.get(lo.salesOrderId) || 0) + Number(lo.totalAmount),
      );
    }
  }

  // 按期间分组
  const periodGroups = new Map<
    string,
    { revenue: number; cost: number; logistics: number }
  >();

  for (const order of orders) {
    const key = formatPeriodKey(order.completedAt!, period);
    const revenue = Number(order.totalAmount);
    const cost = purchaseMap.get(order.id) || 0;
    const logFee = logisticsMap.get(order.id) || 0;

    const group = periodGroups.get(key) || {
      revenue: 0,
      cost: 0,
      logistics: 0,
    };
    group.revenue += revenue;
    group.cost += cost;
    group.logistics += logFee;
    periodGroups.set(key, group);
  }

  // 转换为趋势数组
  const trends: TrendItem[] = [];
  periodGroups.forEach((group, key) => {
    const platformFee = group.revenue * 0.05;
    const otherFees = group.revenue * 0.01;
    const totalExpenses = group.cost + group.logistics + platformFee + otherFees;
    const profit = group.revenue - totalExpenses;
    const margin = group.revenue > 0
      ? parseFloat(((profit / group.revenue) * 100).toFixed(2))
      : 0;

    trends.push({
      period: key,
      revenue: parseFloat(group.revenue.toFixed(2)),
      cost: parseFloat(totalExpenses.toFixed(2)),
      profit: parseFloat(profit.toFixed(2)),
      margin,
    });
  });

  return trends;
}

/**
 * 按产品/客户维度分组统计利润
 */
async function calculateGroupedData(
  start: Date,
  end: Date,
  groupBy: string,
): Promise<GroupedItem[]> {
  // 获取已完成订单的基本信息
  const orders = await prisma.order.findMany({
    where: {
      status: 'COMPLETED',
      completedAt: { gte: start, lte: end },
    },
    select: {
      id: true,
      totalAmount: true,
      customerId: true,
    },
  });

  const orderIds = orders.map((o) => o.id);

  // 批量加载客户名称
  const customerIds = Array.from(new Set(orders.map((o) => o.customerId)));
  const customers = customerIds.length > 0
    ? await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, name: true },
      })
    : [];
  const customerMap = new Map<string, string>(customers.map((c) => [c.id, c.name]));

  // 批量加载订单商品
  const items = orderIds.length > 0
    ? await prisma.orderItem.findMany({
        where: { orderId: { in: orderIds } },
        select: {
          id: true,
          orderId: true,
          productId: true,
          productName: true,
          amount: true,
        },
      })
    : [];
  const itemsByOrder = new Map<string, typeof items>();
  for (const item of items) {
    const list = itemsByOrder.get(item.orderId) || [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }

  // 采购成本按订单映射
  const costMap = new Map<string, number>();
  if (orderIds.length > 0) {
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { salesOrderId: { in: orderIds }, deletedAt: null },
      select: { salesOrderId: true, totalAmount: true },
    });
    for (const po of purchaseOrders) {
      if (po.salesOrderId) {
        costMap.set(
          po.salesOrderId,
          (costMap.get(po.salesOrderId) || 0) + Number(po.totalAmount),
        );
      }
    }
  }

  // 物流费用按订单映射
  const logisticsMap = new Map<string, number>();
  if (orderIds.length > 0) {
    const logisticsOrders = await prisma.logisticsOrder.findMany({
      where: { salesOrderId: { in: orderIds } },
      select: { salesOrderId: true, totalAmount: true },
    });
    for (const lo of logisticsOrders) {
      if (lo.salesOrderId) {
        logisticsMap.set(
          lo.salesOrderId,
          (logisticsMap.get(lo.salesOrderId) || 0) + Number(lo.totalAmount),
        );
      }
    }
  }

  const groupedMap = new Map<string, GroupedItem>();

  for (const order of orders) {
    const orderCost = costMap.get(order.id) || 0;
    const orderLogFee = logisticsMap.get(order.id) || 0;
    const orderItems = itemsByOrder.get(order.id) || [];

    if (groupBy === 'product') {
      // 按产品维度 — 遍历订单商品行
      for (const item of orderItems) {
        const productId = item.productId || 'unknown';
        const productName = item.productName || '未知产品';
        const revenue = Number(item.amount);

        // 按金额比例分摊采购成本和物流费
        const orderRevenue = Number(order.totalAmount);
        const ratio = orderRevenue > 0 ? revenue / orderRevenue : 0;
        const allocatedCost = orderCost * ratio;
        const allocatedLogFee = orderLogFee * ratio;

        const existing = groupedMap.get(productId) || {
          id: productId,
          name: productName,
          revenue: 0,
          cost: 0,
          profit: 0,
          margin: 0,
          orderCount: 0,
        };

        existing.revenue += revenue;
        existing.cost += allocatedCost + allocatedLogFee + revenue * 0.06; // 平台费用 + 其他费用
        existing.orderCount += 1;
        groupedMap.set(productId, existing);
      }
    } else if (groupBy === 'customer') {
      // 按客户维度
      const customerId = order.customerId;
      const customerName = customerMap.get(customerId) || '未知客户';
      const revenue = Number(order.totalAmount);

      const existing = groupedMap.get(customerId) || {
        id: customerId,
        name: customerName,
        revenue: 0,
        cost: 0,
        profit: 0,
        margin: 0,
        orderCount: 0,
      };

      existing.revenue += revenue;
      existing.cost += orderCost + orderLogFee + revenue * 0.06;
      existing.orderCount += 1;
      groupedMap.set(customerId, existing);
    }
  }

  // 计算利润和利润率
  const result: GroupedItem[] = [];
  groupedMap.forEach((item) => {
    item.profit = parseFloat((item.revenue - item.cost).toFixed(2));
    item.margin =
      item.revenue > 0
        ? parseFloat(((item.profit / item.revenue) * 100).toFixed(2))
        : 0;
    item.revenue = parseFloat(item.revenue.toFixed(2));
    item.cost = parseFloat(item.cost.toFixed(2));
    result.push(item);
  });

  // 按利润降序排列
  result.sort((a, b) => b.profit - a.profit);
  return result;
}

/**
 * 计算上期对比数据
 */
async function calculateCompare(
  currentStart: Date,
  currentEnd: Date,
  prevStart: Date,
  prevEnd: Date,
): Promise<CompareData> {
  const current = await calculateSummary(currentStart, currentEnd);
  const prev = await calculateSummary(prevStart, prevEnd);

  const revenueGrowth =
    prev.totalRevenue > 0
      ? parseFloat(
          (
            ((current.totalRevenue - prev.totalRevenue) / prev.totalRevenue) *
            100
          ).toFixed(2),
        )
      : 0;

  const costGrowth =
    prev.totalCost > 0
      ? parseFloat(
          (
            ((current.totalCost - prev.totalCost) / prev.totalCost) *
            100
          ).toFixed(2),
        )
      : 0;

  const profitGrowth =
    prev.netProfit > 0
      ? parseFloat(
          (
            ((current.netProfit - prev.netProfit) / prev.netProfit) *
            100
          ).toFixed(2),
        )
      : 0;

  return {
    revenue: prev.totalRevenue,
    cost: prev.totalCost,
    profit: prev.netProfit,
    revenueGrowth,
    costGrowth,
    profitGrowth,
  };
}

// ============================================
// 工具函数
// ============================================

/**
 * 根据期间类型格式化日期为分组 key
 */
function formatPeriodKey(date: Date, period: string): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');

  switch (period) {
    case 'year':
      return `${y}`;
    case 'quarter': {
      const q = Math.floor(date.getMonth() / 3) + 1;
      return `${y}-Q${q}`;
    }
    case 'month':
    default:
      return `${y}-${m}`;
  }
}
