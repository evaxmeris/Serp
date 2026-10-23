/**
 * 补货建议：忽略（dismiss）与一键转单（convert）
 *
 * 转单规则（业务口径）：
 *   - PURCHASE_ORDER：转采购单草稿（status=PENDING，与人工建单同一套编号/金额逻辑，见 purchase-order-draft.ts）
 *   - STOCK_TRANSFER：转调拨单草稿（status=DRAFT，国内仓 → 建议的海外仓，创建即锁货，见 stock-transfer-create.ts）
 *   - 状态机：PENDING/APPROVED → CONVERTED（终态，写回 convertedType/convertedId/convertedNo）
 *   - 重复转单：状态已 CONVERTED → 409（并带出原单号）；并发转单靠 updateMany 原子领取（count=0 → 409）
 *   - 任意异常回滚：事务内完成「领取 + 建单 + 写回」，失败则建议仍是 PENDING，可直接重试
 */

import { prisma } from '@/lib/prisma';
import { resolveOverseasWarehouse } from '@/lib/overseas-inventory';
import { resolveWarehouse, WarehouseNotFoundError } from '@/lib/warehouse-resolver';
import { createStockTransferDraft } from '@/lib/stock-transfer-create';
import { createPurchaseOrderDraft } from '@/lib/purchase-order-draft';

export type ConvertTarget = 'PURCHASE_ORDER' | 'STOCK_TRANSFER';

export class ReplenishmentSuggestionNotFoundError extends Error {
  constructor(message = '补货建议不存在') {
    super(message);
    this.name = 'ReplenishmentSuggestionNotFoundError';
  }
}

/** 状态不允许当前操作（已转单/已忽略），映射 409 */
export class ReplenishmentSuggestionStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReplenishmentSuggestionStateError';
  }
}

/** 参数不合法（缺供应商/缺源仓/数量非法），映射 422 */
export class ReplenishmentConvertValidationError extends Error {
  constructor(
    message: string,
    public fields: Array<{ field: string; message: string }> = []
  ) {
    super(message);
    this.name = 'ReplenishmentConvertValidationError';
  }
}

export interface DismissParams {
  id: string;
  reason?: string | null;
  operatorId?: string | null;
}

export async function dismissSuggestion(params: DismissParams) {
  const { id, reason, operatorId } = params;

  const suggestion = await prisma.replenishmentSuggestion.findUnique({ where: { id } });
  if (!suggestion) throw new ReplenishmentSuggestionNotFoundError();

  if (suggestion.status === 'CONVERTED') {
    throw new ReplenishmentSuggestionStateError(
      `该建议已转为 ${suggestion.convertedType ?? '单据'}（${suggestion.convertedNo ?? suggestion.convertedId}），不能忽略`
    );
  }
  if (suggestion.status === 'DISMISSED') {
    throw new ReplenishmentSuggestionStateError('该建议已被忽略，无需重复操作');
  }

  const now = new Date();
  const claimed = await prisma.replenishmentSuggestion.updateMany({
    where: { id, status: { in: ['PENDING', 'APPROVED'] } },
    data: {
      status: 'DISMISSED',
      dismissedAt: now,
      dismissedReason: reason ?? null,
      notes: operatorId
        ? `${suggestion.notes ? suggestion.notes + ' / ' : ''}忽略操作人：${operatorId}`
        : suggestion.notes,
    },
  });

  if (claimed.count === 0) {
    throw new ReplenishmentSuggestionStateError('建议状态已被其他操作改变，请刷新后重试');
  }

  return prisma.replenishmentSuggestion.findUniqueOrThrow({ where: { id } });
}

export interface ConvertParams {
  id: string;
  target: ConvertTarget;
  /** 审计用操作人标识（邮箱），写入 convertedById（无外键） */
  operatorId?: string | null;
  /** 真实 userId（purchase_orders.purchaserId / stock_transfers.createdById 是外键或审计字段） */
  operatorUserId?: string | null;
  /** 转采购单：供应商（必填） */
  supplierId?: string | null;
  /** 转调拨单：国内源仓（id 或 code，必填） */
  fromWarehouseId?: string | null;
  /** 数量覆盖（默认用建议量） */
  quantity?: number | null;
  /** 转采购单：单价（默认取产品 costPrice） */
  unitPrice?: number | null;
  currency?: string | null;
  notes?: string | null;
}

export interface ConvertResult {
  suggestion: Awaited<ReturnType<typeof prisma.replenishmentSuggestion.findUniqueOrThrow>>;
  target: ConvertTarget;
  document: {
    id: string;
    no: string;
    status: string;
    [key: string]: unknown;
  };
}

