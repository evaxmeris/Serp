/**
 * Amazon SP-API 平台适配器（预留）
 * 
 * TODO: 实现 Amazon Selling Partner API 对接
 * API 文档：https://developer-docs.amazon.com/sp-api
 */

import { BasePlatformAdapter } from './base';
import { PlatformConfig, UnifiedOrder, FetchOrdersParams, AuthResult } from '../types';

export class AmazonAdapter extends BasePlatformAdapter {
  readonly platformCode = 'amazon';
  readonly platformName = 'Amazon';
  
  async authenticate(config: PlatformConfig): Promise<AuthResult> {
    // TODO: 实现 Amazon SP-API LWA 认证
    return {
      success: false,
      error: 'Amazon SP-API 适配器尚未实现',
    };
  }
  
  async fetchOrders(params: FetchOrdersParams, config: PlatformConfig): Promise<UnifiedOrder[]> {
    // TODO: 调用 Amazon Orders API
    // GET /orders/v0/orders?CreatedAfter=xxx&MarketplaceIds=xxx
    return [];
  }
  
  async fetchOrderDetail(orderId: string, config: PlatformConfig): Promise<UnifiedOrder> {
    // TODO: 调用 Amazon Order Items API
    // GET /orders/v0/orders/{orderId}/orderItems
    throw new Error('Amazon SP-API 适配器尚未实现');
  }
}

export const amazonAdapter = new AmazonAdapter();
