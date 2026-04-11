/**
 * 认证与权限验证模块
 * 
 * @文件说明 提供用户认证和 RBAC 细粒度权限验证功能
 * @作者 应亮
 * @创建日期 2026-03-16
 * @最后更新 2026-04-11 (添加 Cookie 支持)
 */

import { NextRequest, NextResponse } from 'next/server';
import type { AuthSession } from '@/middleware/auth';
import Cookies from 'js-cookie';
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
export type UserRole = 'ADMIN' | 'SALES' | 'PURCHASING' | 'WAREHOUSE' | 'VIEWER';

/**
 * Cookie 配置选项
 */
const COOKIE_OPTIONS = {
  expires: 7, // 7 天过期
  secure: process.env.NODE_ENV === 'production', // 生产环境仅 HTTPS
  sameSite: 'strict' as const,
  path: '/',
};

/**
 * 将用户信息保存到 httpOnly cookie（通过 API 设置）
 * 注意：httpOnly cookie 只能通过服务器端设置，客户端只能读取非 httpOnly 的 cookie
 * 
 * @param userId 用户 ID
 * @param token JWT token
 */
export async function setUserCookie(userId: string, token: string): Promise<void> {
  // 注意：httpOnly cookie 必须通过服务器响应设置
  // 客户端只能设置非 httpOnly 的 cookie 作为 fallback
  // 生产环境应通过 /api/auth/login 设置 httpOnly cookie
  
  // Fallback: 设置非 httpOnly cookie（仅用于开发环境）
  Cookies.set('user_id', userId, COOKIE_OPTIONS);
  Cookies.set('auth_token', token, COOKIE_OPTIONS);
}

/**
 * 从 cookie 读取用户 ID
 * 
 * @returns 用户 ID 或 null
 */
export function getUserIdFromCookie(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return Cookies.get('user_id') || null;
}

/**
 * 从 cookie 读取 auth token
 * 
 * @returns token 或 null
 */
export function getTokenFromCookie(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return Cookies.get('auth_token') || null;
}

/**
 * 清除用户 cookie
 */
export function clearUserCookie(): void {
  Cookies.remove('user_id');
  Cookies.remove('auth_token');
}

/**
 * 从 cookie 加载用户信息
 * 
 * @returns 用户信息或 null
 */
export async function loadUserFromCookie(): Promise<any | null> {
  if (typeof window === 'undefined') {
    return null;
  }
  
  const userId = getUserIdFromCookie();
  const token = getTokenFromCookie();
  
  if (!userId || !token) {
    return null;
  }
  
  try {
    // 从 API 获取用户信息
    const res = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!res.ok) {
      clearUserCookie();
      return null;
    }
    
    const user = await res.json();
    return user;
  } catch (error) {
    console.error('从 cookie 加载用户失败:', error);
    return null;
  }
}

/**
 * CSRF Token 管理
 */

/**
 * 生成 CSRF token（客户端）
 * 
 * @returns CSRF token
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * 设置 CSRF token
 * 
 * @param token CSRF token
 */
export function setCSRFToken(token: string): void {
  Cookies.set('csrf_token', token, COOKIE_OPTIONS);
}

/**
 * 获取 CSRF token
 * 
 * @returns CSRF token 或 null
 */
export function getCSRFToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return Cookies.get('csrf_token') || null;
}

/**
 * 验证 CSRF token
 * 
 * @param token 提供的 token
 * @returns 是否有效
 */
export function verifyCSRFToken(token: string | null): boolean {
  if (!token) return false;
  const stored = getCSRFToken();
  return stored === token;
}
