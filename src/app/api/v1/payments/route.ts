import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { getSession, requirePermission } from '@/middleware/auth';
import { listResponse, createdResponse, errorResponse, notFoundResponse } from '@/lib/api-response';
import { generatePaymentNo, generateTransactionNo } from '@/lib/id-generator';

/**
 * 收款完成后更新订单已付金额和余额，并在金额收齐时自动推进订单状态
 *
 * 规则:
 * 1. 累加订单关联的所有收款金额 → 更新 paidAmount / balanceAmount
 * 2. 如果 balanceAmount <= 0（全额收齐）:
 *    - 当前状态 PENDING → 推进到 CONFIRMED（并记录 confirmedAt）
 *    - 当前状态非终态 → 推进到 COMPLETED（并记录 completedAt）
 * 3. 如果 balanceAmount > 0 但收款已部分到账且当前为 PENDING:
 *    - 推进到 CONFIRMED（首付款到账即确认订单）
 */
async function updateOrderPaymentStatus(orderId: string) {
  // 查询订单及关联收款
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      totalAmount: true,
      paidAmount: true,
      balanceAmount: true,
      status: true,
      confirmedAt: true,
      completedAt: true,
    },
  });

  if (!order) return;

  // 累加所有收款金额（假设同币种，暂不处理跨币种）
  const payments = await prisma.payment.findMany({
    where: { orderId },
    select: { amount: true },
  });

  const totalPaid = payments.reduce((sum, p) => sum + p.amount.toNumber(), 0);
  const totalAmount = order.totalAmount.toNumber();
  const newBalance = Math.max(0, totalAmount - totalPaid);

  // 准备更新数据
  const updateData: any = {
    paidAmount: totalPaid,
    balanceAmount: newBalance,
  };

  // 判断状态推进
  const isFullyPaid = newBalance <= 0;
  const isPartiallyPaid = totalPaid > 0 && newBalance > 0;

  if (isFullyPaid) {
    // 全额到账 → 直接推进到 COMPLETED
    // PENDING 和 CONFIRMED 都推进到 COMPLETED
    if (order.status === 'PENDING' || order.status === 'CONFIRMED') {
      updateData.status = 'COMPLETED';
      updateData.completedAt = new Date();
      if (order.status === 'PENDING') {
        updateData.confirmedAt = new Date();
      }
    }
    // 已经是 COMPLETED / CANCELLED 等终态，不做变更
  } else if (isPartiallyPaid && order.status === 'PENDING') {
    // 部分到账且当前为 PENDING → 推进到 CONFIRMED
    updateData.status = 'CONFIRMED';
    updateData.confirmedAt = new Date();
  }

  await prisma.order.update({
    where: { id: orderId },
    data: updateData,
  });
}

// GET /api/v1/payments
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);
    const orderId = searchParams.get('orderId') || '';

    const where: any = {};
    if (orderId) where.orderId = orderId;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);
    return listResponse(payments, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (e) {
    console.error(e);
    return errorResponse('获取失败', 'INTERNAL_ERROR', 500);
  }
}

// POST /api/v1/payments - 创建收款记录，自动联动订单状态 + 生成交易流水
export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);

    // 权限检查：payments:create
    const authSession = await getSession(request);
    const permError = requirePermission(authSession!, 'payments:create');
    if (permError) return permError;

    const body = await request.json();

    // 验证 orderId 必填
    if (!body.orderId) {
      return errorResponse('订单ID不能为空', 'VALIDATION_ERROR', 422);
    }
    if (!body.accountId) {
      return errorResponse('收款账户ID不能为空', 'VALIDATION_ERROR', 422);
    }

    // 验证订单存在
    const order = await prisma.order.findUnique({
      where: { id: body.orderId },
      select: { id: true, totalAmount: true, currency: true },
    });
    if (!order) {
      return errorResponse('订单不存在', 'NOT_FOUND', 404);
    }

    // 验证账户存在
    const account = await prisma.account.findUnique({
      where: { id: body.accountId },
      select: { id: true, currency: true },
    });
    if (!account) {
      return errorResponse('收款账户不存在', 'NOT_FOUND', 404);
    }

    // 在事务内创建收款 + 交易流水 + 更新订单状态
    const result = await prisma.$transaction(async (tx) => {
      // 自动生成收款单号
      const paymentNo = await generatePaymentNo();

      // 创建收款记录
      const payment = await tx.payment.create({
        data: {
          orderId: body.orderId,
          paymentNo,
          amount: body.amount,
          currency: body.currency || order.currency,
          paymentMethod: body.paymentMethod || null,
          paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
          bankReference: body.bankReference || null,
          notes: body.notes || null,
        },
      });

      // 创建交易流水（INCOME）
      const transactionNo = await generateTransactionNo();
      const amountNum = Number(body.amount);
      const exchangeRate = body.exchangeRate || 1;
      const amountCny = body.currency === 'CNY' ? amountNum : amountNum * Number(exchangeRate);

      const transaction = await tx.transaction.create({
        data: {
          transactionNo,
          accountId: body.accountId,
          type: 'INCOME',
          amount: body.amount,
          currency: body.currency || order.currency,
          exchangeRate,
          amountCny,
          counterParty: body.counterParty || null,
          description: `订单收款 - ${order.id}`,
          category: 'sales',
          businessType: 'PAYMENT',
          businessId: payment.id,
          transactionDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
          status: 'CONFIRMED',
          notes: body.notes || null,
          createdById: session.id,
        },
      });

      // 核心：收款后自动更新订单已付金额/余额，并推进订单状态
      await updateOrderPaymentStatus(body.orderId);

      return { payment, transaction };
    });

    return createdResponse(result, '收款创建成功');
  } catch (e) {
    console.error(e);
    return errorResponse('创建失败', 'INTERNAL_ERROR', 500);
  }
}
