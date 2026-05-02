import { getUserFromRequest } from '@/lib/auth-unified';
import { getSession, requirePermission } from '@/middleware/auth';
import { errorResponse, successResponse, forbiddenResponse } from '@/lib/api-response';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateOrReturn } from '@/lib/api-validation';
import { CreateRoleSchema } from '@/lib/api-schemas';

/**
 * POST /api/roles/create - 创建新角色
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    // 权限检查：只有拥有 settings:roles 权限的用户才能创建角色
    const authSession = await getSession(request);
    if (!authSession) {
      return errorResponse('未认证', 'UNAUTHORIZED', 401);
    }
    const permError = requirePermission(authSession, 'settings:roles');
    if (permError) return permError;

    const body = await request.json();
    const v = validateOrReturn(CreateRoleSchema, body);
    if (!v.success) return v.response;
    const { name, displayName, description, permissions } = v.data;

    // 检查名称是否重复
    const existingRole = await prisma.role.findUnique({
      where: { name },
    });

    if (existingRole) {
      return errorResponse('Role with this name already exists', 'CONFLICT', 409);
    }

    // 创建角色
    const role = await prisma.role.create({
      data: {
        name,
        displayName,
        description,
        isSystem: false,
        isActive: true,
      },
    });

    // 如果提供了权限，创建关联
    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissions.map((permissionId: string) => ({
          roleId: role.id,
          permissionId,
        })),
      });
    }

    return createdResponse(role, 'Role created successfully');
  } catch (error) {
    console.error('Error creating role:', error);
    return errorResponse('Failed to create role', 'INTERNAL_ERROR', 500);
  }
}
