import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
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
    const searchParams = request.nextUrl.searchParams;
    
    const page = Number(searchParams.get('page')) || 1;
    const limit = Number(searchParams.get('limit')) || 20;
    const productId = searchParams.get('productId');
    const warehouseId = searchParams.get('warehouseId');
    const search = searchParams.get('search');

    const where: any = {};

    if (productId) {
      where.productId = productId;
    }

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    if (search) {
      where.OR = [
        { product: { name: { contains: search } } },
        { product: { sku: { contains: search } } },
      ];
    }

    const total = await prisma.inventory.count({ where });

    const inventories = await prisma.inventory.findMany({
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
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return successResponse({
      items: inventories,
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
    const body = await request.json();
    const validationResult = AdjustInventorySchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    const data = validationResult.data;

    // 查找库存记录
    let inventory = await prisma.inventory.findUnique({
      where: {
        productId_warehouseId: {
          productId: data.productId,
          warehouseId: data.warehouseId,
        },
      },
    });

    // 如果库存记录不存在，创建一个新的
    if (!inventory) {
      inventory = await prisma.inventory.create({
        data: {
          productId: data.productId,
          warehouseId: data.warehouseId,
          quantity: 0,
          availableQuantity: 0,
          lockedQuantity: 0,
        },
      });
    }

    const beforeQuantity = inventory.quantity;
    const afterQuantity = beforeQuantity + data.quantity;

    // 检查调整后库存是否为负
    if (afterQuantity < 0) {
      return conflictResponse('调整后库存不能为负数');
    }

    // 更新库存
    const updateData: any = {
      quantity: afterQuantity,
    };

    if (data.quantity > 0) {
      updateData.availableQuantity = { increment: data.quantity };
      updateData.lastInboundDate = new Date();
    } else {
      updateData.availableQuantity = { decrement: Math.abs(data.quantity) };
      updateData.lastOutboundDate = new Date();
    }

    await prisma.inventory.update({
      where: { id: inventory.id },
      data: updateData,
    });

    // 创建库存流水
    const log = await prisma.inventoryLog.create({
      data: {
        productId: data.productId,
        warehouseId: data.warehouseId,
        type: data.type,
        quantity: data.quantity,
        beforeQuantity,
        afterQuantity,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        note: data.note,
      },
    });

    return successResponse({
      inventory,
      log,
      beforeQuantity,
      afterQuantity,
    }, '库存调整成功');
  } catch (error) {
    console.error('Error adjusting inventory:', error);
    return errorResponse('库存调整失败');
  }
}
