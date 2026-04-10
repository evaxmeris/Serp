/**
 * 采购报表 API
 * 提供采购数据的查询和统计
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';

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
  return {
    summary: {
      totalAmount: 0,
      totalOrders: 0,
      totalQuantity: 0,
      averageOrderValue: 0
    },
    bySupplier: [],
    byProduct: [],
    trends: []
  };
}
