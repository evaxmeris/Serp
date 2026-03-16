/**
 * 库存报表 API
 * 提供库存数据的查询、统计和分析
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/reports/inventory
 * 获取库存报表数据
 * 
 * 查询参数:
 * - warehouseId: 仓库 ID（可选）
 * - productId: 产品 ID（可选）
 * - categoryId: 品类 ID（可选）
 * - lowStock: 是否只显示低库存 (true/false)
 * - includeZero: 是否包含零库存 (true/false)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const warehouseId = searchParams.get('warehouseId');
    const productId = searchParams.get('productId');
    const categoryId = searchParams.get('categoryId');
    const lowStock = searchParams.get('lowStock') === 'true';
    const includeZero = searchParams.get('includeZero') === 'true';

    // 获取库存数据
    const inventoryData = await getInventoryData({
      warehouseId,
      productId,
      categoryId,
      lowStock,
      includeZero
    });

    return NextResponse.json({
      success: true,
      data: inventoryData
    });
  } catch (error) {
    console.error('获取库存报表失败:', error);
    return NextResponse.json(
      { error: '获取库存报表失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/reports/inventory
 * 生成库存报表
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { warehouseId, reportName, includeHistory } = body;

    // 获取库存数据
    const inventoryData = await getInventoryData({
      warehouseId,
      includeHistory: includeHistory === true
    });

    // 保存报表数据到数据库
    const report = await prisma.reportData.create({
      data: {
        reportId: 'inventory-report',
        period: 'current',
        periodStart: new Date(),
        periodEnd: new Date(),
        data: inventoryData,
        metrics: {
          totalValue: inventoryData.summary.totalValue,
          totalItems: inventoryData.summary.totalItems,
          lowStockItems: inventoryData.summary.lowStockItems
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: report,
      message: '库存报表生成成功'
    });
  } catch (error) {
    console.error('生成库存报表失败:', error);
    return NextResponse.json(
      { error: '生成库存报表失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * 获取库存数据
 */
async function getInventoryData(params: {
  warehouseId?: string | null;
  productId?: string | null;
  categoryId?: string | null;
  lowStock?: boolean;
  includeZero?: boolean;
  includeHistory?: boolean;
}) {
  const { warehouseId, productId, categoryId, lowStock, includeZero, includeHistory } = params;

  // 获取库存明细数据
  const inventoryItems = await prisma.inventoryItem.findMany({
    where: {
      ...(warehouseId && { warehouseId }),
      ...(productId && { productId }),
      ...(categoryId && { product: { category: categoryId } }),
      ...(!includeZero && { quantity: { gt: 0 } })
    },
    include: {
      product: true
    }
  });

  // 计算库龄分析
  const now = new Date();
  const itemsWithAging = inventoryItems.map(item => {
    // 使用创建时间计算库龄天数
    const firstInDate = new Date(item.createdAt);
    
    // 计算库龄天数
    const agingDays = Math.floor((now.getTime() - firstInDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // 库龄区间分类
    let agingCategory: string;
    if (agingDays <= 30) {
      agingCategory = '0-30 天';
    } else if (agingDays <= 60) {
      agingCategory = '31-60 天';
    } else if (agingDays <= 90) {
      agingCategory = '61-90 天';
    } else if (agingDays <= 180) {
      agingCategory = '91-180 天';
    } else if (agingDays <= 365) {
      agingCategory = '181-365 天';
    } else {
      agingCategory = '365 天以上';
    }

    return {
      ...item,
      agingDays,
      agingCategory,
      firstInDate
    };
  });

  // 汇总数据
  const summary = {
    totalItems: itemsWithAging.length,
    totalQuantity: itemsWithAging.reduce((sum, item) => sum + item.quantity, 0),
    totalValue: itemsWithAging.reduce((sum, item) => sum + (item.quantity * Number(item.product.costPrice || 0)), 0),
    lowStockItems: itemsWithAging.filter(item => item.quantity <= 0).length,
    outOfStockItems: itemsWithAging.filter(item => item.quantity === 0).length,
    overstockItems: itemsWithAging.filter(item => item.quantity > 999999).length
  };

  // 按库龄区间统计
  const agingAnalysis = {
    '0-30 天': itemsWithAging.filter(item => item.agingCategory === '0-30 天'),
    '31-60 天': itemsWithAging.filter(item => item.agingCategory === '31-60 天'),
    '61-90 天': itemsWithAging.filter(item => item.agingCategory === '61-90 天'),
    '91-180 天': itemsWithAging.filter(item => item.agingCategory === '91-180 天'),
    '181-365 天': itemsWithAging.filter(item => item.agingCategory === '181-365 天'),
    '365 天以上': itemsWithAging.filter(item => item.agingCategory === '365 天以上')
  };

  // 按仓库分组
  const byWarehouse = warehouseId 
    ? [] 
    : Array.from(new Set(itemsWithAging.map(item => item.warehouse))).map(warehouseId => {
        const items = itemsWithAging.filter(item => item.warehouse === warehouseId);
        return {
          warehouseId,
          warehouseName: warehouseId,
          totalItems: items.length,
          totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
          totalValue: items.reduce((sum, item) => sum + (item.quantity * Number(item.product.costPrice || 0)), 0)
        };
      });

  // 按品类分组
  const byCategory = categoryId
    ? []
    : Array.from(new Set(itemsWithAging.map(item => item.product.categoryId))).map(categoryId => {
        const items = itemsWithAging.filter(item => item.product.categoryId === categoryId);
        return {
          categoryId,
          categoryName: items[0]?.product.category?.name || '未知品类',
          totalItems: items.length,
          totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
          totalValue: items.reduce((sum, item) => sum + (item.quantity * Number(item.product.costPrice || 0)), 0)
        };
      });

  // 库存周转率计算
  const turnover = {
    turnoverRate: 0,
    daysOfInventory: 0
  };
  
  // TODO: 需要从销售数据计算周转率
  // turnoverRate = 销售成本 / 平均库存
  // daysOfInventory = 365 / turnoverRate

  // 历史趋势（如果 includeHistory 为 true）
  const history = includeHistory ? [] : undefined;

  return {
    summary,
    items: itemsWithAging,
    agingAnalysis,
    byWarehouse,
    byCategory,
    turnover,
    ...(history !== undefined && { history })
  };
}
