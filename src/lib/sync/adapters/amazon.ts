/**
 * Amazon SP-API 平台适配器
 *
 * 对接 Amazon Selling Partner API（自用 / 私人开发者模式）。
 *
 * 认证链路：
 * 1. LWA（Login with Amazon）：refresh_token → access_token（1 小时有效，自动缓存复用）
 *    POST https://api.amazon.com/auth/o2/token
 * 2. AWS SigV4 签名：SP-API 网关（execute-api）要求每个请求带 IAM 签名
 *    （私人应用直接用 IAM User 的 AccessKey/SecretKey 签即可，无需 STS）
 *
 * 已实现的只读接口（第一期）：
 * - GET /orders/v0/orders            订单列表（分页 NextToken）
 * - GET /orders/v0/orders/{id}       订单详情
 * - GET /orders/v0/orders/{id}/orderItems  订单明细
 * - GET /fba/inventory/v1/summaries  FBA 库存汇总
 * - GET /listings/2021-08-01/items/{sellerId} 在售清单（需 sellerId）
 *
 * credentials（PlatformConfig.credentials 传入的键）：
 * - lwaClientId       LWA Client ID（开发者中心 App 卡片）
 * - lwaClientSecret   LWA Client Secret
 * - lwaRefreshToken   self-authorize 拿到的 refresh_token（1 年有效）
 * - awsAccessKeyId    IAM User AccessKey（用于 SigV4 签名）
 * - awsSecretAccessKey IAM User SecretKey
 * - marketplaceId     站点 ID，默认 ATVPDKIKX0DER（美国）
 * - region            区域代码 na/eu/fe，默认 na
 * - sellerId          卖家 ID（listings 接口需要，形如 A1B2C3D4E5F6G7）
 *
 * @see https://developer-docs.amazon.com/sp-api
 */

import crypto from 'crypto';
import { BasePlatformAdapter } from './base';
import {
  PlatformConfig,
  UnifiedOrder,
  FetchOrdersParams,
  AuthResult,
  UnifiedInventorySnapshot,
  UnifiedListingSnapshot,
} from '../types';

/** 平台数字字段容错：null/空串/非法值一律按 0 处理（SP-API 字段常缺省） */
function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

// ============================================
// 常量
// ============================================

const LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';

const REGION_MAP: Record<string, { endpoint: string; awsRegion: string }> = {
  na: { endpoint: 'https://sellingpartnerapi-na.amazon.com', awsRegion: 'us-east-1' },
  eu: { endpoint: 'https://sellingpartnerapi-eu.amazon.com', awsRegion: 'eu-west-1' },
  fe: { endpoint: 'https://sellingpartnerapi-fe.amazon.com', awsRegion: 'us-west-2' },
};

const DEFAULT_MARKETPLACE = 'ATVPDKIKX0DER'; // 美国站

/** Amazon 订单状态 → ERP 统一状态映射 */
const ORDER_STATUS_MAP: Record<string, string> = {
  Pending: 'PENDING_PAYMENT',
  Unshipped: 'PENDING_SHIPMENT',
  PartiallyShipped: 'PARTIAL_SHIPPED',
  Shipped: 'SHIPPED',
  Delivered: 'DELIVERED',
  Canceled: 'CANCELLED',
  Unfulfillable: 'EXCEPTION',
  InvoiceUnconfirmed: 'PENDING_PAYMENT',
  PendingAvailability: 'PENDING_PAYMENT',
};

// ============================================
// 类型定义
// ============================================

interface SpApiCredentials {
  lwaClientId: string;
  lwaClientSecret: string;
  lwaRefreshToken: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  marketplaceId: string;
  region: { endpoint: string; awsRegion: string };
  sellerId?: string;
}

interface LwaTokenCache {
  accessToken: string;
  expiresAt: number; // epoch ms
}

// ============================================
// 适配器实现
// ============================================

export class AmazonAdapter extends BasePlatformAdapter {
  readonly platformCode = 'amazon';
  readonly platformName: string = 'Amazon';
  /** Amazon 零售单写入 PlatformOrder 镜像表，不进 B2B Order 表 */
  readonly orderKind = 'RETAIL' as const;

  /** LWA access_token 缓存（按 refreshToken 区分） */
  private tokenCache = new Map<string, LwaTokenCache>();

