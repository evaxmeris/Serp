/**
 * 回归验证：平台零售单必须剥离出 B2B Order 表
 *
 * 验证目标：
 * 1. Amazon/TikTok/Shopify 零售单同步后写入 PlatformOrder 镜像表
 * 2. 不再写入 B2B Order 表
 * 3. 不再自动创建 Customer
 * 4. 重复同步幂等（不产生重复行，syncVersion 递增）
 * 5. 阿里国际站 B2B 单仍写 Order 表并自动关联/创建客户（行为不变）
 *
 * 本测试使用 mock 适配器（替换平台 API 调用），走真实 executePlatformSync 代码路径和真实数据库。
 */

import { prisma } from '@/lib/prisma';
import { platformRegistry, executePlatformSync } from '@/lib/sync';
import type { PlatformAdapter, UnifiedOrder } from '@/lib/sync/types';

const TEST_MARKETPLACE = 'ATVPDKIKX0DER';
const RETAIL_ORDER_IDS = ['E2E-AMZ-RETAIL-001', 'E2E-AMZ-RETAIL-002'];
const B2B_ORDER_ID = 'E2E-ALI-B2B-001';
/** 仅用于测试的站点标识：绝不与真实平台配置（marketplaceId 为空串的 alibaba）冲突 */
const TEST_B2B_MARKETPLACE = 'E2E-TEST-SITE';

function buildOrder(overrides: Partial<UnifiedOrder> & Pick<UnifiedOrder, 'platformCode' | 'platformOrderId'>): UnifiedOrder {
  const now = new Date();
  return {
    orderNo: `${overrides.platformCode.toUpperCase()}-${overrides.platformOrderId}`,
    status: 'Unshipped',
    currency: 'USD',
    totalAmount: 100,
    paidAmount: 100,
    createdAt: now,
    updatedAt: now,
    customer: { companyName: 'E2E Buyer', email: 'e2e-buyer@example.com', country: 'US' },
    items: [
      {
        platformProductId: 'B0TEST1234',
        productName: 'E2E Test Product',
        sku: 'E2E-SKU-1',
        quantity: 2,
        unitPrice: 50,
        amount: 100,
        currency: 'USD',
      },
    ],
    shippingInfo: { address: '1 Test St, Seattle, WA, US', carrier: 'UPS', trackingNumber: '1Z999' },
    sellerMemo: 'e2e memo',
    buyerMemo: 'e2e buyer note',
    rawData: { fulfillmentChannel: 'AFN', isPrime: true },
    ...overrides,
  };
}

const retailOrders: UnifiedOrder[] = [
  buildOrder({
    platformCode: 'amazon',
    platformOrderId: RETAIL_ORDER_IDS[0],
    totalAmount: 120.5,
    paidAmount: 120.5,
    status: 'Unshipped',
  }),
  buildOrder({
    platformCode: 'amazon',
    platformOrderId: RETAIL_ORDER_IDS[1],
    totalAmount: 60,
    paidAmount: 0,
    status: 'Pending',
  }),
];

const b2bOrder: UnifiedOrder = buildOrder({
  platformCode: 'alibaba',
  platformOrderId: B2B_ORDER_ID,
  status: 'paid',
  totalAmount: 5000,
  paidAmount: 5000,
  customer: { companyName: 'E2E B2B Buyer Ltd', email: 'e2e-b2b@example.com', country: 'DE' },
});

const mockAmazonAdapter: PlatformAdapter = {
  platformCode: 'amazon',
  platformName: 'Amazon (mock)',
  orderKind: 'RETAIL',
  async authenticate() {
    return { success: true };
  },
  async fetchOrders() {
    return retailOrders;
  },
  async fetchOrderDetail(orderId: string) {
    const found = retailOrders.find(o => o.platformOrderId === orderId);
    if (!found) throw new Error('not found');
    return found;
  },
};

const mockAlibabaAdapter: PlatformAdapter = {
  platformCode: 'alibaba',
  platformName: '阿里国际站 (mock)',
  orderKind: 'B2B',
  async authenticate() {
    return { success: true };
  },
  async fetchOrders() {
    return [b2bOrder];
  },
  async fetchOrderDetail() {
    return b2bOrder;
  },
};

async function cleanup() {
  await prisma.order.deleteMany({ where: { platformOrderId: { in: [...RETAIL_ORDER_IDS, B2B_ORDER_ID] } } });
  await prisma.platformOrder.deleteMany({ where: { platformOrderId: { in: RETAIL_ORDER_IDS } } });
  await prisma.customer.deleteMany({ where: { email: { in: ['e2e-buyer@example.com', 'e2e-b2b@example.com'] } } });
  await prisma.platformSyncConfig.deleteMany({
    where: { marketplaceId: { in: [TEST_MARKETPLACE, TEST_B2B_MARKETPLACE] } },
  });
}

