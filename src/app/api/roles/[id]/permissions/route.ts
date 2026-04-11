import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/roles/[id]/permissions - 分配角色权限
 * 替换现有权限分配
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { permissionIds } = body;

    if (!permissionIds || !Array.isArray(permissionIds)) {
      return NextResponse.json(
        { error: 'permissionIds array is required' },
        { status: 400 }
      );
    }

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
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
