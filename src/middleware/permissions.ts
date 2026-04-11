import { NextRequest, NextResponse } from 'next/server';
import { getUserPermissions, hasPermission, hasAnyPermission, hasAllPermissions } from '@/lib/permissions';
import { getCurrentUser } from '@/lib/auth-simple';
import { prisma } from '@/lib/prisma';

/**
 * 权限检查结果
 */
export type PermissionCheckResult = {
  hasPermission: boolean;
  userId?: string;
  message?: string;
};

/**
 * 认证用户上下文
 */
export interface AuthUserContext {
  id: string;
  email: string;
  name: string;
  role: string;
}

/**
 * 检查用户是否拥有指定权限（使用缓存优化）
 * @param userId 用户 ID
 * @param permissionCode 权限编码
 */
export async function checkUserPermission(
  userId: string,
  permissionCode: string
): Promise<PermissionCheckResult> {
  try {
    // 使用缓存优化的 hasPermission 函数
    const permissionGranted = await hasPermission(userId, permissionCode);
    
    // 获取用户信息（用于返回详细消息）
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role === 'ADMIN') {
      return {
        hasPermission: true,
        userId,
        message: 'Admin user has all permissions',
      };
    }

    return {
      hasPermission: permissionGranted,
      userId,
      message: permissionGranted ? 'Permission granted' : 'Permission denied',
    };
  } catch (error) {
    console.error('Error checking permission:', error);
    return {
      hasPermission: false,
      userId,
      message: 'Error checking permission',
    };
  }
}

/**
 * 检查用户是否拥有任意一个指定权限（使用缓存优化）
 * @param userId 用户 ID
 * @param permissionCodes 权限编码列表
 */
export async function checkAnyPermission(
  userId: string,
  permissionCodes: string[]
): Promise<PermissionCheckResult> {
  // 使用缓存优化的 hasAnyPermission 函数
  const hasAny = await hasAnyPermission(userId, permissionCodes);
  
  if (hasAny) {
    return {
      hasPermission: true,
      userId,
      message: 'At least one permission granted',
    };
  }
  
  return {
    hasPermission: false,
    userId,
    message: 'None of the required permissions found',
  };
}

/**
 * 检查用户是否拥有所有指定权限（使用缓存优化）
 * @param userId 用户 ID
 * @param permissionCodes 权限编码列表
 */
export async function checkAllPermissions(
  userId: string,
  permissionCodes: string[]
): Promise<PermissionCheckResult> {
  // 使用缓存优化的 hasAllPermissions 函数
  const hasAll = await hasAllPermissions(userId, permissionCodes);
  
  if (hasAll) {
    return {
      hasPermission: true,
      userId,
      message: 'All permissions granted',
    };
  }
  
  return {
    hasPermission: false,
    userId,
    message: 'Missing required permissions',
  };
}

/**
 * 从认证 token 中获取当前用户
 * 优先从 auth-simple 的 getCurrentUser 获取
 * @param request Next.js 请求对象
 * @returns 认证用户上下文或 null
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthUserContext | null> {
  try {
    // 使用 auth-simple 的 getCurrentUser（从 cookie 获取）
    const user = await getCurrentUser();
    
    if (!user) {
      // 尝试从请求头获取（兼容旧版）
      const userIdFromHeader = request.headers.get('x-user-id');
      if (userIdFromHeader) {
        const dbUser = await prisma.user.findUnique({
          where: { id: userIdFromHeader },
          select: { id: true, email: true, name: true, role: true },
        });
        if (dbUser) {
          return {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name || '',
            role: dbUser.role,
          };
        }
      }
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Error getting authenticated user:', error);
    return null;
  }
}

/**
 * Next.js API Route 权限检查装饰器（优化版）
 * 自动从认证中间件获取用户，使用缓存的权限数据
 * 
 * @param permissionCode 所需权限编码
 * @param handler API 处理器函数
 * 
 * @example
 * ```typescript
 * export const GET = withPermission('customers.view', async (request) => {
 *   // 已认证且有权限，执行逻辑
 *   return NextResponse.json({ data: [] });
 * });
 * ```
 */
export function withPermission(
  permissionCode: string,
  handler: (request: NextRequest, context: any, user: AuthUserContext) => Promise<NextResponse>
) {
  return async (request: NextRequest, context: any) => {
    // 1. 自动从认证中间件获取当前登录用户
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { 
          error: 'Authentication required', 
          message: 'No authenticated user found',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      );
    }

    // 2. 使用缓存的权限数据进行权限检查
    const result = await checkUserPermission(user.id, permissionCode);

    if (!result.hasPermission) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: result.message || 'Permission denied',
          requiredPermission: permissionCode,
          code: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    // 3. 传递认证用户给处理器
    return handler(request, context, user);
  };
}

/**
 * 模块化权限检查（使用缓存优化）
 * 检查用户对某个模块的访问权限
 * 格式：module:* 表示拥有该模块的所有权限
 * 例如：customer:* 表示客户管理所有权限
 * 
 * @param userId 用户 ID
 * @param moduleName 模块名称
 */
export async function checkModulePermission(
  userId: string,
  moduleName: string
): Promise<PermissionCheckResult> {
  try {
    // 使用通配符权限检查 module:*
    const hasModuleAccess = await hasPermission(userId, `${moduleName}:*`);
    
    if (hasModuleAccess) {
      return {
        hasPermission: true,
        userId,
        message: 'Module access granted',
      };
    }

    // 检查是否有该模块的任意具体权限
    const userPermissions = await getUserPermissions(userId);
    const hasAnyModulePermission = userPermissions.some(
      perm => perm.startsWith(`${moduleName}.`) || perm.startsWith(`${moduleName}:`)
    );

    // 管理员始终拥有所有权限
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role === 'ADMIN') {
      return {
        hasPermission: true,
        userId,
        message: 'Admin user has all permissions',
      };
    }

    return {
      hasPermission: hasAnyModulePermission,
      userId,
      message: hasAnyModulePermission
        ? 'Module access granted'
        : 'No permission for this module',
    };
  } catch (error) {
    console.error('Error checking module permission:', error);
    return {
      hasPermission: false,
      userId,
      message: 'Error checking module permission',
    };
  }
}

/**
 * 多权限检查装饰器 - 需要所有指定权限
 * 
 * @param permissionCodes 所需权限编码列表
 * @param handler API 处理器函数
 */
export function withPermissions(
  permissionCodes: string[],
  handler: (request: NextRequest, context: any, user: AuthUserContext) => Promise<NextResponse>
) {
  return async (request: NextRequest, context: any) => {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { 
          error: 'Authentication required', 
          message: 'No authenticated user found',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      );
    }

    const result = await checkAllPermissions(user.id, permissionCodes);

    if (!result.hasPermission) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: result.message || 'Missing required permissions',
          requiredPermissions: permissionCodes,
          code: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    return handler(request, context, user);
  };
}

/**
 * 任意权限检查装饰器 - 需要任意一个指定权限
 * 
 * @param permissionCodes 所需权限编码列表（任意一个即可）
 * @param handler API 处理器函数
 */
export function withAnyPermission(
  permissionCodes: string[],
  handler: (request: NextRequest, context: any, user: AuthUserContext) => Promise<NextResponse>
) {
  return async (request: NextRequest, context: any) => {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { 
          error: 'Authentication required', 
          message: 'No authenticated user found',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      );
    }

    const result = await checkAnyPermission(user.id, permissionCodes);

    if (!result.hasPermission) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: result.message || 'None of the required permissions found',
          requiredPermissions: permissionCodes,
          code: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    return handler(request, context, user);
  };
}
