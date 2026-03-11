import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 订单统计数据 API
 * GET /api/dashboard/orders
 * 
 * 查询参数:
 * - days: 统计天数 (默认 30)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // 订单汇总统计
    const summary = await prisma.$queryRaw<any[]>`
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
    const statusDistribution = await prisma.$queryRaw<any[]>`
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
    const orderTrend = await prisma.$queryRaw<any[]>`
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
    const conversionStats = await prisma.$queryRaw<any[]>`
      SELECT 
        (SELECT COUNT(*) FROM "inquiries" WHERE "createdAt" >= ${startDate}) as totalInquiries,
        (SELECT COUNT(*) FROM "quotations" WHERE "createdAt" >= ${startDate}) as totalQuotations,
        (SELECT COUNT(*) FROM "orders" WHERE "createdAt" >= ${startDate}) as totalOrders
    `;

    // 订单金额区间统计
    const amountRangeStats = await prisma.$queryRaw<any[]>`
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
    const conversionData = conversionStats[0] as any;
    const inquiryToQuotationRate = conversionData.totalinquiries > 0 
      ? (parseFloat(conversionData.totalquotations) / parseFloat(conversionData.totalinquiries)) * 100 
      : 0;
    const quotationToOrderRate = conversionData.totalquotations > 0 
      ? (parseFloat(conversionData.totalorders) / parseFloat(conversionData.totalquotations)) * 100 
      : 0;
    const inquiryToOrderRate = conversionData.totalinquiries > 0 
      ? (parseFloat(conversionData.totalorders) / parseFloat(conversionData.totalinquiries)) * 100 
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        summary: summary[0] || {
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
        statusDistribution: statusDistribution.map((item: any) => ({
          status: item.status,
          orderCount: parseInt(item.ordercount),
          totalAmount: parseFloat(item.totalamount),
        })),
        orderTrend: orderTrend.map((item: any) => ({
          date: new Date(item.date).toISOString(),
          orderCount: parseInt(item.ordercount),
          totalAmount: parseFloat(item.totalamount),
        })),
        conversion: {
          totalInquiries: parseInt(conversionData.totalinquiries),
          totalQuotations: parseInt(conversionData.totalquotations),
          totalOrders: parseInt(conversionData.totalorders),
          inquiryToQuotationRate: parseFloat(inquiryToQuotationRate.toFixed(2)),
          quotationToOrderRate: parseFloat(quotationToOrderRate.toFixed(2)),
          inquiryToOrderRate: parseFloat(inquiryToOrderRate.toFixed(2)),
        },
        amountRangeStats: amountRangeStats.map((item: any) => ({
          amountRange: item.amountrange,
          orderCount: parseInt(item.ordercount),
        })),
      },
    });
  } catch (error) {
    console.error('Order dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch order data' },
      { status: 500 }
    );
  }
}
