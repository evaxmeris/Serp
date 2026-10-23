/**
 * 角色工作台（二期 BE-2）
 *
 * 一个接口按「当前登录角色」返回待办聚合：GET /api/v1/workbench
 *
 * 角色矩阵（业务已拍板：新增 owner / ops，finance 复用现有角色，sales/purchasing/warehouse 不动）：
 *   warehouse  仓管：待确认入库单 / 待发货调拨单 / 在途调拨单 / 待出库单
 *   purchasing 采购：待处理采购单 / 待收货采购单 / PENDING 补货建议数
 *   ops        运营：对账超阈值告警数 / 平台同步失败数（近 24h）/ PENDING 补货建议数
 *   finance    财务：待收款订单 / 待付供应商款 / 本月收付汇总
 *   owner      老板（只读决策）：今日订单数 / 库存总值 / 海外仓总可用 / 告警汇总
 *   admin / super-admin：同 owner 全局视角
 *   sales      业务：我的跟进中询盘 / 待报价 / 进行中订单
 *
 * 口径说明：
 *   - 每项 todo 统一返回 { key, label, count, amount?, unit, href }，前端直接渲染
 *   - 金额一律转成 number（CNY 或订单原币），不做汇率换算（除本月收付用 amountCny）
 *   - 对账告警复用 overseas-reconcile 的阈值与 MATCH/DIFF 判定（不另写一套）
 *   - 查询全部只读，不写库
 */

import { prisma } from '@/lib/prisma';
import { buildReconcileReport, getReconcileThreshold } from '@/lib/overseas-reconcile';

export type WorkbenchRole =
  | 'owner'
  | 'ops'
  | 'finance'
  | 'warehouse'
  | 'purchasing'
  | 'sales'
  | 'viewer'
  | 'admin';

export interface WorkbenchTodo {
  key: string;
  label: string;
  count: number;
  amount?: number;
  unit?: string;
  href?: string;
  /** 附加说明（口径/数据来源） */
  hint?: string;
}

export interface WorkbenchPayload {
  role: WorkbenchRole;
  roleName: string;
  roleDisplay: string;
  roles: string[];
  userId: string;
  scope: 'global' | 'self';
  generatedAt: string;
  todos: WorkbenchTodo[];
  alerts: Record<string, number>;
  summary: Record<string, unknown>;
}

/** DB 角色名 → 工作台角色 */
const ROLE_ALIASES: Record<string, WorkbenchRole> = {
  'super-admin': 'admin',
  super_admin: 'admin',
  admin: 'admin',
  owner: 'owner',
  ops: 'ops',
  Operator_Manager: 'ops',
  finance: 'finance',
  warehouse: 'warehouse',
  warehouse_manager: 'warehouse',
  purchasing: 'purchasing',
  purchasing_manager: 'purchasing',
  sales: 'sales',
  sales_manager: 'sales',
  viewer: 'viewer',
};

const ROLE_DISPLAY: Record<WorkbenchRole, string> = {
  owner: '老板',
  ops: '运营',
  finance: '财务',
  warehouse: '仓管',
  purchasing: '采购',
  sales: '业务',
  viewer: '只读',
  admin: '管理员',
};

/** 多角色时的优先级：决策视角优先 */
const ROLE_PRIORITY: WorkbenchRole[] = [
  'admin',
  'owner',
  'ops',
  'finance',
  'purchasing',
  'warehouse',
  'sales',
  'viewer',
];

export function normalizeWorkbenchRole(roleName: string): WorkbenchRole {
  return ROLE_ALIASES[roleName] ?? 'viewer';
}

/**
 * 解析用户的工作台角色：以 DB UserRole 为准（JWT 里的 role 可能是登录时的旧值/默认 viewer）
 */
export async function resolveWorkbenchRoles(
  userId: string,
  jwtRole?: string | null
): Promise<{ roles: string[]; effective: WorkbenchRole }> {
  const rows = await prisma.userRole.findMany({
    where: { userId },
    select: { role: { select: { name: true } }, isPrimary: true },
  });

  const names = rows.map(r => r.role.name);
  if (names.length === 0 && jwtRole) names.push(jwtRole);

  const mapped = names.map(normalizeWorkbenchRole);
  const effective =
    ROLE_PRIORITY.find(r => mapped.includes(r)) ?? 'viewer';

  return { roles: names, effective };
}

