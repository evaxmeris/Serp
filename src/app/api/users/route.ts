import { NextRequest, NextResponse } from 'next/server';
import * as bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';

// GET /api/users - 获取用户列表
export async function GET(request: NextRequest) {
  try {
    // 获取当前登录用户
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '未认证，请先登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST /api/users - 创建用户（密码使用 bcrypt 加密存储）
export async function POST(request: NextRequest) {
  try {
    // 获取当前登录用户
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '未认证，请先登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    
    // 只有管理员可以创建用户
    if (currentUser.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: '权限不足', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const v = validateOrReturn(z.object({ email: z.string().email(), name: z.string(), password: z.string().min(6), role: z.enum(['ADMIN', 'SALES', 'PURCHASING', 'WAREHOUSE', 'VIEWER']).optional() }), body);
    if (!v.success) return v.response;
    const { email, name, password, role } = v.data;

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }

    // 使用 bcrypt 加密密码后存储（盐轮数 10）
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: role || 'SALES',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
