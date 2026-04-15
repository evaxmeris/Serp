import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-api';
import { errorResponse } from '@/lib/api-response';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateOrReturn } from '@/lib/api-validation';
import { CreatePermissionSchema } from '@/lib/api-schemas';

/**
 * GET /api/permissions - 获取权限列表（按模块分组）
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { searchParams } = new URL(request.url);
    const module = searchParams.get('module');

    const where: any = {};
    if (module) {
      where.module = module;
    }

    const permissions = await prisma.permission.findMany({
      where,
      orderBy: [{ module: 'asc' }, { name: 'asc' }],
    });

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
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/permissions - 创建新权限
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const body = await request.json();
    const v = validateOrReturn(CreatePermissionSchema, body);
    if (!v.success) return v.response;
    const { name, code, displayName, module, description } = v.data;

    // name/code mapping: code = name

    // 检查 name 是否重复
    const existingName = await prisma.permission.findUnique({
      where: { name },
    });

    if (existingName) {
      return NextResponse.json(
        { error: 'Permission with this name already exists' },
        { status: 400 }
      );
    }

    // code = name (for backward compatibility)
    const permission = await prisma.permission.create({
      data: {
        name,
        code: name,
        displayName,
        module,
        description,
        isActive: true,
      },
    });

    return NextResponse.json({ data: permission }, { status: 201 });
  } catch (error) {
    console.error('Error creating permission:', error);
    return NextResponse.json(
      { error: 'Failed to create permission' },
      { status: 500 }
    );
  }
}
