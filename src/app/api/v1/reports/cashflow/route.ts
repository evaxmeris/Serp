/**
 * 现金流量报表 API
 * 提供现金流数据的查询和统计
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';

/**
 * GET /api/v1/reports/cashflow
 * 获取现金流量报表数据
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
    const type = searchParams.get('type'); // operating/investing/financing

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: '缺少必要的日期参数' },
        { status: 400 }
      );
    }

    const cashflowData = await getCashflowData({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      type
    });

    return NextResponse.json({ success: true, data: cashflowData });
  } catch (error) {
    console.error('获取现金流量报表失败:', error);
    return NextResponse.json(
      { error: '获取现金流量报表失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/reports/cashflow
 * 生成现金流量报表
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

    const cashflowData = await getCashflowData({
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    });

    const report = await prisma.reportData.create({
      data: {
        reportId: 'cashflow-report',
        period: 'custom',
        periodStart: new Date(startDate),
        periodEnd: new Date(endDate),
        data: cashflowData,
        metrics: {
          netCashflow: cashflowData.summary.netCashflow,
          openingBalance: cashflowData.summary.openingBalance,
          closingBalance: cashflowData.summary.closingBalance
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: report,
      message: '现金流量报表生成成功'
    });
  } catch (error) {
    console.error('生成现金流量报表失败:', error);
    return NextResponse.json(
      { error: '生成现金流量报表失败' },
      { status: 500 }
    );
  }
}

async function getCashflowData(params: {
  startDate: Date;
  endDate: Date;
  type?: string | null;
}) {
  return {
    summary: {
      openingBalance: 0,
      closingBalance: 0,
      netCashflow: 0,
      operatingCashflow: 0,
      investingCashflow: 0,
      financingCashflow: 0
    },
    inflows: [],
    outflows: [],
    trends: []
  };
}
