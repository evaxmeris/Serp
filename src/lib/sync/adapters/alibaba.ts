/**
 * 阿里国际站平台适配器
 * 
 * 实现阿里国际站订单同步功能
 * API 文档：https://open.alibaba.com/doc/apiMarket.htm
 */

import crypto from 'crypto';
import { BasePlatformAdapter } from './base';
import { PlatformConfig, UnifiedOrder, FetchOrdersParams, AuthResult } from '../types';

const API_BASE_URL = 'https://gw.open.alibaba.com/rest/api1';

/**
 * 阿里订单接口（原始 API 响应格式）
 */
interface AlibabaRawOrder {
  orderId: string;
  orderNo?: string;
  status: string;
  tradeAmount: {
    value: string;
    currency: string;
  };
  gmtCreate: string;
  gmtModified: string;
  buyerInfo?: {
    companyName?: string;
    contactName?: string;
    email?: string;
    phone?: string;
    country?: string;
  };
  sellerMemo?: string;
  buyerMemo?: string;
  productList?: Array<{
    productId: string;
    subject: string;
    price: { value: string; currency: string };
    quantity: number;
    unit?: string;
    imageUrl?: string;
    specification?: string;
  }>;
  shippingAddress?: string;
  logisticsInfo?: {
    trackingNumber?: string;
    logisticsCompany?: string;
  };
}

export class AlibabaAdapter extends BasePlatformAdapter {
  readonly platformCode = 'alibaba';
  readonly platformName = '阿里国际站';
  
  /**
   * 生成 API 签名
   */
  private generateSign(params: Record<string, string>, appSecret: string): string {
    const sortedKeys = Object.keys(params).sort();
    
    let signStr = '';
    for (const key of sortedKeys) {
      signStr += key + params[key];
    }
    
    signStr = appSecret + signStr + appSecret;
    
    return crypto
      .createHmac('sha1', appSecret)
      .update(signStr)
      .digest('hex')
      .toUpperCase();
  }
  
  /**
   * 构建 API 请求参数
   */
  private buildParams(
    method: string,
    params: Record<string, string>,
    config: PlatformConfig
  ): Record<string, string> {
    const baseParams: Record<string, string> = {
      app_key: config.credentials.appKey || '',
      method,
      access_token: config.credentials.accessToken || '',
      timestamp: new Date().toISOString().replace(/[:\-]|\.\d{3}/g, ''),
      sign_method: 'hmac',
      format: 'json',
      v: '1',
      ...params,
    };
    
    baseParams.sign = this.generateSign(baseParams, config.credentials.appSecret || '');
    
    return baseParams;
  }
  
