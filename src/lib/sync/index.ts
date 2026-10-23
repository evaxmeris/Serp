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
export { executeSnapshotSync, resolveSyncTarget } from './inventory-sync';
export type { ResourceSyncResult, ResourceSyncStatus } from './inventory-sync';
export { executeResourceSync, parseSyncResource } from './resource-sync';
export type { AllResourcesSyncResult } from './resource-sync';
export {
  runDueSyncJobs,
  ensureSyncJobsFromConfigs,
  computeNextRunAt,
} from './sync-jobs';
export type { SyncTickResult, SyncJobRunOutcome } from './sync-jobs';

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
import { amazonFixtureAdapter } from './adapters/amazon-fixture';

// 注册所有平台
platformRegistry.register(alibabaAdapter);
platformRegistry.register(tiktokAdapter);    // 预留
platformRegistry.register(amazonAdapter);    // 预留
platformRegistry.register(shopifyAdapter);   // 预留

// ============================================
// 夹具模式（仅开发/联调）：用固定数据跑通快照链路
//
// 亚马逊开发者账号审核期间没有真实凭证，无法端到端验证 fbaInventory/listings 同步。
// 打开 SYNC_FIXTURE_AMAZON=1 时用 AmazonFixtureAdapter 顶替 amazon 适配器，
// 它只替换「取数」这一层，落库/幂等/日志/互斥仍是生产代码。
// 生产环境（NODE_ENV=production）永远不生效。
// ============================================
if (process.env.SYNC_FIXTURE_AMAZON === '1' && process.env.NODE_ENV !== 'production') {
  platformRegistry.register(amazonFixtureAdapter);
  console.warn('[Sync Framework] ⚠️ 已启用 Amazon 夹具适配器（SYNC_FIXTURE_AMAZON=1），仅限开发/联调环境');
}

console.log('[Sync Framework] 已注册平台:', platformRegistry.getAvailablePlatforms().join(', '));
