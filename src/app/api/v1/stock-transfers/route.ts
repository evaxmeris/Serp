import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import {
  listResponse,
  createdResponse,
  errorResponse,
  notFoundResponse,
  conflictResponse,
  validationErrorResponse,
} from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';
import {
  resolveWarehouse,
  WarehouseNotFoundError,
} from '@/lib/warehouse-resolver';
import {
  resolveOverseasWarehouse,
  OverseasWarehouseNotFoundError,
  OverseasStockConflictError,
  OverseasStockValidationError,
} from '@/lib/overseas-inventory';
import { createStockTransferDraft } from '@/lib/stock-transfer-create';
import {
  DomesticStockConflictError,
  DomesticStockValidationError,
} from '@/lib/inventory-mutations';

/**
 * 调拨单（决策⑦：允许国内仓 ↔ 海外仓直接调拨，跳过采购）
 *
 *   GET  /api/v1/stock-transfers            列表（?status=&direction=&warehouseId=&overseasWarehouseId=）
 *   POST /api/v1/stock-transfers            创建（DRAFT，立即扣减源仓库存）
 *
 * 状态机：DRAFT →(ship) IN_TRANSIT →(receive，可多次部分收货) RECEIVED
 *         DRAFT →(cancel) CANCELLED 且回补源仓库存；已发货（IN_TRANSIT）不可取消
 */

const DIRECTIONS = ['DOMESTIC_TO_OVERSEAS', 'OVERSEAS_TO_DOMESTIC'] as const;
const STATUSES = ['DRAFT', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'] as const;

const CreateStockTransferSchema = z.object({
  direction: z.enum(DIRECTIONS).default('DOMESTIC_TO_OVERSEAS'),
  // 国内 → 海外
  fromWarehouseId: z.string().min(1).optional(), // 国内仓（id 或 code）
  toOverseasWarehouseId: z.string().min(1).optional(),
  // 海外 → 国内
  fromOverseasWarehouseId: z.string().min(1).optional(),
  toWarehouseId: z.string().min(1).optional(), // 国内仓（id 或 code）
  logisticsOrderId: z.string().min(1).optional(),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, '产品 ID 不能为空'),
        quantity: z.number().int().positive('调拨数量必须大于 0'),
        notes: z.string().max(200).optional(),
      })
    )
    .min(1, '调拨单至少需要一项商品'),
});

const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(STATUSES).optional(),
  direction: z.enum(DIRECTIONS).optional(),
  warehouseId: z.string().optional(),
  overseasWarehouseId: z.string().optional(),
});

const INCLUDE = {
  items: { include: { product: { select: { id: true, name: true, sku: true } } } },
  fromWarehouse: { select: { id: true, code: true, name: true } },
  toWarehouse: { select: { id: true, code: true, name: true } },
  fromOverseasWarehouse: { select: { id: true, code: true, name: true, country: true } },
  toOverseasWarehouse: { select: { id: true, code: true, name: true, country: true } },
  logisticsOrder: { select: { id: true, orderNo: true, status: true, trackingNo: true } },
} as const;

