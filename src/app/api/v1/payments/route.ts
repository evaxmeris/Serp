import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { getSession, requirePermission } from '@/middleware/auth';
import { listResponse, createdResponse, errorResponse, notFoundResponse } from '@/lib/api-response';
import { generatePaymentNo, generateTransactionNo } from '@/lib/id-generator';
import { syncOrderPaymentStatus } from '@/lib/order-payment';

/**
 * 收款联动：只重算「钱」的字段（paidAmount / balanceAmount / paymentStatus），
 * 订单履约状态（status）不因收款被直接置为 COMPLETED —— 见 @/lib/order-payment。
 *
 * 旧实现的问题：全额到账时 updateData.status = 'COMPLETED'，
 * PENDING / CONFIRMED / SHIPPED 的订单一收款就"已完成"，绕过 SHIPPED → DELIVERED → COMPLETED。
 */

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

      // 核心：收款后重算已付金额/余额/收款状态；订单履约状态只在已送达时才会推进到 COMPLETED
      // 传入 tx —— 原先调用的是全局 prisma，实际跑在事务之外，收款与订单金额可能不一致
      await syncOrderPaymentStatus(tx, body.orderId);

      return { payment, transaction };
    });

    return createdResponse(result, '收款创建成功');
  } catch (e) {
    console.error(e);
    return errorResponse('创建失败', 'INTERNAL_ERROR', 500);
  }
}
