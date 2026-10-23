/**
 * 采购单创建（共享核心逻辑）
 *
 * 两个入口共用，避免编号/金额口径漂移：
 *   1. POST /api/v1/purchase-orders（人工建单）
 *   2. POST /api/v1/replenishment/suggestions/[id]/convert（补货建议一键转采购单）
 *
 * 口径（与原 POST /api/v1/purchase-orders 完全一致，改动前先对齐）：
 *   poNo = PO-YYYYMMDD-NNN（当日序号）
 *   amount = quantity × unitPrice × (1 − discountRate/100)
 *   taxAmount = amount × taxRate/100
 *   totalAmount = Σ(amount + taxAmount)；balanceAmount = totalAmount
 *   初始 status = PENDING（系统内没有 DRAFT 枚举，"草稿"= PENDING + approvalStatus=NOT_REQUIRED）
 */

import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export const PURCHASE_ORDER_INCLUDE = {
  supplier: { select: { id: true, companyName: true, companyEn: true } },
  purchaser: { select: { id: true, name: true, email: true } },
  items: true,
} as const;

export type PurchaseOrderWithRelations = Prisma.PurchaseOrderGetPayload<{
  include: typeof PURCHASE_ORDER_INCLUDE;
}>;

export interface PurchaseOrderDraftItemInput {
  productId?: string | null;
  productName: string;
  productSku?: string | null;
  specification?: string | null;
  unit?: string;
  quantity: number;
  unitPrice: number;
  discountRate?: number;
  taxRate?: number;
  notes?: string | null;
  expectedDeliveryDate?: Date | null;
}

export interface CreatePurchaseOrderDraftInput {
  supplierId: string;
  currency?: string;
  exchangeRate?: number;
  purchaserId?: string | null;
  salesOrderId?: string | null;
  deliveryDate?: Date | null;
  deliveryDeadline?: Date | null;
  deliveryAddress?: string | null;
  shippingMethod?: string | null;
  paymentTerms?: string | null;
  paymentDeadline?: Date | null;
  notes?: string | null;
  internalNotes?: string | null;
  attachments?: string[];
  items: PurchaseOrderDraftItemInput[];
}

/** 生成当日流水号 PO-YYYYMMDD-NNN */
export async function nextPurchaseOrderNo(tx: Tx): Promise<string> {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(
    date.getDate()
  ).padStart(2, '0')}`;
  const count = await tx.purchaseOrder.count({
    where: {
      createdAt: { gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()) },
    },
  });
  return `PO-${ymd}-${String(count + 1).padStart(3, '0')}`;
}

/**
 * 创建采购单（PENDING）。事务可选：调用方已在事务内则传入 tx。
 */
export async function createPurchaseOrderDraft(
  tx: Tx,
  input: CreatePurchaseOrderDraftInput
): Promise<PurchaseOrderWithRelations> {
  if (!input.items.length) throw new Error('采购订单至少需要一项商品');

  const poNo = await nextPurchaseOrderNo(tx);

  let totalAmount = 0;
  const itemsData = input.items.map(item => {
    const discountRate = item.discountRate ?? 0;
    const taxRate = item.taxRate ?? 0;
    const amount = item.quantity * item.unitPrice * (1 - discountRate / 100);
    const taxAmount = amount * (taxRate / 100);
    totalAmount += amount + taxAmount;
    return {
      productId: item.productId ?? null,
      productName: item.productName,
      productSku: item.productSku ?? null,
      specification: item.specification ?? null,
      unit: item.unit ?? 'PCS',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountRate,
      amount,
      taxRate,
      taxAmount,
      expectedDeliveryDate: item.expectedDeliveryDate ?? null,
      notes: item.notes ?? null,
    };
  });

  const purchaseOrder = await tx.purchaseOrder.create({
    data: {
      poNo,
      supplierId: input.supplierId,
      salesOrderId: input.salesOrderId ?? null,
      status: 'PENDING',
      approvalStatus: 'NOT_REQUIRED',
      currency: input.currency ?? 'CNY',
      exchangeRate: input.exchangeRate ?? 1,
      totalAmount,
      paidAmount: 0,
      balanceAmount: totalAmount,
      deliveryDate: input.deliveryDate ?? null,
      deliveryDeadline: input.deliveryDeadline ?? null,
      deliveryAddress: input.deliveryAddress ?? null,
      shippingMethod: input.shippingMethod ?? null,
      paymentTerms: input.paymentTerms ?? null,
      paymentDeadline: input.paymentDeadline ?? null,
      purchaserId: input.purchaserId ?? null,
      notes: input.notes ?? null,
      internalNotes: input.internalNotes ?? null,
      attachments: input.attachments ?? [],
      items: { create: itemsData },
    },
    include: PURCHASE_ORDER_INCLUDE,
  });

  return purchaseOrder as PurchaseOrderWithRelations;
}