// ============================================
// 各角色数据段
// ============================================

function startOfToday(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

async function warehouseSection(): Promise<{ todos: WorkbenchTodo[]; summary: Record<string, unknown> }> {
  const [pendingInbound, draftTransfers, inTransitTransfers, pendingOutbound, pendingInboundValue] =
    await Promise.all([
      prisma.inboundOrder.count({ where: { status: 'PENDING' } }),
      prisma.stockTransfer.count({ where: { status: 'DRAFT' } }),
      prisma.stockTransfer.count({ where: { status: 'IN_TRANSIT' } }),
      prisma.outboundOrder.count({ where: { status: 'PENDING' } }),
      prisma.inboundOrder.aggregate({
        where: { status: 'PENDING' },
        _sum: { totalAmount: true },
      }),
    ]);

  return {
    todos: [
      {
        key: 'pendingInboundOrders',
        label: '待确认入库单',
        count: pendingInbound,
        amount: Number(pendingInboundValue._sum.totalAmount ?? 0),
        unit: '单',
        href: '/inbound-orders?status=PENDING',
      },
      {
        key: 'draftTransfers',
        label: '待发货调拨单',
        count: draftTransfers,
        unit: '单',
        href: '/stock-transfers?status=DRAFT',
      },
      {
        key: 'inTransitTransfers',
        label: '在途调拨单',
        count: inTransitTransfers,
        unit: '单',
        href: '/stock-transfers?status=IN_TRANSIT',
      },
      {
        key: 'pendingOutboundOrders',
        label: '待出库单',
        count: pendingOutbound,
        unit: '单',
        href: '/outbound-orders?status=PENDING',
      },
    ],
    summary: { pendingInboundOrders: pendingInbound, inTransitTransfers },
  };
}

async function purchasingSection(): Promise<{ todos: WorkbenchTodo[]; summary: Record<string, unknown> }> {
  const [pendingPOs, pendingReceiptPOs, pendingReplenishment, pendingPOAgg] = await Promise.all([
    prisma.purchaseOrder.count({ where: { status: 'PENDING', deletedAt: null } }),
    prisma.purchaseOrder.count({
      where: { status: { in: ['CONFIRMED', 'IN_PRODUCTION', 'READY'] }, deletedAt: null },
    }),
    prisma.replenishmentSuggestion.count({ where: { status: 'PENDING' } }),
    prisma.purchaseOrder.aggregate({
      where: { status: 'PENDING', deletedAt: null },
      _sum: { totalAmount: true },
    }),
  ]);

  return {
    todos: [
      {
        key: 'pendingPurchaseOrders',
        label: '待处理采购单',
        count: pendingPOs,
        amount: Number(pendingPOAgg._sum.totalAmount ?? 0),
        unit: '单',
        href: '/purchase-orders?status=PENDING',
      },
      {
        key: 'pendingReceiptPurchaseOrders',
        label: '待收货采购单',
        count: pendingReceiptPOs,
        unit: '单',
        href: '/purchase-orders?status=CONFIRMED',
      },
      {
        key: 'pendingReplenishmentSuggestions',
        label: '待处理补货建议',
        count: pendingReplenishment,
        unit: '条',
        href: '/replenishment/suggestions?status=PENDING',
      },
    ],
    summary: { pendingPurchaseOrders: pendingPOs, pendingReceiptPurchaseOrders: pendingReceiptPOs },
  };
}

/** 对账超阈值告警数：复用 reconcile 报表口径（本地可用 vs 平台可售，|diff| > 阈值） */
async function countReconcileAlerts(): Promise<{
  alertCount: number;
  threshold: number;
  combos: Array<{ warehouseCode: string; platformCode: string; alertCount: number }>;
}> {
  const threshold = getReconcileThreshold();

  const [warehouses, platformCodes] = await Promise.all([
    prisma.overseasWarehouse.findMany({
      where: { isActive: true, inventory: { some: {} } },
      select: { id: true, code: true },
    }),
    prisma.platformInventorySnapshot.findMany({
      distinct: ['platformCode'],
      select: { platformCode: true },
    }),
  ]);

  const combos: Array<{ warehouseCode: string; platformCode: string; alertCount: number }> = [];
  let alertCount = 0;

  for (const wh of warehouses) {
    for (const { platformCode } of platformCodes) {
      if (!platformCode) continue;
      try {
        const report = await buildReconcileReport({
          warehouseId: wh.id,
          platformCode,
          threshold,
        });
        if (report.summary.alertCount > 0) {
          combos.push({
            warehouseCode: wh.code,
            platformCode,
            alertCount: report.summary.alertCount,
          });
          alertCount += report.summary.alertCount;
        }
      } catch (e) {
        // 单仓单平台失败不影响工作台整体（记日志继续）
        console.error(`[workbench] 对账统计失败 ${wh.code}/${platformCode}:`, e);
      }
    }
  }

  return { alertCount, threshold, combos };
}

async function countSyncFailures24h(): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return prisma.platformSyncLog.count({
    where: { status: 'failed', startedAt: { gte: since } },
  });
}

