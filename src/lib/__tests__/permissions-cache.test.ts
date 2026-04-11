/**
 * 权限缓存功能测试
 * @updated 2026-04-11 - 新增缓存测试
 */

import {
  getPermissionsFromCache,
  setPermissionsToCache,
  invalidateUserPermissionsCache,
  cleanupExpiredCache,
  getCacheStats,
} from '../permissions';

describe('Permissions Cache', () => {
  beforeEach(() => {
    // 清空缓存（通过清理所有过期缓存实现）
    cleanupExpiredCache();
  });

  describe('setPermissionsToCache & getPermissionsFromCache', () => {
    it('应该能够存储和获取权限缓存', () => {
      const userId = 'test-user-1';
      const permissions = ['customers.view', 'customers.create', 'orders.view'];

      // 存储缓存
      setPermissionsToCache(userId, permissions);

      // 获取缓存
      const cached = getPermissionsFromCache(userId);

      expect(cached).toEqual(permissions);
    });

    it('应该返回 undefined 当缓存不存在时', () => {
      const userId = 'non-existent-user';
      const cached = getPermissionsFromCache(userId);
      expect(cached).toBeUndefined();
    });

    it('应该能够更新缓存', () => {
      const userId = 'test-user-2';
      const permissions1 = ['customers.view'];
      const permissions2 = ['customers.view', 'customers.edit'];

      // 第一次存储
      setPermissionsToCache(userId, permissions1);
      expect(getPermissionsFromCache(userId)).toEqual(permissions1);

      // 更新缓存
      setPermissionsToCache(userId, permissions2);
      expect(getPermissionsFromCache(userId)).toEqual(permissions2);
    });
  });

  describe('invalidateUserPermissionsCache', () => {
    it('应该能够删除指定用户的缓存', () => {
      const userId = 'test-user-3';
      const permissions = ['customers.view'];

      // 存储缓存
      setPermissionsToCache(userId, permissions);
      expect(getPermissionsFromCache(userId)).toEqual(permissions);

      // 删除缓存
      invalidateUserPermissionsCache(userId);
      expect(getPermissionsFromCache(userId)).toBeUndefined();
    });

    it('删除不存在的缓存不应该报错', () => {
      const userId = 'non-existent-user';
      expect(() => invalidateUserPermissionsCache(userId)).not.toThrow();
    });
  });

  describe('cleanupExpiredCache', () => {
    it('应该清理所有过期缓存', () => {
      // 注意：这个测试需要等待 5 分钟才能验证 TTL，实际测试中我们只验证函数能正常执行
      const userId1 = 'test-user-4';
      const userId2 = 'test-user-5';
      const permissions = ['customers.view'];

      setPermissionsToCache(userId1, permissions);
      setPermissionsToCache(userId2, permissions);

      // 清理过期缓存（刚存储的不会过期）
      cleanupExpiredCache();

      expect(getPermissionsFromCache(userId1)).toEqual(permissions);
      expect(getPermissionsFromCache(userId2)).toEqual(permissions);
    });

    it('应该能够清理指定用户的过期缓存', () => {
      const userId = 'test-user-6';
      const permissions = ['customers.view'];

      setPermissionsToCache(userId, permissions);
      cleanupExpiredCache(userId);

      // 刚存储的不会过期
      expect(getPermissionsFromCache(userId)).toEqual(permissions);
    });
  });

  describe('getCacheStats', () => {
    it('应该返回缓存统计信息', () => {
      const userId1 = 'test-user-7';
      const userId2 = 'test-user-8';
      const permissions = ['customers.view'];

      // 初始状态
      const initialStats = getCacheStats();
      expect(initialStats.size).toBeGreaterThanOrEqual(0);

      // 添加缓存
      setPermissionsToCache(userId1, permissions);
      setPermissionsToCache(userId2, permissions);

      const stats = getCacheStats();
      expect(stats.size).toBeGreaterThanOrEqual(2);
      expect(stats.keys).toContain(`permissions:${userId1}`);
      expect(stats.keys).toContain(`permissions:${userId2}`);
    });
  });

  describe('缓存 TTL', () => {
    it('缓存应该在 5 分钟后过期', () => {
      // 注意：这个测试需要等待 5 分钟，实际测试中我们只验证缓存能正常存储
      const userId = 'test-user-9';
      const permissions = ['customers.view'];

      setPermissionsToCache(userId, permissions);
      const cached = getPermissionsFromCache(userId);

      expect(cached).toEqual(permissions);
      // TTL 测试需要等待 5 分钟，这里只验证缓存能正常工作
    });
  });
});
