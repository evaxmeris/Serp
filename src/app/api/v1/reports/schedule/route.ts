/**
 * 报表定时任务 API
 * 管理报表的自动生成调度
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';

/**
 * GET /api/v1/reports/schedule
 * 获取定时任务列表
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
    const isActive = searchParams.get('isActive');

    const where: any = {};
    if (reportId) where.reportId = reportId;
    if (isActive !== null) where.isActive = isActive === 'true';

    const schedules = await prisma.reportSchedule.findMany({
      where,
      include: {
        report: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      data: schedules
    });
  } catch (error) {
    console.error('获取定时任务失败:', error);
    return NextResponse.json(
      { error: '获取定时任务失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/reports/schedule
 * 创建定时任务
 */
export async function POST(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const v = validateOrReturn(z.object({ reportId: z.string(), name: z.string(), cronExpression: z.string(), timezone: z.string().optional(), config: z.record(z.string(), z.any()).optional() }), body);
    if (!v.success) return v.response;
    const { reportId, name, cronExpression, timezone = 'Asia/Shanghai', config } = v.data;

    if (!reportId || !name || !cronExpression) {
      return NextResponse.json(
        { error: '缺少必要的参数：reportId, name, cronExpression' },
        { status: 400 }
      );
    }

    // 验证 cron 表达式（简单验证）
    const cronParts = cronExpression.split(' ');
    if (cronParts.length < 5) {
      return NextResponse.json(
        { error: '无效的 cron 表达式' },
        { status: 400 }
      );
    }

    const schedule = await prisma.reportSchedule.create({
      data: {
        reportId,
        name,
        cronExpression,
        timezone,
        config: config ? (JSON.parse(JSON.stringify(config)) as any) : {},
        isActive: true
      },
      include: {
        report: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: schedule,
      message: '定时任务创建成功'
    });
  } catch (error) {
    console.error('创建定时任务失败:', error);
    return NextResponse.json(
      { error: '创建定时任务失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/reports/schedule
 * 更新定时任务
 */
export async function PUT(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, cronExpression, timezone, config, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: '缺少任务 ID' },
        { status: 400 }
      );
    }

    const schedule = await prisma.reportSchedule.update({
      where: { id },
      data: {
        name,
        cronExpression,
        timezone,
        config,
        isActive
      }
    });

    return NextResponse.json({
      success: true,
      data: schedule,
      message: '定时任务更新成功'
    });
  } catch (error) {
    console.error('更新定时任务失败:', error);
    return NextResponse.json(
      { error: '更新定时任务失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/reports/schedule
 * 删除定时任务
 */
export async function DELETE(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '缺少任务 ID' },
        { status: 400 }
      );
    }

    await prisma.reportSchedule.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: '定时任务删除成功'
    });
  } catch (error) {
    console.error('删除定时任务失败:', error);
    return NextResponse.json(
      { error: '删除定时任务失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