async function opsSection(): Promise<{
  todos: WorkbenchTodo[];
  summary: Record<string, unknown>;
  alerts: Record<string, number>;
}> {
  const [reconcile, syncFailures, pendingReplenishment] = await Promise.all([
    countReconcileAlerts(),
    countSyncFailures24h(),
    prisma.replenishmentSuggestion.count({ where: { status: 'PENDING' } }),
  ]);

  return {
    todos: [
      {
        key: 'reconcileAlerts',
        label: '对账差异告警',
        count: reconcile.alertCount,
        unit: '条',
        href: '/overseas/reconcile',
        hint: `本地可用 vs 平台可售，差异绝对值 > ${reconcile.threshold}`,
      },
      {
        key: 'platformSyncFailures24h',
        label: '平台同步失败（近 24h）',
        count: syncFailures,
        unit: '次',
        href: '/settings/sync-logs?status=failed',
      },
      {
        key: 'pendingReplenishmentSuggestions',
        label: '待处理补货建议',
        count: pendingReplenishment,
        unit: '条',
        href: '/replenishment/suggestions?status=PENDING',
      },
    ],
    summary: {
      reconcileThreshold: reconcile.threshold,
      reconcileCombos: reconcile.combos,
      platformSyncFailures24h: syncFailures,
    },
    alerts: { reconcileAlerts: reconcile.alertCount, platformSyncFailures24h: syncFailures },
  };
}

async function financeSection(): Promise<{
  todos: WorkbenchTodo[];
  summary: Record<string, unknown>;
}> {
  const monthStart = startOfMonth();

  const [
    ordersAwaitingPayment,
    ordersAwaitingPaymentAgg,
    supplierPaymentsPending,
    supplierPaymentsPendingAgg,
    monthIncome,
    monthExpense,
  ] = await Promise.all([
    prisma.order.count({
      where: {
        paymentStatus: { not: 'PAID' },
        status: { not: 'CANCELLED' },
        deletedAt: null,
      },
    }),
    prisma.order.aggregate({
      where: {
        paymentStatus: { not: 'PAID' },
        status: { not: 'CANCELLED' },
        deletedAt: null,
      },
      _sum: { balanceAmount: true, totalAmount: true },
    }),
    prisma.supplierPayment.count({ where: { status: 'PENDING' } }),
    prisma.supplierPayment.aggregate({ where: { status: 'PENDING' }, _sum: { amount: true } }),
    prisma.transaction.aggregate({
      where: {
        type: 'INCOME',
        status: 'CONFIRMED',
        transactionDate: { gte: monthStart },
      },
      _sum: { amountCny: true },
    }),
    prisma.transaction.aggregate({
      where: {
        type: 'EXPENSE',
        status: 'CONFIRMED',
        transactionDate: { gte: monthStart },
      },
      _sum: { amountCny: true },
    }),
  ]);

  const income = Number(monthIncome._sum.amountCny ?? 0);
  const expense = Number(monthExpense._sum.amountCny ?? 0);

  return {
    todos: [
      {
        key: 'ordersAwaitingPayment',
        label: '待收款订单',
        count: ordersAwaitingPayment,
        amount: Number(ordersAwaitingPaymentAgg._sum.balanceAmount ?? 0),
        unit: '单',
        href: '/orders?paymentStatus=UNPAID',
        hint: '未收余额合计（订单原币）',
      },
      {
        key: 'supplierPaymentsPending',
        label: '待付供应商款',
        count: supplierPaymentsPending,
        amount: Number(supplierPaymentsPendingAgg._sum.amount ?? 0),
        unit: '笔',
        href: '/finance/supplier-payments?status=PENDING',
      },
      {
        key: 'monthIncome',
        label: '本月收款（CNY）',
        count: 1,
        amount: income,
        unit: '元',
        hint: 'transaction INCOME + CONFIRMED（amountCny 合计）',
      },
      {
        key: 'monthExpense',
        label: '本月付款（CNY）',
        count: 1,
        amount: expense,
        unit: '元',
        hint: 'transaction EXPENSE + CONFIRMED（amountCny 合计）',
      },
    ],
    summary: {
      month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
      monthIncomeCny: income,
      monthExpenseCny: expense,
      monthNetCny: Number((income - expense).toFixed(2)),
      ordersAwaitingPayment,
      supplierPaymentsPending,
    },
  };
}

