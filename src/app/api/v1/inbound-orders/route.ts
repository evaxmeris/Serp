import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
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

// Schema 验证
const CreateInboundOrderSchema = z.object({
  type: z.enum(['PURCHASE_IN', 'RETURN_IN', 'ADJUSTMENT_IN', 'TRANSFER_IN', 'OTHER_IN']),
  purchaseOrderId: z.string().optional(),
  supplierId: z.string().optional(),
  warehouseId: z.string().optional(),
  // 目标海外仓：填了就走海外仓台账，warehouseId（国内仓）不能再填
  targetOverseasWarehouseId: z.string().min(1).optional(),
  expectedDate: z.string().optional(),
  totalAmount: z.number().optional(),
  note: z.string().optional(),
  items: z.array(z.object({
    productId: z.string(),
    expectedQuantity: z.number().min(1, '数量必须大于 0'),
    unitPrice: z.number().min(0, '单价不能为负'),
    batchNo: z.string().optional(),
    productionDate: z.string().optional(),
    expiryDate: z.string().optional(),
  })).min(1, '入库单至少需要一项商品'),
});

const UpdateInboundOrderSchema = CreateInboundOrderSchema.partial();

const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  type: z.enum(['PURCHASE_IN', 'RETURN_IN', 'ADJUSTMENT_IN', 'TRANSFER_IN', 'OTHER_IN']).optional(),
  status: z.enum(['PENDING', 'PARTIAL', 'COMPLETED', 'CANCELLED']).optional(),
  supplierId: z.string().optional(),
  warehouseId: z.string().optional(),
  targetOverseasWarehouseId: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// GET /api/v1/inbound-orders - 获取入库单列表
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

    const { page, limit, type, status, supplierId, warehouseId, targetOverseasWarehouseId, search, sortBy, sortOrder } = queryResult.data;
    // 构建查询条件
    const where: any = {};

    if (targetOverseasWarehouseId) {
      where.targetOverseasWarehouseId = targetOverseasWarehouseId;
    }

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    if (search) {
      where.OR = [
        { inboundNo: { contains: search } },
        { note: { contains: search } },
      ];
    }

    // 查询总数
    const total = await prisma.inboundOrder.count({ where });

    // 查询数据
    const orders = await prisma.inboundOrder.findMany({
      where,
      include: {
        supplier: {
          select: {
            id: true,
            companyName: true,
          },
        },
        targetOverseasWarehouse: {
          select: {
            id: true,
            code: true,
            name: true,
            country: true,
          },
        },
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
    console.error('Error fetching inbound orders:', error);
    return errorResponse('获取入库单列表失败');
  }
}

// POST /api/v1/inbound-orders - 创建入库单
export async function POST(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = CreateInboundOrderSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    const data = validationResult.data;

    // 目标仓二选一：国内仓（warehouseId）或海外仓（targetOverseasWarehouseId）
    if (data.warehouseId && data.targetOverseasWarehouseId) {
      return validationErrorResponse([
        {
          field: 'targetOverseasWarehouseId',
          message: '目标国内仓与目标海外仓不能同时指定，请只填其中一个',
        },
      ]);
    }

    // 验证海外仓是否存在（如果提供了）
    let targetOverseasWarehouse = null;
    if (data.targetOverseasWarehouseId) {
      targetOverseasWarehouse = await prisma.overseasWarehouse.findUnique({
        where: { id: data.targetOverseasWarehouseId },
        select: { id: true, name: true, code: true, isActive: true },
      });
      if (!targetOverseasWarehouse) {
        return notFoundResponse('目标海外仓');
      }
      if (!targetOverseasWarehouse.isActive) {
        return conflictResponse(`海外仓 ${targetOverseasWarehouse.name} 已停用，不能作为入库目标`);
      }
    }

    // 验证采购订单是否存在（如果提供了）
    if (data.purchaseOrderId) {
      const purchaseOrder = await prisma.purchaseOrder.findUnique({
        where: { id: data.purchaseOrderId },
      });

      if (!purchaseOrder) {
        return notFoundResponse('采购订单');
      }
    }

    // 验证供应商是否存在（如果提供了）
    if (data.supplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: data.supplierId },
      });

      if (!supplier) {
        return notFoundResponse('供应商');
      }
    }

    // 验证所有产品是否存在
    for (const item of data.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        return notFoundResponse(`产品 (ID: ${item.productId})`);
      }
    }

    // 计算总金额
    const totalAmount = data.items.reduce((sum, item) => {
      return sum + (item.expectedQuantity * item.unitPrice);
    }, 0);

    // 修复 P0 问题 #4：使用事务保证入库单号生成的并发安全性
    const inboundOrder = await prisma.$transaction(async (tx) => {
      // 在事务中生成入库单号，避免并发冲突
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      
      const count = await tx.inboundOrder.count({
        where: {
          createdAt: {
            gte: new Date(year, now.getMonth(), now.getDate()),
          },
        },
      });
      
      const inboundNo = `IN-${year}${month}${day}-${String(count + 1).padStart(3, '0')}`;

      // 创建入库单
      return await tx.inboundOrder.create({
        data: {
          inboundNo,
          type: data.type,
          status: 'PENDING',
          purchaseOrderId: data.purchaseOrderId,
          supplierId: data.supplierId,
          // 海外仓入库：warehouseId 置空，仅通过 targetOverseasWarehouse 定位
          warehouseId: data.targetOverseasWarehouseId ? null : data.warehouseId,
          targetOverseasWarehouseId: data.targetOverseasWarehouseId ?? null,
          expectedDate: data.expectedDate ? new Date(data.expectedDate) : undefined,
          totalAmount,
          note: data.note,
          items: {
            create: data.items.map(item => ({
              productId: item.productId,
              expectedQuantity: item.expectedQuantity,
              actualQuantity: 0,
              unitPrice: item.unitPrice,
              amount: item.expectedQuantity * item.unitPrice,
              batchNo: item.batchNo,
              productionDate: item.productionDate ? new Date(item.productionDate) : undefined,
              expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          supplier: true,
          targetOverseasWarehouse: true,
        },
      });
    });

    return successResponse(inboundOrder, '入库单创建成功', 'CREATED');
  } catch (error) {
    console.error('Error creating inbound order:', error);
    return errorResponse('创建入库单失败');
  }
}
