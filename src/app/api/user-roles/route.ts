import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-api';
import { errorResponse } from '@/lib/api-response';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';

/**
 * GET /api/user-roles - 获取用户角色分配列表
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (userId) {
      // 获取特定用户的角色
      const userRoles = await prisma.userRole.findMany({
        where: { userId },
        include: {
          role: true,
        },
      });

      const roles = userRoles.map(ur => ur.role);
      return NextResponse.json({ data: roles });
    }

    // 获取所有用户角色分配（分页）
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const [userRoles, total] = await Promise.all([
      prisma.userRole.findMany({
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          role: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.userRole.count(),
    ]);

    return NextResponse.json({
      data: userRoles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching user roles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user roles' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user-roles - 为用户分配角色
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const body = await request.json();
    const v = validateOrReturn(z.object({ userId: z.string(), roleIds: z.array(z.string()) }), body);
    if (!v.success) return v.response;
    const { userId, roleIds } = v.data;

    // 删除现有的用户角色分配
    await prisma.userRole.deleteMany({
      where: { userId },
    });

    // 创建新的分配
    if (roleIds.length > 0) {
      await prisma.userRole.createMany({
        data: roleIds.map((roleId: string) => ({
          userId,
          roleId,
        })),
      });
    }

    // 返回更新后的角色列表
    const updatedUserRoles = await prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });

    const roles = updatedUserRoles.map(ur => ur.role);
    return NextResponse.json({ data: roles });
  } catch (error) {
    console.error('Error assigning user roles:', error);
    return NextResponse.json(
      { error: 'Failed to assign user roles' },
      { status: 500 }
    );
  }
}
