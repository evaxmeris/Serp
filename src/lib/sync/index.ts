/**
 * 多平台订单同步框架 - 入口文件
 * 
 * 导出所有同步相关组件
 */

// 类型定义
export * from './types';

// 注册表
export { platformRegistry } from './registry';

// 适配器
export { BasePlatformAdapter } from './adapters/base';
export { alibabaAdapter } from './adapters/alibaba';
export { tiktokAdapter } from './adapters/tiktok';
export { amazonAdapter } from './adapters/amazon';
export { shopifyAdapter } from './adapters/shopify';

// 同步服务
export { executePlatformSync } from './order-sync';

// 映射工具
export { mapUnifiedOrderToERP, updateOrderStatus } from './mapper';

// ============================================
// 初始化：注册所有平台适配器
// ============================================

import { platformRegistry } from './registry';
import { alibabaAdapter } from './adapters/alibaba';
import { tiktokAdapter } from './adapters/tiktok';
import { amazonAdapter } from './adapters/amazon';
import { shopifyAdapter } from './adapters/shopify';

// 注册所有平台
platformRegistry.register(alibabaAdapter);
platformRegistry.register(tiktokAdapter);    // 预留
platformRegistry.register(amazonAdapter);    // 预留
platformRegistry.register(shopifyAdapter);   // 预留

console.log('[Sync Framework] 已注册平台:', platformRegistry.getAvailablePlatforms().join(', '));
