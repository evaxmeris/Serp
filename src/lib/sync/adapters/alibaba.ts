/**
 * 阿里国际站平台适配器（新版 open-api.alibaba.com + TOP 旧版 eco.taobao.com）
 * 
 * 双网关策略：
 * - 新平台网关 (open-api.alibaba.com)：认证、OAuth、Token 刷新
 * - TOP 旧版网关 (eco.taobao.com)：ICBU 交易订单 API（订单列表/详情/资金/物流/发货）
 * 
 * 签名算法：
 * - 新平台 API（以 / 开头）: HMAC-SHA256(AppSecret, apiName + 排序参数字符串) → hex 大写
 * - TOP 旧版 API（alibaba.*）: MD5(AppSecret + 排序参数字符串 + AppSecret) → hex 大写
 * 
 * 认证：
 * - OAuth 流程在新平台完成，获取 access_token
 * - access_token 同时用于新平台（access_token 参数）和 TOP（session 参数）
 * 
 * @see https://developer.alibaba.com/docs/api.htm?apiId=41047 (alibaba.seller.order.list)
 * @see https://developer.alibaba.com/docs/api.htm?apiId=41148 (alibaba.seller.order.get)
 * @see https://developer.alibaba.com/docs/api.htm?apiId=41142 (alibaba.seller.order.logistics.get)
 */

import crypto from 'crypto';
import { BasePlatformAdapter } from './base';
import { PlatformConfig, UnifiedOrder, FetchOrdersParams, AuthResult } from '../types';

// ============================================
// 网关配置
// ============================================

/** 新平台 API 网关 */
const API_BASE = 'https://open-api.alibaba.com/sync';
/** 新平台 Token 网关 */
const TOKEN_BASE = 'https://open-api.alibaba.com/rest';
/** TOP 旧版 API 网关（ICBU 交易订单 API 使用） */
const TOP_API_BASE = 'https://eco.taobao.com/router/rest';

// ============================================
// 类型定义
// ============================================

/** TOP API 订单列表请求参数 */
interface TopOrderListQuery {
  role: string;              // seller / buyer
  page_size?: number;        // 最大 100
  start_page?: number;       // 从 0 开始
  status?: string;           // 订单状态筛选
  create_date_start?: { date_str?: string; time?: number };
  create_date_end?: { date_str?: string; time?: number };
  modified_date_start?: { date_str?: string; time?: number };
  modified_date_end?: { date_str?: string; time?: number };
  other_login_id?: string;   // 交易对方登录账号
  sales_man_login_id?: string; // 业务员登录账号
}

/** TOP API 通用响应结果 */
interface TopResult<T> {
  success: boolean;
  error_code?: string;
  error_message?: string;
  value?: T;
}

/** TOP API 订单列表响应 */
interface TopOrderListResponse {
  alibaba_seller_order_list_response?: {
    result?: TopResult<{
      order_list?: TopOrder[];
      total_count?: number;
    }>;
  };
  error_response?: { code: number; msg: string; sub_code?: string; sub_msg?: string };
}

/** TOP API 订单详情响应 */
interface TopOrderGetResponse {
  alibaba_seller_order_get_response?: {
    result?: TopResult<TopOrder>;
  };
  error_response?: { code: number; msg: string; sub_code?: string; sub_msg?: string };
}

/** TOP 平台原始订单格式 */
interface TopOrder {
  trade_id?: string;
  trade_status?: string;
  total_amount?: { amount: string; currency: string };
  product_total_amount?: { amount: string; currency: string };
  advance_amount?: { amount: string; currency: string };
  balance_amount?: { amount: string; currency: string };
  discount_amount?: { amount: string; currency: string };
  shipment_fee?: { amount: string; currency: string };
  create_date?: { timestamp: number; format_date: string };
  modify_date?: { timestamp: number; format_date: string };
  order_products?: Array<{
    id?: string;
    product_id?: string;
    name?: string;
    product_image?: string;
    quantity?: number;
    unit?: string;
    unit_price?: { amount: string; currency: string };
    sku_code?: string;
    model_number?: string;
  }>;
  buyer_info?: {
    full_name?: string;
    login_id?: string;
    email?: string;
    country?: string;
    company_name?: string;
  };
  seller_info?: {
    full_name?: string;
    login_id?: string;
    email?: string;
  };
  shipping_address?: {
    address?: string;
    city?: string;
    province?: string;
    country?: string;
    zip?: string;
    contact_person?: string;
    telephone?: { country?: string; area?: string; number?: string };
    mobile?: { country?: string; area?: string; number?: string };
  };
  carrier?: { code?: string; name?: string };
  remark?: string;
  buyer_memo?: string;
  seller_memo?: string;
  /** 订单状态动作（含可选操作列表） */
  status_action?: {
    status?: string;
    actions?: Array<{ value?: string; name?: string; render_name?: string; status?: string }>;
  };
  /** 物流信息（仅在 alibaba.seller.order.logistics.get 中完整） */
  logistic_status?: string;
  shipment_date?: { timestamp: number; format_date: string };
  shipping_order_list?: Array<{
    service_provider?: string;
    tracking_number?: string;
    tracking_url?: string;
    logistics_type?: string;
  }>;
  goods?: Array<{
    product_id?: string;
    quantity?: string;
  }>;
}

