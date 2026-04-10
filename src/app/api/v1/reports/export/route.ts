/**
 * 报表导出 API
 * 提供报表导出功能，支持 PDF、Excel、CSV 格式
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';

/**
 * GET /api/v1/reports/export
 * 获取导出历史记录
 */
export async function GET(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const reportId = searchParams.get('reportId');
    const status = searchParams.get('status');

    const where: any = {};
    if (reportId) where.reportId = reportId;
    if (status) where.status = status;

    const logs = await prisma.reportExportLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return NextResponse.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('获取导出记录失败:', error);
    return NextResponse.json(
      { error: '获取导出记录失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/reports/export
 * 导出报表
 */
export async function POST(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { reportId, format = 'excel', filters } = body;

    if (!reportId) {
      return NextResponse.json(
        { error: '缺少报表 ID' },
        { status: 400 }
      );
    }

    // 创建导出记录
    const exportLog = await prisma.reportExportLog.create({
      data: {
        reportId,
        userId: 'system', // TODO: 从 session 获取
        exportType: 'IMMEDIATE',
        format,
        status: 'pending'
      }
    });

    // TODO: 异步执行导出任务
    // await performExport(exportLog.id, reportId, format, filters);

    return NextResponse.json({
      success: true,
      data: exportLog,
      message: '导出任务已创建，请稍后查询状态'
    });
  } catch (error) {
    console.error('创建导出任务失败:', error);
    return NextResponse.json(
      { error: '创建导出任务失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
