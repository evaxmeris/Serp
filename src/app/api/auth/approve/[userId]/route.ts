import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';

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
    const v = validateOrReturn(z.object({ approved: z.boolean().optional(), reason: z.string().optional() }), body);
    if (!v.success) return v.response;
    const { approved, reason: rejectReason } = v.data;

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

    // 使用事务确保原子性：检查 PENDING 状态 + 创建用户 + 更新状态
    // 防止并发请求同时通过状态检查导致的竞态条件
    let user;
    try {
      user = await prisma.$transaction(async (tx) => {
        // 在事务内重新查询，获取最新状态（避免 TOCTOU 竞态条件）
        const reg = await tx.userRegistration.findUnique({
          where: { id: registrationId },
        });

        if (!reg) {
          throw new Error('NOT_FOUND');
        }

        if (reg.status !== 'PENDING') {
          throw new Error('ALREADY_PROCESSED');
        }

        // 创建正式用户
        // 只复制 User 模型中存在的字段，UserRegistration 有额外字段但 User 不需要
        const createdUser = await tx.user.create({
          data: {
            email: reg.email,
            passwordHash: reg.passwordHash,
            name: reg.name,
            role: 'SALES', // 默认角色为业务员
          },
        });

        // 更新注册申请状态
        await tx.userRegistration.update({
          where: { id: registrationId },
          data: {
            status: approved ? 'APPROVED' : 'REJECTED',
            approvedById: currentSession.user.id,
            rejectReason,
          },
        });

        if (!approved) {
          // 删除已拒绝的申请
          await tx.userRegistration.delete({
            where: { id: registrationId },
          });
        }

        return createdUser;
      });
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json(
          { error: 'Registration not found' },
          { status: 404 }
        );
      }
      if (error.message === 'ALREADY_PROCESSED') {
        return NextResponse.json(
          { error: 'This registration has already been processed' },
          { status: 400 }
        );
      }
      throw error; // 其他异常抛给外层 catch 处理
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
