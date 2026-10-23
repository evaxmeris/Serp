import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { computeAvailableQty } from '@/lib/inventory-utils';
import {
  resolveWarehouseCode,
  resolveWarehouseCodeOrRaw,
  WarehouseNotFoundError,
} from '@/lib/warehouse-resolver';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  conflictResponse,
  validationErrorResponse,
  extractZodErrors,
} from '@/lib/api-response';
import { z } from 'zod';

const AdjustInventorySchema = z.object({
  productId: z.string(),
  warehouseId: z.string(),
  quantity: z.number(), // 正数为增加，负数为减少
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER', 'RETURN']),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  note: z.string().optional(),
});

// GET /api/v1/inventory - 获取库存列表
export async function GET(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    
    const page = Number(searchParams.get('page')) || 1;
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 100);
    const productId = searchParams.get('productId');
    const warehouseId = searchParams.get('warehouseId');
    const search = searchParams.get('search');

    const where: any = {};

    if (productId) {
      where.productId = productId;
    }

    if (warehouseId) {
      // 支持按仓库 id / code / 'MAIN' 过滤，统一转成库存表里的 code
      where.warehouse = await resolveWarehouseCodeOrRaw(warehouseId);
    }

    if (search) {
      where.OR = [
        { product: { name: { contains: search } } },
        { product: { sku: { contains: search } } },
      ];
    }

    const total = await prisma.inventoryItem.count({ where });

    const inventories = await prisma.inventoryItem.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            unit: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // 动态计算 availableQty，而非依赖可能不一致的手动维护字段
    const items = inventories.map(item => ({
      ...item,
      availableQty: computeAvailableQty(item.quantity, item.reservedQty),
      availableQuantity: computeAvailableQty(item.quantity, item.reservedQty),
      lockedQuantity: item.reservedQty,
    }));

    return successResponse({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return errorResponse('获取库存列表失败');
  }
}

// POST /api/v1/inventory/adjust - 库存调整
export async function POST(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = AdjustInventorySchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    const data = validationResult.data;

    // 库存表只认仓库 code：请求体可能传 Warehouse.id（前端下拉 value）或 'MAIN'
    let warehouseCode: string;
    try {
      warehouseCode = await resolveWarehouseCode(data.warehouseId);
    } catch (e) {
      if (e instanceof WarehouseNotFoundError) {
        return validationErrorResponse([{ field: 'warehouseId', message: e.message }]);
      }
      throw e;
    }

    // 查找或创建库存记录
    let inventoryItem = await prisma.inventoryItem.findUnique({
      where: {
        productId_warehouse: {
          productId: data.productId,
          warehouse: warehouseCode,
        },
      },
    });

    // 如果库存记录不存在，创建一个新的
    if (!inventoryItem) {
      inventoryItem = await prisma.inventoryItem.create({
        data: {
          productId: data.productId,
          warehouse: warehouseCode,
          quantity: 0,
          reservedQty: 0,
        },
      });
    }

    // 更新库存（乐观锁 + 重试机制，最多 3 次）
    let updatedItem: any;
    let success = false;

    // 修复（2026-09-11）：此前一律 beforeQty + data.quantity，忽略 type，导致"出库"反而增加库存。
    // 现按业务类型决定方向：OUT 恒为减；IN/RETURN 恒为增；ADJUSTMENT/TRANSFER 沿用传入的带符号数量。
    // 在循环外计算，供下方流水记录复用。
    const delta = (data.type === 'ADJUSTMENT' || data.type === 'TRANSFER')
      ? data.quantity
      : (data.type === 'OUT' ? -Math.abs(data.quantity) : Math.abs(data.quantity));

    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await prisma.inventoryItem.findUniqueOrThrow({
        where: { id: inventoryItem.id },
        select: { version: true, quantity: true },
      });

      const beforeQty = current.quantity;
      const afterQty = beforeQty + delta;

      if (afterQty < 0) {
        return conflictResponse('调整后库存不能为负数');
      }

      const updateData: any = {
        quantity: afterQty,
      };

      if (delta > 0) {
        updateData.lastInboundDate = new Date();
      } else {
        updateData.lastOutboundDate = new Date();
      }

      const result = await prisma.inventoryItem.updateMany({
        where: { id: inventoryItem.id, version: current.version },
        data: { ...updateData, version: { increment: 1 } },
      });

      if (result.count > 0) {
        success = true;
        updatedItem = await prisma.inventoryItem.findUniqueOrThrow({
          where: { id: inventoryItem.id },
        });
        break;
      }

      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    if (!success) {
      return conflictResponse('库存数据已被其他操作修改，请重试');
    }

    // 创建库存流水
    const log = await prisma.inventoryLog.create({
      data: {
        productId: data.productId,
        warehouseId: warehouseCode,
        type: data.type,
        quantity: delta,
        beforeQuantity: updatedItem.quantity - delta,
        afterQuantity: updatedItem.quantity,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        note: data.note,
      },
    });

    return successResponse({
      inventoryItem,
      log,
      beforeQuantity: updatedItem.quantity - data.quantity,
      afterQuantity: updatedItem.quantity,
    }, '库存调整成功');
  } catch (error) {
    console.error('Error adjusting inventory:', error);
    return errorResponse('库存调整失败');
  }
}
