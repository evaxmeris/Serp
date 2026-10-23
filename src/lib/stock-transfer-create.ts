/**
 * 调拨单草稿创建（共享核心逻辑）
 *
 * 背景：调拨单有两个创建入口 ——
 *   1. POST /api/v1/stock-transfers（人工建单）
 *   2. POST /api/v1/replenishment/suggestions/[id]/convert（补货建议一键转调拨单）
 * 编号规则、初始状态、创建即锁货（扣减源仓库存）这些业务规则必须只有一处实现，
 * 否则两个入口会漂移（编号撞号、扣减口径不一致）。
 *
 * 约定：
 *   - 仓库归一化（id/code → {id,code,name}）由调用方在事务外完成并传入
 *   - 本函数必须在调用方的事务内执行（内部会调 applyDomesticStockChange / applyOverseasStockChange）
 *   - 初始状态恒为 DRAFT；创建即扣减源仓库存，取消时由 /cancel 回补
 */

import { Prisma, StockTransfer } from '@prisma/client';
import {
  applyOverseasStockChange,
} from '@/lib/overseas-inventory';
import { applyDomesticStockChange } from '@/lib/inventory-mutations';

type Tx = Prisma.TransactionClient;

export const STOCK_TRANSFER_INCLUDE = {
  items: { include: { product: { select: { id: true, name: true, sku: true } } } },
  fromWarehouse: { select: { id: true, code: true, name: true } },
  toWarehouse: { select: { id: true, code: true, name: true } },
  fromOverseasWarehouse: { select: { id: true, code: true, name: true, country: true } },
  toOverseasWarehouse: { select: { id: true, code: true, name: true, country: true } },
  logisticsOrder: { select: { id: true, orderNo: true, status: true, trackingNo: true } },
} as const;

export type StockTransferWithRelations = Prisma.StockTransferGetPayload<{
  include: typeof STOCK_TRANSFER_INCLUDE;
}>;

export interface ResolvedWarehouseRef {
  id: string;
  code: string;
  name: string;
}

export interface ResolvedOverseasWarehouseRef {
  id: string;
  code: string;
  name: string;
}

export interface CreateStockTransferDraftInput {
  direction: 'DOMESTIC_TO_OVERSEAS' | 'OVERSEAS_TO_DOMESTIC';
  /** 国内源仓（direction=DOMESTIC_TO_OVERSEAS 时必填） */
  domesticFrom?: ResolvedWarehouseRef | null;
  /** 海外目标仓（direction=DOMESTIC_TO_OVERSEAS 时必填） */
  overseasTo?: ResolvedOverseasWarehouseRef | null;
  /** 海外源仓（direction=OVERSEAS_TO_DOMESTIC 时必填） */
  overseasFrom?: ResolvedOverseasWarehouseRef | null;
  /** 国内目标仓（direction=OVERSEAS_TO_DOMESTIC 时必填） */
  domesticTo?: ResolvedWarehouseRef | null;
  logisticsOrderId?: string | null;
  notes?: string | null;
  items: Array<{ productId: string; quantity: number; notes?: string | null }>;
  createdById?: string | null;
}

/** 生成当日流水号 TR-YYYYMMDD-NNN（在事务内调用，避免并发重号） */
async function nextTransferNo(tx: Tx): Promise<string> {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const todayCount = await tx.stockTransfer.count({
    where: { createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } },
  });
  return `TR-${ymd}-${String(todayCount + 1).padStart(3, '0')}`;
}

/**
 * 创建调拨单草稿（DRAFT）+ 扣减源仓库存 + 写库存流水。必须在事务内调用。
 */
export async function createStockTransferDraft(
  tx: Tx,
  input: CreateStockTransferDraftInput
): Promise<StockTransferWithRelations> {
  const {
    direction,
    domesticFrom,
    overseasTo,
    overseasFrom,
    domesticTo,
    logisticsOrderId,
    notes,
    items,
    createdById,
  } = input;

  const isDomesticToOverseas = direction === 'DOMESTIC_TO_OVERSEAS';

  if (isDomesticToOverseas) {
    if (!domesticFrom || !overseasTo) {
      throw new Error('国内→海外调拨必须指定国内源仓与海外目标仓');
    }
  } else if (!overseasFrom || !domesticTo) {
    throw new Error('海外→国内调拨必须指定海外源仓与国内目标仓');
  }

  const transferNo = await nextTransferNo(tx);

  const created = await tx.stockTransfer.create({
    data: {
      transferNo,
      direction,
      status: 'DRAFT',
      fromWarehouseId: domesticFrom?.id ?? null,
      toWarehouseId: domesticTo?.id ?? null,
      fromOverseasWarehouseId: overseasFrom?.id ?? null,
      toOverseasWarehouseId: overseasTo?.id ?? null,
      logisticsOrderId: logisticsOrderId ?? null,
      notes: notes ?? undefined,
      createdById: createdById ?? null,
      items: {
        create: items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          notes: i.notes ?? undefined,
        })),
      },
    },
    include: STOCK_TRANSFER_INCLUDE,
  });

  // 创建即锁货：扣减源仓库存（取消时回补）
  for (const item of items) {
    if (isDomesticToOverseas) {
      await applyDomesticStockChange(tx, {
        productId: item.productId,
        warehouseCode: domesticFrom!.code,
        delta: -item.quantity,
        type: 'TRANSFER',
        referenceType: 'STOCK_TRANSFER',
        referenceId: created.id,
        note: `调拨单 ${transferNo} 出库至海外仓 ${overseasTo!.name}`,
      });
    } else {
      await applyOverseasStockChange(tx, {
        overseasWarehouseId: overseasFrom!.id,
        overseasWarehouseCode: overseasFrom!.code,
        productId: item.productId,
        delta: -item.quantity,
        type: 'TRANSFER',
        referenceType: 'STOCK_TRANSFER',
        referenceId: created.id,
        notes: `调拨单 ${transferNo} 出库至国内仓 ${domesticTo!.name}`,
      });
    }
  }

  return created as StockTransferWithRelations;
}

export type { StockTransfer };
