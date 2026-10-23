/**
 * 国内仓库存变动统一入口（inventory_items + inventory_logs）
 *
 * 与出库单/入库单现有逻辑口径一致：
 *   - inventory_items.warehouse 只写仓库编码 code（调用方先用 warehouse-resolver 归一化）
 *   - availableQty 不手工维护，可用量 = quantity - reservedQty 由 inventory-utils 动态计算
 *   - 并发用 version 乐观锁（updateMany where id + version）
 *
 * 注意：出库单创建/取消、入库单确认的历史代码是各自内联实现的（未迁移到本模块），
 * 为保证行为不变，本模块只给新功能（调拨单）使用，不改动老路径。
 */

import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export class DomesticStockConflictError extends Error {
  constructor(message = '国内仓库存已被其他操作修改，请重试') {
    super(message);
    this.name = 'DomesticStockConflictError';
  }
}

export class DomesticStockValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomesticStockValidationError';
  }
}

export interface DomesticStockChangeInput {
  productId: string;
  /** 仓库编码（code），调用方已归一化 */
  warehouseCode: string;
  /** 变动量：正数入库，负数出库 */
  delta: number;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER' | 'RETURN';
  referenceType?: string;
  referenceId?: string;
  note?: string;
}

export interface DomesticStockChangeResult {
  inventoryId: string;
  before: number;
  after: number;
}

/**
 * 应用一次国内仓库存变动 + 写 inventory_logs。必须在事务内调用。
 */
export async function applyDomesticStockChange(
  tx: Tx,
  input: DomesticStockChangeInput
): Promise<DomesticStockChangeResult> {
  const { productId, warehouseCode, delta, type, referenceType, referenceId, note } = input;

  if (!Number.isInteger(delta) || delta === 0) {
    throw new DomesticStockValidationError('库存变动量必须是非零整数');
  }

  let row = await tx.inventoryItem.findUnique({
    where: { productId_warehouse: { productId, warehouse: warehouseCode } },
  });

  if (!row) {
    if (delta < 0) {
      throw new DomesticStockValidationError(`产品在仓库 ${warehouseCode} 没有库存记录，无法出库`);
    }
    row = await tx.inventoryItem.create({
      data: {
        productId,
        warehouse: warehouseCode,
        quantity: 0,
        reservedQty: 0,
        availableQty: 0,
      },
    });
  }

  const before = row.quantity;
  const after = before + delta;
  if (after < 0) {
    throw new DomesticStockValidationError(
      `仓库 ${warehouseCode} 库存不足：当前 ${before}，需要 ${Math.abs(delta)}`
    );
  }

  const updated = await tx.inventoryItem.updateMany({
    where: { id: row.id, version: row.version },
    data: {
      quantity: after,
      version: { increment: 1 },
      ...(delta > 0 ? { lastInboundDate: new Date() } : { lastOutboundDate: new Date() }),
    },
  });

  if (updated.count === 0) {
    throw new DomesticStockConflictError();
  }

  await tx.inventoryLog.create({
    data: {
      productId,
      warehouseId: warehouseCode,
      type,
      quantity: delta,
      beforeQuantity: before,
      afterQuantity: after,
      referenceType,
      referenceId,
      note,
    },
  });

  return { inventoryId: row.id, before, after };
}
