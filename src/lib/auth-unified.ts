/**
 * 统一认证模块 — Trade ERP 认证系统统一入口
 *
 * 背景：项目中有 4 个认证库文件（auth.ts, auth-api.ts, auth-simple.ts, middleware/auth.ts），
 * 功能重叠且维护成本高。本模块作为统一入口，优先使用 auth-api 的实现，
 * 提供高阶函数简化路由处理器的认证编写。
 *
 * 使用指南：
 * - 现有代码：继续使用 import { getUserFromRequest } from '@/lib/auth-api'，无需修改
 * - 新代码：推荐 import { requireAuth, getUserFromRequest } from '@/lib/auth-unified'
 *
 * 迁移计划（P1-P2）：
 * - P1: 所有新创建的 route.ts 使用本模块
 * - P2: 逐步迁移旧 route.ts 从 auth-api/auth-simple 到本模块
 * - P3: 废弃 auth-simple.ts（功能完全被覆盖）
 * - P4: 合并 auth-api.ts 和 middleware/auth.ts 的重复逻辑
 */

import {
  getUserFromRequest,
  // auth-api.ts 导出的函数：从请求头/cookie 解析 JWT
} from './auth-api';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * 用户会话信息（统一类型）
 */
export interface UserSession {
  id: string;
  email: string;
  name: string | null;
  role: string;
  avatar?: string | null;
}

/**
 * 高阶函数：为路由处理器添加认证
 *
 * @example
 * export const GET = withAuth(async (request, session) => {
 *   // session 已认证，可直接使用
 *   const data = await prisma.orders.findMany({...});
 *   return NextResponse.json({ data });
 * });
 *
 * @example 需管理员权限
 * export const POST = withAuth(async (request, session) => {
 *   // 自动检查是否为 ADMIN
 * }, { requireAdmin: true });
 */
export function withAuth(
  handler: (request: NextRequest, session: UserSession) => Promise<NextResponse>,
  options?: { requireAdmin?: boolean }
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const session = await getUserFromRequest(request);
      if (!session) {
        return NextResponse.json(
          { success: false, error: '未认证，请先登录', code: 'UNAUTHORIZED' },
          { status: 401 }
        );
      }

      if (options?.requireAdmin && session.role !== 'ADMIN') {
        return NextResponse.json(
          { success: false, error: '权限不足', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }

      return handler(request, session as UserSession);
    } catch (error) {
      console.error('[withAuth] Handler error:', error);
      return NextResponse.json(
        { success: false, error: '服务器错误' },
        { status: 500 }
      );
    }
  };
}

/**
 * 行级权限检查：验证当前用户是否拥有指定资源的访问权限
 *
 * @param session 当前用户会话
 * @param ownerField 所有者字段名（如 'ownerId', 'salesRepId', 'assignedTo'）
 * @param ownerValue 资源的所有者值（通常是某条记录的 ownerId）
 * @returns 是否允许访问
 */
export function hasRowPermission(
  session: UserSession,
  ownerField: string,
  ownerValue: string | undefined | null
): boolean {
  if (session.role === 'ADMIN') return true;
  return ownerValue === session.id;
}

/**
 * 构建行级查询条件（用于列表查询时过滤数据）
 *
 * @example
 * const where = {
 *   ...buildRowLevelFilter(session, 'ownerId'),
 *   // 其他条件...
 * };
 */
export function buildRowLevelFilter(
  session: UserSession,
  ownerField: string
): Record<string, string> | Record<string, never> {
  if (session.role === 'ADMIN') return {};
  return { [ownerField]: session.id };
}

// 重新导出 auth-api 的函数（保持向后兼容）
export { getUserFromRequest };
