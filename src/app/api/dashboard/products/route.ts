import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 产品统计数据 API
 * GET /api/dashboard/products
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

    // 产品汇总统计
    const summary = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as totalProducts,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as activeProducts,
        COUNT(CASE WHEN status = 'INACTIVE' THEN 1 END) as inactiveProducts,
        COUNT(CASE WHEN "createdAt" >= ${startDate} THEN 1 END) as newProducts
      FROM "products"
    `;

    // 产品分类统计
    const categoryStats = await prisma.$queryRaw<any[]>`
      SELECT 
        COALESCE("category", 'Uncategorized') as category,
        COUNT(*) as productCount,
        SUM(CASE WHEN oi.id IS NOT NULL THEN oi.quantity ELSE 0 END) as totalQuantity,
        SUM(CASE WHEN oi.id IS NOT NULL THEN oi.amount ELSE 0 END) as totalRevenue
      FROM "products" p
      LEFT JOIN "order_items" oi ON p.id = oi."productId"
      LEFT JOIN "orders" o ON oi."orderId" = o.id AND o."createdAt" >= ${startDate}
      GROUP BY "category"
      ORDER BY totalRevenue DESC
    `;

    // 畅销产品 TOP 10
    const topProducts = await prisma.$queryRaw<any[]>`
      SELECT 
        p.id,
        p."sku",
        p."name",
        p."category",
        p."salePrice",
        COUNT(oi.id) as orderCount,
        SUM(oi.quantity) as totalQuantity,
        SUM(oi.amount) as totalRevenue
      FROM "products" p
      LEFT JOIN "order_items" oi ON p.id = oi."productId"
      LEFT JOIN "orders" o ON oi."orderId" = o.id
      WHERE o."createdAt" >= ${startDate}
      GROUP BY p.id, p."sku", p."name", p."category", p."salePrice"
      ORDER BY totalRevenue DESC
      LIMIT 10
    `;

    // 库存预警产品
    const lowStockProducts = await prisma.$queryRaw<any[]>`
      SELECT 
        p.id,
        p."sku",
        p."name",
        p."category",
        COALESCE(SUM(i.quantity), 0) as currentStock,
        COALESCE(p.moq, 0) as minStock
      FROM "products" p
      LEFT JOIN "inventory_items" i ON p.id = i."productId"
      GROUP BY p.id, p."sku", p."name", p."category", p.moq
      HAVING COALESCE(SUM(i.quantity), 0) < COALESCE(p.moq, 0)
         OR COALESCE(SUM(i.quantity), 0) = 0
      ORDER BY currentStock ASC
      LIMIT 10
    `;

    // 产品价格区间统计
    const priceRangeStats = await prisma.$queryRaw<any[]>`
      SELECT 
        CASE 
          WHEN "salePrice" < 10 THEN '0-10'
          WHEN "salePrice" < 50 THEN '10-50'
          WHEN "salePrice" < 100 THEN '50-100'
          WHEN "salePrice" < 500 THEN '100-500'
          ELSE '500+'
        END as priceRange,
        COUNT(*) as productCount
      FROM "products"
      GROUP BY priceRange
      ORDER BY MIN("salePrice")
    `;

    return NextResponse.json({
      success: true,
      data: {
        summary: summary[0] || {
          totalProducts: 0,
          activeProducts: 0,
          inactiveProducts: 0,
          newProducts: 0,
        },
        categoryStats: categoryStats.map((item: any) => ({
          category: item.category,
          productCount: parseInt(item.productcount),
          totalQuantity: parseInt(item.totalquantity),
          totalRevenue: parseFloat(item.totalrevenue),
        })),
        topProducts: topProducts.map((item: any) => ({
          id: item.id,
          sku: item.sku,
          name: item.name,
          category: item.category,
          salePrice: parseFloat(item.saleprice),
          orderCount: parseInt(item.ordercount),
          totalQuantity: parseInt(item.totalquantity),
          totalRevenue: parseFloat(item.totalrevenue),
        })),
        lowStockProducts: lowStockProducts.map((item: any) => ({
          id: item.id,
          sku: item.sku,
          name: item.name,
          category: item.category,
          currentStock: parseInt(item.currentstock),
          minStock: parseInt(item.minstock),
        })),
        priceRangeStats: priceRangeStats.map((item: any) => ({
          priceRange: item.pricerange,
          productCount: parseInt(item.productcount),
        })),
      },
    });
  } catch (error) {
    console.error('Product dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product data' },
      { status: 500 }
    );
  }
}
