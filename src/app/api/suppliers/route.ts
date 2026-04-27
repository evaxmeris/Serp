import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { listResponse, createdResponse, errorResponse } from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import { CreateSupplierSchema } from '@/lib/api-schemas';
import { generateSupplierCode } from '@/lib/id-generator';
import { applyRowLevelFilter } from '@/lib/row-level-filter';

// GET /api/suppliers - 获取供应商列表（行级隔离）
// 管理员可以看到所有供应商，普通用户只能看到自己的供应商
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
    const search = searchParams.get('search') || '';

    // PERM-005: 统一应用行级过滤
    const where = applyRowLevelFilter(currentUser, 'supplier', {});

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

    return listResponse(suppliers, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return errorResponse('获取供应商列表失败', 'INTERNAL_ERROR', 500);
  }
}

// POST /api/suppliers - 创建供应商（行级隔离）
export async function POST(request: NextRequest) {
  try {
    // 获取当前用户会话
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }
    const currentUser = session;

    const body = await request.json();
    const v = validateOrReturn(CreateSupplierSchema, body);
    if (!v.success) return v.response;
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
    } = v.data;

    // 生成供应商编号
    const supplierNo = await generateSupplierCode();

    // BUG-PERM-007: 自动设置 ownerId 为当前用户
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
        ownerId: currentUser.id,
        status: 'ACTIVE',
        type: 'DOMESTIC',
        level: 'NORMAL',
        currency: 'CNY',
      },
    });

    return createdResponse(supplier, '供应商创建成功');
  } catch (error) {
    console.error('Error creating supplier:', error);
    return errorResponse('创建供应商失败', 'INTERNAL_ERROR', 500);
  }
}
