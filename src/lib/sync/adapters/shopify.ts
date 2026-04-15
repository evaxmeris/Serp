/**
 * Shopify 平台适配器（预留）
 * 
 * TODO: 实现 Shopify Admin API 对接
 * API 文档：https://shopify.dev/docs/api/admin-rest
 */

import { BasePlatformAdapter } from './base';
import { PlatformConfig, UnifiedOrder, FetchOrdersParams, AuthResult } from '../types';

export class ShopifyAdapter extends BasePlatformAdapter {
  readonly platformCode = 'shopify';
  readonly platformName = 'Shopify';
  
  async authenticate(config: PlatformConfig): Promise<AuthResult> {
    // TODO: 实现 Shopify API 密钥认证
    return {
      success: false,
      error: 'Shopify 适配器尚未实现',
    };
  }
  
  async fetchOrders(params: FetchOrdersParams, config: PlatformConfig): Promise<UnifiedOrder[]> {
    // TODO: 调用 Shopify Orders API
    // GET /admin/api/2024-01/orders.json?status=any&limit=250
    return [];
  }
  
  async fetchOrderDetail(orderId: string, config: PlatformConfig): Promise<UnifiedOrder> {
    // TODO: 调用 Shopify Order Detail API
    // GET /admin/api/2024-01/orders/{order_id}.json
    throw new Error('Shopify 适配器尚未实现');
  }
}

export const shopifyAdapter = new ShopifyAdapter();
