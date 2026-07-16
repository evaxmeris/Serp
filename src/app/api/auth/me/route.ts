/**
 * 获取当前用户信息 API
 * 
 * @文件说明 获取已登录用户的详细信息
 * @作者 Trade ERP 团队
 * @创建日期 2026-03-23
 */

import { getCurrentUser, loadUserPermissions } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/auth/me - 获取当前用户信息
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (user) {
      // 加载用户的权限列表
      const perms = await loadUserPermissions(user.id);
      const isAdmin = user.role === 'admin' || user.role === 'super-admin';
      return successResponse({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: isAdmin ? ['*'] : Array.from(perms.permissions),
      });
    } else {
      return errorResponse('未认证', 'UNAUTHORIZED', 401);
    }
  } catch (error) {
    console.error('Get user error:', error);
    return errorResponse('获取用户信息失败', 'INTERNAL_ERROR', 500);
  }
}
