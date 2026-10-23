/**
 * 海外仓台账（OverseasInventory + StockMovement）统一记账模块
 *
 * 口径（二期补货/调拨/入库都会依赖，改动前先读这里）：
 *   - overseas_inventory.quantity 是**本地台账实物数量**，唯一权威值（平台同步值只做参考）
 *   - overseas_inventory.availableQty / totalQty 是派生镜像，写台账时同步刷新，供列表/报表直读
 *   - 可用量 = quantity - reservedQty（本模块统一用 computeOverseasAvailable 计算）
 *   - 每一次台账变动都必须写一条 stock_movements 流水（warehouse=海外仓编码，overseasWarehouseId=海外仓主键）
 *   - 并发控制：overseas_inventory.version 乐观锁；冲突抛 OverseasStockConflictError，由路由映射 409
 *
 * 事务约束：所有写操作必须在调用方的事务内执行（传入 tx），禁止在本模块内自行开事务。
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type Tx = Prisma.TransactionClient;

/** 海外仓不存在 */
export class OverseasWarehouseNotFoundError extends Error {
  constructor(input: string) {
    super(`海外仓不存在或编码无法识别：${input}`);
    this.name = 'OverseasWarehouseNotFoundError';
  }
}

/** 台账并发冲突（乐观锁失败），调用方可重试 */
export class OverseasStockConflictError extends Error {
  constructor(message = '海外仓台账已被其他操作修改，请重试') {
    super(message);
    this.name = 'OverseasStockConflictError';
  }
}

/** 台账业务校验失败（库存不足、结果为负等），映射 422 */
export class OverseasStockValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OverseasStockValidationError';
  }
}

export interface ResolvedOverseasWarehouse {
  id: string;
  code: string;
  name: string;
  country: string;
  isActive: boolean;
}

/** 可用量计算（统一入口，禁止各路由自己写 quantity - reservedQty） */
export function computeOverseasAvailable(quantity: number, reservedQty: number): number {
  return quantity - reservedQty;
}

/**
 * 海外仓标识归一化：支持 OverseasWarehouse.id（cuid）或 code（大小写不敏感）
 */
export async function resolveOverseasWarehouse(
  input: string | null | undefined
): Promise<ResolvedOverseasWarehouse> {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw) throw new OverseasWarehouseNotFoundError(String(input));

  const byId = await prisma.overseasWarehouse.findUnique({
    where: { id: raw },
    select: { id: true, code: true, name: true, country: true, isActive: true },
  });
  if (byId) return byId;

  const byCode = await prisma.overseasWarehouse.findFirst({
    where: { code: { equals: raw, mode: 'insensitive' } },
    select: { id: true, code: true, name: true, country: true, isActive: true },
  });
  if (byCode) return byCode;

  throw new OverseasWarehouseNotFoundError(raw);
}

export interface OverseasStockChangeInput {
  /** 海外仓主键（overseas_warehouses.id） */
  overseasWarehouseId: string;
  /** 海外仓编码，写流水用 */
  overseasWarehouseCode: string;
  productId: string;
  /** 变动量：正数入库，负数出库 */
  delta: number;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER' | 'RETURN';
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  /** 产品 SKU（新建台账行时必填，缺省时从 products 表读取） */
  sku?: string;
}

export interface OverseasStockChangeResult {
  inventoryId: string;
  before: number;
  after: number;
  available: number;
  movementId: string;
}

/**
 * 应用一次海外仓台账变动（含流水）。必须在事务内调用。
 *
 * 流程：读快照 → 校验不够减 → 乐观锁写入（quantity/totalQty/availableQty/version）→ 写 StockMovement
 */
export async function applyOverseasStockChange(
  tx: Tx,
  input: OverseasStockChangeInput
): Promise<OverseasStockChangeResult> {
  const {
    overseasWarehouseId,
    overseasWarehouseCode,
    productId,
    delta,
    type,
    referenceType,
    referenceId,
    notes,
    sku,
  } = input;

  if (!Number.isInteger(delta) || delta === 0) {
    throw new OverseasStockValidationError('台账变动量必须是非零整数');
  }

  let row = await tx.overseasInventory.findUnique({
    where: { warehouseId_productId: { warehouseId: overseasWarehouseId, productId } },
  });

  if (!row) {
    if (delta < 0) {
      throw new OverseasStockValidationError('该产品在此海外仓没有台账记录，无法减少库存');
    }
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { sku: true },
    });
    if (!product) throw new OverseasStockValidationError('产品不存在');

    row = await tx.overseasInventory.create({
      data: {
        warehouseId: overseasWarehouseId,
        productId,
        sku: sku || product.sku || productId,
        quantity: 0,
        totalQty: 0,
        availableQty: 0,
        reservedQty: 0,
        version: 0,
      },
    });
  }

  const before = row.quantity;
  const after = before + delta;

  if (after < 0) {
    throw new OverseasStockValidationError(
      `海外仓台账库存不足：当前 ${before}，需要变动 ${delta}`
    );
  }

  const available = computeOverseasAvailable(after, row.reservedQty);

  // 乐观锁：where 带 version，绝对赋值是安全的（版本不匹配直接失败，不会写脏值）
  const updated = await tx.overseasInventory.updateMany({
    where: { id: row.id, version: row.version },
    data: {
      quantity: after,
      totalQty: after,
      availableQty: available,
      version: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    throw new OverseasStockConflictError();
  }

  const movement = await tx.stockMovement.create({
    data: {
      productId,
      warehouse: overseasWarehouseCode,
      overseasWarehouseId,
      type,
      quantity: delta,
      referenceType,
      referenceId,
      notes,
    },
  });

  return { inventoryId: row.id, before, after, available, movementId: movement.id };
}
