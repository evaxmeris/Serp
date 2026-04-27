import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-api';
import { errorResponse } from '@/lib/api-response';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCache, generateCacheKey } from '@/lib/cache';

// ============================================
// 类型定义
// ============================================

/** 销售核心指标 */
interface SalesMetrics {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  activeCustomers: number;
  growth: number;
}

/** 客户核心指标 */
interface CustomerMetrics {
  totalCustomers: number;
  newCustomers: number;
  activeCustomers: number;
}

/** 产品核心指标 */
interface ProductMetrics {
  totalProducts: number;
  activeProducts: number;
  newProducts: number;
}

/** 转化指标 */
interface ConversionMetrics {
  totalInquiries: number;
  totalQuotations: number;
  totalOrders: number;
  inquiryToQuotationRate: number;
  quotationToOrderRate: number;
}

/** 预警数据 */
interface AlertData {
  lowStockItems: number;
  pendingOrders: number;
}

/** 时间周期 */
interface PeriodData {
  days: number;
  startDate: string;
  endDate: string;
}

/** API 响应数据结构 */
interface OverviewDashboardData {
  sales: SalesMetrics;
  customers: CustomerMetrics;
  products: ProductMetrics;
  conversion: ConversionMetrics;
  alerts: AlertData;
  period: PeriodData;
}

