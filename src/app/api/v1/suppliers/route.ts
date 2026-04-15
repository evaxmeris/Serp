import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  validationErrorResponse,
  extractZodErrors,
} from '@/lib/api-response';
import { CreateSupplierSchema, SupplierQuerySchema } from '@/lib/validators/supplier';

// GET /api/v1/suppliers - 获取供应商列表
export async function GET(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    // 解析和验证查询参数
    const searchParams = request.nextUrl.searchParams;
    const queryResult = SupplierQuerySchema.safeParse(
      Object.fromEntries(searchParams)
    );

    if (!queryResult.success) {
      return validationErrorResponse(extractZodErrors(queryResult.error));
    }

    const {
      page,
      limit,
      status,
      type,
      level,
      search,
      sortBy,
      sortOrder,
    } = queryResult.data;

    // 构建查询条件
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (level) {
      where.level = level;
    }

    if (search) {
      where.OR = [
        { companyName: { contains: search } },
        { companyEn: { contains: search } },
        { contactName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    // 执行查询
    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
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
              purchaseOrders: true,
            },
          },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.supplier.count({ where }),
    ]);

    return paginatedResponse(suppliers, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return errorResponse('获取供应商列表失败', 'INTERNAL_ERROR');
  }
}

// POST /api/v1/suppliers - 创建供应商
export async function POST(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const body = await request.json();
    const validationResult = CreateSupplierSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    const data = validationResult.data;

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

    // 创建供应商
    const supplier = await prisma.supplier.create({
      data: {
        ...data,
        supplierNo,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return successResponse(supplier, '供应商创建成功', 'CREATED');
  } catch (error) {
    console.error('Error creating supplier:', error);
    
    // 检查是否是唯一约束冲突
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return errorResponse('供应商编号已存在', 'CONFLICT', 409);
    }
    
    return errorResponse('创建供应商失败', 'INTERNAL_ERROR');
  }
}
