import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/users/[id]/roles - 分配用户角色
 * 替换现有的角色分配
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { roleIds } = body;

    if (!roleIds || !Array.isArray(roleIds)) {
      return NextResponse.json(
        { error: 'roleIds array is required' },
        { status: 400 }
      );
    }

    // 检查用户是否存在
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 删除现有的角色分配
    await prisma.userRole.deleteMany({
      where: { userId: id },
    });

    // 创建新的角色分配
    if (roleIds.length > 0) {
      // 验证所有角色ID是否存在
      const existingRoles = await prisma.role.findMany({
        where: { id: { in: roleIds } },
        select: { id: true },
      });

      const validIds = existingRoles.map(r => r.id);

      await prisma.userRole.createMany({
        data: validIds.map((roleId) => ({
          userId: id,
          roleId,
        })),
      });
    }

    // 返回更新后的角色列表
    const updatedUserRoles = await prisma.userRole.findMany({
      where: { userId: id },
      include: { role: true },
    });

    const roles = updatedUserRoles.map(ur => ur.role);

    return NextResponse.json({
      data: roles,
      message: 'Roles updated successfully',
    });
  } catch (error) {
    console.error('Error assigning user roles:', error);
    return NextResponse.json(
      { error: 'Failed to assign roles' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/users/[id]/roles - 获取用户角色列表
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // 检查用户是否存在
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 获取用户角色
    const userRoles = await prisma.userRole.findMany({
      where: { userId: id },
      include: { role: true },
    });

    const roles = userRoles.map(ur => ur.role);

    return NextResponse.json({ data: roles });
  } catch (error) {
    console.error('Error fetching user roles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch roles' },
      { status: 500 }
    );
  }
}
