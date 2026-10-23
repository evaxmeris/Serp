/**
 * 订单收款联动 —— 收款只更新「钱」的字段，不越过履约状态机
 *
 * 历史 bug（收款绕过状态机）：
 *   POST/PUT /api/v1/payments 在"全额到账"时直接 `status: 'COMPLETED'`，
 *   PENDING / CONFIRMED / SHIPPED 的订单一收款就变"已完成"，
 *   跳过 发货(SHIPPED) → 送达(DELIVERED) → 完成(COMPLETED) 的履约流转，
 *   财务报表与仓库发货数据因此对不上（订单显示完成但从未发货）。
 *
 * 现在的规则：
 *   - 收款永远只写 paidAmount / balanceAmount / paymentStatus
 *   - PENDING → CONFIRMED：首笔收款到账即可确认订单（状态机允许的合法跳转，保留原有行为）
 *   - COMPLETED：只有在订单已 DELIVERED（已送达/已履约）且全额收齐时才允许，
 *     并再次经过 order-status-machine 校验（DELIVERED → COMPLETED）
 *   - 其余状态（CONFIRMED / IN_PRODUCTION / READY / SHIPPED）一律不动 status
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canTransition } from '@/lib/order-status-machine';
import type { OrderStatus } from '@/types/order';

type Db = Prisma.TransactionClient | typeof prisma;

export type OrderPaymentState = 'UNPAID' | 'PARTIAL' | 'PAID';

export interface OrderPaymentSyncResult {
  orderId: string;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: OrderPaymentState;
  status: string;
  statusChanged: boolean;
  transitionedTo?: 'CONFIRMED' | 'COMPLETED';
}

/**
 * 按订单下所有收款记录重算已付/余额/收款状态，并按履约状态机决定是否推进订单状态。
 * 幂等：重复调用结果一致（金额是重算的，不是累加的）。
 */
export async function syncOrderPaymentStatus(
  client: Db,
  orderId: string
): Promise<OrderPaymentSyncResult | null> {
  const order = await client.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      totalAmount: true,
      status: true,
      confirmedAt: true,
      completedAt: true,
    },
  });
  if (!order) return null;

  const payments = await client.payment.findMany({
    where: { orderId },
    select: { amount: true },
  });

  const totalPaid = payments.reduce((sum: number, p: { amount: Prisma.Decimal }) => sum + p.amount.toNumber(), 0);
  const totalAmount = order.totalAmount.toNumber();
  const balanceAmount = Math.max(0, totalAmount - totalPaid);

  const paymentStatus: OrderPaymentState =
    totalPaid <= 0 ? 'UNPAID' : balanceAmount <= 0 ? 'PAID' : 'PARTIAL';

  const updateData: Prisma.OrderUpdateInput = {
    paidAmount: new Prisma.Decimal(totalPaid.toFixed(2)),
    balanceAmount: new Prisma.Decimal(balanceAmount.toFixed(2)),
    paymentStatus,
  };

  let transitionedTo: 'CONFIRMED' | 'COMPLETED' | undefined;

  // 1) 首笔收款到账 → CONFIRMED（合法跳转，不越过履约环节）
  if (paymentStatus !== 'UNPAID' && order.status === 'PENDING') {
    if (canTransition('PENDING' as OrderStatus, 'CONFIRMED' as OrderStatus)) {
      updateData.status = 'CONFIRMED';
      updateData.confirmedAt = order.confirmedAt ?? new Date();
      transitionedTo = 'CONFIRMED';
    }
  }

  // 2) 全额收齐 + 已送达 → COMPLETED（必须经过状态机校验；跳过任何中间履约状态都不允许）
  if (paymentStatus === 'PAID' && order.status === 'DELIVERED') {
    if (canTransition('DELIVERED' as OrderStatus, 'COMPLETED' as OrderStatus)) {
      updateData.status = 'COMPLETED';
      updateData.completedAt = order.completedAt ?? new Date();
      transitionedTo = 'COMPLETED';
    }
  }

  const updated = await client.order.update({
    where: { id: orderId },
    data: updateData,
    select: { status: true },
  });

  return {
    orderId,
    paidAmount: totalPaid,
    balanceAmount,
    paymentStatus,
    status: updated.status,
    statusChanged: updated.status !== order.status,
    transitionedTo,
  };
}
