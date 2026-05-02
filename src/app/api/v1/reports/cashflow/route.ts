/**
 * 现金流量报表 API
 * 从 Payment(收入) + SupplierPayment(支出) + Expense(费用) 统计现金流
 *
 * GET /api/v1/reports/cashflow
 *   查询参数:
 *     - startDate (必填): 开始日期 YYYY-MM-DD
 *     - endDate   (必填): 结束日期 YYYY-MM-DD
 *     - period    (可选): day/week/month/quarter/year (默认 month)
 *     - type      (可选): operating/investing/financing (默认全部)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { validateOrReturn } from '@/lib/api-validation';
import { CashflowReportSchema } from '@/lib/api-schemas';

// ============================================
// 类型定义
// ============================================

interface CashflowSummary {
  openingBalance: number;
  closingBalance: number;
  netCashflow: number;
  totalInflow: number;
  totalOutflow: number;
  operatingCashflow: number;
  investingCashflow: number;
  financingCashflow: number;
}

interface CashflowActivity {
  cashInflow: number;
  cashOutflow: number;
  netCashflow: number;
}

interface ReceivablesPayables {
  total: number;
  overdue: number;
  overdueRate: number;
}

interface TrendItem {
  date: string;
  inflow: number;
  outflow: number;
  net: number;
}

// ============================================
// GET 处理器
// ============================================

export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const period = searchParams.get('period') || 'month';
    const type = searchParams.get('type'); // operating/investing/financing

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: '缺少必要的日期参数 startDate 和 endDate' },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const cashflowData = await getCashflowData({ startDate: start, endDate: end, period, type });

    return NextResponse.json({ success: true, data: cashflowData });
  } catch (error) {
    console.error('获取现金流量报表失败:', error);
    return NextResponse.json(
      { error: '获取现金流量报表失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// ============================================
// POST 处理器
// ============================================

export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const v = validateOrReturn(CashflowReportSchema, body);
    if (!v.success) return v.response;
    const { startDate, endDate, reportName } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ error: '缺少必要的日期参数' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const cashflowData = await getCashflowData({ startDate: start, endDate: end });

    const report = await prisma.reportData.create({
      data: {
        reportId: 'cashflow-report',
        period: 'custom',
        periodStart: new Date(startDate),
        periodEnd: new Date(endDate),
        data: cashflowData,
        metrics: {
          netCashflow: cashflowData.summary.netCashflow,
          openingBalance: cashflowData.summary.openingBalance,
          closingBalance: cashflowData.summary.closingBalance,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: report,
      message: '现金流量报表生成成功',
    });
  } catch (error) {
    console.error('生成现金流量报表失败:', error);
    return NextResponse.json(
      { error: '生成现金流量报表失败' },
      { status: 500 }
    );
  }
}

// ============================================
// 核心计算函数
// ============================================

async function getCashflowData(params: {
  startDate: Date;
  endDate: Date;
  period?: string;
  type?: string | null;
}) {
  const { startDate, endDate, period = 'month' } = params;

  // 并行获取所有现金流数据
  const [
    payments,           // 客户付款（收入）
    supplierPayments,   // 供应商付款（支出）
    expenses,           // 费用支出
    transactions,       // 通用交易流水
    accounts,           // 账户信息（期初/期末余额）
    invoices,           // 应收发票
    purchaseOrders,     // 应付采购单
  ] = await Promise.all([
    // 1. 客户付款（收入）
    prisma.payment.findMany({
      where: {
        paymentDate: { gte: startDate, lte: endDate },
      },
      select: { amount: true, paymentDate: true },
    }),

    // 2. 供应商付款（支出）
    prisma.supplierPayment.findMany({
      where: {
        paymentDate: { gte: startDate, lte: endDate },
        status: { not: 'CANCELLED' },
      },
      select: { amount: true, paymentDate: true },
    }),

    // 3. 费用支出
    prisma.expense.findMany({
      where: {
        expenseDate: { gte: startDate, lte: endDate },
        status: { not: 'DRAFT' },
      },
      select: { amount: true, expenseDate: true, category: true },
    }),

    // 4. 通用交易流水
    prisma.transaction.findMany({
      where: {
        transactionDate: { gte: startDate, lte: endDate },
        status: 'CONFIRMED',
      },
      select: { amount: true, transactionDate: true, type: true, category: true },
    }),

    // 5. 账户信息
    prisma.account.findMany({
      select: { currentBalance: true, openingBalance: true, currency: true },
    }),

    // 6. 应收发票
    prisma.invoice.findMany({
      where: {
        status: { in: ['SENT', 'CONFIRMED', 'PAID'] },
      },
      select: { totalAmount: true, dueDate: true, status: true, invoiceDate: true },
    }),

    // 7. 应付采购单
    prisma.purchaseOrder.findMany({
      where: {
        deletedAt: null,
        status: { not: 'CANCELLED' },
      },
      select: {
        totalAmount: true,
        paidAmount: true,
        paymentDeadline: true,
        status: true,
      },
    }),
  ]);

  // ========== 计算汇总 ==========

  // 收入：客户付款总额
  const customerPaymentTotal = payments.reduce((s, p) => s + Number(p.amount), 0);

  // 交易流水中 INCOME 类型
  const transactionInflow = transactions
    .filter((t) => t.type === 'INCOME')
    .reduce((s, t) => s + Number(t.amount), 0);

  // 总流入
  const totalInflow = customerPaymentTotal + transactionInflow;

  // 支出：供应商付款 + 费用
  const supplierPaymentTotal = supplierPayments.reduce((s, p) => s + Number(p.amount), 0);
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);

  // 交易流水中 EXPENSE 类型
  const transactionOutflow = transactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((s, t) => s + Number(t.amount), 0);

  // 总流出
  const totalOutflow = supplierPaymentTotal + expenseTotal + transactionOutflow;

  // 净现金流
  const netCashflow = totalInflow - totalOutflow;

  // 期初/期末余额（取第一个人民币账户或汇总）
  const cnyAccounts = accounts.filter((a) => a.currency === 'CNY');
  const totalOpeningBalance = cnyAccounts.length > 0
    ? cnyAccounts.reduce((s, a) => s + Number(a.openingBalance), 0)
    : accounts.reduce((s, a) => s + Number(a.currentBalance) - (a.currency === 'CNY' ? 0 : 0), 0);

  const totalCurrentBalance = cnyAccounts.length > 0
    ? cnyAccounts.reduce((s, a) => s + Number(a.currentBalance), 0)
    : accounts.reduce((s, a) => s + Number(a.currentBalance), 0);

  // 如果没有账户数据，用净现金流推算
  const openingBalance = totalOpeningBalance > 0 ? totalOpeningBalance : 0;
  const closingBalance = totalCurrentBalance > 0 ? totalCurrentBalance : (openingBalance + netCashflow);

  // ========== 三大活动现金流 ==========

  // 经营活动现金流：客户付款 - 供应商付款 - 运营费用
  const operatingInflow = customerPaymentTotal;
  const operatingOutflow = supplierPaymentTotal + expenseTotal;
  const operatingCashflow = operatingInflow - operatingOutflow;

  // 投资活动现金流（从 Transaction 中取 INVESTMENT 类型）
  const investingInflow = transactions
    .filter((t) => t.type === 'INCOME' && t.category === 'INVESTMENT')
    .reduce((s, t) => s + Number(t.amount), 0);
  const investingOutflow = transactions
    .filter((t) => t.type === 'EXPENSE' && t.category === 'INVESTMENT')
    .reduce((s, t) => s + Number(t.amount), 0);
  const investingCashflow = investingInflow - investingOutflow;

  // 筹资活动现金流
  const financingInflow = transactions
    .filter((t) => t.type === 'INCOME' && t.category === 'FINANCING')
    .reduce((s, t) => s + Number(t.amount), 0);
  const financingOutflow = transactions
    .filter((t) => t.type === 'EXPENSE' && t.category === 'FINANCING')
    .reduce((s, t) => s + Number(t.amount), 0);
  const financingCashflow = financingInflow - financingOutflow;

  // ========== 应收/应付账款 ==========

  // 应收账款（未付发票）
  const receivableInvoices = invoices.filter((inv) => inv.status !== 'PAID');
  const receivablesTotal = receivableInvoices.reduce((s, inv) => s + inv.totalAmount, 0);
  const now = new Date();
  const overdueReceivables = receivableInvoices
    .filter((inv) => inv.dueDate && inv.dueDate < now)
    .reduce((s, inv) => s + inv.totalAmount, 0);
  const receivablesOverdueRate = receivablesTotal > 0
    ? parseFloat(((overdueReceivables / receivablesTotal) * 100).toFixed(1))
    : 0;

  // 应付账款（未付采购单）
  const payableOrders = purchaseOrders.filter(
    (po) => Number(po.totalAmount) > Number(po.paidAmount)
  );
  const payablesTotal = payableOrders.reduce(
    (s, po) => s + (Number(po.totalAmount) - Number(po.paidAmount)), 0
  );
  const overduePayables = payableOrders
    .filter((po) => po.paymentDeadline && po.paymentDeadline < now)
    .reduce((s, po) => s + (Number(po.totalAmount) - Number(po.paidAmount)), 0);
  const payablesOverdueRate = payablesTotal > 0
    ? parseFloat(((overduePayables / payablesTotal) * 100).toFixed(1))
    : 0;

  // ========== 趋势数据 ==========

  const trends = await calculateCashflowTrends(startDate, endDate, period);

  return {
    summary: {
      openingBalance: parseFloat(openingBalance.toFixed(2)),
      closingBalance: parseFloat(closingBalance.toFixed(2)),
      netCashflow: parseFloat(netCashflow.toFixed(2)),
      totalInflow: parseFloat(totalInflow.toFixed(2)),
      totalOutflow: parseFloat(totalOutflow.toFixed(2)),
      operatingCashflow: parseFloat(operatingCashflow.toFixed(2)),
      investingCashflow: parseFloat(investingCashflow.toFixed(2)),
      financingCashflow: parseFloat(financingCashflow.toFixed(2)),
    },
    operatingActivities: {
      cashInflow: parseFloat(operatingInflow.toFixed(2)),
      cashOutflow: parseFloat(operatingOutflow.toFixed(2)),
      netCashflow: parseFloat(operatingCashflow.toFixed(2)),
    },
    investingActivities: {
      cashInflow: parseFloat(investingInflow.toFixed(2)),
      cashOutflow: parseFloat(investingOutflow.toFixed(2)),
      netCashflow: parseFloat(investingCashflow.toFixed(2)),
    },
    financingActivities: {
      cashInflow: parseFloat(financingInflow.toFixed(2)),
      cashOutflow: parseFloat(financingOutflow.toFixed(2)),
      netCashflow: parseFloat(financingCashflow.toFixed(2)),
    },
    receivables: {
      total: parseFloat(receivablesTotal.toFixed(2)),
      overdue: parseFloat(overdueReceivables.toFixed(2)),
      overdueRate: receivablesOverdueRate,
    },
    payables: {
      total: parseFloat(payablesTotal.toFixed(2)),
      overdue: parseFloat(overduePayables.toFixed(2)),
      overdueRate: payablesOverdueRate,
    },
    trends,
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      type: period,
    },
  };
}

/**
 * 计算现金流趋势
 */
