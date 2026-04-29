/**
 * 阿里国际站平台适配器 (新版 open-api.alibaba.com)
 * 
 * API 网关: https://open-api.alibaba.com/sync
 * Token 网关: https://open-api.alibaba.com/rest
 * 签名算法: HMAC_SHA256(AppSecret, API名 + 排序参数字符串) → hex 大写
 * 
 * @see https://open.alibaba.com/doc/doc.htm 开发者文档
 */

import crypto from 'crypto';
import { BasePlatformAdapter } from './base';
import { PlatformConfig, UnifiedOrder, FetchOrdersParams, AuthResult } from '../types';

const API_BASE = 'https://open-api.alibaba.com/sync';
const TOKEN_BASE = 'https://open-api.alibaba.com/rest';

/**
 * 阿里国际站原始订单格式
 */
interface AlibabaRawOrder {
  orderId?: string;
  id?: string;
  orderNo?: string;
  status: string;
  tradeAmount?: { value: string; currency: string };
  totalAmount?: number;
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
   * 新版签名
   * - 新平台 API（以 / 开头）: HMAC_SHA256(AppSecret, apiName + 排序参数字符串) → hex 大写
   * - 迁移 API（如 alibaba.*）: HMAC_SHA256(AppSecret, 排序参数字符串（含 method）) → hex 大写
   */
  private generateSign(apiName: string, params: Record<string, string>, appSecret: string): string {
    const isNewApi = apiName.startsWith('/');
    const sortedKeys = Object.keys(params).sort();
    let signStr = isNewApi ? apiName : '';
    for (const key of sortedKeys) {
      signStr += key + params[key];
    }
    return crypto.createHmac('sha256', appSecret).update(signStr, 'utf-8').digest('hex').toUpperCase();
  }

  /**
   * 构建请求参数并签名
   */
  private buildParams(
    apiName: string,
    params: Record<string, string>,
    config: PlatformConfig,
    baseUrl: string = API_BASE
  ): { url: string } {
    const appKey = config.credentials.appKey || '';
    const appSecret = config.credentials.appSecret || '';
    const accessToken = config.credentials.accessToken || '';

    const allParams: Record<string, string> = {
      app_key: appKey,
      sign_method: 'sha256',
      simplify: 'true',
      timestamp: String(Date.now()),
      ...params,
    };

    // 迁移 API 需要 method 参数参与签名
    if (!apiName.startsWith('/')) {
      allParams.method = apiName;
    }

    if (accessToken) {
      allParams.access_token = accessToken;
    }

    // 排序并签名
    const sortedKeys = Object.keys(allParams).sort();
    const sign = this.generateSign(apiName, allParams, appSecret);

    // 构建 URL
    const qsParts: string[] = [];
    for (const key of sortedKeys) {
      qsParts.push(`${key}=${encodeURIComponent(allParams[key])}`);
    }
    qsParts.push(`sign=${encodeURIComponent(sign)}`);

    return { url: `${baseUrl}?${qsParts.join('&')}` };
  }

