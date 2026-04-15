/**
 * 基础平台适配器抽象类
 * 
 * 提供通用功能，各平台适配器继承此类
 */

import { PlatformAdapter, PlatformConfig, UnifiedOrder, FetchOrdersParams, AuthResult } from '../types';

export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract readonly platformCode: string;
  abstract readonly platformName: string;
  
  /**
   * 认证（必须由子类实现）
   */
  abstract authenticate(config: PlatformConfig): Promise<AuthResult>;
  
  /**
   * 获取订单列表（必须由子类实现）
   */
  abstract fetchOrders(params: FetchOrdersParams, config: PlatformConfig): Promise<UnifiedOrder[]>;
  
  /**
   * 获取订单详情（必须由子类实现）
   */
  abstract fetchOrderDetail(orderId: string, config: PlatformConfig): Promise<UnifiedOrder>;
  
  /**
   * 生成 ERP 订单号
   * 
   * 格式：{平台前缀}-{平台订单号}
   * 例如：ALI-1234567890, TIKTOK-9876543210
   */
  protected generateOrderNo(platformOrderId: string): string {
    const prefix = this.platformCode.toUpperCase();
    return `${prefix}-${platformOrderId}`;
  }
  
  /**
   * 限流控制（简单实现）
   * 
   * @param requestsPerMinute 每分钟最大请求数
   */
  protected async rateLimit(requestsPerMinute: number = 60): Promise<void> {
    const delay = (60 / requestsPerMinute) * 1000; // 毫秒
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  /**
   * 错误处理
   * 
   * @param error 错误对象
   * @param context 错误上下文
   */
  protected handleError(error: unknown, context: string): Error {
    const message = error instanceof Error ? error.message : String(error);
    return new Error(`[${this.platformCode}] ${context}: ${message}`);
  }
  
  /**
   * 日志记录
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${this.platformCode}] [${level.toUpperCase()}] ${message}`;
    
    switch (level) {
      case 'info':
        console.log(logMessage, data || '');
        break;
      case 'warn':
        console.warn(logMessage, data || '');
        break;
      case 'error':
        console.error(logMessage, data || '');
        break;
    }
  }
}