async function calculateCashflowTrends(
  start: Date,
  end: Date,
  period: string,
): Promise<TrendItem[]> {
  const [payments, supplierPayments, expenses, transactions] = await Promise.all([
    prisma.payment.findMany({
      where: { paymentDate: { gte: start, lte: end } },
      select: { amount: true, paymentDate: true },
    }),
    prisma.supplierPayment.findMany({
      where: { paymentDate: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
      select: { amount: true, paymentDate: true },
    }),
    prisma.expense.findMany({
      where: { expenseDate: { gte: start, lte: end }, status: { not: 'DRAFT' } },
      select: { amount: true, expenseDate: true },
    }),
    prisma.transaction.findMany({
      where: { transactionDate: { gte: start, lte: end }, status: 'CONFIRMED' },
      select: { amount: true, transactionDate: true, type: true },
    }),
  ]);

  const periodGroups = new Map<string, { inflow: number; outflow: number }>();

  // 按期间聚合支付流入
  for (const p of payments) {
    const key = formatPeriodKey(p.paymentDate!, period);
    const g = periodGroups.get(key) || { inflow: 0, outflow: 0 };
    g.inflow += Number(p.amount);
    periodGroups.set(key, g);
  }

  // 支出（供应商付款 + 费用）
  for (const sp of supplierPayments) {
    const key = formatPeriodKey(sp.paymentDate!, period);
    const g = periodGroups.get(key) || { inflow: 0, outflow: 0 };
    g.outflow += Number(sp.amount);
    periodGroups.set(key, g);
  }

  for (const e of expenses) {
    const key = formatPeriodKey(e.expenseDate, period);
    const g = periodGroups.get(key) || { inflow: 0, outflow: 0 };
    g.outflow += Number(e.amount);
    periodGroups.set(key, g);
  }

  // 交易流水
  for (const t of transactions) {
    const key = formatPeriodKey(t.transactionDate, period);
    const g = periodGroups.get(key) || { inflow: 0, outflow: 0 };
    if (t.type === 'INCOME') {
      g.inflow += Number(t.amount);
    } else {
      g.outflow += Number(t.amount);
    }
    periodGroups.set(key, g);
  }

  return Array.from(periodGroups.entries())
    .map(([date, g]) => ({
      date,
      inflow: parseFloat(g.inflow.toFixed(2)),
      outflow: parseFloat(g.outflow.toFixed(2)),
      net: parseFloat((g.inflow - g.outflow).toFixed(2)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================
// 辅助函数
// ============================================

function formatPeriodKey(date: Date, period: string): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');

  switch (period) {
    case 'day':
      return `${y}-${m}-${d}`;
    case 'week':
      const week = getWeekNumber(date);
      return `${y}-W${String(week).padStart(2, '0')}`;
    case 'month':
      return `${y}-${m}`;
    case 'quarter':
      return `${y}-Q${Math.ceil((date.getMonth() + 1) / 3)}`;
    case 'year':
      return String(y);
    default:
      return `${y}-${m}`;
  }
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
