/**
 * 认证与权限验证模块
 * 
 * @文件说明 提供用户认证和 RBAC 细粒度权限验证功能
 * @作者 应亮
 * @创建日期 2026-03-16
 * @最后更新 2026-04-02 (简化重构)
 */

import { NextRequest, NextResponse } from 'next/server';
import type { AuthSession } from '@/middleware/auth';
import { 
  getSession as getSessionFromMiddleware,
  requireAuth as requireAuthFromMiddleware,
  requireAuthWithSession,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getRowLevelFilter,
  loadUserPermissions,
  optionalAuth,
} from '@/middleware/auth';

// 重新导出类型和核心功能
export type { AuthSession } from '@/middleware/auth';
export type { PermissionName } from '@/middleware/auth';
export type { RowLevelFilter } from '@/middleware/auth';
export { getSessionFromMiddleware as getSession };
export { requireAuthFromMiddleware as requireAuth };
export { requireAuthWithSession };
export { requirePermission };
export { requireAnyPermission };
export { requireAllPermissions };
export { hasPermission };
export { hasAnyPermission };
export { hasAllPermissions };
export { getRowLevelFilter };
export { loadUserPermissions };
export { optionalAuth };

// 兼容旧代码的别名
export { getSessionFromMiddleware as getCurrentUser };

/**
 * 用户角色枚举（保留用于向后兼容）
 */
export type UserRole = 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER';
