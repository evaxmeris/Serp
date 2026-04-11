import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/permissions/:id - 获取权限详情
 */
export async function GET(
  request: Request,
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
      return NextResponse.json({ error: 'Permission not found' }, { status: 404 });
    }

    return NextResponse.json({ data: permission });
  } catch (error) {
    console.error('Error fetching permission:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permission' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/permissions/:id - 更新权限
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, code, displayName, module, description, isActive } = body;

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

    return NextResponse.json({ data: permission });
  } catch (error) {
    console.error('Error updating permission:', error);
    return NextResponse.json(
      { error: 'Failed to update permission' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/permissions/:id - 删除权限
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // 检查是否有角色关联
    const permission = await prisma.permission.findUnique({
      where: { id },
      include: {
        roles: true,
      },
    });

    if (!permission) {
      return NextResponse.json({ error: 'Permission not found' }, { status: 404 });
    }

    if (permission.roles.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete permission assigned to roles',
          roleCount: permission.roles.length,
        },
        { status: 400 }
      );
    }

    await prisma.permission.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting permission:', error);
    return NextResponse.json(
      { error: 'Failed to delete permission' },
      { status: 500 }
    );
  }
}
