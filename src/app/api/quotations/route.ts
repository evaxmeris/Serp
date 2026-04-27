import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { quotationListQuerySchema } from '@/lib/validators/quotation';
import { validateOrReturn } from '@/lib/api-validation';
import { CreateQuotationSchema } from '@/lib/api-schemas';
import { getUserFromRequest } from '@/lib/auth-api';

// GET /api/quotations - 获取报价列表（支持分页、筛选、搜索）- 需要认证
export async function GET(request: Request) {
  try {
    // 认证检查
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '未认证，请先登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    
    // 验证查询参数
    const queryParams = quotationListQuerySchema.parse(Object.fromEntries(searchParams));
    const { page, limit, status, customerId, startDate, endDate, search, sortBy, sortOrder } = queryParams;

    const where: any = {};
    
    // 状态筛选
    if (status) {
      where.status = status;
    }
    
    // 客户筛选
    if (customerId) {
      where.customerId = customerId;
    }
    
    // 日期范围筛选
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    
    // 搜索（报价单号、客户名称）
    if (search) {
      where.OR = [
        { quotationNo: { contains: search } },
        { customer: { companyName: { contains: search } } },
        { customer: { contactName: { contains: search } } },
      ];
    }

    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              companyName: true,
              contactName: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.quotation.count({ where }),
    ]);

    return NextResponse.json({
      data: quotations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching quotations:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch quotations' },
      { status: 500 }
    );
  }
}

// POST /api/quotations - 创建报价 - 需要认证
export async function POST(request: Request) {
  try {
    // 认证检查
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '未认证，请先登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // 验证输入
    const v = validateOrReturn(CreateQuotationSchema, body);
    if (!v.success) return v.response;
    const validatedData = v.data;

    // 生成报价单号
    const quotationNo = `QT${Date.now()}`;

    // 计算总金额
    const totalAmount = validatedData.items.reduce((sum, item) => {
      return sum + item.unitPrice * item.quantity;
    }, 0);

    const quotation = await prisma.quotation.create({
      data: {
        quotationNo,
        customerId: validatedData.customerId,
        inquiryId: validatedData.inquiryId,
        currency: validatedData.currency,
        paymentTerms: validatedData.paymentTerms,
        deliveryTerms: validatedData.deliveryTerms,
        validityDays: validatedData.validityDays,
        notes: validatedData.notes,
        totalAmount,
        status: 'DRAFT',
        items: {
          create: validatedData.items.map((item) => ({
            productId: item.productId,
            productName: item.productName || '',
            specification: item.specification,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.unitPrice * item.quantity,
            notes: item.notes,
          })),
        },
      },
      include: {
        items: true,
        customer: {
          select: {
            id: true,
            companyName: true,
            contactName: true,
          },
        },
      },
    });

    return NextResponse.json(quotation, { status: 201 });
  } catch (error) {
    console.error('Error creating quotation:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create quotation' },
      { status: 500 }
    );
  }
}
