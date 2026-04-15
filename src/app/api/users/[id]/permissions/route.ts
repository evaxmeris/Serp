import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-api';
import { errorResponse } from '@/lib/api-response';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/users/[id]/permissions - 获取用户的所有权限
 * 通过用户角色关联 -> 角色权限关联 获取所有权限
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { id } = await params;
    // 检查用户是否存在
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 获取用户的所有角色，然后通过角色获取所有权限
    const userRoles = await prisma.userRole.findMany({
      where: { userId: id },
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

    // 收集所有唯一权限
    const permissionsMap = new Map();
    userRoles.forEach(ur => {
      ur.role.permissions?.forEach(rp => {
        if (rp.permission && rp.permission.isActive) {
          permissionsMap.set(rp.permission.id, rp.permission);
        }
      });
    });

    const permissions = Array.from(permissionsMap.values());

    // 按模块分组
    const groupedPermissions = permissions.reduce((acc, permission) => {
      if (!acc[permission.module]) {
        acc[permission.module] = [];
      }
      acc[permission.module].push(permission);
      return acc;
    }, {} as Record<string, typeof permissions>);

    return NextResponse.json({
      data: permissions,
      grouped: groupedPermissions,
      permissionCodes: permissions.map(p => p.name),
    });
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
      { status: 500 }
    );
  }
}
