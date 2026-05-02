import { getUserFromRequest } from '@/lib/auth-unified';
import { errorResponse, successResponse, notFoundResponse, validationErrorResponse } from '@/lib/api-response';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateOrReturn } from '@/lib/api-validation';
import { UpdatePermissionSchema } from '@/lib/api-schemas';

/**
 * GET /api/permissions/:id - 获取权限详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const permission = await prisma.permission.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!permission) {
      return notFoundResponse('Permission');
    }

    return successResponse({ data: permission });
  } catch (error) {
    console.error('Error fetching permission:', error);
    return errorResponse('Failed to fetch permission', 'INTERNAL_ERROR', 500);
  }
}

/**
 * PUT /api/permissions/:id - 更新权限
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const v = validateOrReturn(UpdatePermissionSchema, body);
    if (!v.success) return v.response;
    const { name, code, displayName, module, description, isActive } = v.data;

    const permission = await prisma.permission.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(displayName !== undefined && { displayName }),
        ...(module !== undefined && { module }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return successResponse({ data: permission });
  } catch (error) {
    console.error('Error updating permission:', error);
    return errorResponse('Failed to update permission', 'INTERNAL_ERROR', 500);
  }
}

/**
 * DELETE /api/permissions/:id - 删除权限
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

    const { id } = await params;
    // 检查是否有角色关联
    const permission = await prisma.permission.findUnique({
      where: { id },
      include: {
        roles: true,
      },
    });

    if (!permission) {
      return notFoundResponse('Permission');
    }

    if (permission.roles.length > 0) {
      return validationErrorResponse([{ field: 'permission', message: 'Cannot delete permission assigned to roles' }]);
    }

    await prisma.permission.delete({
      where: { id },
    });

    return successResponse(null, 'Permission deleted');
  } catch (error) {
    console.error('Error deleting permission:', error);
    return errorResponse('Failed to delete permission', 'INTERNAL_ERROR', 500);
  }
}
