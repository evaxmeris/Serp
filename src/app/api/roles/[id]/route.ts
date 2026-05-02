import { getUserFromRequest } from '@/lib/auth-unified';
import { getSession, requirePermission } from '@/middleware/auth';
import { errorResponse } from '@/lib/api-response';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateOrReturn } from '@/lib/api-validation';
import { UpdateRoleSchema } from '@/lib/api-schemas';

/**
 * GET /api/roles/:id - 获取单个角色详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!role) {
      return notFoundResponse('Role');
    }

    return successResponse({ data: role });
  } catch (error) {
    console.error('Error fetching role:', error);
    return errorResponse('Failed to fetch role', 'INTERNAL_ERROR', 500);
  }
}

/**
 * PUT /api/roles/:id - 更新角色
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    // 权限检查：只有拥有 settings:roles 权限的用户才能更新角色
    const authSession = await getSession(request);
    if (!authSession) {
      return errorResponse('未认证', 'UNAUTHORIZED', 401);
    }
    const permError = requirePermission(authSession, 'settings:roles');
    if (permError) return permError;

    const { id } = await params;
    const body = await request.json();
    const v = validateOrReturn(UpdateRoleSchema, body);
    if (!v.success) return v.response;
    const { name, displayName, description, isActive, permissions } = v.data;

    // 检查角色是否存在
    const existingRole = await prisma.role.findUnique({
      where: { id },
    });

    if (!existingRole) {
      return notFoundResponse('Role');
    }

    // 如果系统角色，不允许修改名称
    if (existingRole.isSystem && name !== existingRole.name) {
      return NextResponse.json(
        { error: 'System role cannot be renamed' },
        { status: 400 }
      );
    }

    // 更新角色基本信息
    const updatedRole = await prisma.role.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(displayName !== undefined && { displayName }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    // 如果提供了权限，更新权限关联
    if (permissions && Array.isArray(permissions)) {
      // 删除旧的权限关联
      await prisma.rolePermission.deleteMany({
        where: { roleId: id },
      });

      // 创建新的权限关联
      if (permissions.length > 0) {
        await prisma.rolePermission.createMany({
          data: permissions.map((permissionId: string) => ({
            roleId: id,
            permissionId,
          })),
        });
      }
    }

    return NextResponse.json({ data: updatedRole });
  } catch (error) {
    console.error('Error updating role:', error);
    return errorResponse('Failed to update role', 'INTERNAL_ERROR', 500);
  }
}

/**
 * DELETE /api/roles/:id - 删除角色
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    // 权限检查：只有拥有 settings:roles 权限的用户才能删除角色
    const authSession = await getSession(request);
    if (!authSession) {
      return errorResponse('未认证', 'UNAUTHORIZED', 401);
    }
    const permError = requirePermission(authSession, 'settings:roles');
    if (permError) return permError;

    const { id } = await params;
    // 检查角色是否存在
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        users: true,
      },
    });

    if (!role) {
      return notFoundResponse('Role');
    }

    // 系统角色不允许删除
    if (role.isSystem) {
      return NextResponse.json(
        { error: 'System role cannot be deleted' },
        { status: 400 }
      );
    }

    // 检查是否有用户关联
    if (role.users.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete role with assigned users',
          userCount: role.users.length,
        },
        { status: 400 }
      );
    }

    // 删除角色（关联会通过 cascade 删除）
    await prisma.role.delete({
      where: { id },
    });

    return successResponse(null, 'Role deleted');
  } catch (error) {
    console.error('Error deleting role:', error);
    return errorResponse('Failed to delete role', 'INTERNAL_ERROR', 500);
  }
}
