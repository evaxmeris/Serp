import { NextRequest } from 'next/server';
import * as bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';
import { successResponse, createdResponse, errorResponse, forbiddenResponse } from '@/lib/api-response';

// GET /api/users - 获取用户列表
export async function GET(request: NextRequest) {
  try {
    // 获取当前登录用户
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        isApproved: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          where: { isPrimary: true },
          include: { role: { select: { name: true, displayName: true } } },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return errorResponse('获取用户列表失败', 'INTERNAL_ERROR', 500);
  }
}

// POST /api/users - 创建用户（密码使用 bcrypt 加密存储）
export async function POST(request: NextRequest) {
  try {
    // 获取当前登录用户
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }
    
    // 只有管理员可以创建用户
    if (currentUser.role !== 'admin') {
      return forbiddenResponse('权限不足');
    }

    const body = await request.json();
    const v = validateOrReturn(z.object({ email: z.string().email(), name: z.string(), password: z.string().min(6), role: z.enum(['admin', 'sales', 'purchasing', 'warehouse', 'viewer']).optional() }), body);
    if (!v.success) return v.response;
    const { email, name, password, role } = v.data;

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return errorResponse('用户已存在', 'CONFLICT', 409);
    }

    // 使用 bcrypt 加密密码后存储（盐轮数 10）
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    // 创建主角色关联
    const roleName = role || 'sales';
    const roleRecord = await prisma.role.findUnique({ where: { name: roleName } });
    if (roleRecord) {
      await prisma.userRole.create({
        data: { userId: user.id, roleId: roleRecord.id, isPrimary: true },
      });
    }

    return createdResponse(user, '用户创建成功');
  } catch (error) {
    console.error('Error creating user:', error);
    return errorResponse('创建用户失败', 'INTERNAL_ERROR', 500);
  }
}
