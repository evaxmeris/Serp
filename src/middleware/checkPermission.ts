/**
 * 权限验证中间件 (Legacy - Pages Router)
 *
 * 基于 RBAC 模型的权限检查
 * 新的 App Router API 请使用 @/middleware/permissions.ts
 *
 * 支持：
 * - 内存缓存（5 分钟 TTL）
 * - 向后兼容旧的角色枚举
 * - ADMIN 全权限放行
 */

// Note: In NextAuth v5 (App Router), getServerSession import location changed
// This file is kept for backward compatibility for existing Pages Router APIs

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Permission } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 缓存条目结构
 */
interface CachedPermissions {
  /** 权限代码集合 */
  codes: Set<string>;
  /** 缓存时间戳 */
  timestamp: number;
}

/**
 * 用户权限缓存
 * key: userId, value: 缓存条目
 */
const userPermissionCache = new Map<string, CachedPermissions>();

/**
 * 缓存 TTL（默认 5 分钟）
 */
const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

/**
 * 向后兼容：为旧的角色枚举提供默认权限集合
 */
function getDefaultPermissionsForRole(roleName: string): string[] {
  switch (roleName) {
    case 'ADMIN':
      return ['*'];
    case 'SALES':
      return [
        'customer:view', 'customer:create', 'customer:edit',
        'inquiry:view', 'inquiry:create', 'inquiry:edit',
        'quotation:view', 'quotation:create', 'quotation:edit',
        'order:view', 'order:create', 'order:edit',
        'report:view',
      ];
    case 'PURCHASING':
      return [
        'supplier:view', 'supplier:create', 'supplier:edit',
        'product:view', 'product:create', 'product:edit',
        'purchase:view', 'purchase:create', 'purchase:edit',
        'inventory:view',
        'report:view',
      ];
    case 'WAREHOUSE':
      return [
        'product:view',
        'inventory:view', 'inventory:adjust',
        'inbound:view', 'inbound:create', 'inbound:process',
        'outbound:view', 'outbound:create', 'outbound:process',
        'report:view',
      ];
    case 'VIEWER':
      return [
        'customer:view',
        'inquiry:view',
        'quotation:view',
        'order:view',
        'supplier:view',
        'product:view',
        'purchase:view',
        'inventory:view',
        'report:view',
      ];
    default:
      return [];
  }
}

/**
 * 检查用户是否拥有指定权限的装饰器
 * @param permissionCode 需要的权限代码，如 "order:approve"
 *
 * 使用示例：
 * ```typescript
 * export default checkPermission('role:create')(handler);
 * ```
 *
 * 多权限不同方法：
 * ```typescript
 * export default async function handler(req: NextApiRequest, res: NextApiResponse) {
 *   if (req.method === 'GET') {
 *     return checkPermission('role:view')(getHandler)(req, res);
 *   }
 *   if (req.method === 'POST') {
 *     return checkPermission('role:create')(postHandler)(req, res);
 *   }
 * }
 * ```
 */
// @ts-ignore - next-auth import skipped for v5 compatibility
export function checkPermission(permissionCode: string, cacheTtl: number = DEFAULT_CACHE_TTL) {
  return function (
    handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
  ) {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      // 1. 获取当前用户 ID 从 session
      // In NextAuth v5, this needs to be updated for App Router
      // For Pages Router, please update the import according to your auth config
      /*
      const session = await getServerSession({ req });
      if (!session?.user?.id) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '请先登录',
          },
        });
      }
      */

      // For compatibility, this is disabled in v5
      // Please use the new permissions middleware from @/middleware/permissions.ts
      console.warn('checkPermission: Legacy middleware is deprecated. Use @/middleware/permissions.ts instead');

      const userId = 'legacy';
      const roleFromSession = null;

      // 2. 检查缓存是否有效
      const cached = userPermissionCache.get(userId);
      let permissionCodes: Set<string>;

      if (cached && Date.now() - cached.timestamp < cacheTtl) {
        permissionCodes = cached.codes;
      } else {
        // 3. 从数据库查询用户所有权限
        permissionCodes = await getUserPermissionCodes(userId);

        // 4. 向后兼容：如果用户没有分配任何角色，回退到旧的 role 枚举
        if (permissionCodes.size === 0 && roleFromSession) {
          const defaultPermissions = getDefaultPermissionsForRole(roleFromSession);
          defaultPermissions.forEach(code => permissionCodes.add(code));
        }

        // 5. 写入缓存
        userPermissionCache.set(userId, {
          codes: permissionCodes,
          timestamp: Date.now(),
        });
      }

      // 6. ADMIN 用户拥有全部权限（* 通配符）
      if (permissionCodes.has('*') || permissionCodes.has('system:*')) {
        return handler(req, res);
      }

      // 7. 检查权限：支持 category:* 通配符，如 "order:*"
      const hasPermission = checkWildcardPermission(permissionCode, permissionCodes);

      if (!hasPermission) {
        return res.status(403).json({
          error: {
            code: 'PERMISSION_DENIED',
            message: `您没有权限执行此操作：${permissionCode}`,
            details: { required: permissionCode },
          },
        });
      }

      // 8. 权限验证通过，继续处理
      return handler(req, res);
    };
  };
}

/**
 * 从数据库查询用户的所有权限代码
 */
async function getUserPermissionCodes(userId: string): Promise<Set<string>> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  // Filter active roles in memory
  const filteredUserRoles = userRoles.filter(ur => ur.role.isActive);

  const codes = new Set<string>();

  for (const userRole of filteredUserRoles) {
    for (const rp of userRole.role.permissions) {
      if (rp.permission.isActive) {
        codes.add(rp.permission.code);
      }
    }
  }

  return codes;
}

/**
 * 检查权限，支持通配符
 *
 * 支持：
 * - 精确匹配：`order:create` → `order:create`
 * - 分类通配：`order:*` → 匹配 `order:create`, `order:view` 等
 * - 全权限：`*` → 匹配所有
 */
function checkWildcardPermission(required: string, userCodes: Set<string>): boolean {
  // 精确匹配
  if (userCodes.has(required)) {
    return true;
  }

  // 全权限
  if (userCodes.has('*')) {
    return true;
  }

  // 分类通配检查：如果用户有 "order:*"，则 any "order:xxx" 通过
  const [category] = required.split(':');
  if (userCodes.has(`${category}:*`)) {
    return true;
  }

  return false;
}

/**
 * 清除指定用户的权限缓存
 * 在用户角色/权限变更时调用
 */
export function clearUserPermissionCache(userId: string): void {
  userPermissionCache.delete(userId);
}

/**
 * 清空所有权限缓存
 * 在系统权限变更时调用
 */
export function clearAllPermissionCache(): void {
  userPermissionCache.clear();
}

/**
 * 获取缓存统计信息
 */
export function getPermissionCacheStats() {
  return {
    size: userPermissionCache.size,
    entries: Array.from(userPermissionCache.entries()).map(([userId, cached]) => ({
      userId,
      size: cached.codes.size,
      age: Date.now() - cached.timestamp,
    })),
  };
}

// @ts-ignore
export default checkPermission;
