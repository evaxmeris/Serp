import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/roles/create - 创建新角色
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, displayName, description, permissions } = body;

    // 验证必填字段
    if (!name || !displayName) {
      return NextResponse.json(
        { error: 'Name and display name are required' },
        { status: 400 }
      );
    }

    // 检查名称是否重复
    const existingRole = await prisma.role.findUnique({
      where: { name },
    });

    if (existingRole) {
      return NextResponse.json(
        { error: 'Role with this name already exists' },
        { status: 400 }
      );
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

    return NextResponse.json({ data: role }, { status: 201 });
  } catch (error) {
    console.error('Error creating role:', error);
    return NextResponse.json(
      { error: 'Failed to create role' },
      { status: 500 }
    );
  }
}