// ============================================
// TOP API 签名算法（MD5）
// ============================================

/**
 * TOP 旧版 API 签名 (MD5)
 * 规则: MD5(AppSecret + 排序参数字符串 + AppSecret) → 32位大写 hex
 * 
 * @see https://developer.alibaba.com/docs/doc.htm?treeId=684&articleId=118416&docType=1
 */
function signTopApi(params: Record<string, string>, appSecret: string): string {
  const sortedKeys = Object.keys(params).sort();
  let signStr = appSecret;
  for (const key of sortedKeys) {
    signStr += key + params[key];
  }
  signStr += appSecret;
  return crypto.createHash('md5').update(signStr, 'utf-8').digest('hex').toUpperCase();
}

// ============================================
// 适配器
// ============================================

export class AlibabaAdapter extends BasePlatformAdapter {
  readonly platformCode = 'alibaba';
  readonly platformName = '阿里国际站';

  /**
   * 新平台签名 (HMAC-SHA256)
   * - 新平台 API（以 / 开头）: HMAC-SHA256(AppSecret, apiName + 排序参数字符串) → hex 大写
   * - 迁移 API（如 alibaba.*）: 使用 TOP 签名方式
   */
  private generateNewSign(apiName: string, params: Record<string, string>, appSecret: string): string {
    const isNewApi = apiName.startsWith('/');
    const sortedKeys = Object.keys(params).sort();
    let signStr = isNewApi ? apiName : '';
    for (const key of sortedKeys) {
      signStr += key + params[key];
    }
    return crypto.createHmac('sha256', appSecret).update(signStr, 'utf-8').digest('hex').toUpperCase();
  }

