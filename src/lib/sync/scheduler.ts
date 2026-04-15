/**
 * 同步调度器
 * 
 * 根据各平台配置的间隔时间自动执行同步
 * 在服务器启动时初始化
 */

import { prisma } from '@/lib/prisma';
import { executePlatformSync, platformRegistry } from './index';

// 存储定时器 ID
const syncTimers: Map<string, NodeJS.Timeout> = new Map();

/**
 * 初始化同步调度器
 * 
 * 为每个已启用的平台创建定时任务
 */
export async function initSyncScheduler(): Promise<void> {
  console.log('[Sync Scheduler] 初始化同步调度器...');
  
  // 获取所有已启用的平台配置
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
    const credentials = config.credentials as Record<string, any>;
    if (!credentials || Object.keys(credentials).length === 0) {
      console.warn(`[Sync Scheduler] 平台 ${config.platformCode} 未配置凭据，跳过`);
      continue;
    }
    
    // 清除已有的定时器
    if (syncTimers.has(config.platformCode)) {
      clearInterval(syncTimers.get(config.platformCode)!);
    }
    
    // 创建新的定时器
    const intervalMs = config.syncIntervalMin * 60 * 1000;
    console.log(`[Sync Scheduler] 平台 ${config.platformCode} 同步间隔：${config.syncIntervalMin} 分钟`);
    
    const timer = setInterval(async () => {
      try {
        console.log(`[Sync Scheduler] 开始定时同步：${config.platformCode}`);
        const result = await executePlatformSync(config.platformCode, 'scheduled');
        console.log(`[Sync Scheduler] 同步完成：${config.platformCode}`, result);
      } catch (error) {
        console.error(`[Sync Scheduler] 同步失败：${config.platformCode}`, error);
      }
    }, intervalMs);
    
    syncTimers.set(config.platformCode, timer);
  }
  
  console.log(`[Sync Scheduler] 已启动 ${syncTimers.size} 个平台的定时同步`);
}

/**
 * 停止所有同步定时器
 */
export function stopSyncScheduler(): void {
  for (const [platformCode, timer] of syncTimers.entries()) {
    clearInterval(timer);
    console.log(`[Sync Scheduler] 已停止平台 ${platformCode} 的定时同步`);
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
