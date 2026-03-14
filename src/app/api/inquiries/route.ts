import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { InquiryStatus, Priority } from '@prisma/client';

// GET /api/inquiries - 获取询盘列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || '';
    const priority = searchParams.get('priority') || '';

    // 构建查询条件
    const where: {
      status?: InquiryStatus;
      priority?: Priority;
    } = {};
    
    if (status) {
      where.status = status as InquiryStatus;
    }
    
    if (priority) {
      where.priority = priority as Priority;
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

// POST /api/inquiries - 创建询盘
export async function POST(request: Request) {
  try {
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
    } = body;

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    // 生成询盘编号
    const inquiryNo = `INQ${Date.now()}`;

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
