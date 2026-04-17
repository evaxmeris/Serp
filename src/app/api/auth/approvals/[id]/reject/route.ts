import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-simple';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';

/**
 * POST /api/auth/approvals/[id]/reject - 拒绝注册申请
 * 管理员拒绝申请，更新状态为 REJECTED 并记录拒绝原因
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证管理员权限
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '无权限访问' },
        { status: 403 }
      );
    }

    const { id: registrationId } = await params;

    // 安全解析 JSON body，允许空 body
    let body: any = {};
    try {
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const text = await request.text();
        body = text ? JSON.parse(text) : {};
      }
    } catch {
      body = {};
    }

    const v = validateOrReturn(z.object({ reason: z.string().optional() }), body);
    if (!v.success) return v.response;
    const { reason } = v.data;

    // 查询注册申请
    const registration = await prisma.userRegistration.findUnique({
      where: { id: registrationId },
    });

    if (!registration) {
      return NextResponse.json(
        { error: '注册申请不存在' },
        { status: 404 }
      );
    }

    if (registration.status !== 'PENDING') {
      return NextResponse.json(
        { error: '该申请已处理，不能重复操作' },
        { status: 400 }
      );
    }

    // 更新注册申请状态为拒绝
    await prisma.userRegistration.update({
      where: { id: registrationId },
      data: {
        status: 'REJECTED',
        approvedById: currentUser.id,
        approvedAt: new Date(),
        rejectReason: reason || '未提供原因',
      },
    });

    return NextResponse.json({
      success: true,
      message: '已拒绝该注册申请',
    });
  } catch (error) {
    console.error('Error rejecting registration:', error);
    return NextResponse.json(
      { error: '拒绝失败，请重试' },
      { status: 500 }
    );
  }
}
