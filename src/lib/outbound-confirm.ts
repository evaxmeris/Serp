/**
 * 出库单确认（发货）核心逻辑 — 单一实现，供单个确认 / 批量确认共用
 *
 * 历史 bug（重复计数）：
 *   confirm 时先查出"该销售订单下所有 status=SHIPPED 的出库单明细"（此刻已包含本次这张单），
 *   再用 `shippedQty: { increment: shippedQty }` 写回 OrderItem。
 *   shippedQty 本身就是"累计已出数量"，对累计值再做 increment → 第二次确认时
 *   把历史累计量又加一遍（1 → 3 → 6 ...），订单页"已出库数量"翻倍虚高，
 *   并导致"是否全部出库"判断提前成立。
 *
 * 现在的做法：
 *   1) 原子领取状态：updateMany({ where: { id, status: 'PENDING' } })，count=0 即说明
 *      已被确认/取消（并发双击也一样），直接返回 NOT_PENDING —— 确认动作幂等。
 *   2) 已出数量用 **赋值**（绝对值）而非 increment，值 = 该订单所有 SHIPPED 出库单的数量合计。
 *      重复执行结果不变（幂等），且能自愈历史脏值。
 *   3) 库存扣减只发生在出库单创建时，确认动作不碰 inventory_items（不会二次扣减）。
 */

import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/** 允许通过发货推进到 SHIPPED 的销售订单状态（遵循 order-status-machine） */
const SHIPPABLE_ORDER_STATUSES = ['CONFIRMED', 'IN_PRODUCTION', 'READY'];

export type ConfirmResult =
  | { ok: true }
  | { ok: false; reason: 'NOT_FOUND' | 'NOT_PENDING'; status?: string };

/**
 * 按"实际已发货出库单"重算销售订单行的 shippedQty，并在全部发齐时推进订单状态。
 * 幂等：重复调用结果一致。
 */
export async function recalcOrderShippedQty(tx: Tx, orderId: string): Promise<void> {
  const orderItems = await tx.orderItem.findMany({
    where: { orderId },
    select: { id: true, productId: true, quantity: true, shippedQty: true },
  });
  if (orderItems.length === 0) return;

  const shippedItems = await tx.outboundOrderItem.findMany({
    where: { outboundOrder: { orderId, status: 'SHIPPED' } },
    select: { productId: true, quantity: true },
  });

  const shippedByProduct = new Map<string, number>();
  for (const s of shippedItems) {
    shippedByProduct.set(s.productId, (shippedByProduct.get(s.productId) ?? 0) + s.quantity);
  }

  let allShipped = true;

  for (const item of orderItems) {
    // OrderItem.productId 可为空（纯文本行），这类行不参与按产品汇总
    const shippedQty = item.productId ? shippedByProduct.get(item.productId) ?? 0 : 0;

    // 赋值（非 increment）：重复确认不会累加，且可修正历史翻倍脏值
    if (shippedQty !== (item.shippedQty ?? 0)) {
      await tx.orderItem.update({
        where: { id: item.id },
        data: { shippedQty },
      });
    }

    if (shippedQty < item.quantity) allShipped = false;
  }

  if (!allShipped) return;

  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  if (!order) return;

  if (SHIPPABLE_ORDER_STATUSES.includes(order.status)) {
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'SHIPPED' },
    });
  }
}

/**
 * 确认单张出库单（PENDING → SHIPPED）。
 * 必须在事务中调用；重复/并发调用只有一次会真正生效。
 */
export async function confirmOutboundOrderOnce(
  tx: Tx,
  outboundOrderId: string
): Promise<ConfirmResult> {
  const existing = await tx.outboundOrder.findUnique({
    where: { id: outboundOrderId },
    select: { id: true, status: true, orderId: true },
  });

  if (!existing) return { ok: false, reason: 'NOT_FOUND' };
  if (existing.status !== 'PENDING') {
    return { ok: false, reason: 'NOT_PENDING', status: existing.status };
  }

  // 原子领取：并发双击时只有一个事务能成功把 PENDING 改成 SHIPPED
  const claimed = await tx.outboundOrder.updateMany({
    where: { id: outboundOrderId, status: 'PENDING' },
    data: { status: 'SHIPPED' },
  });

  if (claimed.count === 0) {
    const latest = await tx.outboundOrder.findUnique({
      where: { id: outboundOrderId },
      select: { status: true },
    });
    return { ok: false, reason: 'NOT_PENDING', status: latest?.status };
  }

  if (existing.orderId) {
    await recalcOrderShippedQty(tx, existing.orderId);
  }

  return { ok: true };
}
