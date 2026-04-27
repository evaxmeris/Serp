import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-simple';
import bcrypt from 'bcryptjs';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';

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

    // 使用事务确保原子性：检查 PENDING 状态 + 创建用户 + 更新状态
    // 防止并发请求同时通过状态检查导致的重复创建用户
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

        // 检查邮箱是否已被注册（事务内确保一致性）
        const existingUser = await tx.user.findUnique({
          where: { email: reg.email },
        });

        if (existingUser) {
          throw new Error('EMAIL_EXISTS');
        }

        // 创建正式用户，密码使用注册申请中的密码Hash
        const createdUser = await tx.user.create({
          data: {
            email: reg.email,
            name: reg.name || reg.username,
            passwordHash: reg.passwordHash,
            role: 'VIEWER', // 默认访客角色，可后续修改
            isApproved: true, // 已批准
          },
        });

        // 更新注册申请状态为已批准
        await tx.userRegistration.update({
          where: { id: registrationId },
          data: {
            status: 'APPROVED',
            approvedById: currentUser.id,
            approvedAt: new Date(),
          },
        });

        return createdUser;
      });
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json(
          { error: '注册申请不存在' },
          { status: 404 }
        );
      }
      if (error.message === 'ALREADY_PROCESSED') {
        return NextResponse.json(
          { error: '该申请已处理，不能重复操作' },
          { status: 400 }
        );
      }
      if (error.message === 'EMAIL_EXISTS') {
        return NextResponse.json(
          { error: '该邮箱已被注册' },
          { status: 400 }
        );
      }
      throw error; // 其他异常抛给外层 catch 处理
    }

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