  /**
   * 新平台 API 请求
   * 用于 OAuth / Token 刷新等
   */
  private async newPlatformRequest<T>(
    apiName: string,
    params: Record<string, string>,
    config: PlatformConfig,
    baseUrl: string = API_BASE
  ): Promise<T> {
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

    if (!apiName.startsWith('/')) {
      allParams.method = apiName;
    }

    if (accessToken) {
      allParams.access_token = accessToken;
    }

    const sortedKeys = Object.keys(allParams).sort();
    const sign = this.generateNewSign(apiName, allParams, appSecret);

    const qsParts: string[] = [];
    for (const key of sortedKeys) {
      qsParts.push(`${key}=${encodeURIComponent(allParams[key])}`);
    }
    qsParts.push(`sign=${encodeURIComponent(sign)}`);

    const url = `${baseUrl}?${qsParts.join('&')}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json();

      if (result.error_response) {
        throw new Error(
          result.error_response.msg || result.error_response.message ||
          `API 错误 (${result.error_response.code})`
        );
      }

      return result as T;
    } catch (error) {
      throw this.handleError(error, `新平台 API 请求失败 (${apiName})`);
    }
  }

  /**
   * TOP 旧版 API 请求
   * 用于 ICBU 交易订单 API（alibaba.seller.order.*）
   * 
   * 签名：MD5(AppSecret + 排序参数字符串 + AppSecret)
   * 认证：session 参数（即 access_token）
   */
  private async topApiRequest<T>(
    apiName: string,
    apiParams: Record<string, string>,
    config: PlatformConfig
  ): Promise<T> {
    const appKey = config.credentials.appKey || '';
    const appSecret = config.credentials.appSecret || '';
    const accessToken = config.credentials.accessToken || '';

    if (!accessToken) {
      throw new Error('缺少 Access Token，请先完成 OAuth 授权');
    }

    // 构建公共参数
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const allParams: Record<string, string> = {
      method: apiName,
      app_key: appKey,
      sign_method: 'md5',
      session: accessToken,
      timestamp,
      format: 'json',
      v: '2.0',
      simplify: 'true',
      ...apiParams,
    };

    // 生成签名（排除 sign 参数）
    const sign = signTopApi(allParams, appSecret);
    allParams.sign = sign;

    // 构建 query string（URL 编码）
    const qsParts: string[] = [];
    for (const [key, value] of Object.entries(allParams)) {
      qsParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }

    const url = `${TOP_API_BASE}?${qsParts.join('&')}`;

    try {
      this.log('info', `TOP API 请求: ${apiName}`);

      const response = await fetch(url, { method: 'GET' });
      const result = await response.json();

      this.log('info', `TOP API 响应: ${apiName}`, {
        hasError: !!result.error_response,
        responseKeys: Object.keys(result),
      });

      // 检查 TOP 错误
      if (result.error_response) {
        const errMsg = result.error_response.sub_msg || result.error_response.msg || '未知 TOP 错误';
        const errCode = result.error_response.code;
        // Token 过期或无效，抛出可识别的错误
        if (errCode === 40 || errCode === 41 || errCode === 29) {
          throw new Error(`TOKEN_EXPIRED: ${errMsg}`);
        }
        throw new Error(`TOP API 错误 [${errCode}]: ${errMsg}`);
      }

      return result as T;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('TOKEN_EXPIRED')) {
        throw error;
      }
      throw this.handleError(error, `TOP API 请求失败 (${apiName})`);
    }
  }

  /**
   * 将 TOP 订单状态映射为统一状态
   */
  private mapTopStatus(topStatus: string): string {
    const statusMap: Record<string, string> = {
      'unpay': 'PENDING',
      'paying': 'PENDING',
      'paid': 'CONFIRMED',
      'relating': 'CONFIRMED',
      'captured': 'CONFIRMED',
      'undeliver': 'CONFIRMED',
      'delivering': 'SHIPPED',
      'wait_confirm_receipt': 'SHIPPED',
      'trade_success': 'COMPLETED',
      'trade_finished': 'COMPLETED',
      'intention_processing': 'PENDING',
      'trade_close': 'CANCELLED',
      'wait_confirm_modify': 'PENDING',
      'charge_back': 'CANCELLED',
      'frozen': 'PENDING',
      'to_be_audited': 'PENDING',
    };
    return statusMap[topStatus] || 'PENDING';
  }

  /**
   * 计算订单总金额（从各金额字段汇总）
   */
  private calcTotalAmount(order: TopOrder): number {
    if (order.total_amount?.amount) {
      return parseFloat(order.total_amount.amount);
    }
    if (order.product_total_amount?.amount) {
      return parseFloat(order.product_total_amount.amount);
    }
    // 从产品明细汇总
    if (order.order_products?.length) {
      return order.order_products.reduce((sum, p) => {
        return sum + (parseFloat(p.unit_price?.amount || '0') * (p.quantity || 0));
      }, 0);
    }
    return 0;
  }

  /**
   * 获取客户联系方式（从运输地址或买家信息）
   */
  private getContactPhone(order: TopOrder): string | undefined {
    const tel = order.shipping_address?.telephone;
    if (tel?.number) {
      return `${tel.country || ''}${tel.area || ''}${tel.number}`;
    }
    const mobile = order.shipping_address?.mobile;
    if (mobile?.number) {
      return `${mobile.country || ''}${mobile.area || ''}${mobile.number}`;
    }
    return undefined;
  }

  /**
   * 将 TOP 原始订单转换为统一格式
   */
  private convertTopOrderToUnified(topOrder: TopOrder): UnifiedOrder {
    const tradeId = topOrder.trade_id || '';
    const buyerName = topOrder.buyer_info?.full_name || topOrder.buyer_info?.login_id;
    const buyerCompany = topOrder.buyer_info?.company_name;

    return {
      platformCode: this.platformCode,
      platformOrderId: tradeId,
      orderNo: this.generateOrderNo(tradeId),
      status: this.mapTopStatus(topOrder.trade_status || ''),
      currency: topOrder.total_amount?.currency || 'USD',
      totalAmount: this.calcTotalAmount(topOrder),
      paidAmount: parseFloat(topOrder.advance_amount?.amount || '0'),
      createdAt: topOrder.create_date?.timestamp
        ? new Date(topOrder.create_date.timestamp * 1000)
        : new Date(),
      updatedAt: topOrder.modify_date?.timestamp
        ? new Date(topOrder.modify_date.timestamp * 1000)
        : new Date(),
      customer: {
        companyName: buyerCompany || buyerName || undefined,
        contactName: buyerName || undefined,
        email: topOrder.buyer_info?.email || undefined,
        phone: this.getContactPhone(topOrder),
        country: topOrder.shipping_address?.country || topOrder.buyer_info?.country || undefined,
        address: [
          topOrder.shipping_address?.address,
          topOrder.shipping_address?.city,
          topOrder.shipping_address?.province,
        ].filter(Boolean).join(', ') || undefined,
      },
      items: (topOrder.order_products || []).map(product => ({
        platformProductId: product.product_id || product.id || '',
        productName: product.name || 'Unnamed Product',
        sku: product.sku_code || product.model_number || product.product_id,
        quantity: product.quantity || 1,
        unitPrice: parseFloat(product.unit_price?.amount || '0'),
        amount: parseFloat(product.unit_price?.amount || '0') * (product.quantity || 1),
        currency: product.unit_price?.currency || 'USD',
        imageUrl: product.product_image || undefined,
        unit: product.unit || 'PCS',
      })),
      shippingInfo: topOrder.carrier ? {
        trackingNumber: topOrder.shipping_order_list?.[0]?.tracking_number || undefined,
        carrier: topOrder.carrier.name || topOrder.carrier.code || undefined,
        address: [
          topOrder.shipping_address?.address,
          topOrder.shipping_address?.city,
          topOrder.shipping_address?.province,
          topOrder.shipping_address?.country,
        ].filter(Boolean).join(', ') || undefined,
      } : undefined,
      sellerMemo: topOrder.seller_memo || undefined,
      buyerMemo: topOrder.buyer_memo || topOrder.remark || undefined,
      rawData: topOrder,
    };
  }

  // ============================================
  // 认证
  // ============================================

  /**
   * 认证 - 测试 API 凭据是否有效
   * 先尝试新平台产品 API，失败时回退到 TOP 订单列表 API
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

      // 第 1 步：尝试新平台产品 Schema API
      try {
        await this.newPlatformRequest(
          'alibaba.icbu.product.schema.get',
          { cat_id: '0', language: 'en_US' },
          config
        );
        return { success: true };
      } catch (e: any) {
        const msg = e?.message || '';

        // 第 2 步：尝试 TOP 订单列表 API（参数最轻量）
        if (msg.includes('auth') || msg.includes('token') || msg.includes('expired') || msg.includes('401')) {
          try {
            await this.topApiRequest(
              'alibaba.seller.order.list',
              {
                'param_trade_ecology_order_list_query': JSON.stringify({
                  role: 'seller',
                  page_size: 1,
                  start_page: 0,
                }),
              },
              config
            );
            return { success: true };
          } catch (topErr: any) {
            const topMsg = topErr?.message || '';
            // token 过期，尝试刷新
            if (refreshToken && (topMsg.includes('TOKEN_EXPIRED') || topMsg.includes('token'))) {
              const refreshed = await this.refreshToken(config);
              if (refreshed.success) {
                return {
                  success: true,
                  refreshedToken: refreshed.accessToken,
                  newRefreshToken: refreshed.refreshToken,
                } as any;
              }
            }
            return { success: false, error: topMsg };
          }
        }

        // 刷新 token 尝试
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

      const response: any = await this.newPlatformRequest(
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

  // ============================================
  // 订单 API - 核心实现
  // ============================================

  /**
   * 获取订单列表 (TOP: alibaba.seller.order.list)
   * 
   * 支持按状态、时间范围筛选
   * 每页最大 100 条，自动翻页
   * 
   * @see https://developer.alibaba.com/docs/api.htm?apiId=41047
   */
  async fetchOrders(params: FetchOrdersParams, config: PlatformConfig): Promise<UnifiedOrder[]> {
    const pageSize = Math.min(params.pageSize || 50, 100);
    const startPage = params.page ? params.page - 1 : 0; // TOP 分页从 0 开始

    // 构建查询参数
    const queryParams: TopOrderListQuery = {
      role: 'seller',
      page_size: pageSize,
      start_page: startPage,
    };

    // 按状态筛选
    if (params.status) {
      queryParams.status = params.status;
    }

    // 按创建时间筛选
    if (params.createdAtStart) {
      queryParams.create_date_start = {
        date_str: this.formatTopDate(params.createdAtStart),
      };
    }
    if (params.createdAtEnd) {
      queryParams.create_date_end = {
        date_str: this.formatTopDate(params.createdAtEnd),
      };
    }

    this.log('info', `获取订单列表: page=${startPage + 1}, size=${pageSize}, status=${params.status || 'all'}`);

    try {
      const response = await this.topApiRequest<TopOrderListResponse>(
        'alibaba.seller.order.list',
        {
          'param_trade_ecology_order_list_query': JSON.stringify(queryParams),
        },
        config
      );

      const result = response?.alibaba_seller_order_list_response?.result;

      if (!result?.success) {
        const errMsg = result?.error_message || '订单列表查询失败';
        this.log('error', `订单列表查询失败: ${errMsg}`);
        return [];
      }

      const orderList = result?.value?.order_list || [];
      const totalCount = result?.value?.total_count || 0;

      this.log('info', `获取到 ${orderList.length} 条订单 (共 ${totalCount} 条)`);

      // 对每个订单，调用 alibaba.seller.order.get 获取完整详情
      if (orderList.length > 0) {
        const detailedOrders: UnifiedOrder[] = [];
        for (const topOrder of orderList) {
          try {
            if (topOrder.trade_id) {
              const detail = await this.fetchTopOrderDetail(topOrder.trade_id, config);
              if (detail) {
                detailedOrders.push(detail);
              } else {
                // 详情查询失败，用列表数据降级
                detailedOrders.push(this.convertTopOrderToUnified(topOrder));
              }
            } else {
              detailedOrders.push(this.convertTopOrderToUnified(topOrder));
            }
            // 限流：每秒最多 10 个请求
            await this.rateLimit(600);
          } catch (detailErr) {
            this.log('warn', `订单 ${topOrder.trade_id} 详情查询失败，使用列表数据降级`);
            detailedOrders.push(this.convertTopOrderToUnified(topOrder));
          }
        }
        return detailedOrders;
      }

      return [];
    } catch (error) {
      const msg = error instanceof Error ? error.message : '未知错误';
      this.log('error', `获取订单列表异常: ${msg}`);

      // token 过期时抛出，让上层处理刷新
      if (msg.includes('TOKEN_EXPIRED')) {
        throw error;
      }

      return [];
    }
  }

  /**
   * 通过 TOP API 获取单个订单详情
   */
  private async fetchTopOrderDetail(tradeId: string, config: PlatformConfig): Promise<UnifiedOrder | null> {
    try {
      const response = await this.topApiRequest<TopOrderGetResponse>(
        'alibaba.seller.order.get',
        {
          e_trade_id: tradeId,
          data_select: 'statusAction,draft_role,snapshot_product',
          language: 'en_US',
        },
        config
      );

      const result = response?.alibaba_seller_order_get_response?.result;

      if (!result?.success || !result?.value) {
        this.log('warn', `订单 ${tradeId} 详情未找到: ${result?.error_message}`);
        return null;
      }

      return this.convertTopOrderToUnified(result.value);
    } catch (error) {
      if (error instanceof Error && error.message.includes('TOKEN_EXPIRED')) {
        throw error;
      }
      this.log('warn', `订单 ${tradeId} 详情查询失败: ${error instanceof Error ? error.message : '未知'}`);
      return null;
    }
  }

  /**
   * 获取订单详情 (TOP: alibaba.seller.order.get)
   * 
   * @see https://developer.alibaba.com/docs/api.htm?apiId=41148
   */
  async fetchOrderDetail(orderId: string, config: PlatformConfig): Promise<UnifiedOrder> {
    const detail = await this.fetchTopOrderDetail(orderId, config);

    if (!detail) {
      throw new Error(`订单 ${orderId} 详情获取失败`);
    }

    return detail;
  }

  // ============================================
  // 辅助方法
  // ============================================

  /**
   * 格式化时间为 TOP API 要求的格式 (yyyy-MM-dd HH:mm:ss GMT+8)
   */
  private formatTopDate(date: Date): string {
    // 转换为北京时间 (GMT+8)
    const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    const y = beijing.getUTCFullYear();
    const m = String(beijing.getUTCMonth() + 1).padStart(2, '0');
    const d = String(beijing.getUTCDate()).padStart(2, '0');
    const h = String(beijing.getUTCHours()).padStart(2, '0');
    const min = String(beijing.getUTCMinutes()).padStart(2, '0');
    const s = String(beijing.getUTCSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}:${s}`;
  }
}

export const alibabaAdapter = new AlibabaAdapter();