export async function convertSuggestion(params: ConvertParams): Promise<ConvertResult> {
  const { id, target, operatorId, quantity, currency, notes } = params;

  const suggestion = await prisma.replenishmentSuggestion.findUnique({
    where: { id },
    include: {
      product: { select: { id: true, name: true, sku: true, costPrice: true, currency: true } },
      overseasWarehouse: { select: { id: true, code: true, name: true } },
    },
  });
  if (!suggestion) throw new ReplenishmentSuggestionNotFoundError();

  if (suggestion.status === 'CONVERTED') {
    throw new ReplenishmentSuggestionStateError(
      `该建议已转为 ${suggestion.convertedType ?? '单据'}（${suggestion.convertedNo ?? suggestion.convertedId}），不能重复转单`
    );
  }
  if (suggestion.status === 'DISMISSED') {
    throw new ReplenishmentSuggestionStateError('该建议已被忽略，不能转单（请重新生成建议）');
  }

  const qty = quantity !== null && quantity !== undefined ? Math.trunc(Number(quantity)) : suggestion.suggestedQty;
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new ReplenishmentConvertValidationError('转单数量必须大于 0', [
      { field: 'quantity', message: '转单数量必须大于 0' },
    ]);
  }

  if (!suggestion.productId) {
    throw new ReplenishmentConvertValidationError('建议缺少产品主数据（productId 为空），无法转单', [
      { field: 'productId', message: '建议缺少产品主数据' },
    ]);
  }

  const reference = `补货建议 ${suggestion.id}（SKU ${suggestion.sku} / ${suggestion.overseasWarehouse?.code ?? suggestion.overseasWarehouseId}）`;
  const finalNotes = [reference, notes].filter(Boolean).join('；');

  // ---- 前置校验（事务外，尽量早失败） ----
  if (target === 'PURCHASE_ORDER') {
    if (!params.supplierId) {
      throw new ReplenishmentConvertValidationError('转采购单必须指定供应商 supplierId', [
        { field: 'supplierId', message: '转采购单必须指定供应商' },
      ]);
    }
    const supplier = await prisma.supplier.findUnique({
      where: { id: params.supplierId },
      select: { id: true, status: true },
    });
    if (!supplier) {
      throw new ReplenishmentConvertValidationError('供应商不存在', [
        { field: 'supplierId', message: '供应商不存在' },
      ]);
    }
    if (supplier.status === 'INACTIVE' || supplier.status === 'BLACKLISTED') {
      throw new ReplenishmentConvertValidationError('供应商已停用或被拉黑，不能下采购单', [
        { field: 'supplierId', message: '供应商已停用或被拉黑' },
      ]);
    }
  } else {
    if (!params.fromWarehouseId) {
      throw new ReplenishmentConvertValidationError('转调拨单必须指定国内源仓 fromWarehouseId', [
        { field: 'fromWarehouseId', message: '转调拨单必须指定国内源仓' },
      ]);
    }
  }

  const domesticFrom =
    target === 'STOCK_TRANSFER' && params.fromWarehouseId
      ? await resolveWarehouse(params.fromWarehouseId).catch(e => {
          if (e instanceof WarehouseNotFoundError) {
            throw new ReplenishmentConvertValidationError(e.message, [
              { field: 'fromWarehouseId', message: e.message },
            ]);
          }
          throw e;
        })
      : null;

  const overseasTo =
    target === 'STOCK_TRANSFER'
      ? await resolveOverseasWarehouse(suggestion.overseasWarehouseId)
      : null;

  if (target === 'STOCK_TRANSFER' && overseasTo && !overseasTo.isActive) {
    throw new ReplenishmentConvertValidationError(
      `海外仓 ${overseasTo.name} 已停用，不能调拨`,
      [{ field: 'overseasWarehouseId', message: '目标海外仓已停用' }]
    );
  }

  const now = new Date();

  const result = await prisma.$transaction(async tx => {
    // 原子领取：并发/重复转单在这里被挡掉
    const claimed = await tx.replenishmentSuggestion.updateMany({
      where: { id, status: { in: ['PENDING', 'APPROVED'] } },
      data: {
        status: 'CONVERTED',
        convertedType: target,
        convertedAt: now,
        convertedById: operatorId ?? null,
      },
    });
    if (claimed.count === 0) {
      throw new ReplenishmentSuggestionStateError('建议状态已被其他操作改变（可能已转单/已被忽略），请刷新后重试');
    }

    if (target === 'PURCHASE_ORDER') {
      const unitPrice =
        params.unitPrice !== null && params.unitPrice !== undefined
          ? Number(params.unitPrice)
          : Number(suggestion.product?.costPrice ?? 0);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new ReplenishmentConvertValidationError('单价必须是非负数', [
          { field: 'unitPrice', message: '单价必须是非负数' },
        ]);
      }

      const po = await createPurchaseOrderDraft(tx, {
        supplierId: params.supplierId!,
        currency: currency ?? suggestion.product?.currency ?? 'CNY',
        purchaserId: params.operatorUserId ?? null,
        notes: `${finalNotes}；目标海外仓：${suggestion.overseasWarehouse?.name ?? suggestion.overseasWarehouseId}`,
        items: [
          {
            productId: suggestion.productId,
            productName: suggestion.product?.name ?? suggestion.sku,
            productSku: suggestion.sku,
            quantity: qty,
            unitPrice,
            notes: `${reference} 建议量 ${suggestion.suggestedQty}`,
          },
        ],
      });

      const updated = await tx.replenishmentSuggestion.update({
        where: { id },
        data: { convertedId: po.id, convertedNo: po.poNo },
      });

      return {
        suggestion: updated,
        document: { id: po.id, no: po.poNo, status: po.status, totalAmount: po.totalAmount.toString() },
      };
    }

    const transfer = await createStockTransferDraft(tx, {
      direction: 'DOMESTIC_TO_OVERSEAS',
      domesticFrom: domesticFrom!,
      overseasTo: overseasTo!,
      notes: `${finalNotes}；建议量 ${suggestion.suggestedQty}`,
      createdById: params.operatorUserId ?? operatorId ?? null,
      items: [{ productId: suggestion.productId!, quantity: qty }],
    });

    const updated = await tx.replenishmentSuggestion.update({
      where: { id },
      data: { convertedId: transfer.id, convertedNo: transfer.transferNo },
    });

    return {
      suggestion: updated,
      document: { id: transfer.id, no: transfer.transferNo, status: transfer.status },
    };
  });

  return {
    suggestion: result.suggestion,
    target,
    document: result.document,
  };
}
