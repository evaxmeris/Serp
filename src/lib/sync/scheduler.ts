/**
 * 同步调度器
 * 
 * 根据各平台配置的间隔时间自动执行同步
 * 在服务器启动时初始化
 *
 * 多站点：每个 (platformCode, marketplaceId) 配置行各自一个定时器
 */

import { prisma } from '@/lib/prisma';
import { decryptCredentials } from '@/lib/crypto-utils';
import { executePlatformSync, platformRegistry } from './index';

// 存储定时器 ID（key = 配置行 id，避免多站点互相覆盖）
const syncTimers: Map<string, NodeJS.Timeout> = new Map();

/**
 * 初始化同步调度器
 * 
 * 为每个已启用的平台配置创建定时任务
 */
export async function initSyncScheduler(): Promise<void> {
  console.log('[Sync Scheduler] 初始化同步调度器...');
  
  // 获取所有已启用的平台配置（可能同一平台多个站点）
  const configs = await prisma.platformSyncConfig.findMany({
    where: { enabled: true },
  });
  
  for (const config of configs) {
    const adapter = platformRegistry.get(config.platformCode);
    if (!adapter) {
      console.warn(`[Sync Scheduler] 平台 ${config.platformCode} 未注册，跳过`);
      continue;
    }
    
    // 检查凭据是否配置
    const credentials = decryptCredentials(config.credentials);
    if (!credentials || Object.keys(credentials).length === 0) {
      console.warn(`[Sync Scheduler] 平台 ${config.platformCode} 未配置凭据，跳过`);
      continue;
    }
    
    const label = config.marketplaceId
      ? `${config.platformCode}@${config.marketplaceId}`
      : config.platformCode;
    
    // 清除已有的定时器
    if (syncTimers.has(config.id)) {
      clearInterval(syncTimers.get(config.id)!);
    }
    
    // 创建新的定时器
    const intervalMs = config.syncIntervalMin * 60 * 1000;
    console.log(`[Sync Scheduler] 平台 ${label} 同步间隔：${config.syncIntervalMin} 分钟`);
    
    const timer = setInterval(async () => {
      try {
        console.log(`[Sync Scheduler] 开始定时同步：${label}`);
        const result = await executePlatformSync(
          config.platformCode,
          'scheduled',
          config.marketplaceId || undefined,
        );
        console.log(`[Sync Scheduler] 同步完成：${label}`, result);
      } catch (error) {
        console.error(`[Sync Scheduler] 同步失败：${label}`, error);
      }
    }, intervalMs);
    
    syncTimers.set(config.id, timer);
  }
  
  console.log(`[Sync Scheduler] 已启动 ${syncTimers.size} 个平台站点的定时同步`);
}

/**
 * 停止所有同步定时器
 */
export function stopSyncScheduler(): void {
  for (const [configId, timer] of syncTimers.entries()) {
    clearInterval(timer);
    console.log(`[Sync Scheduler] 已停止配置 ${configId} 的定时同步`);
  }
  syncTimers.clear();
}

/**
 * 重新加载调度器（配置变更后调用）
 */
export async function reloadSyncScheduler(): Promise<void> {
  stopSyncScheduler();
  await initSyncScheduler();
}