  // ------------------------------------------
  // 凭证解析
  // ------------------------------------------

  private resolveCredentials(config: PlatformConfig): SpApiCredentials {
    const c = config.credentials || {};
    const regionKey = (c.region || 'na').toLowerCase();
    const region = REGION_MAP[regionKey];
    if (!region) {
      throw this.handleError(new Error(`不支持的 region: ${regionKey}（可选 na/eu/fe）`), '凭证解析');
    }
    const missing = ['lwaClientId', 'lwaClientSecret', 'lwaRefreshToken', 'awsAccessKeyId', 'awsSecretAccessKey']
      .filter(k => !c[k]);
    if (missing.length > 0) {
      throw this.handleError(new Error(`缺少凭证字段: ${missing.join(', ')}`), '凭证解析');
    }
    return {
      lwaClientId: c.lwaClientId,
      lwaClientSecret: c.lwaClientSecret,
      lwaRefreshToken: c.lwaRefreshToken,
      awsAccessKeyId: c.awsAccessKeyId,
      awsSecretAccessKey: c.awsSecretAccessKey,
      marketplaceId: c.marketplaceId || DEFAULT_MARKETPLACE,
      region,
      sellerId: c.sellerId,
    };
  }

  // ------------------------------------------
  // LWA 认证
  // ------------------------------------------

  async authenticate(config: PlatformConfig): Promise<AuthResult> {
    try {
      const creds = this.resolveCredentials(config);
      const accessToken = await this.getLwaAccessToken(creds);
      // 用一个低危只读调用验证权限是否到位
      await this.spApiRequest(creds, accessToken, 'GET', '/orders/v0/orders', {
        MarketplaceIds: creds.marketplaceId,
        MaxResultsPerPage: '1',
        CreatedAfter: new Date(Date.now() - 7 * 86400000).toISOString(),
      });
      return { success: true, accessToken };
    } catch (error) {
      this.log('error', '认证失败', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /** 获取 LWA access_token（带缓存，提前 5 分钟续期） */
  private async getLwaAccessToken(creds: SpApiCredentials): Promise<string> {
    const cached = this.tokenCache.get(creds.lwaRefreshToken);
    if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
      return cached.accessToken;
    }
    const res = await fetch(LWA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: creds.lwaRefreshToken,
        client_id: creds.lwaClientId,
        client_secret: creds.lwaClientSecret,
      }).toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw this.handleError(new Error(`LWA token 获取失败 HTTP ${res.status}: ${text}`), 'LWA 认证');
    }
    const data = await res.json() as { access_token: string; expires_in?: number };
    const expiresIn = (data.expires_in || 3600) * 1000;
    this.tokenCache.set(creds.lwaRefreshToken, {
      accessToken: data.access_token,
      expiresAt: Date.now() + expiresIn,
    });
    return data.access_token;
  }

  // ------------------------------------------
  // AWS SigV4 签名
  // ------------------------------------------

  private hmac(key: crypto.BinaryLike, data: string): Buffer {
    return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
  }

