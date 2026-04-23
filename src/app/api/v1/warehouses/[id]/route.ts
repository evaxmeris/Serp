import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  conflictResponse,
} from '@/lib/api-response';
import { UpdateWarehouseSchema } from '../route';
import { z } from 'zod';

/**
 * 单个仓库操作 API
 * GET    /api/v1/warehouses/[id] - 获取仓库详情
 * PUT    /api/v1/warehouses/[id] - 更新仓库
 * DELETE /api/v1/warehouses/[id] - 删除仓库
 */

/**
 * GET /api/v1/warehouses/[id] - 获取仓库详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
    });

    if (!warehouse) {
      return notFoundResponse('仓库');
    }

    return successResponse(warehouse);
  } catch (error) {
    console.error('Error fetching warehouse:', error);
    return errorResponse('获取仓库详情失败');
  }
}

/**
 * PUT /api/v1/warehouses/[id] - 更新仓库
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
    });

    if (!warehouse) {
      return notFoundResponse('仓库');
    }

    const body = await request.json();
    const validationResult = UpdateWarehouseSchema.safeParse(body);

    if (!validationResult.success) {
      const extractZodErrors = (error: z.ZodError) =>
        error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
      return NextResponse.json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: '请求参数验证失败',
        errors: extractZodErrors(validationResult.error),
        timestamp: new Date().toISOString(),
      }, { status: 422 });
    }

    const data = validationResult.data;

    // 如果修改了 code，检查是否与其他仓库冲突
    if (data.code && data.code !== warehouse.code) {
      const existing = await prisma.warehouse.findUnique({
        where: { code: data.code },
      });
      if (existing) {
        return conflictResponse(`仓库编码 "${data.code}" 已存在`);
      }
    }

    const updated = await prisma.warehouse.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.code !== undefined && { code: data.code }),
        ...(data.address !== undefined && { address: data.address || null }),
        ...(data.manager !== undefined && { manager: data.manager || null }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });

    return successResponse(updated, '仓库更新成功');
  } catch (error) {
    console.error('Error updating warehouse:', error);
    return errorResponse('更新仓库失败');
  }
}

/**
 * DELETE /api/v1/warehouses/[id] - 删除仓库
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
    });

    if (!warehouse) {
      return notFoundResponse('仓库');
    }

    // 检查是否有库存记录关联此仓库
    const inventoryCount = await prisma.inventoryItem.count({
      where: { warehouse: warehouse.code },
    });

    if (inventoryCount > 0) {
      return conflictResponse(
        `仓库 "${warehouse.name}" 有 ${inventoryCount} 条库存记录关联，无法删除。请先清空或转移库存。`
      );
    }

    // 检查是否有入库单关联此仓库
    const inboundCount = await prisma.inboundOrder.count({
      where: { warehouseId: warehouse.code },
    });

    if (inboundCount > 0) {
      return conflictResponse(
        `仓库 "${warehouse.name}" 有 ${inboundCount} 条入库单关联，无法删除。`
      );
    }

    // 检查是否有出库单关联此仓库
    const outboundCount = await prisma.outboundOrder.count({
      where: { warehouseId: warehouse.code },
    });

    if (outboundCount > 0) {
      return conflictResponse(
        `仓库 "${warehouse.name}" 有 ${outboundCount} 条出库单关联，无法删除。`
      );
    }

    await prisma.warehouse.delete({
      where: { id },
    });

    return successResponse(null, '仓库删除成功');
  } catch (error) {
    console.error('Error deleting warehouse:', error);
    return errorResponse('删除仓库失败');
  }
}
