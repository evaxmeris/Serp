/**
 * 认证与权限验证模块
 * 
 * @文件说明 提供用户认证和权限验证功能
 * @作者 应亮
 * @创建日期 2026-03-16
 * @最后更新 2026-03-16
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * 用户角色枚举
 */
export type UserRole = 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER';

/**
 * 用户会话接口
 */
export interface AuthSession {
  user: {
  id: string;
  email: string;
  name?: string;
    role: UserRole;
  };
}

/**
 * 获取当前用户会话
 * 
 * @param request Next.js 请求对象
 * @returns 用户会话或 null
 * 
 * @说明 从 Cookie 中提取 JWT 并验证，返回用户会话信息
 */
export async function getSession(request: NextRequest): Promise<AuthSession | null> {
  try {
    // 使用简化认证获取当前用户
    const { getCurrentUser } = await import('@/lib/auth-simple');
    const user = await getCurrentUser();
    
    if (user) {
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as UserRole,
        }
      };
    }
    
    return null;
  } catch (error) {
    console.error('获取会话失败:', error);
    return null;
  }
}

/**
 * 验证用户是否已认证
 * 
 * @param request Next.js 请求对象
 * @returns 错误响应（如果未认证），否则返回 null
 * 
 * @示例
 * const authError = await requireAuth(request);
 * if (authError) return authError;
 */
export async function requireAuth(request: NextRequest): Promise<NextResponse | null> {
  const session = await getSession(request);
  
  if (!session) {
    return NextResponse.json(
      { 
        success: false, 
        error: '未认证',
        message: '请先登录'
      },
      { status: 401 }
    );
  }
  
  return null;
}

/**
 * 验证用户角色权限
 * 
 * @param session 用户会话
 * @param requiredRole 所需的最低角色
 * @returns 错误响应（如果权限不足），否则返回 null
 * 
 * @角色等级 ADMIN > MANAGER > USER > VIEWER
 * 
 * @示例
 * const roleError = requireRole(session!, 'MANAGER');
 * if (roleError) return roleError;
 */
export function requireRole(session: AuthSession, requiredRole: UserRole): NextResponse | null {
  const roleHierarchy: Record<UserRole, number> = {
    'VIEWER': 1,
    'USER': 2,
    'MANAGER': 3,
    'ADMIN': 4
  };
  
  const userRoleLevel = roleHierarchy[session.user.role];
  const requiredRoleLevel = roleHierarchy[requiredRole];
  
  if (userRoleLevel < requiredRoleLevel) {
    return NextResponse.json(
      { 
        success: false, 
        error: '权限不足',
        message: `需要 ${requiredRole} 或更高权限`
      },
      { status: 403 }
    );
  }
  
  return null;
}

/**
 * 可选认证（不强制要求登录）
 * 
 * @param request Next.js 请求对象
 * @returns 用户会话（可能为 null）
 * 
 * @说明 用于公开接口，但登录用户可以获得个性化内容
 */
export async function optionalAuth(request: NextRequest): Promise<AuthSession | null> {
  return await getSession(request);
}

/**
 * 验证用户是否为管理员
 * 
 * @param session 用户会话
 * @returns 是否为管理员
 */
export function isAdmin(session: AuthSession | null): boolean {
  return session?.user.role === 'ADMIN';
}

/**
 * 验证用户是否为管理员或经理
 * 
 * @param session 用户会话
 * @returns 是否为管理员或经理
 */
export function isManager(session: AuthSession | null): boolean {
  return session?.user.role === 'ADMIN' || session?.user.role === 'MANAGER';
}

/**
 * 获取当前用户（兼容旧代码）
 * 
 * @param request Next.js 请求对象
 * @returns 用户会话或 null
 * 
 * @说明 getCurrentUser 是 getSession 的别名，用于兼容旧代码
 */
export async function getCurrentUser(request: NextRequest): Promise<AuthSession | null> {
  return getSession(request);
}