async function globalSection(): Promise<{
  todos: WorkbenchTodo[];
  summary: Record<string, unknown>;
  alerts: Record<string, number>;
}> {
  const today = startOfToday();

  const [
    todaySalesOrders,
    todayPlatformOrders,
    inventoryValueRows,
    overseasAgg,
    reconcile,
    syncFailures,
    pendingReplenishment,
    overdueReceivables,
  ] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: today }, deletedAt: null } }),
    prisma.platformOrder.count({
      where: {
        OR: [
          { orderDate: { gte: today } },
          { AND: [{ orderDate: null }, { orderedAt: { gte: today } }] },
        ],
      },
    }),
    prisma.$queryRaw<Array<{ value: unknown }>>`
      SELECT COALESCE(SUM(ii.quantity * p."costPrice"), 0) AS value
      FROM inventory_items ii
      JOIN products p ON p.id = ii."productId"
      WHERE p."deletedAt" IS NULL
    `,
    prisma.overseasInventory.aggregate({ _sum: { quantity: true, reservedQty: true } }),
    countReconcileAlerts(),
    countSyncFailures24h(),
    prisma.replenishmentSuggestion.count({ where: { status: 'PENDING' } }),
    prisma.order.aggregate({
      where: {
        paymentDeadline: { lt: new Date() },
        paymentStatus: { not: 'PAID' },
        status: { not: 'CANCELLED' },
        deletedAt: null,
      },
      _sum: { balanceAmount: true },
      _count: true,
    }),
  ]);

  const inventoryValue = Number(inventoryValueRows?.[0]?.value ?? 0);
  const overseasTotal = Number(overseasAgg._sum.quantity ?? 0);
  const overseasReserved = Number(overseasAgg._sum.reservedQty ?? 0);
  const totalAlerts = reconcile.alertCount + syncFailures + pendingReplenishment;

  return {
    todos: [
      {
        key: 'todayOrders',
        label: '今日订单数',
        count: todaySalesOrders,
        unit: '单',
        href: '/orders',
        hint: `销售订单（Order.createdAt ≥ 今日 0 点）；平台零售单另计 ${todayPlatformOrders} 单`,
      },
      {
        key: 'inventoryValue',
        label: '库存总值（CNY 成本价估算）',
        count: 1,
        amount: inventoryValue,
        unit: '元',
        hint: 'Σ(国内仓 quantity × product.costPrice)',
      },
      {
        key: 'overseasTotalAvailable',
        label: '海外仓总可用',
        count: overseasTotal - overseasReserved,
        unit: '件',
        hint: `Σ(quantity) ${overseasTotal} − Σ(reserved) ${overseasReserved}`,
      },
      {
        key: 'alerts',
        label: '告警汇总',
        count: totalAlerts,
        unit: '项',
        hint: `对账 ${reconcile.alertCount} + 同步失败 ${syncFailures} + 补货待处理 ${pendingReplenishment}`,
      },
    ],
    summary: {
      todaySalesOrders,
      todayPlatformOrders,
      inventoryValueCny: inventoryValue,
      overseasTotalQty: overseasTotal,
      overseasReservedQty: overseasReserved,
      overseasAvailableQty: overseasTotal - overseasReserved,
      reconcileAlertCount: reconcile.alertCount,
      platformSyncFailures24h: syncFailures,
      pendingReplenishmentSuggestions: pendingReplenishment,
      overdueReceivableCount: overdueReceivables._count,
      overdueReceivableAmount: Number(overdueReceivables._sum.balanceAmount ?? 0),
    },
    alerts: {
      reconcileAlerts: reconcile.alertCount,
      platformSyncFailures24h: syncFailures,
      pendingReplenishmentSuggestions: pendingReplenishment,
      total: totalAlerts,
    },
  };
}

