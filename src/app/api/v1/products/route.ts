import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response';
import { z } from 'zod';

// 输入验证 schema
const ProductListSchema = z.object({
  page: z.coerce.number().int().positive().min(1).max(10000).default(1),
  limit: z.coerce.number().int().positive().min(1).max(100).default(20),
  search: z.string().max(100).optional(),
  category: z.string().max(50).optional(),
  status: z.string().max(20).optional(),
});

// 清理搜索字符串，防止 SQL 注入
function sanitizeSearchInput(input: string): string {
  // 移除可能的 SQL 特殊字符
  return input
    .replace(/[%;'"\\]/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .trim()
    .slice(0, 100); // 限制长度
}

// GET /api/v1/products - 获取产品列表
export async function GET(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    
    // 验证输入参数
    const validationResult = ProductListSchema.safeParse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      search: searchParams.get('search'),
      category: searchParams.get('category'),
      status: searchParams.get('status'),
    });

    if (!validationResult.success) {
      return validationErrorResponse(
        validationResult.error.issues.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }))
      );
    }

    const { page, limit, search, category, status } = validationResult.data;

    const where: any = {
      deletedAt: null, // 只查询未删除的产品
    };
    
    if (search) {
      // 清理搜索输入
      const sanitizedSearch = sanitizeSearchInput(search);
      if (sanitizedSearch) {
        where.OR = [
          { sku: { contains: sanitizedSearch } },
          { name: { contains: sanitizedSearch } },
          { nameEn: { contains: sanitizedSearch } },
        ];
      }
    }
    
    if (category) {
      where.category = category;
    }
    
    if (status) {
      where.status = status;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return paginatedResponse(products, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return errorResponse('获取产品列表失败');
  }
}
