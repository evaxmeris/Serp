import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { listResponse, createdResponse, errorResponse, notFoundResponse, validationErrorResponse } from '@/lib/api-response';
import { CreateCustomerSchema, PaginationSchema } from '@/lib/api-schemas';

// GET /api/customers - 获取客户列表（行级隔离：只能看到自己的客户）
export async function GET(request: NextRequest) {
  try {
    // 获取当前登录用户（修复 API 认证问题）
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
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
    if (currentUser.role !== 'ADMIN') {
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

    return listResponse(customers, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return errorResponse('Failed to fetch customers', 'INTERNAL_ERROR', 500);
  }
}

// POST /api/customers - 创建客户（行级隔离：自动设置 ownerId 为当前用户）
export async function POST(request: NextRequest) {
  try {
    // 获取当前登录用户
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const body = await request.json();

    // Zod 验证
    const validation = CreateCustomerSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(
        validation.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }))
      );
    }

    const customer = await prisma.customer.create({
      data: {
        ...validation.data,
        ownerId: currentUser.id,
      },
    });

    return createdResponse(customer, '客户创建成功');
  } catch (error) {
    console.error('Error creating customer:', error);
    return errorResponse('Failed to create customer', 'INTERNAL_ERROR', 500);
  }
}