  /**
   * 发送 API 请求
   */
  private async apiRequest<T>(
    method: string,
    params: Record<string, string>,
    config: PlatformConfig
  ): Promise<T> {
    const requestParams = this.buildParams(method, params, config);
    const queryString = new URLSearchParams(requestParams).toString();
    const url = `${API_BASE_URL}?${queryString}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error(`API 请求失败：${response.status} ${response.statusText}`);
      }
      
      return await response.json() as T;
    } catch (error) {
      throw this.handleError(error, `API 请求失败 (${method})`);
    }
  }
  
  /**
   * 认证
   * 
   * 阿里国际站使用 AppKey + AppSecret + AccessToken 认证
   */
  async authenticate(config: PlatformConfig): Promise<AuthResult> {
    try {
      const { appKey, appSecret, accessToken } = config.credentials;
      
      if (!appKey || !appSecret || !accessToken) {
        return {
          success: false,
          error: '缺少必要的认证信息（appKey, appSecret, accessToken）',
        };
      }
      
      // 测试认证是否有效（调用一个简单的 API）
      const response: any = await this.apiRequest(
        'alibaba.seller.order.list',
        { page: '1', pageSize: '1' },
        config
      );
      
      if (response.result?.success !== false) {
        return { success: true };
      } else {
        return {
          success: false,
          error: response.result?.errorMessage || '认证失败',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '认证失败',
      };
    }
  }
  
  /**
   * 获取订单列表
   */
  async fetchOrders(params: FetchOrdersParams, config: PlatformConfig): Promise<UnifiedOrder[]> {
    const apiParams: Record<string, string> = {
      page: String(params.page || 1),
      pageSize: String(params.pageSize || 50),
    };
    
    if (params.createdAtStart) {
      apiParams.gmtCreateStart = params.createdAtStart.toISOString();
    }
    if (params.createdAtEnd) {
      apiParams.gmtCreateEnd = params.createdAtEnd.toISOString();
    }
    if (params.status) {
      apiParams.status = params.status;
    }
    
    try {
      const response: any = await this.apiRequest(
        'alibaba.seller.order.list',
        apiParams,
        config
      );
      
      if (!response.result?.success || !response.result.data?.orders) {
        this.log('warn', '获取订单列表失败', response.result?.errorMessage);
        return [];
      }
      
      const rawOrders: AlibabaRawOrder[] = response.result.data.orders;
      
      // 转换为统一格式
      return rawOrders.map(order => this.convertToUnifiedOrder(order));
      
    } catch (error) {
      this.log('error', '获取订单列表异常', error);
      return [];
    }
  }
  
  /**
   * 获取订单详情
   */
  async fetchOrderDetail(orderId: string, config: PlatformConfig): Promise<UnifiedOrder> {
    try {
      const response: any = await this.apiRequest(
        'alibaba.seller.order.get',
        { order_id: orderId },
        config
      );
      
      if (!response.result?.success || !response.result.data) {
        throw new Error(response.result?.errorMessage || '获取订单详情失败');
      }
      
      return this.convertToUnifiedOrder(response.result.data);
      
    } catch (error) {
      throw this.handleError(error, `获取订单详情失败 (${orderId})`);
    }
  }
  
  /**
   * 将阿里原始订单转换为统一格式
   */
  private convertToUnifiedOrder(rawOrder: AlibabaRawOrder): UnifiedOrder {
    // 计算总金额
    const totalAmount = rawOrder.productList?.reduce(
      (sum, p) => sum + parseFloat(p.price.value) * p.quantity,
      0
    ) || parseFloat(rawOrder.tradeAmount?.value || '0');
    
    return {
      platformCode: this.platformCode,
      platformOrderId: rawOrder.orderId,
      orderNo: this.generateOrderNo(rawOrder.orderId),
      status: rawOrder.status,
      currency: rawOrder.tradeAmount?.currency || 'USD',
      totalAmount,
      paidAmount: 0, // 需要从资金 API 获取
      createdAt: new Date(rawOrder.gmtCreate),
      updatedAt: new Date(rawOrder.gmtModified),
      customer: {
        companyName: rawOrder.buyerInfo?.companyName,
        contactName: rawOrder.buyerInfo?.contactName,
        email: rawOrder.buyerInfo?.email,
        phone: rawOrder.buyerInfo?.phone,
        country: rawOrder.buyerInfo?.country,
        address: rawOrder.shippingAddress,
      },
      items: rawOrder.productList?.map(product => ({
        platformProductId: product.productId,
        productName: product.subject,
        sku: product.productId,
        quantity: product.quantity,
        unitPrice: parseFloat(product.price.value),
        amount: parseFloat(product.price.value) * product.quantity,
        currency: product.price.currency || 'USD',
        imageUrl: product.imageUrl,
        specification: product.specification,
        unit: product.unit || 'PCS',
      })) || [],
      shippingInfo: rawOrder.logisticsInfo ? {
        trackingNumber: rawOrder.logisticsInfo.trackingNumber,
        carrier: rawOrder.logisticsInfo.logisticsCompany,
        address: rawOrder.shippingAddress,
      } : undefined,
      sellerMemo: rawOrder.sellerMemo,
      buyerMemo: rawOrder.buyerMemo,
      rawData: rawOrder,
    };
  }
}

// 导出单例
export const alibabaAdapter = new AlibabaAdapter();
