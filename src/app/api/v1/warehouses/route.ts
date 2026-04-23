import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import {
  successResponse,
  paginatedResponse,
  createdResponse,
  errorResponse,
  validationErrorResponse,
  extractZodErrors,
  notFoundResponse,
  conflictResponse,
} from '@/lib/api-response';
import { z } from 'zod';

/**
 * 仓库管理 API
 * GET  /api/v1/warehouses - 获取仓库列表
 * POST /api/v1/warehouses - 创建仓库
 */

// 创建仓库 Schema
const CreateWarehouseSchema = z.object({
  name: z.string().min(1, '仓库名称不能为空'),
  code: z.string().min(1, '仓库编码不能为空').regex(/^[A-Z0-9_-]+$/, '编码只能包含大写字母、数字、下划线和横线'),
  address: z.string().optional(),
  manager: z.string().optional(),
  phone: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

// 更新仓库 Schema（导出供 [id]/route.ts 使用）
export const UpdateWarehouseSchema = CreateWarehouseSchema.partial();

// 查询参数 Schema
const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  search: z.string().optional(),
});

/**
 * GET /api/v1/warehouses - 获取仓库列表
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const queryResult = QuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!queryResult.success) {
      return validationErrorResponse(extractZodErrors(queryResult.error));
    }

    const { page, limit, status, search } = queryResult.data;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { address: { contains: search } },
      ];
    }

    const total = await prisma.warehouse.count({ where });

    const warehouses = await prisma.warehouse.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginatedResponse(warehouses, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    return errorResponse('获取仓库列表失败');
  }
}

/**
 * POST /api/v1/warehouses - 创建仓库
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = CreateWarehouseSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    const data = validationResult.data;

    // 检查编码是否已存在
    const existing = await prisma.warehouse.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      return conflictResponse(`仓库编码 "${data.code}" 已存在`);
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        name: data.name,
        code: data.code,
        address: data.address || null,
        manager: data.manager || null,
        phone: data.phone || null,
        status: data.status,
      },
    });

    return createdResponse(warehouse, '仓库创建成功');
  } catch (error) {
    console.error('Error creating warehouse:', error);
    return errorResponse('创建仓库失败');
  }
}