/**
 * 数据看板总览 API
 * GET /api/dashboard/overview
 * 
 * 返回所有核心指标的汇总数据
 * ⚠️ 所有统计均排除软删除数据（deletedAt IS NULL）
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    
    // 生成缓存键
    const cacheKey = generateCacheKey('dashboard_overview', days);
    
    return await withCache(cacheKey, async () => {

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    const prevStartDate = new Date();
    prevStartDate.setDate(startDate.getDate() - days);

    // 使用 Promise.all 并行执行所有查询（优化：减少总响应时间）
    const [
      salesMetrics,
      customerMetrics,
      productMetrics,
      conversionMetrics,
      inventoryAlert,
      pendingOrders,
      pendingApprovalsRaw,
      prevSales
    ] = await Promise.all([
      // 1. 销售核心指标（排除软删除订单）
      prisma.$queryRaw<Array<{
        totalorders: string;
        totalrevenue: string;
        avgordervalue: string;
        activecustomers: string;
      }>>`
        SELECT 
          COUNT(*) as totalOrders,
          SUM("totalAmount") as totalRevenue,
          AVG("totalAmount") as avgOrderValue,
          COUNT(DISTINCT "customerId") as activeCustomers
        FROM "orders"
        WHERE "createdAt" >= ${startDate}
          AND "deletedAt" IS NULL
      `,
      
      // 2. 客户核心指标（排除软删除客户）
      prisma.$queryRaw<Array<{
        totalcustomers: string;
        newcustomers: string;
        activecustomers: string;
      }>>`
        SELECT 
          COUNT(*) as totalCustomers,
          COUNT(CASE WHEN "createdAt" >= ${startDate} THEN 1 END) as newCustomers,
          COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as activeCustomers
        FROM "customers"
        WHERE "deletedAt" IS NULL
      `,
      
      // 3. 产品核心指标（排除软删除产品）
      prisma.$queryRaw<Array<{
        totalproducts: string;
        activeproducts: string;
        newproducts: string;
      }>>`
        SELECT 
          COUNT(*) as totalProducts,
          COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as activeProducts,
          COUNT(CASE WHEN "createdAt" >= ${startDate} THEN 1 END) as newProducts
        FROM "products"
        WHERE "deletedAt" IS NULL
      `,
      
      // 4. 询盘/报价转化指标（均排除软删除）
      // 注意：totalQuotations 统计的是从询盘关联创建的报价（inquiryId IS NOT NULL），
      // 而非全部报价，以确保 inquiryToQuotationRate 能准确反映"询盘→报价"转化率。
      prisma.$queryRaw<Array<{
        totalinquiries: string;
        totalquotations: string;
        totalorders: string;
      }>>`
        SELECT 
          (SELECT COUNT(*) FROM "inquiries" WHERE "createdAt" >= ${startDate} AND "deletedAt" IS NULL) as totalInquiries,
          (SELECT COUNT(*) FROM "quotations" WHERE "createdAt" >= ${startDate} AND "deletedAt" IS NULL AND "inquiryId" IS NOT NULL) as totalQuotations,
          (SELECT COUNT(*) FROM "orders" WHERE "createdAt" >= ${startDate} AND "deletedAt" IS NULL) as totalOrders
      `,
      
      // 5. 库存预警数量（排除软删除产品）
      prisma.$queryRaw<Array<{
        alertcount: string;
      }>>`
        SELECT COUNT(*) as alertCount
        FROM "inventory_items" i
        JOIN "products" p ON i."productId" = p.id
        WHERE i.quantity < COALESCE(p.moq, 0)
          AND p."deletedAt" IS NULL
      `,
      
      // 6. 待处理订单数量（排除软删除订单）
      prisma.$queryRaw<Array<{
        pendingcount: string;
      }>>`
        SELECT COUNT(*) as pendingCount
        FROM "orders"
        WHERE status IN ('PENDING', 'CONFIRMED')
          AND "deletedAt" IS NULL
      `,
      
      // 8. 待审批数量
      prisma.$queryRaw<Array<{ pendingcount: string }>>`
        SELECT COUNT(*) as pendingCount
        FROM "approval_instances"
        WHERE status = 'IN_PROGRESS'
      `,

      // 9. 上一周期销售额（用于计算环比增长，排除软删除）
      prisma.$queryRaw<Array<{
        prevrevenue: string;
      }>>`
        SELECT SUM("totalAmount") as prevRevenue
        FROM "orders"
        WHERE "createdAt" >= ${prevStartDate} AND "createdAt" < ${startDate}
          AND "deletedAt" IS NULL
      `
    ]);

    // 计算转化率
    const convData = conversionMetrics[0];
    const totalInquiries = convData ? parseInt(convData.totalinquiries) : 0;
    const totalQuotations = convData ? parseInt(convData.totalquotations) : 0;
    const totalOrdersCount = convData ? parseInt(convData.totalorders) : 0;

    const inquiryToQuotationRate = totalInquiries > 0 
      ? (totalQuotations / totalInquiries) * 100 
      : 0;
    const quotationToOrderRate = totalQuotations > 0 
      ? (totalOrdersCount / totalQuotations) * 100 
      : 0;

    // 计算环比增长（与上一个周期对比）
    const currentRevenue = salesMetrics[0] ? parseFloat(salesMetrics[0].totalrevenue) : 0;
    const prevRevenue = prevSales[0] ? parseFloat(prevSales[0].prevrevenue) : 0;
    const revenueGrowth = prevRevenue > 0 
      ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 
      : 0;

    // 构建响应数据
    const responseData: OverviewDashboardData = {
      sales: {
        totalOrders: salesMetrics[0] ? parseInt(salesMetrics[0].totalorders) : 0,
        totalRevenue: currentRevenue,
        avgOrderValue: salesMetrics[0] ? parseFloat(salesMetrics[0].avgordervalue) : 0,
        activeCustomers: salesMetrics[0] ? parseInt(salesMetrics[0].activecustomers) : 0,
        growth: parseFloat(revenueGrowth.toFixed(2)),
      },
      customers: {
        totalCustomers: customerMetrics[0] ? parseInt(customerMetrics[0].totalcustomers) : 0,
        newCustomers: customerMetrics[0] ? parseInt(customerMetrics[0].newcustomers) : 0,
        activeCustomers: customerMetrics[0] ? parseInt(customerMetrics[0].activecustomers) : 0,
      },
      products: {
        totalProducts: productMetrics[0] ? parseInt(productMetrics[0].totalproducts) : 0,
        activeProducts: productMetrics[0] ? parseInt(productMetrics[0].activeproducts) : 0,
        newProducts: productMetrics[0] ? parseInt(productMetrics[0].newproducts) : 0,
      },
      conversion: {
        totalInquiries,
        totalQuotations,
        totalOrders: totalOrdersCount,
        inquiryToQuotationRate: parseFloat(inquiryToQuotationRate.toFixed(2)),
        quotationToOrderRate: parseFloat(quotationToOrderRate.toFixed(2)),
      },
      alerts: {
        lowStockItems: inventoryAlert[0] ? parseInt(inventoryAlert[0].alertcount) : 0,
        pendingOrders: pendingOrders[0] ? parseInt(pendingOrders[0].pendingcount) : 0,
        pendingApprovals: pendingApprovalsRaw[0] ? parseInt(pendingApprovalsRaw[0].pendingcount) : 0,
      },
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    };

      return NextResponse.json({
        success: true,
        data: responseData,
      });
    });
  } catch (error) {
    console.error('Dashboard overview API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
