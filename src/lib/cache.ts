import NodeCache from 'node-cache';

// 创建内存缓存实例，TTL为5分钟（300秒）
export const cache = new NodeCache({
  stdTTL: 300, // 默认过期时间：5分钟
  checkperiod: 60, // 每分钟检查一次过期项
  useClones: false, // 不克隆对象，提高性能
});

/**
 * 缓存键生成器
 */
export function generateCacheKey(prefix: string, ...args: any[]): string {
  return `${prefix}:${args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(':')}`;
}

/**
 * 带缓存的异步函数执行器
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // 尝试从缓存获取
  const cached = cache.get<T>(key);
  if (cached !== undefined) {
    return cached;
  }

  // 执行函数并缓存结果
  const result = await fn();
  if (ttl !== undefined) {
    cache.set(key, result, ttl);
  } else {
    cache.set(key, result);
  }
  return result;
}

/**
 * 清除相关缓存
 */
export function invalidateCache(pattern: string | RegExp) {
  const keys = cache.keys();
  const keysToDelete = keys.filter(key => 
    typeof pattern === 'string' 
      ? key.startsWith(pattern)
      : pattern.test(key)
  );
  
  if (keysToDelete.length > 0) {
    cache.del(keysToDelete);

  }
}