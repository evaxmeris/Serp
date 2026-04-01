import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/middleware/auth';
import { getCurrentUser } from '@/lib/auth-simple';

// GET /api/customers - 获取客户列表（行级隔离：只能看到自己的客户）
export async function GET(request: NextRequest) {
  try {
    // BUG-PERM-001: 添加认证检查
    // 转换 request 兼容 NextRequest 类型
    const authError = await requireAuth(request);
    if (authError) return authError;

    // 获取当前登录用户
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';

    // 构建查询条件
    const where: any = search ? {
      OR: [
        { companyName: { contains: search } },
        { contactName: { contains: search } },
        { email: { contains: search } },
      ],
    } : {};

    // BUG-PERM-007: 添加行级隔离 - 管理员可以看到所有客户，普通用户只能看到自己的
    if (currentUser.role !== 'ADMIN' && currentUser.role !== 'MANAGER') {
      where.ownerId = currentUser.id;
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              inquiries: true,
              orders: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);

    return NextResponse.json({
      data: customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}

// POST /api/customers - 创建客户（行级隔离：自动设置 ownerId 为当前用户）
export async function POST(request: NextRequest) {
  try {
    // BUG-PERM-001: 添加认证检查
    // 转换 request 兼容 NextRequest 类型
    const authError = await requireAuth(request);
    if (authError) return authError;

    // 获取当前登录用户
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      companyName,
      contactName,
      email,
      phone,
      country,
      address,
      website,
      source,
      creditLevel,
      notes,
    } = body;

    if (!companyName) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      );
    }

    // BUG-PERM-007: 自动设置 ownerId 为当前登录用户
    const customer = await prisma.customer.create({
      data: {
        companyName,
        contactName,
        email,
        phone,
        country,
        address,
        website,
        source,
        creditLevel,
        notes,
        ownerId: currentUser.id,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    );
  }
}
