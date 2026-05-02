import { getUserFromRequest } from '@/lib/auth-api';
import { getSession, requirePermission } from '@/middleware/auth';
import { successResponse, createdResponse, listResponse, errorResponse } from '@/lib/api-response';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateOrReturn } from '@/lib/api-validation';
import { CreateRoleSchema } from '@/lib/api-schemas';

/**
 * GET /api/roles - 获取角色列表
 * 支持分页和搜索
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const search = searchParams.get('search') || '';

    const skip = (page - 1) * limit;
    const where: any = {};

    // 搜索过滤
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { displayName: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [roles, total] = await Promise.all([
      prisma.role.findMany({
        where,
        select: {
          id: true,
          name: true,
          displayName: true,
          description: true,
          isSystem: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              users: true,
              permissions: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.role.count({ where }),
    ]);

    const pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };

    return listResponse(roles, pagination);
  } catch (error) {
    console.error('Error fetching roles:', error);
    return errorResponse('Failed to fetch roles');
  }
}

/**
 * POST /api/roles - 创建新角色
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
    const { name, displayName, description, permissions, isActive } = v.data;

    // 检查角色名称是否重复
    const existingRole = await prisma.role.findUnique({
      where: { name },
    });
    if (existingRole) {
      return errorResponse('该角色标识已存在', 'CONFLICT', 409);
    }

    // 创建角色
    const role = await prisma.role.create({
      data: {
        name,
        displayName: displayName || name,
        description: description || '',
        isSystem: false,
        isActive: isActive ?? true,
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

    return createdResponse(role, '角色创建成功');
  } catch (error) {
    console.error('创建角色失败:', error);
    return errorResponse('创建角色失败', 'INTERNAL_ERROR', 500);
  }
}
