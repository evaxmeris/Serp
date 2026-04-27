import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-api';
import { errorResponse } from '@/lib/api-response';
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

    return NextResponse.json({
      data: roles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch roles' },
      { status: 500 }
    );
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

    return NextResponse.json({ data: role, message: '角色创建成功' }, { status: 201 });
  } catch (error) {
    console.error('创建角色失败:', error);
    return errorResponse('创建角色失败', 'INTERNAL_ERROR', 500);
  }
}
