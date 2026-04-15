/**
 * TikTok Shop 平台适配器（预留）
 * 
 * TODO: 实现 TikTok Shop API 对接
 * API 文档：https://partner.tiktokshop.com/doc
 */

import { BasePlatformAdapter } from './base';
import { PlatformConfig, UnifiedOrder, FetchOrdersParams, AuthResult } from '../types';

export class TikTokAdapter extends BasePlatformAdapter {
  readonly platformCode = 'tiktok';
  readonly platformName = 'TikTok Shop';
  
  async authenticate(config: PlatformConfig): Promise<AuthResult> {
    // TODO: 实现 TikTok OAuth2 认证
    return {
      success: false,
      error: 'TikTok Shop 适配器尚未实现',
    };
  }
  
  async fetchOrders(params: FetchOrdersParams, config: PlatformConfig): Promise<UnifiedOrder[]> {
    // TODO: 调用 TikTok Orders API
    // GET /api/orders?page_size=20&page_token=xxx
    return [];
  }
  
  async fetchOrderDetail(orderId: string, config: PlatformConfig): Promise<UnifiedOrder> {
    // TODO: 调用 TikTok Order Detail API
    // GET /api/orders/{order_id}
    throw new Error('TikTok Shop 适配器尚未实现');
  }
}

export const tiktokAdapter = new TikTokAdapter();