async function salesSection(userId: string): Promise<{
  todos: WorkbenchTodo[];
  summary: Record<string, unknown>;
}> {
  const [myInquiries, myQuotationDrafts, myActiveOrders, myActiveOrderAgg] = await Promise.all([
    prisma.inquiry.count({
      where: {
        assignedTo: userId,
        status: { in: ['NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING'] },
        deletedAt: null,
      },
    }),
    prisma.quotation.count({ where: { status: 'DRAFT', deletedAt: null } }),
    prisma.order.count({
      where: {
        salesRepId: userId,
        status: { in: ['CONFIRMED', 'IN_PRODUCTION', 'READY', 'SHIPPED', 'DELIVERED'] },
        deletedAt: null,
      },
    }),
    prisma.order.aggregate({
      where: {
        salesRepId: userId,
        status: { in: ['CONFIRMED', 'IN_PRODUCTION', 'READY', 'SHIPPED', 'DELIVERED'] },
        deletedAt: null,
      },
      _sum: { totalAmount: true },
    }),
  ]);

  return {
    todos: [
      {
        key: 'myInquiriesInProgress',
        label: '我的跟进中询盘',
        count: myInquiries,
        unit: '条',
        href: '/inquiries?assignedTo=me',
      },
      {
        key: 'quotationsToSend',
        label: '待报价（报价草稿）',
        count: myQuotationDrafts,
        unit: '条',
        href: '/quotations?status=DRAFT',
        hint: 'Quotation 无归属人字段，此处为全局草稿数',
      },
      {
        key: 'myOrdersInProgress',
        label: '进行中订单',
        count: myActiveOrders,
        amount: Number(myActiveOrderAgg._sum.totalAmount ?? 0),
        unit: '单',
        href: '/orders?salesRepId=me',
      },
    ],
    summary: { myInquiriesInProgress: myInquiries, myActiveOrders },
  };
}

// ============================================
// 汇总入口
// ============================================

export interface BuildWorkbenchParams {
  userId: string;
  jwtRole?: string | null;
  /** 管理员可指定查看某个角色的工作台（view-as） */
  roleOverride?: string | null;
}

export async function buildWorkbench(params: BuildWorkbenchParams): Promise<WorkbenchPayload> {
  const { roles, effective } = await resolveWorkbenchRoles(params.userId, params.jwtRole);

  let role = effective;
  if (params.roleOverride) {
    const mapped = normalizeWorkbenchRole(params.roleOverride);
    // 仅全局视角（admin）可切换角色，避免越权看到别人的待办
    if (effective === 'admin' || role === params.roleOverride) {
      role = mapped;
    }
  }

  const base = {
    role,
    roleName: roles[0] ?? effective,
    roleDisplay: ROLE_DISPLAY[role],
    roles,
    userId: params.userId,
    generatedAt: new Date().toISOString(),
  };

  if (role === 'warehouse') {
    const s = await warehouseSection();
    return { ...base, scope: 'global', todos: s.todos, alerts: {}, summary: s.summary };
  }
  if (role === 'purchasing') {
    const s = await purchasingSection();
    return { ...base, scope: 'global', todos: s.todos, alerts: {}, summary: s.summary };
  }
  if (role === 'ops') {
    const s = await opsSection();
    return { ...base, scope: 'global', todos: s.todos, alerts: s.alerts, summary: s.summary };
  }
  if (role === 'finance') {
    const s = await financeSection();
    return { ...base, scope: 'global', todos: s.todos, alerts: {}, summary: s.summary };
  }
  if (role === 'sales') {
    const s = await salesSection(params.userId);
    return { ...base, scope: 'self', todos: s.todos, alerts: {}, summary: s.summary };
  }
  if (role === 'viewer') {
    return {
      ...base,
      scope: 'global',
      todos: [],
      alerts: {},
      summary: { note: '只读访客无待办；如需工作台请分配 owner/ops/finance/purchasing/warehouse/sales 角色' },
    };
  }

  // owner / admin
  const s = await globalSection();
  return { ...base, scope: 'global', todos: s.todos, alerts: s.alerts, summary: s.summary };
}
