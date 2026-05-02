/**
 * 采购报表 API
 * 提供采购数据的查询和统计
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { validateOrReturn } from '@/lib/api-validation';
import { PurchaseReportSchema } from '@/lib/api-schemas';

/**
 * GET /api/v1/reports/purchase
 * 获取采购报表数据
 */
export async function GET(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const supplierId = searchParams.get('supplierId');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: '缺少必要的日期参数' },
        { status: 400 }
      );
    }

    const purchaseData = await getPurchaseData({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      supplierId
    });

    return NextResponse.json({ success: true, data: purchaseData });
  } catch (error) {
    console.error('获取采购报表失败:', error);
    return NextResponse.json(
      { error: '获取采购报表失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/reports/purchase
 * 生成采购报表
 */
export async function POST(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

const body = await request.json();

    // Zod 验证
    const v = validateOrReturn(PurchaseReportSchema, body);
    if (!v.success) return v.response;
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: '缺少必要的日期参数' },
        { status: 400 }
      );
    }

    const purchaseData = await getPurchaseData({
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    });

    const report = await prisma.reportData.create({
      data: {
        reportId: 'purchase-report',
        period: 'custom',
        periodStart: new Date(startDate),
        periodEnd: new Date(endDate),
        data: purchaseData,
        metrics: {
          totalAmount: purchaseData.summary.totalAmount,
          totalOrders: purchaseData.summary.totalOrders
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: report,
      message: '采购报表生成成功'
    });
  } catch (error) {
    console.error('生成采购报表失败:', error);
    return NextResponse.json(
      { error: '生成采购报表失败' },
      { status: 500 }
    );
  }
}

async function getPurchaseData(params: {
  startDate: Date;
  endDate: Date;
  supplierId?: string | null;
}) {
  const { startDate, endDate, supplierId } = params;

  // 查询日期范围内的采购订单
  const where: any = {
    createdAt: {
      gte: startDate,
      lte: endDate
    },
    deletedAt: null
  };
  if (supplierId) {
    where.supplierId = supplierId;
  }

  const orders = await prisma.purchaseOrder.findMany({
    where,
    include: {
      items: true,
      supplier: {
        select: { id: true, companyName: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const totalOrders = orders.length;
  const totalAmount = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const averageOrderValue = totalOrders > 0 ? Math.round(totalAmount / totalOrders) : 0;
  const totalQuantity = orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);

  // 按供应商统计
  const supplierMap = new Map<string, { name: string; amount: number; count: number }>();
  for (const order of orders) {
    const sid = order.supplierId;
    const sname = (order.supplier as any)?.companyName || sid;
    const existing = supplierMap.get(sid) || { name: sname, amount: 0, count: 0 };
    existing.amount += Number(order.totalAmount);
    existing.count += 1;
    supplierMap.set(sid, existing);
  }
  const bySupplier = Array.from(supplierMap.values())
    .map(s => ({
      name: s.name,
      amount: s.amount,
      percentage: totalAmount > 0 ? Math.round((s.amount / totalAmount) * 1000) / 10 : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  // 按产品品类统计
  const categoryMap = new Map<string, { category: string; amount: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const cat = item.productSku || item.productName || '其他';
      const existing = categoryMap.get(cat) || { category: cat, amount: 0 };
      existing.amount += Number(item.amount);
      categoryMap.set(cat, existing);
    }
  }
  const purchaseByCategory = Array.from(categoryMap.values())
    .map(c => ({
      category: c.category,
      amount: c.amount,
      percentage: totalAmount > 0 ? Math.round((c.amount / totalAmount) * 1000) / 10 : 0
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // 按日期的趋势数据
  const trendMap = new Map<string, { date: string; amount: number; count: number }>();
  for (const order of orders) {
    const day = order.createdAt.toISOString().slice(0, 10);
    const existing = trendMap.get(day) || { date: day, amount: 0, count: 0 };
    existing.amount += Number(order.totalAmount);
    existing.count += 1;
    trendMap.set(day, existing);
  }
  const trends = Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // 交付准时率统计
  const onTimeOrders = orders.filter(o => o.deliveryDate && o.deliveryDeadline && o.deliveryDate <= o.deliveryDeadline).length;
  const deliveredOrders = orders.filter(o => o.deliveryDate !== null).length;
  const deliveryPerformance = {
    onTime: deliveredOrders > 0 ? Math.round((onTimeOrders / deliveredOrders) * 100) : 0,
    delayed: 0,
    early: 0
  };

  return {
    summary: {
      totalAmount,
      totalOrders,
      totalQuantity,
      averageOrderValue
    },
    bySupplier,
    byProduct: purchaseByCategory,
    trends,
    deliveryPerformance,
    qualityMetrics: {
      passRate: 0,
      returnRate: 0,
      complaintRate: 0
    }
  };
}
