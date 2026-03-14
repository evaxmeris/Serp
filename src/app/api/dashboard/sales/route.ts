import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// 类型定义
// ============================================

/** 销售汇总数据 */
interface SalesSummary {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  totalCustomers: number;
}

/** 销售趋势数据 */
interface SalesTrendItem {
  date: string;
  orderCount: number;
  totalAmount: number;
  avgAmount: number;
}

/** 客户统计数据 */
interface CustomerStatItem {
  date: string;
  customerCount: number;
  orderCount: number;
}

/** 产品统计数据 */
interface ProductStatItem {
  productName: string;
  category: string;
  quantity: number;
  revenue: number;
}

/** API 响应数据结构 */
interface SalesDashboardData {
  summary: SalesSummary;
  trends: SalesTrendItem[];
  customers: CustomerStatItem[];
  topProducts: ProductStatItem[];
}

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

    // 获取订单统计数据
    const orderStats = await prisma.$queryRaw<Array<{
      date: Date;
      ordercount: string;
      totalamount: string;
      avgamount: string;
    }>>`
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
    const customerStats = await prisma.$queryRaw<Array<{
      date: Date;
      customercount: string;
      ordercount: string;
    }>>`
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
    const productStats = await prisma.$queryRaw<Array<{
      productname: string;
      category: string;
      quantity: string;
      revenue: string;
    }>>`
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
    const summary = await prisma.$queryRaw<Array<{
      totalorders: string;
      totalrevenue: string;
      avgordervalue: string;
      totalcustomers: string;
    }>>`
      SELECT 
        COUNT(*) as totalOrders,
        SUM("totalAmount") as totalRevenue,
        AVG("totalAmount") as avgOrderValue,
        COUNT(DISTINCT "customerId") as totalCustomers
      FROM "orders"
      WHERE "createdAt" >= ${startDate}
    `;

    // 构建响应数据
    const responseData: SalesDashboardData = {
      summary: summary[0] ? {
        totalOrders: parseInt(summary[0].totalorders),
        totalRevenue: parseFloat(summary[0].totalrevenue),
        avgOrderValue: parseFloat(summary[0].avgordervalue),
        totalCustomers: parseInt(summary[0].totalcustomers),
      } : {
        totalOrders: 0,
        totalRevenue: 0,
        avgOrderValue: 0,
        totalCustomers: 0,
      },
      trends: orderStats.map((item) => ({
        date: new Date(item.date).toISOString(),
        orderCount: parseInt(item.ordercount),
        totalAmount: parseFloat(item.totalamount),
        avgAmount: parseFloat(item.avgamount),
      })),
      customers: customerStats.map((item) => ({
        date: new Date(item.date).toISOString(),
        customerCount: parseInt(item.customercount),
        orderCount: parseInt(item.ordercount),
      })),
      topProducts: productStats.map((item) => ({
        productName: item.productname,
        category: item.category,
        quantity: parseInt(item.quantity),
        revenue: parseFloat(item.revenue),
      })),
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('Sales dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sales data' },
      { status: 500 }
    );
  }
}
