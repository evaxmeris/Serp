import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-simple';
import bcrypt from 'bcryptjs';

/**
 * POST /api/auth/approvals/[id]/approve - 批准注册申请
 * 管理员批准后，在 User 表创建正式用户
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

    // 检查邮箱是否已被注册
    const existingUser = await prisma.user.findUnique({
      where: { email: registration.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: '该邮箱已被注册' },
        { status: 400 }
      );
    }

    // 创建正式用户，密码使用注册申请中的密码Hash
    const user = await prisma.user.create({
      data: {
        email: registration.email,
        name: registration.name || registration.username,
        passwordHash: registration.passwordHash,
        role: 'VIEWER', // 默认访客角色，可后续修改
        isApproved: true, // 已批准
      },
    });

    // 更新注册申请状态
    await prisma.userRegistration.update({
      where: { id: registrationId },
      data: {
        status: 'APPROVED',
        approvedById: currentUser.id,
        approvedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: '批准成功，用户已创建',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Error approving registration:', error);
    return NextResponse.json(
      { error: '批准失败，请重试' },
      { status: 500 }
    );
  }
}
