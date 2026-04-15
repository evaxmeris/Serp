import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-api';
import { errorResponse } from '@/lib/api-response';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateOrReturn } from '@/lib/api-validation';
import { AssignPermissionsSchema } from '@/lib/api-schemas';

/**
 * POST /api/roles/[id]/permissions - 分配角色权限
 * 替换现有权限分配
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { id } = await params;
    const body = await request.json();
    const v = validateOrReturn(AssignPermissionsSchema, body);
    if (!v.success) return v.response;
    const { permissionIds } = v.data;

    // 检查角色是否存在
    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    // 删除现有的权限关联
    await prisma.rolePermission.deleteMany({
      where: { roleId: id },
    });

    // 创建新的权限关联
    if (permissionIds.length > 0) {
      // 验证所有权限ID是否存在
      const existingPermissions = await prisma.permission.findMany({
        where: { id: { in: permissionIds } },
        select: { id: true },
      });

      const validIds = existingPermissions.map(p => p.id);

      await prisma.rolePermission.createMany({
        data: validIds.map((permissionId) => ({
          roleId: id,
          permissionId,
        })),
      });
    }

    // 返回更新后的权限列表
    const updatedPermissions = await prisma.rolePermission.findMany({
      where: { roleId: id },
      include: { permission: true },
    });

    return NextResponse.json({
      data: updatedPermissions.map(rp => rp.permission),
      message: 'Permissions updated successfully',
    });
  } catch (error) {
    console.error('Error assigning role permissions:', error);
    return NextResponse.json(
      { error: 'Failed to assign permissions' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/roles/[id]/permissions - 获取角色权限列表
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
    // 检查角色是否存在
    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    // 获取角色权限
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId: id },
      include: { permission: true },
    });

    const permissions = rolePermissions.map(rp => rp.permission);

    return NextResponse.json({ data: permissions });
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
      { status: 500 }
    );
  }
}
