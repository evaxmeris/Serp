/**
 * Amazon 夹具适配器（仅开发/联调环境）
 *
 * 用途：亚马逊开发者账号还在审核、真实凭证未到位时，用固定夹具把
 *       「适配器 → 统一快照 → platform_inventory_snapshots / platform_listing_snapshots」全链路跑通。
 *       它不覆盖 upsert / 日志 / 互斥等真实逻辑——那些仍由 inventory-sync.ts 执行。
 *
 * 启用方式（必须同时满足，双重保险，生产环境绝不会生效）：
 *   SYNC_FIXTURE_AMAZON=1 且 NODE_ENV !== 'production'
 *   见 src/lib/sync/index.ts 的注册分支。
 *
 * 夹具一律以 TEST- 前缀命名，验证完可直接按前缀清理，不碰任何真实数据。
 */

import { AmazonAdapter } from './amazon';
import type {
  PlatformConfig,
  UnifiedInventorySnapshot,
  UnifiedListingSnapshot,
  UnifiedOrder,
  FetchOrdersParams,
  AuthResult,
} from '../types';

export const FIXTURE_MARKETPLACES = {
  US: 'ATVPDKIKX0DER', // 美国站
  UK: 'A1F83G8C2ARO7P', // 英国站
} as const;

/** 库存夹具：按 marketplaceId 分组，US/UK 数值刻意不同，用于验证多站点互不覆盖 */
const INVENTORY_FIXTURES: Record<string, UnifiedInventorySnapshot[]> = {
  [FIXTURE_MARKETPLACES.US]: [
    {
      platformCode: 'amazon',
      marketplaceId: FIXTURE_MARKETPLACES.US,
      sku: 'TEST-MATCH-01',
      fnsku: 'XTESTMATCH01',
      asin: 'B0TESTMATCH',
      availableQty: 4,
      inboundQty: 0,
      reservedQty: 0,
      fcDetail: { condition: 'NewItem', totalQuantity: 4, unfulfillableQuantity: 0, fixture: true },
    },
    {
      platformCode: 'amazon',
      marketplaceId: FIXTURE_MARKETPLACES.US,
      sku: 'TEST-DIFF-01',
      fnsku: 'XTESTDIFF001',
      asin: 'B0TESTDIFF1',
      availableQty: 8,
      inboundQty: 2,
      reservedQty: 1,
      fcDetail: { condition: 'NewItem', totalQuantity: 11, unfulfillableQuantity: 0, fixture: true },
    },
    {
      platformCode: 'amazon',
      marketplaceId: FIXTURE_MARKETPLACES.US,
      sku: 'TEST-PLATONLY-01',
      fnsku: 'XTESTPLATON1',
      asin: 'B0TESTPLATO',
      availableQty: 6,
      inboundQty: 0,
      reservedQty: 0,
      fcDetail: { condition: 'NewItem', totalQuantity: 6, unfulfillableQuantity: 0, fixture: true },
    },
  ],
  [FIXTURE_MARKETPLACES.UK]: [
    {
      platformCode: 'amazon',
      marketplaceId: FIXTURE_MARKETPLACES.UK,
      sku: 'TEST-MATCH-01',
      fnsku: 'XTESTMATCH01',
      asin: 'B0TESTMATCH',
      availableQty: 2, // 与美站 4 不同：验证两站点快照各自独立
      inboundQty: 1,
      reservedQty: 0,
      fcDetail: { condition: 'NewItem', totalQuantity: 3, unfulfillableQuantity: 0, fixture: true },
    },
    {
      platformCode: 'amazon',
      marketplaceId: FIXTURE_MARKETPLACES.UK,
      sku: 'TEST-UKONLY-01',
      fnsku: 'XTESTUKONLY1',
      asin: 'B0TESTUKONL',
      availableQty: 7,
      inboundQty: 0,
      reservedQty: 0,
      fcDetail: { condition: 'NewItem', totalQuantity: 7, unfulfillableQuantity: 0, fixture: true },
    },
  ],
};

/** Listing 夹具 */
const LISTING_FIXTURES: Record<string, UnifiedListingSnapshot[]> = {
  [FIXTURE_MARKETPLACES.US]: [
    {
      platformCode: 'amazon',
      marketplaceId: FIXTURE_MARKETPLACES.US,
      sku: 'TEST-MATCH-01',
      asin: 'B0TESTMATCH',
      title: 'TEST MATCH 01 - fixture listing',
      status: 'BUYABLE',
      price: 19.99,
      currency: 'USD',
      rawPayload: { fixture: true },
    },
    {
      platformCode: 'amazon',
      marketplaceId: FIXTURE_MARKETPLACES.US,
      sku: 'TEST-DIFF-01',
      asin: 'B0TESTDIFF1',
      title: 'TEST DIFF 01 - fixture listing',
      status: 'BUYABLE',
      price: 29.5,
      currency: 'USD',
      rawPayload: { fixture: true },
    },
  ],
  [FIXTURE_MARKETPLACES.UK]: [
    {
      platformCode: 'amazon',
      marketplaceId: FIXTURE_MARKETPLACES.UK,
      sku: 'TEST-MATCH-01',
      asin: 'B0TESTMATCH',
      title: 'TEST MATCH 01 - fixture listing (UK)',
      status: 'BUYABLE',
      price: 15.75,
      currency: 'GBP',
      rawPayload: { fixture: true },
    },
  ],
};

export class AmazonFixtureAdapter extends AmazonAdapter {
  readonly platformName = 'Amazon (fixture)';

  /** 夹具模式不需要任何凭证；订单资源返回空集，避免污染 PlatformOrder 镜像 */
  async authenticate(_config: PlatformConfig): Promise<AuthResult> {
    return { success: true, accessToken: 'fixture' };
  }

  async fetchOrders(_params: FetchOrdersParams, _config: PlatformConfig): Promise<UnifiedOrder[]> {
    return [];
  }

  async fetchInventorySnapshots(config: PlatformConfig): Promise<UnifiedInventorySnapshot[]> {
    const marketplaceId = this.resolveFixtureMarketplace(config);
    const rows = INVENTORY_FIXTURES[marketplaceId];
    if (!rows) {
      throw new Error(`[amazon-fixture] 没有 ${marketplaceId} 的库存夹具`);
    }
    // 返回副本，避免调用方改动夹具常量
    return rows.map(r => ({ ...r }));
  }

  async fetchListingSnapshots(config: PlatformConfig): Promise<UnifiedListingSnapshot[]> {
    const marketplaceId = this.resolveFixtureMarketplace(config);
    const rows = LISTING_FIXTURES[marketplaceId] || [];
    return rows.map(r => ({ ...r }));
  }

  private resolveFixtureMarketplace(config: PlatformConfig): string {
    return (
      config.marketplaceId ||
      (config.credentials?.marketplaceId as string) ||
      FIXTURE_MARKETPLACES.US
    );
  }
}

export const amazonFixtureAdapter = new AmazonFixtureAdapter();
