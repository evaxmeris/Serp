import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { getSession, requirePermission } from '@/middleware/auth';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  extractZodErrors,
  notFoundResponse,
  conflictResponse,
} from '@/lib/api-response';
import { z } from 'zod';

/**
 * 生产记录 API - 单个记录的详情、更新和删除
 */

// 更新生产记录 Schema（部分字段可更新）
const UpdateProductionRecordSchema = z.object({
  productId: z.string().optional(),
  quantity: z.number().int().positive('数量必须大于 0').optional(),
  plannedStartDate: z.coerce.date().optional(),
  plannedEndDate: z.coerce.date().optional(),
  actualStartDate: z.coerce.date().optional().nullable(),
  actualEndDate: z.coerce.date().optional().nullable(),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED']).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  department: z.string().optional().nullable(),
  factory: z.string().optional().nullable(),
  supervisor: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

/**
 * GET /api/v1/production-records/[id]
 * 获取单个生产记录详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { id } = await params;

    const record = await prisma.productionRecord.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            orderNo: true,
            status: true,
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
    });

    if (!record) {
      return notFoundResponse('生产记录');
    }

    return successResponse(record, 'SUCCESS');
  } catch (error) {
    console.error('Error fetching production record:', error);
    return errorResponse('获取生产记录详情失败');
  }
}

/**
 * PUT /api/v1/production-records/[id]
 * 更新生产记录
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    // RBAC 权限检查：production:edit
    const authSession = await getSession(request);
    const permError = requirePermission(authSession!, 'production:edit');
    if (permError) return permError;

    const { id } = await params;
    const body = await request.json();
    const validationResult = UpdateProductionRecordSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    const data = validationResult.data;

    // 检查生产记录是否存在
    const existingRecord = await prisma.productionRecord.findUnique({
      where: { id },
    });

    if (!existingRecord) {
      return notFoundResponse('生产记录');
    }

    // 已取消或已完成的生产记录不允许修改
    if (existingRecord.status === 'CANCELLED') {
      return conflictResponse('已取消的生产记录无法修改');
    }

    // 如果状态要改为 COMPLETED，自动填充实际结束时间
    if (data.status === 'COMPLETED' && !data.actualEndDate) {
      data.actualEndDate = new Date();
    }

    // 更新生产记录
    const updatedRecord = await prisma.productionRecord.update({
      where: { id },
      data,
      include: {
        order: {
          select: {
            id: true,
            orderNo: true,
          },
        },
      },
    });

    return successResponse(updatedRecord, '生产记录更新成功');
  } catch (error) {
    console.error('Error updating production record:', error);
    return errorResponse('更新生产记录失败');
  }
}

/**
 * DELETE /api/v1/production-records/[id]
 * 删除生产记录
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    // RBAC 权限检查：production:delete
    const authSession = await getSession(request);
    const permError = requirePermission(authSession!, 'production:delete');
    if (permError) return permError;

    const { id } = await params;

    // 检查生产记录是否存在
    const existingRecord = await prisma.productionRecord.findUnique({
      where: { id },
    });

    if (!existingRecord) {
      return notFoundResponse('生产记录');
    }

    // 只有 PLANNED 或 ON_HOLD 状态的生产记录可以删除
    if (existingRecord.status === 'IN_PROGRESS' || existingRecord.status === 'COMPLETED') {
      return conflictResponse('进行中或已完成的生产记录无法删除');
    }

    // 删除生产记录
    await prisma.productionRecord.delete({
      where: { id },
    });

    return successResponse(null, '生产记录删除成功');
  } catch (error) {
    console.error('Error deleting production record:', error);
    return errorResponse('删除生产记录失败');
  }
}
