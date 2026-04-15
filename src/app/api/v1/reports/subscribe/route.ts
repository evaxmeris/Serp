/**
 * 报表订阅 API
 * 管理用户对报表的订阅配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { sendEmail } from '@/lib/email';
import { validateOrReturn } from '@/lib/api-validation';
import { CreateSubscriptionSchema } from '@/lib/api-schemas';

/**
 * GET /api/v1/reports/subscribe
 * 获取订阅列表
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
    const userId = searchParams.get('userId');
    const isActive = searchParams.get('isActive');

    const where: any = {};
    if (reportId) where.reportId = reportId;
    if (userId) where.userId = userId;
    if (isActive !== null) where.isActive = isActive === 'true';

    const subscriptions = await prisma.reportSubscription.findMany({
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
      data: subscriptions
    });
  } catch (error) {
    console.error('获取订阅列表失败:', error);
    return NextResponse.json(
      { error: '获取订阅列表失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/reports/subscribe
 * 创建订阅
 */
export async function POST(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const v = validateOrReturn(CreateSubscriptionSchema, body);
    if (!v.success) return v.response;
    const { reportId, frequency, format = 'pdf' as const, email } = v.data;
    const { userId } = body as any;

    if (!reportId || !userId || !frequency) {
      return NextResponse.json(
        { error: '缺少必要的参数：reportId, userId, frequency' },
        { status: 400 }
      );
    }

    // 验证频率
    const validFrequencies = ['DAILY', 'WEEKLY', 'MONTHLY'];
    if (!validFrequencies.includes(frequency)) {
      return NextResponse.json(
        { error: '无效的订阅频率' },
        { status: 400 }
      );
    }

    // 计算下次发送时间
    const nextSendAt = calculateNextSendTime(frequency);

    const subscription = await prisma.reportSubscription.create({
      data: {
        reportId,
        userId,
        frequency,
        format,
        email,
        isActive: true,
        nextSendAt
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

    // BUG-S6-005 修复：发送订阅确认邮件
    if (email) {
      try {
        await sendConfirmationEmail(email, subscription);
      } catch (emailError) {
        // 邮件发送失败不影响订阅创建，但记录错误日志
        console.error('发送订阅确认邮件失败:', emailError);
      }
    }

    return NextResponse.json({
      success: true,
      data: subscription,
      message: '订阅创建成功，确认邮件已发送'
    });
  } catch (error) {
    console.error('创建订阅失败:', error);
    return NextResponse.json(
      { error: '创建订阅失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/reports/subscribe
 * 更新订阅
 */
export async function PUT(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, frequency, format, email, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: '缺少订阅 ID' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (frequency) updateData.frequency = frequency;
    if (format) updateData.format = format;
    if (email !== undefined) updateData.email = email;
    if (isActive !== undefined) updateData.isActive = isActive;

    const subscription = await prisma.reportSubscription.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      data: subscription,
      message: '订阅更新成功'
    });
  } catch (error) {
    console.error('更新订阅失败:', error);
    return NextResponse.json(
      { error: '更新订阅失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/reports/subscribe
 * 取消订阅
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
        { error: '缺少订阅 ID' },
        { status: 400 }
      );
    }

    await prisma.reportSubscription.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: '订阅取消成功'
    });
  } catch (error) {
    console.error('取消订阅失败:', error);
    return NextResponse.json(
      { error: '取消订阅失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * 计算下次发送时间
 */
function calculateNextSendTime(frequency: string): Date {
  const now = new Date();
  const next = new Date(now);

  switch (frequency) {
    case 'DAILY':
      next.setDate(next.getDate() + 1);
      next.setHours(8, 0, 0, 0);
      break;
    case 'WEEKLY':
      next.setDate(next.getDate() + (1 - next.getDay() + 7) % 7);
      next.setHours(8, 0, 0, 0);
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      next.setDate(1);
      next.setHours(8, 0, 0, 0);
      break;
  }

  return next;
}

/**
 * BUG-S6-005 修复：发送订阅确认邮件
 */
async function sendConfirmationEmail(email: string, subscription: any) {
  const frequencyMap: Record<string, string> = {
    'DAILY': '每日',
    'WEEKLY': '每周',
    'MONTHLY': '每月'
  };

  const subject = `报表订阅确认 - ${subscription.report.name}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">订阅确认</h2>
      <p>您好！</p>
      <p>您已成功订阅以下报表：</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p><strong>报表名称：</strong>${subscription.report.name}</p>
        <p><strong>报表代码：</strong>${subscription.report.code}</p>
        <p><strong>发送频率：</strong>${frequencyMap[subscription.frequency] || subscription.frequency}</p>
        <p><strong>报表格式：</strong>${subscription.format.toUpperCase()}</p>
        <p><strong>下次发送：</strong>${new Date(subscription.nextSendAt).toLocaleDateString('zh-CN')}</p>
      </div>
      <p>从下次发送时间开始，您将定期收到该报表。</p>
      <p>如需取消订阅，请登录系统或在收到报表时点击取消订阅链接。</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
      <p style="color: #999; font-size: 12px;">此邮件由 Trade ERP 系统自动发送，请勿回复。</p>
    </div>
  `;

  // 调用邮件服务发送确认邮件
  await sendEmail({
    to: email,
    subject,
    html,
    text: `您已成功订阅报表：${subscription.report.name}，发送频率：${frequencyMap[subscription.frequency] || subscription.frequency}`
  });
}
