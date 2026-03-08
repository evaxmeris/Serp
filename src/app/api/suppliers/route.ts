import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/suppliers - 获取供应商列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';

    const where: any = {};

    if (search) {
      where.OR = [
        { companyName: { contains: search } },
        { contactName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        include: {
          _count: {
            select: {
              purchaseOrders: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.supplier.count({ where }),
    ]);

    return NextResponse.json({
      data: suppliers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suppliers' },
      { status: 500 }
    );
  }
}

// POST /api/suppliers - 创建供应商
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      companyName,
      companyEn,
      contactName,
      contactTitle,
      email,
      phone,
      mobile,
      country,
      address,
      website,
      products,
      creditTerms,
      notes,
    } = body;

    if (!companyName) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      );
    }

    // 生成供应商编号
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const count = await prisma.supplier.count({
      where: {
        createdAt: {
          gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        },
      },
    });
    
    const supplierNo = `SUP-${year}${month}${day}-${String(count + 1).padStart(3, '0')}`;

    const supplier = await prisma.supplier.create({
      data: {
        supplierNo,
        companyName,
        companyEn,
        contactName,
        contactTitle,
        email,
        phone,
        mobile,
        address,
        country,
        website,
        products,
        creditTerms,
        notes,
        status: 'ACTIVE',
        type: 'DOMESTIC',
        level: 'NORMAL',
        currency: 'CNY',
      },
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error('Error creating supplier:', error);
    return NextResponse.json(
      { error: 'Failed to create supplier' },
      { status: 500 }
    );
  }
}
