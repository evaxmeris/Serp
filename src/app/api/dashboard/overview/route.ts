import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 数据看板总览 API
 * GET /api/dashboard/overview
 * 
 * 返回所有核心指标的汇总数据
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // 销售核心指标
    const salesMetrics = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as totalOrders,
        SUM("totalAmount") as totalRevenue,
        AVG("totalAmount") as avgOrderValue,
        COUNT(DISTINCT "customerId") as activeCustomers
      FROM "orders"
      WHERE "createdAt" >= ${startDate}
    `;

    // 客户核心指标
    const customerMetrics = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as totalCustomers,
        COUNT(CASE WHEN "createdAt" >= ${startDate} THEN 1 END) as newCustomers,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as activeCustomers
      FROM "customers"
    `;

    // 产品核心指标
    const productMetrics = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as totalProducts,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as activeProducts,
        COUNT(CASE WHEN "createdAt" >= ${startDate} THEN 1 END) as newProducts
      FROM "products"
    `;

    // 询盘/报价转化指标
    const conversionMetrics = await prisma.$queryRaw<any[]>`
      SELECT 
        (SELECT COUNT(*) FROM "inquiries" WHERE "createdAt" >= ${startDate}) as totalInquiries,
        (SELECT COUNT(*) FROM "quotations" WHERE "createdAt" >= ${startDate}) as totalQuotations,
        (SELECT COUNT(*) FROM "orders" WHERE "createdAt" >= ${startDate}) as totalOrders
    `;

    // 库存预警数量
    const inventoryAlert = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as alertCount
      FROM "inventory_items" i
      JOIN "products" p ON i."productId" = p.id
      WHERE i.quantity < COALESCE(p.moq, 0)
    `;

    // 待处理订单数量
    const pendingOrders = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as pendingCount
      FROM "orders"
      WHERE status IN ('PENDING', 'CONFIRMED')
    `;

    // 计算转化率
    const convData = conversionMetrics[0] as any;
    const inquiryToQuotationRate = convData.totalinquiries > 0 
      ? (parseFloat(convData.totalquotations) / parseFloat(convData.totalinquiries)) * 100 
      : 0;
    const quotationToOrderRate = convData.totalquotations > 0 
      ? (parseFloat(convData.totalorders) / parseFloat(convData.totalquotations)) * 100 
      : 0;

    // 计算环比增长（与上一个周期对比）
    const prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - days);

    const prevSales = await prisma.$queryRaw<any[]>`
      SELECT SUM("totalAmount") as prevRevenue
      FROM "orders"
      WHERE "createdAt" >= ${prevStartDate} AND "createdAt" < ${startDate}
    `;

    const currentRevenue = parseFloat(salesMetrics[0].totalrevenue || 0);
    const prevRevenue = parseFloat(prevSales[0].prevrevenue || 0);
    const revenueGrowth = prevRevenue > 0 
      ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        sales: {
          totalOrders: parseInt(salesMetrics[0].totalorders),
          totalRevenue: parseFloat(salesMetrics[0].totalrevenue),
          avgOrderValue: parseFloat(salesMetrics[0].avgordervalue),
          activeCustomers: parseInt(salesMetrics[0].activecustomers),
          growth: parseFloat(revenueGrowth.toFixed(2)),
        },
        customers: {
          totalCustomers: parseInt(customerMetrics[0].totalcustomers),
          newCustomers: parseInt(customerMetrics[0].newcustomers),
          activeCustomers: parseInt(customerMetrics[0].activecustomers),
        },
        products: {
          totalProducts: parseInt(productMetrics[0].totalproducts),
          activeProducts: parseInt(productMetrics[0].activeproducts),
          newProducts: parseInt(productMetrics[0].newproducts),
        },
        conversion: {
          totalInquiries: parseInt(convData.totalinquiries),
          totalQuotations: parseInt(convData.totalquotations),
          totalOrders: parseInt(convData.totalorders),
          inquiryToQuotationRate: parseFloat(inquiryToQuotationRate.toFixed(2)),
          quotationToOrderRate: parseFloat(quotationToOrderRate.toFixed(2)),
        },
        alerts: {
          lowStockItems: parseInt(inventoryAlert[0].alertcount),
          pendingOrders: parseInt(pendingOrders[0].pendingcount),
        },
        period: {
          days,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('Dashboard overview API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