describe('平台零售单剥离（PlatformOrder 镜像 / B2B Order 隔离）', () => {
  beforeAll(async () => {
    await cleanup();

    // 配置：Amazon 美国站点（零售单）
    await prisma.platformSyncConfig.create({
      data: {
        platformCode: 'amazon',
        marketplaceId: TEST_MARKETPLACE,
        platformName: 'Amazon (mock)',
        enabled: true,
        syncIntervalMin: 120,
        credentials: {},
      },
    });

    // 配置：阿里国际站（B2B 单），使用独立测试站点，避免触碰真实配置行
    await prisma.platformSyncConfig.create({
      data: {
        platformCode: 'alibaba',
        marketplaceId: TEST_B2B_MARKETPLACE,
        platformName: '阿里国际站 (mock)',
        enabled: true,
        syncIntervalMin: 120,
        credentials: {},
      },
    });

    // 注入 mock 适配器（仅本进程，替换平台 API 调用）
    platformRegistry.register(mockAmazonAdapter);
    platformRegistry.register(mockAlibabaAdapter);
  });

  afterAll(async () => {
    // 保留 Amazon 零售镜像行作为验证证据（platformOrderId 以 E2E- 前缀标记），
    // 只清理 B2B 回归数据和测试用配置，避免污染 B2B 账套。
    await prisma.order.deleteMany({ where: { platformOrderId: B2B_ORDER_ID } });
    await prisma.customer.deleteMany({ where: { email: 'e2e-b2b@example.com' } });
    // 只删除本测试创建的配置行（按测试站点标识），不触碰真实平台配置
    await prisma.platformSyncConfig.deleteMany({
      where: { marketplaceId: { in: [TEST_MARKETPLACE, TEST_B2B_MARKETPLACE] } },
    });
    await prisma.$disconnect();
  });

  it('Amazon 零售单写入 PlatformOrder，且不写 Order、不建 Customer', async () => {
    const orderCountBefore = await prisma.order.count();
    const customerCountBefore = await prisma.customer.count();

    const result = await executePlatformSync('amazon', 'manual', TEST_MARKETPLACE);

    expect(result.status).toBe('success');
    expect(result.ordersFound).toBe(2);
    expect(result.ordersSynced).toBe(2);
    expect(result.ordersFailed).toBe(0);

    // a) PlatformOrder 有新行，字段完整
    const platformOrders = await prisma.platformOrder.findMany({
      where: { platformOrderId: { in: RETAIL_ORDER_IDS } },
      orderBy: { platformOrderId: 'asc' },
    });
    expect(platformOrders).toHaveLength(2);
    const first = platformOrders[0];
    expect(first.platformCode).toBe('amazon');
    expect(first.platformType).toBe('AMAZON');
    expect(first.marketplaceId).toBe(TEST_MARKETPLACE);
    expect(first.platformOrderSn).toBe(`AMAZON-${RETAIL_ORDER_IDS[0]}`);
    expect(Number(first.totalAmount)).toBeCloseTo(120.5);
    expect(first.currency).toBe('USD');
    expect(first.status).toBe('Unshipped');
    expect(first.paymentStatus).toBe('PAID');
    expect(first.orderedAt).toBeInstanceOf(Date);
    expect(Array.isArray(first.items)).toBe(true);
    expect((first.items as any[]).length).toBe(1);
    expect(first.rawData).toMatchObject({ fulfillmentChannel: 'AFN' });
    expect(first.internalOrderId).toBeNull();

    // b) Order 表不再新增平台零售单
    const retailOrderRows = await prisma.order.count({
      where: { platformOrderId: { in: RETAIL_ORDER_IDS } },
    });
    expect(retailOrderRows).toBe(0);
    expect(await prisma.order.count()).toBe(orderCountBefore);

    // c) 不再新建客户
    const amazonCustomers = await prisma.customer.count({ where: { source: 'AMAZON' } });
    expect(amazonCustomers).toBe(0);
    expect(await prisma.customer.count()).toBe(customerCountBefore);

    // 同步日志仍然写入
    const log = await prisma.platformSyncLog.findFirst({
      where: { platformCode: 'amazon' },
      orderBy: { startedAt: 'desc' },
    });
    expect(log?.status).toBe('success');
    expect(log?.ordersSynced).toBe(2);
  });

  it('重复同步幂等：PlatformOrder 不重复，syncVersion 递增', async () => {
    const before = await prisma.platformOrder.findMany({
      where: { platformOrderId: { in: RETAIL_ORDER_IDS } },
      select: { id: true, syncVersion: true },
    });

    const result = await executePlatformSync('amazon', 'manual', TEST_MARKETPLACE);
    expect(result.ordersSynced).toBe(2);

    const after = await prisma.platformOrder.findMany({
      where: { platformOrderId: { in: RETAIL_ORDER_IDS } },
      select: { id: true, syncVersion: true },
    });
    expect(after).toHaveLength(before.length);
    for (const row of after) {
      const prev = before.find(b => b.id === row.id);
      expect(prev).toBeDefined();
      expect(row.syncVersion).toBe((prev!.syncVersion || 1) + 1);
    }

    // 仍然没有写入 Order / Customer
    expect(await prisma.order.count({ where: { platformOrderId: { in: RETAIL_ORDER_IDS } } })).toBe(0);
    expect(await prisma.customer.count({ where: { source: 'AMAZON' } })).toBe(0);
  });

  it('阿里国际站 B2B 单仍写 Order 表并创建客户', async () => {
    const orderCountBefore = await prisma.order.count();
    const customerCountBefore = await prisma.customer.count();

    const result = await executePlatformSync('alibaba', 'manual', TEST_B2B_MARKETPLACE);
    expect(result.status).toBe('success');
    expect(result.ordersSynced).toBe(1);

    const b2bRow = await prisma.order.findFirst({ where: { platformOrderId: B2B_ORDER_ID } });
    expect(b2bRow).toBeTruthy();
    expect(b2bRow!.sourcePlatform).toBe('alibaba');
    expect(Number(b2bRow!.totalAmount)).toBeCloseTo(5000);
    expect(await prisma.order.count()).toBe(orderCountBefore + 1);

    const customer = await prisma.customer.findFirst({ where: { email: 'e2e-b2b@example.com' } });
    expect(customer).toBeTruthy();
    expect(customer!.companyName).toBe('E2E B2B Buyer Ltd');
    expect(await prisma.customer.count()).toBe(customerCountBefore + 1);

    // B2B 单不应写入 PlatformOrder 镜像表
    expect(await prisma.platformOrder.count({ where: { platformOrderId: B2B_ORDER_ID } })).toBe(0);
  });
});
