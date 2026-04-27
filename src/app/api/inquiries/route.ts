import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { listResponse, createdResponse, errorResponse } from '@/lib/api-response';
import type { InquiryStatus, Priority } from '@prisma/client';
import { validateOrReturn } from '@/lib/api-validation';
import { CreateInquirySchema } from '@/lib/api-schemas';
import { applyRowLevelFilter } from '@/lib/row-level-filter';

// GET /api/inquiries - 获取询盘列表（行级隔离）
// 普通用户只能看到自己客户的询盘，管理员可以看到所有
export async function GET(request: NextRequest) {
  try {
    // 获取当前用户会话
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }
    const currentUser = session;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const status = searchParams.get('status') || '';
    const priority = searchParams.get('priority') || '';
    const customerId = searchParams.get('customerId') || '';
    const search = searchParams.get('search') || '';

    // PERM-005: 统一应用行级过滤
    const where = applyRowLevelFilter(currentUser, 'inquiry', {});

    if (status) {
      where.status = status as InquiryStatus;
    }
    
    if (priority) {
      where.priority = priority as Priority;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (search) {
      where.OR = [
        { inquiryNo: { contains: search } },
        { products: { contains: search } },
        { customer: { companyName: { contains: search } } },
      ];
    }

    const [inquiries, total] = await Promise.all([
      prisma.inquiry.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              companyName: true,
              contactName: true,
              ownerId: true,
            },
          },
          followUps: {
            select: {
              id: true,
              type: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.inquiry.count({ where }),
    ]);

    return listResponse(inquiries, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    return errorResponse('获取询盘列表失败', 'INTERNAL_ERROR', 500);
  }
}

// POST /api/inquiries - 创建询盘（行级隔离）
export async function POST(request: NextRequest) {
  try {
    // 获取当前用户会话
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }
    const currentUser = session;

    const body = await request.json();
    const v = validateOrReturn(CreateInquirySchema, body);
    if (!v.success) return v.response;
    const {
      customerId,
      source,
      products,
      quantity,
      targetPrice,
      currency,
      requirements,
      deadline,
      priority,
      assignedTo,
    } = v.data;

    // 生成询盘编号
    const inquiryNo = `INQ${Date.now()}`;

    // BUG-PERM-007: 如果没有指定负责人，自动分配给当前用户
    const finalAssignedTo = assignedTo || currentUser.id;

    const inquiry = await prisma.inquiry.create({
      data: {
        inquiryNo,
        customerId,
        source: source || 'Website',
        products,
        quantity,
        targetPrice: targetPrice || null,
        currency: currency || 'USD',
        requirements,
        deadline: deadline ? new Date(deadline) : null,
        priority: (priority || 'MEDIUM') as Priority,
        status: 'NEW',
        assignedTo: finalAssignedTo,
      },
    });

    return createdResponse(inquiry, '询盘创建成功');
  } catch (error) {
    console.error('Error creating inquiry:', error);
    return errorResponse('创建询盘失败', 'INTERNAL_ERROR', 500);
  }
}
