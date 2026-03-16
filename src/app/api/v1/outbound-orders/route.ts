import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
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

// 创建出库单 Schema 验证
const CreateOutboundOrderSchema = z.object({
  orderId: z.string().min(1, '销售订单 ID 不能为空'),
  warehouseId: z.string().min(1, '仓库 ID 不能为空'), // 仓库 ID 在出库单级别
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
  status: z.enum(['DRAFT', 'PENDING', 'SHIPPED', 'CANCELLED']).optional(),
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
    const searchParams = request.nextUrl.searchParams;
    const queryResult = QuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!queryResult.success) {
      return validationErrorResponse(extractZodErrors(queryResult.error));
    }

    const { page, limit, status, orderId, search, sortBy, sortOrder } = queryResult.data;

    // 构建查询条件
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (orderId) {
      where.orderId = orderId;
    }

    if (search) {
      where.OR = [
        { outboundNo: { contains: search } },
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
    const body = await request.json();
    const validationResult = CreateOutboundOrderSchema.safeParse(body);

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

    // 验证所有产品是否存在，并检查库存
    for (const item of data.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        return notFoundResponse(`产品 (ID: ${item.productId})`);
      }

      // 检查库存
      const inventory = await prisma.inventory.findUnique({
        where: {
          productId_warehouseId: {
            productId: item.productId,
            warehouseId: data.warehouseId,
          },
        },
      });

      if (!inventory || inventory.availableQuantity < item.quantity) {
        return conflictResponse(
          `产品 ${product.name} 库存不足（可用：${inventory?.availableQuantity || 0}，需要：${item.quantity}）`
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
      
      const count = await tx.outboundOrder.count({
        where: {
          createdAt: {
            gte: new Date(year, now.getMonth(), now.getDate()),
          },
        },
      });
      
      const outboundNo = `OB-${year}${month}${day}-${String(count + 1).padStart(3, '0')}`;

      // 创建出库单
      const order = await tx.outboundOrder.create({
        data: {
          outboundNo,
          orderId: data.orderId,
          warehouseId: data.warehouseId, // 使用出库单级别的仓库 ID
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

      // 扣减库存
      const warehouseId = data.warehouseId; // 从出库单获取仓库 ID
      for (const item of data.items) {
        await tx.inventory.update({
          where: {
            productId_warehouseId: {
              productId: item.productId,
              warehouseId: warehouseId,
            },
          },
          data: {
            quantity: { decrement: item.quantity },
            availableQuantity: { decrement: item.quantity },
            lastOutboundDate: now,
          },
        });

        // 创建库存日志
        const inventory = await tx.inventory.findUnique({
          where: {
            productId_warehouseId: {
              productId: item.productId,
              warehouseId: warehouseId,
            },
          },
        });

        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            warehouseId: warehouseId,
            type: 'OUT',
            quantity: -item.quantity,
            beforeQuantity: inventory ? inventory.quantity + item.quantity : item.quantity,
            afterQuantity: inventory?.quantity || 0,
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
