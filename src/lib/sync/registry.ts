/**
 * 平台适配器注册表
 * 
 * 管理所有平台适配器的注册和访问
 * 支持动态添加新平台
 */

import { PlatformAdapter, PlatformRegistry } from './types';

class PlatformRegistryImpl implements PlatformRegistry {
  private adapters: Map<string, PlatformAdapter> = new Map();
  
  /**
   * 注册平台适配器
   * 
   * @param adapter 平台适配器实例
   */
  register(adapter: PlatformAdapter): void {
    if (this.adapters.has(adapter.platformCode)) {
      console.warn(`[Sync Registry] 平台 ${adapter.platformCode} 已注册，将被覆盖`);
    }
    
    this.adapters.set(adapter.platformCode, adapter);
    console.log(`[Sync Registry] 已注册平台：${adapter.platformCode} (${adapter.platformName})`);
  }
  
  /**
   * 获取指定平台适配器
   * 
   * @param platformCode 平台代码
   * @returns 平台适配器或 undefined
   */
  get(platformCode: string): PlatformAdapter | undefined {
    return this.adapters.get(platformCode);
  }
  
  /**
   * 获取所有已注册的适配器
   * 
   * @returns 适配器数组
   */
  getAll(): PlatformAdapter[] {
    return Array.from(this.adapters.values());
  }
  
  /**
   * 获取所有可用平台代码
   * 
   * @returns 平台代码数组
   */
  getAvailablePlatforms(): string[] {
    return Array.from(this.adapters.keys());
  }
  
  /**
   * 检查平台是否已注册
   * 
   * @param platformCode 平台代码
   * @returns 是否已注册
   */
  isRegistered(platformCode: string): boolean {
    return this.adapters.has(platformCode);
  }
}

// 创建全局单例
export const platformRegistry = new PlatformRegistryImpl();
