/**
 * Profile API - 个人资料更新
 * 
 * @文件说明 PUT /api/profile - 更新当前用户的个人信息（name, email, avatar）
 * @作者 Trade ERP 团队
 * @创建日期 2026-04-27
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';

// 请求体校验 schema
const UpdateProfileSchema = z.object({
  name: z.string().min(1, '姓名不能为空').max(50, '姓名最长 50 个字符').optional(),
  email: z.string().email('邮箱格式不正确').optional(),
  avatar: z.string().url('头像 URL 格式不正确').max(500, '头像 URL 过长').optional(),
});

/**
 * PUT /api/profile - 更新当前用户个人信息
 * 
 * 只允许用户更新自己的信息（name, email, avatar）
 * 需要认证，从 JWT token 中获取当前用户 ID
 */
export async function PUT(request: NextRequest) {
  try {
    // 1. 认证：获取当前登录用户
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '未认证，请先登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // 2. 解析并校验请求体
    const body = await request.json();
    const v = validateOrReturn(UpdateProfileSchema, body);
    if (!v.success) return v.response;
    const updateData = v.data;

    // 3. 至少更新一个字段
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: '请提供至少一个要更新的字段', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    // 4. 如果要更新 email，检查是否与其他用户冲突
    if (updateData.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: updateData.email },
        select: { id: true },
      });
      if (existingUser && existingUser.id !== currentUser.id) {
        return NextResponse.json(
          { success: false, error: '该邮箱已被其他用户使用', code: 'EMAIL_CONFLICT' },
          { status: 409 }
        );
      }
    }

    // 5. 更新数据库
    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 6. 返回更新后的用户信息
    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: '个人资料已更新',
    });
  } catch (error) {
    console.error('更新用户资料失败:', error);
    return NextResponse.json(
      { success: false, error: '更新失败，请稍后重试', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
