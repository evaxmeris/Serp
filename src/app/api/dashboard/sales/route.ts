import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 销售统计数据 API
 * GET /api/dashboard/sales
 * 
 * 查询参数:
 * - period: day | week | month (默认 month)
 * - days: 统计天数 (默认 30)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';
    const days = parseInt(searchParams.get('days') || '30');

    // 计算日期范围
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // 按周期分组统计
    let dateGrouping: any;
    switch (period) {
      case 'day':
        dateGrouping = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        };
        break;
      case 'week':
        dateGrouping = {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' },
        };
        break;
      case 'month':
      default:
        dateGrouping = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        };
        break;
    }

    // 获取订单统计数据
    const orderStats = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE_TRUNC(${period}, "createdAt") as date,
        COUNT(*) as orderCount,
        SUM("totalAmount") as totalAmount,
        AVG("totalAmount") as avgAmount
      FROM "orders"
      WHERE "createdAt" >= ${startDate}
      GROUP BY DATE_TRUNC(${period}, "createdAt")
      ORDER BY date ASC
    `;

    // 获取客户统计数据
    const customerStats = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE_TRUNC(${period}, "createdAt") as date,
        COUNT(DISTINCT "customerId") as customerCount,
        COUNT(*) as orderCount
      FROM "orders"
      WHERE "createdAt" >= ${startDate}
      GROUP BY DATE_TRUNC(${period}, "createdAt")
      ORDER BY date ASC
    `;

    // 获取产品统计数据
    const productStats = await prisma.$queryRaw<any[]>`
      SELECT 
        p."name" as productName,
        p."category",
        COUNT(oi.id) as quantity,
        SUM(oi.amount) as revenue
      FROM "order_items" oi
      JOIN "products" p ON oi."productId" = p.id
      JOIN "orders" o ON oi."orderId" = o.id
      WHERE o."createdAt" >= ${startDate}
      GROUP BY p.id, p."name", p."category"
      ORDER BY revenue DESC
      LIMIT 10
    `;

    // 汇总数据
    const summary = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as totalOrders,
        SUM("totalAmount") as totalRevenue,
        AVG("totalAmount") as avgOrderValue,
        COUNT(DISTINCT "customerId") as totalCustomers
      FROM "orders"
      WHERE "createdAt" >= ${startDate}
    `;

    return NextResponse.json({
      success: true,
      data: {
        summary: summary[0] || {
          totalOrders: 0,
          totalRevenue: 0,
          avgOrderValue: 0,
          totalCustomers: 0,
        },
        trends: orderStats.map((item: any) => ({
          date: new Date(item.date).toISOString(),
          orderCount: parseInt(item.ordercount),
          totalAmount: parseFloat(item.totalamount),
          avgAmount: parseFloat(item.avgamount),
        })),
        customers: customerStats.map((item: any) => ({
          date: new Date(item.date).toISOString(),
          customerCount: parseInt(item.customercount),
          orderCount: parseInt(item.ordercount),
        })),
        topProducts: productStats.map((item: any) => ({
          productName: item.productname,
          category: item.category,
          quantity: parseInt(item.quantity),
          revenue: parseFloat(item.revenue),
        })),
      },
    });
  } catch (error) {
    console.error('Sales dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sales data' },
      { status: 500 }
    );
  }
}
