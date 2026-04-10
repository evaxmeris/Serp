import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import type { InquiryStatus, Priority } from '@prisma/client';

// GET /api/inquiries - 获取询盘列表（行级隔离）
// 普通用户只能看到自己客户的询盘，管理员可以看到所有
export async function GET(request: NextRequest) {
  try {
    // 获取当前用户会话
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const currentUser = session;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || '';
    const priority = searchParams.get('priority') || '';
    const customerId = searchParams.get('customerId') || '';
    const search = searchParams.get('search') || '';

    // 构建查询条件
    const where: any = {};
    
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

    // BUG-PERM-007: 行级隔离 - 通过客户 ownerId 过滤
    if (currentUser.role !== 'ADMIN') {
      where.customer = {
        ownerId: currentUser.id,
      };
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

    return NextResponse.json({
      data: inquiries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inquiries' },
      { status: 500 }
    );
  }
}

// POST /api/inquiries - 创建询盘（行级隔离）
export async function POST(request: NextRequest) {
  try {
    // 获取当前用户会话
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const currentUser = session;

    const body = await request.json();
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
    } = body;

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

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
        targetPrice: targetPrice ? parseFloat(targetPrice) : null,
        currency: currency || 'USD',
        requirements,
        deadline: deadline ? new Date(deadline) : null,
        priority: (priority || 'MEDIUM') as Priority,
        status: 'NEW',
        assignedTo: finalAssignedTo,
      },
    });

    return NextResponse.json(inquiry, { status: 201 });
  } catch (error) {
    console.error('Error creating inquiry:', error);
    return NextResponse.json(
      { error: 'Failed to create inquiry' },
      { status: 500 }
    );
  }
}
