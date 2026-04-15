import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-api';
import { errorResponse } from '@/lib/api-response';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/user-roles/:userId - 获取用户的所有角色
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { userId } = await params;
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const roles = userRoles.map(ur => ur.role);

    // 汇总所有权限
    const allPermissions = roles.flatMap(role =>
      role.permissions.map(rp => rp.permission.name)
    );

    return NextResponse.json({
      data: roles,
      permissions: [...new Set(allPermissions)],
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
 * DELETE /api/user-roles/:userId - 移除用户的某个角色
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('roleId');

    if (!roleId) {
      return NextResponse.json(
        { error: 'roleId is required' },
        { status: 400 }
      );
    }

    await prisma.userRole.deleteMany({
      where: {
        userId,
        roleId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing user role:', error);
    return NextResponse.json(
      { error: 'Failed to remove user role' },
      { status: 500 }
    );
  }
}
