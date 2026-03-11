import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 客户统计数据 API
 * GET /api/dashboard/customers
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

    // 客户汇总统计
    const summary = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as totalCustomers,
        COUNT(CASE WHEN "createdAt" >= ${startDate} THEN 1 END) as newCustomers,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as activeCustomers,
        COUNT(CASE WHEN status = 'INACTIVE' THEN 1 END) as inactiveCustomers
      FROM "customers"
    `;

    // 客户增长趋势
    const growthTrend = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE_TRUNC('day', "createdAt") as date,
        COUNT(*) as newCustomers
      FROM "customers"
      WHERE "createdAt" >= ${startDate}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `;

    // 客户订单统计（TOP 客户）
    const topCustomers = await prisma.$queryRaw<any[]>`
      SELECT 
        c.id,
        c."companyName",
        c."contactName",
        c."country",
        COUNT(o.id) as orderCount,
        SUM(o."totalAmount") as totalRevenue,
        AVG(o."totalAmount") as avgOrderValue
      FROM "customers" c
      LEFT JOIN "orders" o ON c.id = o."customerId"
      WHERE o."createdAt" >= ${startDate}
      GROUP BY c.id, c."companyName", c."contactName", c."country"
      ORDER BY totalRevenue DESC
      LIMIT 10
    `;

    // 客户地区分布
    const regionDistribution = await prisma.$queryRaw<any[]>`
      SELECT 
        COALESCE("country", 'Unknown') as country,
        COUNT(*) as customerCount
      FROM "customers"
      GROUP BY "country"
      ORDER BY customerCount DESC
      LIMIT 10
    `;

    // 客户来源统计
    const sourceDistribution = await prisma.$queryRaw<any[]>`
      SELECT 
        COALESCE("source", 'Unknown') as source,
        COUNT(*) as customerCount
      FROM "customers"
      GROUP BY "source"
      ORDER BY customerCount DESC
    `;

    return NextResponse.json({
      success: true,
      data: {
        summary: summary[0] || {
          totalCustomers: 0,
          newCustomers: 0,
          activeCustomers: 0,
          inactiveCustomers: 0,
        },
        growthTrend: growthTrend.map((item: any) => ({
          date: new Date(item.date).toISOString(),
          newCustomers: parseInt(item.newcustomers),
        })),
        topCustomers: topCustomers.map((item: any) => ({
          id: item.id,
          companyName: item.companyname,
          contactName: item.contactname,
          country: item.country,
          orderCount: parseInt(item.ordercount),
          totalRevenue: parseFloat(item.totalrevenue),
          avgOrderValue: parseFloat(item.avgordervalue),
        })),
        regionDistribution: regionDistribution.map((item: any) => ({
          country: item.country,
          customerCount: parseInt(item.customercount),
        })),
        sourceDistribution: sourceDistribution.map((item: any) => ({
          source: item.source,
          customerCount: parseInt(item.customercout),
        })),
      },
    });
  } catch (error) {
    console.error('Customer dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customer data' },
      { status: 500 }
    );
  }
}
