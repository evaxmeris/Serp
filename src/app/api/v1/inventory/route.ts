import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { computeAvailableQty } from '@/lib/inventory-utils';
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
      where.warehouse = warehouseId;
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

    // 查找或创建库存记录
    let inventoryItem = await prisma.inventoryItem.findUnique({
      where: {
        productId_warehouse: {
          productId: data.productId,
          warehouse: data.warehouseId,
        },
      },
    });

    // 如果库存记录不存在，创建一个新的
    if (!inventoryItem) {
      inventoryItem = await prisma.inventoryItem.create({
        data: {
          productId: data.productId,
          warehouse: data.warehouseId,
          quantity: 0,
          reservedQty: 0,
        },
      });
    }

    const beforeQuantity = inventoryItem.quantity;
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
      updateData.lastInboundDate = new Date();
    } else {
      updateData.lastOutboundDate = new Date();
    }

    await prisma.inventoryItem.update({
      where: { id: inventoryItem.id },
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
      inventoryItem,
      log,
      beforeQuantity,
      afterQuantity,
    }, '库存调整成功');
  } catch (error) {
    console.error('Error adjusting inventory:', error);
    return errorResponse('库存调整失败');
  }
}
