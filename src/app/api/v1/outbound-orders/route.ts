import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { getAvailableQty } from '@/lib/inventory-utils';
import { resolveWarehouse, WarehouseNotFoundError } from '@/lib/warehouse-resolver';
import { getSession } from '@/middleware/auth';
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  validationErrorResponse,
  extractZodErrors,
  notFoundResponse,
  conflictResponse,
} from '@/lib/api-response';
import { z } from 'zod';

/**
 * 出库单 API - 列表和创建
 * 支持出库单的查询、创建功能
 */

const OUTBOUND_TYPES = ['SALE', 'SAMPLE', 'GIFT', 'INTERNAL', 'TRANSFER'] as const;

// 创建出库单 Schema 验证
const CreateOutboundOrderSchema = z.object({
  // 销售订单可选：非销售出库（样品/赠品/内部领用/调拨）允许无单
  orderId: z.string().min(1, '销售订单 ID 不能为空').optional(),
  outboundType: z.enum(OUTBOUND_TYPES).default('SALE'),
  warehouseId: z.string().min(1, '仓库 ID 不能为空'), // 仓库 ID 在出库单级别
  // 非销售出库必须填备注（决策③：出库类型 + 备注留痕）
  notes: z.string().max(500, '备注过长').optional(),
  items: z.array(z.object({
    productId: z.string().min(1, '产品 ID 不能为空'),
    quantity: z.number().int().positive('数量必须大于 0'),
    batchNo: z.string().optional(),
    location: z.string().optional(),
    unitPrice: z.number().min(0, '单价不能为负'),
    notes: z.string().optional(),
  })).min(1, '出库单至少需要一项商品'),
});

// 查询参数 Schema
const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'PICKING', 'PACKING', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional(),
  outboundType: z.enum(OUTBOUND_TYPES).optional(),
  orderId: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * GET /api/v1/outbound-orders
 * 获取出库单列表
 */
export async function GET(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const queryResult = QuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!queryResult.success) {
      return validationErrorResponse(extractZodErrors(queryResult.error));
    }

    const { page, limit, status, outboundType, orderId, search, sortBy, sortOrder } = queryResult.data;

    // 构建查询条件
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (outboundType) {
      where.outboundType = outboundType;
    }

    if (orderId) {
      where.orderId = orderId;
    }

    if (search) {
      where.OR = [
        { outboundNo: { contains: search } },
        { notes: { contains: search } },
        { items: { some: { notes: { contains: search } } } },
      ];
    }

    // 查询总数
    const total = await prisma.outboundOrder.count({ where });

    // 查询数据
    const orders = await prisma.outboundOrder.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
        order: {
          include: {
            customer: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
    });

    return paginatedResponse(
      orders,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      'SUCCESS'
    );
  } catch (error) {
    console.error('Error fetching outbound orders:', error);
    return errorResponse('获取出库单列表失败');
  }
}

/**
 * POST /api/v1/outbound-orders
 * 创建出库单
 */
