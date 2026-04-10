import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

interface ApproveParams {
  userId: string;
}

/**
 * POST /api/auth/approve/:userId - 管理员审批用户注册
 * 审批通过后正式创建用户账号
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<ApproveParams> }
) {
  try {
    const { userId: registrationId } = await params;
    const body = await request.json();
    const { approved, rejectReason } = body;

    // 获取当前登录用户（审批人）
    const currentSession = await getCurrentUser(request);
    if (!currentSession) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 检查当前用户是否有审批权限（需要管理员角色）
    if (currentSession.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    // 获取注册申请
    const registration = await prisma.userRegistration.findUnique({
      where: { id: registrationId },
    });

    if (!registration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    // 检查是否已审批过
    if (registration.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'This registration has already been processed' },
        { status: 400 }
      );
    }

    // 创建正式用户
    // 只复制 User 模型中存在的字段，UserRegistration 有额外字段但 User 不需要
    const user = await prisma.user.create({
      data: {
        email: registration.email,
        passwordHash: registration.passwordHash,
        name: registration.name,
        role: 'SALES', // 默认角色为业务员
      },
    });

    // 更新注册申请状态
    await prisma.userRegistration.update({
      where: { id: registrationId },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        approvedById: currentSession.user.id,
        rejectReason,
      },
    });

    if (!approved) {
      // 删除已拒绝的申请
      await prisma.userRegistration.delete({
        where: { id: registrationId },
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: approved
          ? 'Registration approved, user account created'
          : 'Registration rejected, request deleted',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error approving registration:', error);
    return NextResponse.json(
      { error: 'Failed to process approval' },
      { status: 500 }
    );
  }
}