export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const v = validateOrReturn(QuerySchema, Object.fromEntries(request.nextUrl.searchParams), 'query');
    if (!v.success) return v.response;
    const { page, limit, status, direction, warehouseId, overseasWarehouseId } = v.data;

    const where: any = {};
    if (status) where.status = status;
    if (direction) where.direction = direction;
    if (warehouseId) {
      where.OR = [{ fromWarehouseId: warehouseId }, { toWarehouseId: warehouseId }];
    }
    if (overseasWarehouseId) {
      const or = [
        { fromOverseasWarehouseId: overseasWarehouseId },
        { toOverseasWarehouseId: overseasWarehouseId },
      ];
      where.OR = where.OR ? [...where.OR, ...or] : or;
    }

    const [rows, total] = await Promise.all([
      prisma.stockTransfer.findMany({
        where,
        include: INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.stockTransfer.count({ where }),
    ]);

    return listResponse(rows, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    });
  } catch (error) {
    console.error('获取调拨单列表失败:', error);
    return errorResponse('获取调拨单列表失败');
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const body = await request.json().catch(() => ({}));
    const v = validateOrReturn(CreateStockTransferSchema, body);
    if (!v.success) return v.response;
    const data = v.data;

    const isDomesticToOverseas = data.direction === 'DOMESTIC_TO_OVERSEAS';

    // ---- 1. 方向与仓库校验 ----
    const errors: Array<{ field: string; message: string }> = [];
    let domesticFrom: { id: string; code: string; name: string } | null = null;
    let domesticTo: { id: string; code: string; name: string } | null = null;
    let overseasFrom: { id: string; code: string; name: string; isActive: boolean } | null = null;
    let overseasTo: { id: string; code: string; name: string; isActive: boolean } | null = null;

    if (isDomesticToOverseas) {
      if (!data.fromWarehouseId) errors.push({ field: 'fromWarehouseId', message: '国内仓不能为空' });
      if (!data.toOverseasWarehouseId)
        errors.push({ field: 'toOverseasWarehouseId', message: '目标海外仓不能为空' });
    } else {
      if (!data.fromOverseasWarehouseId)
        errors.push({ field: 'fromOverseasWarehouseId', message: '源海外仓不能为空' });
      if (!data.toWarehouseId) errors.push({ field: 'toWarehouseId', message: '目标国内仓不能为空' });
    }
    if (errors.length) return validationErrorResponse(errors);

    try {
      if (isDomesticToOverseas) {
        domesticFrom = await resolveWarehouse(data.fromWarehouseId!);
        overseasTo = await resolveOverseasWarehouse(data.toOverseasWarehouseId!);
      } else {
        overseasFrom = await resolveOverseasWarehouse(data.fromOverseasWarehouseId!);
        domesticTo = await resolveWarehouse(data.toWarehouseId!);
      }
    } catch (e) {
      if (e instanceof WarehouseNotFoundError || e instanceof OverseasWarehouseNotFoundError) {
        return errorResponse(e.message, 'NOT_FOUND', 404);
      }
      throw e;
    }

    const targetOverseas = overseasTo ?? overseasFrom;
    if (targetOverseas && !targetOverseas.isActive) {
      return conflictResponse(`海外仓 ${targetOverseas.name} 已停用，不能调拨`);
    }

    // ---- 2. 明细去重 + 产品校验 ----
    const productIds = data.items.map(i => i.productId);
    const duplicated = productIds.filter((id, idx) => productIds.indexOf(id) !== idx);
    if (duplicated.length) {
      return validationErrorResponse([
        { field: 'items', message: `同一产品在调拨单内重复：${Array.from(new Set(duplicated)).join(', ')}` },
      ]);
    }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true },
    });
    if (products.length !== productIds.length) {
      const found = new Set(products.map(p => p.id));
      const missing = productIds.filter(id => !found.has(id));
      return notFoundResponse(`产品 (ID: ${missing.join(', ')})`);
    }

    // ---- 3. 物流单校验（可选） ----
    if (data.logisticsOrderId) {
      const lo = await prisma.logisticsOrder.findUnique({
        where: { id: data.logisticsOrderId },
        select: { id: true },
      });
      if (!lo) return notFoundResponse('物流订单');
    }

    // ---- 4. 事务：建单 + 扣减源仓库存（共享核心逻辑见 src/lib/stock-transfer-create.ts） ----
    const transfer = await prisma.$transaction(async tx =>
      createStockTransferDraft(tx, {
        direction: data.direction,
        domesticFrom,
        overseasTo,
        overseasFrom,
        domesticTo,
        logisticsOrderId: data.logisticsOrderId ?? null,
        notes: data.notes ?? null,
        items: data.items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          notes: i.notes ?? null,
        })),
        createdById: session.id,
      })
    );

    return createdResponse(transfer, '调拨单创建成功');
  } catch (error) {
    console.error('创建调拨单失败:', error);
    if (error instanceof DomesticStockValidationError || error instanceof OverseasStockValidationError) {
      return validationErrorResponse([{ field: 'items', message: error.message }]);
    }
    if (error instanceof DomesticStockConflictError || error instanceof OverseasStockConflictError) {
      return errorResponse(error.message, 'CONFLICT', 409);
    }
    return errorResponse('创建调拨单失败');
  }
}