  private sha256Hex(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  /** 对请求做 SigV4 签名，返回需要附加的请求头 */
  private signRequest(
    creds: SpApiCredentials,
    method: string,
    host: string,
    path: string,
    query: Record<string, string>,
  ): Record<string, string> {
    const service = 'execute-api';
    const now = new Date();
    const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); // yyyyMMddTHHmmssZ
    const dateStamp = amzDate.slice(0, 8);

    const sortedKeys = Object.keys(query).sort();
    const canonicalQuery = sortedKeys
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
      .join('&');

    const payloadHash = this.sha256Hex('');
    const canonicalHeaders =
      `host:${host}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-date';
    const canonicalRequest = [
      method, path || '/', canonicalQuery, canonicalHeaders, signedHeaders, payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${creds.region.awsRegion}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256', amzDate, credentialScope, this.sha256Hex(canonicalRequest),
    ].join('\n');

    const kDate = this.hmac(`AWS4${creds.awsSecretAccessKey}`, dateStamp);
    const kRegion = this.hmac(kDate, creds.region.awsRegion);
    const kService = this.hmac(kRegion, service);
    const kSigning = this.hmac(kService, 'aws4_request');
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

    return {
      'x-amz-date': amzDate,
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${creds.awsAccessKeyId}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
  }

  // ------------------------------------------
  // SP-API 请求封装
  // ------------------------------------------

  private async spApiRequest(
    creds: SpApiCredentials,
    accessToken: string,
    method: string,
    path: string,
    query: Record<string, string> = {},
  ): Promise<any> {
    const url = new URL(`${creds.region.endpoint}${path}`);
    const authHeaders = this.signRequest(creds, method, url.host, path, query);
    Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), {
      method,
      headers: {
        ...authHeaders,
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json',
      },
    });
    if (res.status === 429) {
      // 限流：等待后重试一次
      this.log('warn', 'SP-API 限流 (429)，2 秒后重试');
      await new Promise(r => setTimeout(r, 2000));
      return this.spApiRequest(creds, accessToken, method, path, query);
    }
    if (!res.ok) {
      const text = await res.text();
      throw this.handleError(new Error(`SP-API ${method} ${path} HTTP ${res.status}: ${text}`), 'API 请求');
    }
    return res.json();
  }

  private async authedRequest(
    config: PlatformConfig,
    method: string,
    path: string,
    query: Record<string, string> = {},
  ): Promise<{ data: any; creds: SpApiCredentials }> {
    const creds = this.resolveCredentials(config);
    const accessToken = await this.getLwaAccessToken(creds);
    const data = await this.spApiRequest(creds, accessToken, method, path, query);
    return { data, creds };
  }

  // ------------------------------------------
  // 订单同步
  // ------------------------------------------

  async fetchOrders(params: FetchOrdersParams, config: PlatformConfig): Promise<UnifiedOrder[]> {
    try {
      const creds = this.resolveCredentials(config);
      const accessToken = await this.getLwaAccessToken(creds);

      const createdAfter = (params.createdAtStart || new Date(Date.now() - 30 * 86400000)).toISOString();
      const query: Record<string, string> = {
        MarketplaceIds: creds.marketplaceId,
        CreatedAfter: createdAfter,
        MaxResultsPerPage: String(Math.min(params.pageSize || 50, 100)),
      };
      if (params.createdAtEnd) query.CreatedBefore = params.createdAtEnd.toISOString();
      if (params.status) query.OrderStatuses = params.status;

      const orders: UnifiedOrder[] = [];
      let nextToken: string | undefined;
      let page = 0;
      const maxPages = params.page ? params.page : 10; // 默认最多翻 10 页防失控

      do {
        if (nextToken) {
          query.NextToken = nextToken;
          delete query.CreatedAfter;
          delete query.CreatedBefore;
          delete query.OrderStatuses;
          delete query.MaxResultsPerPage;
        }
        const data = await this.spApiRequest(creds, accessToken, 'GET', '/orders/v0/orders', query);
        const payload = data.payload || data;
        for (const o of payload.Orders || []) {
          orders.push(this.mapOrder(o));
        }
        nextToken = payload.NextToken;
        page++;
        if (nextToken) await this.rateLimit(30); // Orders API 限流约 0.0167/s 突发，保守限速
      } while (nextToken && page < maxPages);

      this.log('info', `拉取订单 ${orders.length} 条（${page} 页）`);
      return orders;
    } catch (error) {
      throw this.handleError(error, 'fetchOrders');
    }
  }

  async fetchOrderDetail(orderId: string, config: PlatformConfig): Promise<UnifiedOrder> {
    try {
      const { data: orderData } = await this.authedRequest(config, 'GET', `/orders/v0/orders/${orderId}`);
      const order = (orderData.payload || orderData);

      const { data: itemsData } = await this.authedRequest(config, 'GET', `/orders/v0/orders/${orderId}/orderItems`);
      const itemsPayload = itemsData.payload || itemsData;

      const unified = this.mapOrder(order);
      unified.items = (itemsPayload.OrderItems || []).map((it: any) => this.mapOrderItem(it, order));
      return unified;
    } catch (error) {
      throw this.handleError(error, `fetchOrderDetail(${orderId})`);
    }
  }

  // ------------------------------------------
  // 库存与清单（第一期只读扩展）
  // ------------------------------------------

  /** FBA 库存汇总（details=false 只拿汇总，省限流） */
  async fetchFbaInventory(config: PlatformConfig): Promise<any[]> {
    const creds = this.resolveCredentials(config);
    const { data } = await this.authedRequest(
      config, 'GET', '/fba/inventory/v1/summaries',
      { marketplaceIds: creds.marketplaceId, granularityType: 'Marketplace', granularityId: creds.marketplaceId, details: 'false' },
    );
    const payload = data.payload || data;
    return payload.inventorySummaries || [];
  }

  /** 在售 Listing 清单（需要 credentials.sellerId） */
  async fetchListings(config: PlatformConfig, pageToken?: string): Promise<{ items: any[]; nextToken?: string }> {
    const creds = this.resolveCredentials(config);
    if (!creds.sellerId) {
      throw this.handleError(new Error('fetchListings 需要 credentials.sellerId'), '参数校验');
    }
    const query: Record<string, string> = { marketplaceIds: creds.marketplaceId, pageSize: '20' };
    if (pageToken) query.pageToken = pageToken;
    const { data } = await this.authedRequest(config, 'GET', `/listings/2021-08-01/items/${creds.sellerId}`, query);
    const payload = data.payload || data;
    return { items: payload.items || [], nextToken: payload.pagination?.nextToken };
  }

  // ------------------------------------------
  // 平台镜像快照（二期 BE-1）
  //
  // 适配器只负责「拿原始数据 + 映射成统一快照」，落库/日志由 sync/inventory-sync.ts 负责。
  // ------------------------------------------

  /** FBA 库存快照（复用 fetchFbaInventory，映射为统一快照行） */
  async fetchInventorySnapshots(config: PlatformConfig): Promise<UnifiedInventorySnapshot[]> {
    let raw: any[];
    try {
      raw = await this.fetchFbaInventory(config);
    } catch (error) {
      throw this.handleError(error, 'fetchInventorySnapshots');
    }

    const marketplaceId = config.marketplaceId || config.credentials?.marketplaceId || DEFAULT_MARKETPLACE;
    const rows: UnifiedInventorySnapshot[] = [];

    for (const s of raw || []) {
      const sku = s.sellerSku || s.sellerSKU;
      if (!sku) {
        // 没有卖家 SKU 的行无法与本地台账 join，跳过并留痕
        this.log('warn', `FBA 库存汇总缺少 sellerSku，跳过：ASIN=${s.asin ?? '?'} FNSKU=${s.fnSku ?? '?'}`);
        continue;
      }
      const d = s.inventoryDetails || {};
      const inboundQty =
        toInt(d.inboundWorkingQuantity) +
        toInt(d.inboundShippedQuantity) +
        toInt(d.inboundReceivingQuantity);
      const reservedQty = toInt(d.reservedQuantity?.totalReservedQuantity);
      const lastUpdated = s.lastUpdatedTime ? new Date(s.lastUpdatedTime) : null;

      rows.push({
        platformCode: this.platformCode,
        marketplaceId,
        sku,
        fnsku: s.fnSku || null,
        asin: s.asin || null,
        // 可售 = fulfillable（FBA 可履约量）；预留/在途单列，不混入可售
        availableQty: toInt(d.fulfillableQuantity),
        inboundQty,
        reservedQty,
        fcDetail: {
          condition: s.condition || null,
          totalQuantity: toInt(d.totalQuantity),
          unfulfillableQuantity: toInt(d.unfulfillableQuantity),
          reservedBreakdown: d.reservedQuantity || null,
          lastUpdatedTime: s.lastUpdatedTime || null,
        },
        platformUpdatedAt: lastUpdated && !isNaN(lastUpdated.getTime()) ? lastUpdated : null,
      });
    }

    this.log('info', `FBA 库存快照映射 ${rows.length} 行（marketplace=${marketplaceId}）`);
    return rows;
  }

  /** Listing 快照（复用 fetchListings，逐页拉取后映射） */
  async fetchListingSnapshots(config: PlatformConfig, pageToken?: string): Promise<UnifiedListingSnapshot[]> {
    const marketplaceId = config.marketplaceId || config.credentials?.marketplaceId || DEFAULT_MARKETPLACE;
    const rows: UnifiedListingSnapshot[] = [];
    let token: string | undefined = pageToken;
    let page = 0;
    const MAX_PAGES = 50;

    try {
      do {
        const { items, nextToken } = await this.fetchListings(config, token);
        for (const it of items || []) {
          const sku = it.sku;
          if (!sku) continue;
          const summary =
            (it.summaries || []).find((sm: any) => sm.marketplaceId === marketplaceId) ||
            (it.summaries || [])[0] ||
            {};
          const priceAttr =
            it.attributes?.purchasable_offer?.[0]?.our_price?.[0]?.schedule?.[0]?.value_with_tax;
          const priceValue = summary.price?.amount ?? priceAttr;
          const parsedPrice = priceValue === undefined || priceValue === null ? null : Number(priceValue);

          rows.push({
            platformCode: this.platformCode,
            marketplaceId,
            sku,
            asin: summary.asin || it.asin || null,
            title: summary.itemName || it.attributes?.item_name?.[0]?.value || null,
            status: Array.isArray(it.status) ? it.status.join(',') : it.status || summary.status?.[0] || null,
            price: parsedPrice !== null && !isNaN(parsedPrice) ? parsedPrice : null,
            currency: summary.price?.currency || 'USD',
            rawPayload: {
              productType: it.productType || null,
              createdDate: it.createdDate || null,
              lastUpdatedDate: it.lastUpdatedDate || null,
              summaries: it.summaries || [],
            },
            platformUpdatedAt: it.lastUpdatedDate ? new Date(it.lastUpdatedDate) : null,
          });
        }
        token = nextToken;
        page++;
        if (token) await this.rateLimit(300); // Listings API 限流约 5 次/秒，翻页保守限速
      } while (token && page < MAX_PAGES);
    } catch (error) {
      throw this.handleError(error, 'fetchListingSnapshots');
    }

    this.log('info', `Listing 快照映射 ${rows.length} 行（marketplace=${marketplaceId}, ${page} 页）`);
    return rows;
  }

  // ------------------------------------------
  // 数据映射
  // ------------------------------------------

  private mapOrder(o: any): UnifiedOrder {
    const total = parseFloat(o.OrderTotal?.Amount || '0');
    return {
      platformCode: this.platformCode,
      platformOrderId: o.AmazonOrderId,
      orderNo: this.generateOrderNo(o.AmazonOrderId),
      status: ORDER_STATUS_MAP[o.OrderStatus] || o.OrderStatus || 'UNKNOWN',
      currency: o.OrderTotal?.CurrencyCode || 'USD',
      totalAmount: total,
      paidAmount: o.OrderStatus === 'Pending' ? 0 : total,
      createdAt: o.PurchaseDate ? new Date(o.PurchaseDate) : new Date(),
      updatedAt: o.LastUpdateDate ? new Date(o.LastUpdateDate) : new Date(),
      customer: {
        // 无受限角色时拿不到买家 PII，仅保留国家/城市级别信息
        companyName: o.BuyerInfo?.BuyerName || undefined,
        country: o.ShippingAddress?.CountryCode || undefined,
      },
      items: [],
      shippingInfo: {
        address: o.ShippingAddress
          ? [o.ShippingAddress.City, o.ShippingAddress.StateOrRegion, o.ShippingAddress.CountryCode]
              .filter(Boolean).join(', ')
          : undefined,
      },
      rawData: {
        fulfillmentChannel: o.FulfillmentChannel,   // AFN=FBA / MFN=自发货
        salesChannel: o.SalesChannel,
        shipmentServiceLevelCategory: o.ShipmentServiceLevelCategory,
        isBusinessOrder: o.IsBusinessOrder,
        isPrime: o.IsPrime,
      },
    };
  }

  private mapOrderItem(it: any, order: any): UnifiedOrder['items'][number] {
    const price = parseFloat(it.ItemPrice?.Amount || '0');
    const qty = it.QuantityOrdered || 1;
    return {
      platformProductId: it.ASIN || it.OrderItemId,
      productName: it.Title || '',
      sku: it.SellerSKU,
      quantity: qty,
      unitPrice: qty > 0 ? price / qty : price,
      amount: price,
      currency: it.ItemPrice?.CurrencyCode || order.OrderTotal?.CurrencyCode || 'USD',
    };
  }
}

export const amazonAdapter = new AmazonAdapter();
