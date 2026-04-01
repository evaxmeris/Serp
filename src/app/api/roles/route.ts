import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/roles - 获取角色列表
 * 支持分页和搜索
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
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
          permissions: {
            select: {
              permissionId: true,
              permission: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  module: true,
                  description: true,
                  isActive: true,
                },
              },
            },
          },
          users: {
            select: {
              userId: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
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