export async function POST(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = CreateOutboundOrderSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    const data = validationResult.data;

    // 决策③：SALE 必须有销售订单；非 SALE（样品/赠品/内部领用/调拨）必须填备注
    const errors: Array<{ field: string; message: string }> = [];
    if (data.outboundType === 'SALE' && !data.orderId) {
      errors.push({ field: 'orderId', message: '销售出库（SALE）必须关联销售订单' });
    }
    if (data.outboundType !== 'SALE' && !data.notes?.trim()) {
      errors.push({
        field: 'notes',
        message: `${data.outboundType} 出库必须填写备注，说明用途/去向`,
      });
    }
    if (errors.length > 0) {
      return validationErrorResponse(errors);
    }

    // 验证销售订单是否存在（无单出库跳过）
    if (data.orderId) {
      const order = await prisma.order.findUnique({
        where: { id: data.orderId },
      });

      if (!order) {
        return notFoundResponse('销售订单');
      }
    }

    // 仓库归一化：请求体里的 warehouseId 可能是 Warehouse.id（前端下拉框 value）
    // 或仓库编码，库存表只认 code，必须先解析成 { id, code } 再动库存。
    let warehouse;
    try {
      warehouse = await resolveWarehouse(data.warehouseId);
    } catch (e) {
      if (e instanceof WarehouseNotFoundError) {
        return conflictResponse(e.message);
      }
      throw e;
    }
    const warehouseCode = warehouse.code;

    // 验证所有产品是否存在，并检查库存
    for (const item of data.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        return notFoundResponse(`产品 (ID: ${item.productId})`);
      }

      // 检查库存：使用动态计算的可用库存（quantity - reservedQty），而非手动维护的 availableQty 字段
      const availableQty = await getAvailableQty(item.productId, warehouseCode);

      if (availableQty < item.quantity) {
        return conflictResponse(
          `产品 ${product.name} 在仓库 ${warehouse.name}(${warehouseCode}) 库存不足（可用：${availableQty}，需要：${item.quantity}）`
        );
      }
    }

    // 使用事务创建出库单并扣减库存
    const outboundOrder = await prisma.$transaction(async (tx) => {
      // 生成出库单号
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      // 生成语义化出库单号: OUT-YYYYMMDD-<timestamp36><random>
      const timestamp = Date.now().toString(36).slice(-6);
      const random = Math.random().toString(36).slice(2, 6);
      const outboundNo = `OUT-${year}${month}${day}-${timestamp}${random}`;

      // 创建出库单
      const order = await tx.outboundOrder.create({
        data: {
          outboundNo,
          orderId: data.orderId ?? null,
          outboundType: data.outboundType,
          notes: data.notes?.trim() || null,
          warehouseId: warehouse.id, // 出库单存仓库主键 id（前端按 id 展示仓库名）
          status: 'PENDING',
          items: {
            create: data.items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // 扣减库存（不再手动维护 availableQty，由 getAvailableQty 动态计算）
      // inventory_items.warehouse 只写仓库编码 code（已在上方归一化）
      for (const item of data.items) {
        // 获取当前 version（乐观锁）
        const current = await tx.inventoryItem.findUnique({
          where: {
            productId_warehouse: {
              productId: item.productId,
              warehouse: warehouseCode,
            },
          },
          select: { id: true, version: true },
        });

        if (!current) {
          throw new Error(
            `产品 ${item.productId} 在仓库 ${warehouse.name}(${warehouseCode}) 没有库存记录`
          );
        }

        const updateResult = await tx.inventoryItem.updateMany({
          // updateMany 的 where 不接受复合唯一键 productId_warehouse（仅 WhereUniqueInput 支持），
          // 这里用主键 + 乐观锁版本号做条件
          where: { id: current.id, version: current.version },
          data: {
            quantity: { decrement: item.quantity },
            lastOutboundDate: now,
            version: { increment: 1 },
          },
        });

        if (updateResult.count === 0) {
          throw new Error('库存数据已被其他操作修改，请重试');
        }

        // 重新查询库存记录用于日志
        const inventoryItem = await tx.inventoryItem.findUniqueOrThrow({
          where: {
            productId_warehouse: {
              productId: item.productId,
              warehouse: warehouseCode,
            },
          },
        });

        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            warehouseId: warehouseCode,
            type: 'OUT',
            quantity: -item.quantity,
            beforeQuantity: inventoryItem.quantity + item.quantity,
            afterQuantity: inventoryItem.quantity,
            referenceType: 'OUTBOUND_ORDER',
            referenceId: order.id,
            note: `出库单：${outboundNo}`,
          },
        });
      }

      return order;
    });

    return successResponse(outboundOrder, '出库单创建成功', 'CREATED');
  } catch (error) {
    console.error('Error creating outbound order:', error);
    return errorResponse('创建出库单失败');
  }
}
