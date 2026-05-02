import { getUserFromRequest } from '@/lib/auth-unified';
import { errorResponse, successResponse, notFoundResponse, validationErrorResponse } from '@/lib/api-response';
import { invalidateUserPermissionsCache } from '@/lib/permissions';
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

    return successResponse({
      data: roles,
      permissions: [...new Set(allPermissions)],
    });
  } catch (error) {
    console.error('Error fetching user roles:', error);
    return errorResponse('Failed to fetch user roles', 'INTERNAL_ERROR', 500);
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
      return validationErrorResponse([{ field: 'roleId', message: 'roleId is required' }]);
    }

    await prisma.userRole.deleteMany({
      where: {
        userId,
        roleId,
      },
    });

    // 主动失效权限缓存
    invalidateUserPermissionsCache(userId);

    return successResponse(null, 'Role removed successfully');
  } catch (error) {
    console.error('Error removing user role:', error);
    return errorResponse('Failed to remove user role', 'INTERNAL_ERROR', 500);
  }
}
