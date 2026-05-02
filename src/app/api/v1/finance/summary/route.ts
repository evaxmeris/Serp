import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { errorResponse, successResponse } from '@/lib/api-response';
import { withCache } from '@/lib/cache';

/**
 * GET /api/v1/finance/summary - 获取财务概览汇总数据
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证', 'UNAUTHORIZED', 401);
    }

    // 使用 5 分钟缓存加速财务概览
    const result = await withCache('finance_summary', async () => {
      // 本月起始时间
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // 并发查询所有汇总数据
      const [
        receivablesResult,
        payablesResult,
        monthlyIncomeResult,
        monthlyExpenseResult,
      ] = await Promise.all([
        // 应收: Order 表中 balanceAmount > 0 的余额总和
        prisma.order.aggregate({
          where: { balanceAmount: { gt: 0 }, deletedAt: null },
          _sum: { balanceAmount: true },
        }),
        // 应付: PurchaseOrder 表中 balanceAmount > 0 的余额总和
        prisma.purchaseOrder.aggregate({
          where: { balanceAmount: { gt: 0 }, deletedAt: null },
          _sum: { balanceAmount: true },
        }),
        // 本月收入: Transaction WHERE type='INCOME' AND 本月 的 amountCny 总和
        prisma.transaction.aggregate({
          where: {
            type: 'INCOME',
            transactionDate: { gte: monthStart },
          },
          _sum: { amountCny: true },
        }),
        // 本月支出: Transaction WHERE type='EXPENSE' AND 本月 的 amountCny 总和
        prisma.transaction.aggregate({
          where: {
            type: 'EXPENSE',
            transactionDate: { gte: monthStart },
          },
          _sum: { amountCny: true },
        }),
      ]);

      return {
        receivables: receivablesResult._sum.balanceAmount ?? 0,
        payables: payablesResult._sum.balanceAmount ?? 0,
        monthlyIncome: monthlyIncomeResult._sum.amountCny ?? 0,
        monthlyExpense: monthlyExpenseResult._sum.amountCny ?? 0,
      };
    });

    return successResponse(result);
  } catch (error) {
    console.error('Error fetching finance summary:', error);
    return errorResponse('获取财务汇总失败', 'INTERNAL_ERROR', 500);
  }
}