  /**
   * 发送 API 请求
   */
  private async apiRequest<T>(
    apiName: string,
    params: Record<string, string>,
    config: PlatformConfig,
    baseUrl: string = API_BASE
  ): Promise<T> {
    const { url } = this.buildParams(apiName, params, config, baseUrl);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      // 检查错误
      if (result.error_response) {
        throw new Error(
          result.error_response.msg || result.error_response.message ||
          `API 错误 (${result.error_response.code})`
        );
      }

      return result as T;
    } catch (error) {
      throw this.handleError(error, `API 请求失败 (${apiName})`);
    }
  }

  /**
   * 认证 - 测试 API 凭据是否有效
   * 调用一个简单的产品 API 验证 access_token，失败时自动尝试刷新
   */
  async authenticate(config: PlatformConfig): Promise<AuthResult> {
    try {
      const { appKey, appSecret, accessToken, refreshToken } = config.credentials;

      if (!appKey || !appSecret) {
        return {
          success: false,
          error: '缺少必要的认证信息（appKey, appSecret）',
        };
      }

      if (!accessToken) {
        if (refreshToken) {
          // 有 refreshToken，尝试自动续期
          const refreshed = await this.refreshToken(config);
          if (refreshed.success) {
            return {
              success: true,
              refreshedToken: refreshed.accessToken,
              newRefreshToken: refreshed.refreshToken,
            } as any;
          }
        }
        return {
          success: false,
          error: '缺少 Access Token，请先完成 OAuth 授权获取 Token',
        };
      }

      // 调用产品 Schema API 测试
      try {
        await this.apiRequest(
          'alibaba.icbu.product.schema.get',
          { cat_id: '0', language: 'en_US' },
          config
        );
        return { success: true };
      } catch (e: any) {
        const msg = e?.message || '认证失败';
        // token 过期，尝试刷新
        if (refreshToken && (msg.includes('token') || msg.includes('expired') || msg.includes('auth'))) {
          const refreshed = await this.refreshToken(config);
          if (refreshed.success) {
            return {
              success: true,
              refreshedToken: refreshed.accessToken,
              newRefreshToken: refreshed.refreshToken,
            } as any;
          }
        }
        return { success: false, error: msg };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '认证失败',
      };
    }
  }

  /**
   * 刷新 access_token
   * 使用 refresh_token 获取新的 access_token
   */
  async refreshToken(config: PlatformConfig): Promise<{ success: boolean; accessToken?: string; refreshToken?: string; error?: string }> {
    try {
      const rt = config.credentials.refreshToken;
      if (!rt) return { success: false, error: '缺少 refresh_token，请重新授权' };

      const response: any = await this.apiRequest(
        '/auth/token/refresh',
        { refresh_token: rt },
        config,
        TOKEN_BASE
      );

      const at = response?.access_token;
      const nrt = response?.refresh_token;
      if (!at) return { success: false, error: '刷新失败：未返回新 token' };

      return { success: true, accessToken: at, refreshToken: nrt };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '刷新失败' };
    }
  }

  /**
   * 获取订单列表
   * 注意：阿里新版开放平台暂无传统订单列表 API
   * 可用接口为物流订单查询: /alibaba/ggs/logistic/queryLogisticOrderList
   */
  async fetchOrders(params: FetchOrdersParams, config: PlatformConfig): Promise<UnifiedOrder[]> {
    const apiParams: Record<string, string> = {
      page: String(params.page || 1),
      pageSize: String(params.pageSize || 50),
    };

    try {
      // 使用物流订单查询 API（目前唯一可用的订单相关接口）
      const response: any = await this.apiRequest(
        '/alibaba/ggs/logistic/queryLogisticOrderList',
        apiParams,
        config,
        'https://open-api.alibaba.com/rest'
      );

      const orders = response?.result || response?.data?.result || [];
      const orderList = Array.isArray(orders) ? orders : (orders?.order_list || orders?.model || []);

      return orderList.map((o: any) => this.convertToUnifiedOrder(o));
    } catch (error) {
      this.log('error', '获取物流订单列表异常（阿里新版平台暂未开放传统订单API）', error);
      return [];
    }
  }

  /**
   * 获取订单详情
   */
  async fetchOrderDetail(orderId: string, config: PlatformConfig): Promise<UnifiedOrder> {
    // 新版平台暂无订单详情 API
    throw new Error('阿里新版平台暂不支持订单详情查询');
  }

  /**
   * 将阿里原始订单转换为统一格式
   */
  private convertToUnifiedOrder(rawOrder: AlibabaRawOrder): UnifiedOrder {
    const totalAmount = rawOrder.productList?.reduce(
      (sum, p) => sum + parseFloat(p.price.value) * p.quantity, 0
    ) || rawOrder.totalAmount || 0;

    return {
      platformCode: this.platformCode,
      platformOrderId: rawOrder.orderId || rawOrder.id || '',
      orderNo: this.generateOrderNo(rawOrder.orderId || rawOrder.id || ''),
      status: rawOrder.status,
      currency: rawOrder.tradeAmount?.currency || 'USD',
      totalAmount,
      paidAmount: 0,
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

export const alibabaAdapter = new AlibabaAdapter();
