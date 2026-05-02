import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { getSession, requirePermission } from '@/middleware/auth';
import {
  successResponse,
  listResponse,
  errorResponse,
  validationErrorResponse,
  extractZodErrors,
  notFoundResponse,
} from '@/lib/api-response';
import { z } from 'zod';

/**
 * 生产记录 API - 列表和创建
 */

// 创建生产记录 Schema 验证
const CreateProductionRecordSchema = z.object({
  orderId: z.string().min(1, '订单 ID 不能为空'),
  productId: z.string().optional(),
  quantity: z.number().int().positive('数量必须大于 0'),
  plannedStartDate: z.coerce.date(),
  plannedEndDate: z.coerce.date(),
  department: z.string().optional(),
  factory: z.string().optional(),
  supervisor: z.string().optional(),
  notes: z.string().optional(),
});

// 查询参数 Schema
const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED']).optional(),
  search: z.string().optional(),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * GET /api/v1/production-records
 * 获取生产记录列表
 */
export async function GET(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const queryResult = QuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!queryResult.success) {
      return validationErrorResponse(extractZodErrors(queryResult.error));
    }

    const { page, limit, status, search, sortBy, sortOrder } = queryResult.data;

    // 构建查询条件
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { productionNo: { contains: search } },
        { order: { orderNo: { contains: search } } },
        { notes: { contains: search } },
      ];
    }

    // 查询总数
    const total = await prisma.productionRecord.count({ where });

    // 查询数据，包含 order 关联以获取订单信息
    const records = await prisma.productionRecord.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNo: true,
            items: {
              select: {
                id: true,
                productName: true,
                productSku: true,
                quantity: true,
              },
            },
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
    });

    return listResponse(
      records,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      'SUCCESS'
    );
  } catch (error) {
    console.error('Error fetching production records:', error);
    return errorResponse('获取生产记录列表失败');
  }
}

/**
 * POST /api/v1/production-records
 * 创建生产记录
 */
export async function POST(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    // RBAC 权限检查：production:create
    const authSession = await getSession(request);
    const permError = requirePermission(authSession!, 'production:create');
    if (permError) return permError;

    const body = await request.json();
    const validationResult = CreateProductionRecordSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    const data = validationResult.data;

    // 验证销售订单是否存在
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
    });

    if (!order) {
      return notFoundResponse('销售订单');
    }

    // 生成生产单号: PR-YYYYMMDD-<timestamp36><random>
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const timestamp = Date.now().toString(36).slice(-6);
    const random = Math.random().toString(36).slice(2, 6);
    const productionNo = `PR-${year}${month}${day}-${timestamp}${random}`;

    // 创建生产记录
    const record = await prisma.productionRecord.create({
      data: {
        productionNo,
        orderId: data.orderId,
        productId: data.productId,
        quantity: data.quantity,
        plannedStartDate: data.plannedStartDate,
        plannedEndDate: data.plannedEndDate,
        department: data.department,
        factory: data.factory,
        supervisor: data.supervisor,
        notes: data.notes,
        status: 'PLANNED',
        progress: 0,
      },
      include: {
        order: {
          select: {
            id: true,
            orderNo: true,
          },
        },
      },
    });

    return successResponse(record, '生产记录创建成功', 'CREATED');
  } catch (error) {
    console.error('Error creating production record:', error);
    return errorResponse('创建生产记录失败');
  }
}
