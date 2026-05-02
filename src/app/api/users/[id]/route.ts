import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import bcrypt from 'bcryptjs';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';
import { successResponse, errorResponse, forbiddenResponse, notFoundResponse } from '@/lib/api-response';

// PATCH/PUT /api/users/[id] - 更新用户
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 获取当前登录用户
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    // 只有管理员可以更新用户
    if (currentUser.role !== 'ADMIN') {
      return forbiddenResponse('权限不足');
    }

    const body = await request.json();
    const v = validateOrReturn(z.object({ email: z.string().email().optional(), name: z.string().optional(), role: z.string().optional(), password: z.string().optional(), isApproved: z.boolean().optional() }), body);
    if (!v.success) return v.response;
    const { email, name, password, role, isApproved } = v.data;

    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return notFoundResponse('用户');
    }

    // 构建更新数据
    const updateData: any = {};
    if (email !== undefined) updateData.email = email;
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (isApproved !== undefined) updateData.isApproved = isApproved;
    
    // 如果提供了新密码，加密后更新
    if (password && password.trim()) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isApproved: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return successResponse(updatedUser, '用户更新成功');
  } catch (error) {
    console.error('Error updating user:', error);
    return errorResponse('更新用户失败', 'INTERNAL_ERROR', 500);
  }
}

// DELETE /api/users/[id] - 删除用户
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 获取当前登录用户
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    // 只有管理员可以删除用户
    if (currentUser.role !== 'ADMIN') {
      return forbiddenResponse('权限不足');
    }

    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return notFoundResponse('用户');
    }

    await prisma.user.delete({
      where: { id },
    });

    return successResponse({ success: true }, '用户已删除');
  } catch (error) {
    console.error('Error deleting user:', error);
    return errorResponse('删除用户失败', 'INTERNAL_ERROR', 500);
  }
}

// GET /api/users/[id] - 获取单个用户
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 获取当前登录用户
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isApproved: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return notFoundResponse('用户');
    }

    return successResponse(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return errorResponse('获取用户信息失败', 'INTERNAL_ERROR', 500);
  }
}
