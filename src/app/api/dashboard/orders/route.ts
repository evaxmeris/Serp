import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-api';
import { errorResponse } from '@/lib/api-response';
import type { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// 类型定义
// ============================================

/** 订单汇总统计数据 */
interface OrderSummary {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  pendingOrders: number;
  confirmedOrders: number;
  processingOrders: number;
  shippedOrders: number;
  completedOrders: number;
  cancelledOrders: number;
}

/** 订单状态分布数据 */
interface OrderStatusDistribution {
  status: string;
  orderCount: number;
  totalAmount: number;
}

/** 订单趋势数据 */
interface OrderTrendItem {
  date: string;
  orderCount: number;
  totalAmount: number;
}

/** 转化率数据 */
interface ConversionData {
  totalInquiries: number;
  totalQuotations: number;
  totalOrders: number;
  inquiryToQuotationRate: number;
  quotationToOrderRate: number;
  inquiryToOrderRate: number;
}

/** 订单金额区间统计 */
interface AmountRangeStat {
  amountRange: string;
  orderCount: number;
}

/** API 响应数据结构 */
interface OrderDashboardData {
  summary: OrderSummary;
  statusDistribution: OrderStatusDistribution[];
  orderTrend: OrderTrendItem[];
  conversion: ConversionData;
  amountRangeStats: AmountRangeStat[];
}

/**
 * 订单统计数据 API
 * GET /api/dashboard/orders
 * 
 * 查询参数:
 * - days: 统计天数 (默认 30)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // 订单汇总统计
    const summary = await prisma.$queryRaw<Array<{
      totalorders: string;
      totalrevenue: string;
      avgordervalue: string;
      pendingorders: string;
      confirmedorders: string;
      processingorders: string;
      shippedorders: string;
      completedorders: string;
      cancelledorders: string;
    }>>`
      SELECT 
        COUNT(*) as totalOrders,
        SUM("totalAmount") as totalRevenue,
        AVG("totalAmount") as avgOrderValue,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pendingOrders,
        COUNT(CASE WHEN status = 'CONFIRMED' THEN 1 END) as confirmedOrders,
        COUNT(CASE WHEN status = 'PROCESSING' THEN 1 END) as processingOrders,
        COUNT(CASE WHEN status = 'SHIPPED' THEN 1 END) as shippedOrders,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completedOrders,
        COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelledOrders
      FROM "orders"
      WHERE "createdAt" >= ${startDate}
    `;

    // 订单状态分布
    const statusDistribution = await prisma.$queryRaw<Array<{
      status: string;
      ordercount: string;
      totalamount: string;
    }>>`
      SELECT 
        status,
        COUNT(*) as orderCount,
        SUM("totalAmount") as totalAmount
      FROM "orders"
      WHERE "createdAt" >= ${startDate}
      GROUP BY status
      ORDER BY orderCount DESC
    `;

    // 订单趋势（按日）
    const orderTrend = await prisma.$queryRaw<Array<{
      date: Date;
      ordercount: string;
      totalamount: string;
    }>>`
      SELECT 
        DATE_TRUNC('day', "createdAt") as date,
        COUNT(*) as orderCount,
        SUM("totalAmount") as totalAmount
      FROM "orders"
      WHERE "createdAt" >= ${startDate}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `;

    // 订单转化率（询盘->报价->订单）
    const conversionStats = await prisma.$queryRaw<Array<{
      totalinquiries: string;
      totalquotations: string;
      totalorders: string;
    }>>`
      SELECT 
        (SELECT COUNT(*) FROM "inquiries" WHERE "createdAt" >= ${startDate}) as totalInquiries,
        (SELECT COUNT(*) FROM "quotations" WHERE "createdAt" >= ${startDate}) as totalQuotations,
        (SELECT COUNT(*) FROM "orders" WHERE "createdAt" >= ${startDate}) as totalOrders
    `;

    // 订单金额区间统计
    const amountRangeStats = await prisma.$queryRaw<Array<{
      amountrange: string;
      ordercount: string;
    }>>`
      SELECT 
        CASE 
          WHEN "totalAmount" < 1000 THEN '0-1000'
          WHEN "totalAmount" < 5000 THEN '1000-5000'
          WHEN "totalAmount" < 10000 THEN '5000-10000'
          WHEN "totalAmount" < 50000 THEN '10000-50000'
          ELSE '50000+'
        END as amountRange,
        COUNT(*) as orderCount
      FROM "orders"
      WHERE "createdAt" >= ${startDate}
      GROUP BY amountRange
      ORDER BY MIN("totalAmount")
    `;

    // 计算转化率
    const conversionData = conversionStats[0];
    const totalInquiries = conversionData ? parseInt(conversionData.totalinquiries) : 0;
    const totalQuotations = conversionData ? parseInt(conversionData.totalquotations) : 0;
    const totalOrdersCount = conversionData ? parseInt(conversionData.totalorders) : 0;

    const inquiryToQuotationRate = totalInquiries > 0 
      ? (totalQuotations / totalInquiries) * 100 
      : 0;
    const quotationToOrderRate = totalQuotations > 0 
      ? (totalOrdersCount / totalQuotations) * 100 
      : 0;
    const inquiryToOrderRate = totalInquiries > 0 
      ? (totalOrdersCount / totalInquiries) * 100 
      : 0;

    // 构建响应数据
    const responseData: OrderDashboardData = {
      summary: summary[0] ? {
        totalOrders: parseInt(summary[0].totalorders),
        totalRevenue: parseFloat(summary[0].totalrevenue),
        avgOrderValue: parseFloat(summary[0].avgordervalue),
        pendingOrders: parseInt(summary[0].pendingorders),
        confirmedOrders: parseInt(summary[0].confirmedorders),
        processingOrders: parseInt(summary[0].processingorders),
        shippedOrders: parseInt(summary[0].shippedorders),
        completedOrders: parseInt(summary[0].completedorders),
        cancelledOrders: parseInt(summary[0].cancelledorders),
      } : {
        totalOrders: 0,
        totalRevenue: 0,
        avgOrderValue: 0,
        pendingOrders: 0,
        confirmedOrders: 0,
        processingOrders: 0,
        shippedOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
      },
      statusDistribution: statusDistribution.map((item) => ({
        status: item.status,
        orderCount: parseInt(item.ordercount),
        totalAmount: parseFloat(item.totalamount),
      })),
      orderTrend: orderTrend.map((item) => ({
        date: new Date(item.date).toISOString(),
        orderCount: parseInt(item.ordercount),
        totalAmount: parseFloat(item.totalamount),
      })),
      conversion: {
        totalInquiries,
        totalQuotations,
        totalOrders: totalOrdersCount,
        inquiryToQuotationRate: parseFloat(inquiryToQuotationRate.toFixed(2)),
        quotationToOrderRate: parseFloat(quotationToOrderRate.toFixed(2)),
        inquiryToOrderRate: parseFloat(inquiryToOrderRate.toFixed(2)),
      },
      amountRangeStats: amountRangeStats.map((item) => ({
        amountRange: item.amountrange,
        orderCount: parseInt(item.ordercount),
      })),
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('Order dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch order data' },
      { status: 500 }
    );
  }
}
