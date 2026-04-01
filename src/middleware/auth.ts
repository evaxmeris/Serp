/**
 * 认证与权限中间件 - RBAC 实现
 * 
 * 提供 API 请求的认证和 RBAC 细粒度权限检查
 * 支持：多角色、细粒度权限检查、行级数据过滤
 * 
 * @module middleware/auth
 * @author Trade ERP 开发团队
 * @updated 2026-03-26
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 权限定义类型 - 格式：module:action
 * @example order:read, order:create, customer:delete
 */
export type PermissionName = string;

/**
 * 认证会话接口 - RBAC 扩展
 */
export interface AuthSession {
  /** 用户信息 */
  user: {
    /** 用户 ID */
    id: string;
    /** 用户邮箱 */
    email: string;
    /** 用户名称 */
    name?: string;
    /** 兼容旧版：用户主角色（保留用于向后兼容） */
    role: string;
    /** 所有分配的角色 ID 列表 */
    roleIds: string[];
    /** 所有角色展开后的权限集合 */
    permissions: Set<PermissionName>;
  };
}

/**
 * 行级数据过滤条件
 */
export interface RowLevelFilter {
  /** 按所有者用户 ID 过滤 */
  ownerUserId?: string;
  /** 按平台 ID 过滤 */
  platformId?: string;
  /** 按部门 ID 过滤 */
  departmentId?: string;
}

/**
 * 认证错误响应
 */
interface AuthErrorResponse {
  success: false;
  error: string;
  code: string;
}

/**
 * 从 JWT token 解析用户 ID
 * 这是一个占位实现，实际应使用 JWT 验证库
 */
async function parseUserIdFromToken(token: string): Promise<string | null> {
  try {
    // TODO: 集成真实的 JWT 验证
    // 当前简化实现：直接返回用户 ID（开发环境）
    // 生产环境应使用 jsonwebtoken 验证并解析 payload
    return token;
  } catch {
    return null;
  }
}

/**
 * 加载用户所有角色并展开权限
 * 
 * @param userId 用户 ID
 * @returns 角色 ID 列表和权限集合
 */
export async function loadUserPermissions(userId: string): Promise<{
  roleIds: string[];
  permissions: Set<PermissionName>;
  mainRole: string;
}> {
  // 查询用户所有角色
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

  const roleIds = userRoles.map(ur => ur.role.id);
  const permissions = new Set<PermissionName>();

  // 展开所有角色的权限
  for (const userRole of userRoles) {
    for (const rolePermission of userRole.role.permissions) {
      permissions.add(rolePermission.permission.name);
    }
  }

  // 从用户表获取主角色（向后兼容）
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  const mainRole = user?.role || 'USER';

  return { roleIds, permissions, mainRole };
}

/**
 * 验证用户认证并加载会话（包含权限）
 * 
 * 流程：
 * 1. 从请求头获取 Bearer token
 * 2. 验证 token 解析用户 ID
 * 3. 从数据库加载用户所有角色和权限
 * 4. 返回认证会话
 * 
 * @param request Next.js 请求对象
 * @returns 认证失败返回错误响应，成功返回会话
 */
export async function getSession(request: NextRequest): Promise<AuthSession | null> {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const userId = await parseUserIdFromToken(token);
    
    if (!userId) {
      return null;
    }

    // 查询用户基本信息
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      return null;
    }

    // 加载用户权限
    const { roleIds, permissions, mainRole } = await loadUserPermissions(userId);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || undefined,
        role: mainRole,
        roleIds,
        permissions,
      },
    };
  } catch (error) {
    console.error('获取会话失败:', error);
    return null;
  }
}

/**
 * 验证用户认证
 * 
 * 检查请求是否包含有效的会话
 * 
 * @param request Next.js 请求对象
 * @returns 认证失败返回错误响应，成功返回 null（用于向后兼容）
 *          如果需要获取会话，请使用 getSession()
 * 
 * @example 兼容旧用法
 * ```typescript
 * const authError = await requireAuth(request);
 * if (authError) return authError;
 * const session = await getSession(request);
 * ```
 * 
 * @example 新用法
 * ```typescript
 * const session = await getSession(request);
 * if (!session) return NextResponse.json({ error: '未认证' }, { status: 401 });
 * ```
 */
export async function requireAuth(
  request: NextRequest
): Promise<NextResponse<AuthErrorResponse> | null> {
  try {
    const session = await getSession(request);
    
    if (!session) {
      return NextResponse.json(
        { 
          success: false, 
          error: '未认证，请先登录',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      );
    }

    return null; // 兼容旧用法：认证通过返回 null
  } catch (error) {
    console.error('认证中间件错误:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '认证服务错误',
        code: 'AUTH_ERROR'
      },
      { status: 500 }
    );
  }
}

/**
 * 验证认证并返回会话
 * 
 * 新用法：认证成功返回会话，失败返回错误响应
 * 
 * @param request Next.js 请求对象
 * @returns 认证成功返回会话，失败返回错误响应
 */
export async function requireAuthWithSession(
  request: NextRequest
): Promise<AuthSession | NextResponse<AuthErrorResponse>> {
  try {
    const session = await getSession(request);
    
    if (!session) {
      return NextResponse.json(
        { 
          success: false, 
          error: '未认证，请先登录',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      );
    }

    return session;
  } catch (error) {
    console.error('认证中间件错误:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '认证服务错误',
        code: 'AUTH_ERROR'
      },
      { status: 500 }
    );
  }
}

/**
 * 兼容旧版：验证单个用户角色
 * 
 * 保留用于向后兼容旧代码，新代码应使用 requirePermission
 * 
 * @param session 认证会话对象
 * @param requiredRole 所需角色
 * @returns 无权限返回错误响应，有权限返回 null
 */
export function requireRole(
  session: AuthSession, 
  requiredRole: string
): NextResponse<AuthErrorResponse> | null {
  // ADMIN 可以访问所有资源
  if (session.user.role === 'ADMIN' || session.user.permissions.has('*')) {
    return null;
  }
  
  // 兼容旧版检查
  if (session.user.role !== requiredRole) {
    return NextResponse.json(
      { 
        success: false, 
        error: '无权限执行此操作',
        code: 'FORBIDDEN'
      },
      { status: 403 }
    );
  }
  
  return null;
}

/**
 * RBAC：检查用户是否拥有指定权限
 * 
 * @param session 认证会话
 * @param permission 所需权限，格式：module:action (e.g., order:create)
 * @returns 无权限返回错误响应，有权限返回 null
 * 
 * @example
 * ```typescript
 * const session = await requireAuth(request);
 * if (!('success' in session)) {
 *   const permError = requirePermission(session, 'order:create');
 *   if (permError) return permError;
 * }
 * ```
 */
export function requirePermission(
  session: AuthSession,
  permission: PermissionName
): NextResponse<AuthErrorResponse> | null {
  // 超级管理员权限通配符
  if (session.user.permissions.has('*') || session.user.role === 'ADMIN') {
    return null;
  }

  // 检查用户是否有该权限
  if (session.user.permissions.has(permission)) {
    return null;
  }

  // 支持模块级通配符，如 order:* 匹配所有 order 权限
  const [module] = permission.split(':');
  if (session.user.permissions.has(`${module}:*`)) {
    return null;
  }

  return NextResponse.json(
    {
      success: false,
      error: `无权限执行此操作，需要权限：${permission}`,
      code: 'PERMISSION_DENIED',
    },
    { status: 403 }
  );
}

/**
 * RBAC：批量检查用户是否拥有任意一个权限
 * 
 * @param session 认证会话
 * @param permissions 权限列表，用户只需要拥有其中一个即可通过
 * @returns 无权限返回错误响应，有权限返回 null
 */
export function requireAnyPermission(
  session: AuthSession,
  permissions: PermissionName[]
): NextResponse<AuthErrorResponse> | null {
  if (session.user.permissions.has('*') || session.user.role === 'ADMIN') {
    return null;
  }

  for (const permission of permissions) {
    if (session.user.permissions.has(permission)) {
      return null;
    }
    const [module] = permission.split(':');
    if (session.user.permissions.has(`${module}:*`)) {
      return null;
    }
  }

  return NextResponse.json(
    {
      success: false,
      error: `无权限执行此操作，需要以下权限之一：${permissions.join(', ')}`,
      code: 'PERMISSION_DENIED',
    },
    { status: 403 }
  );
}

/**
 * RBAC：批量检查用户是否拥有所有指定权限
 * 
 * @param session 认证会话
 * @param permissions 权限列表，用户必须拥有所有权限才能通过
 * @returns 无权限返回错误响应，有权限返回 null
 */
export function requireAllPermissions(
  session: AuthSession,
  permissions: PermissionName[]
): NextResponse<AuthErrorResponse> | null {
  if (session.user.permissions.has('*') || session.user.role === 'ADMIN') {
    return null;
  }

  for (const permission of permissions) {
    const hasPermission = session.user.permissions.has(permission);
    if (!hasPermission) {
      const [module] = permission.split(':');
      if (!session.user.permissions.has(`${module}:*`)) {
        return NextResponse.json(
          {
            success: false,
            error: `无权限执行此操作，缺少权限：${permission}`,
            code: 'PERMISSION_DENIED',
          },
          { status: 403 }
        );
      }
    }
  }

  return null;
}

/**
 * 生成行级数据过滤条件
 * 
 * 根据用户权限和数据范围，自动添加过滤条件
 * 支持：按用户本人、按部门、全数据访问
 * 
 * @param session 认证会话
 * @returns Prisma 兼容的过滤条件对象
 * 
 * @example
 * ```typescript
 * const filter = getRowLevelFilter(session);
 * const orders = await prisma.order.findMany({ where: filter });
 * ```
 */
export function getRowLevelFilter(session: AuthSession): RowLevelFilter {
  // ADMIN 无过滤，可访问所有数据
  if (session.user.role === 'ADMIN' || session.user.permissions.has('*')) {
    return {};
  }

  // 默认：仅返回当前用户自己的数据
  // 未来扩展：支持按部门、按平台配置
  return {
    ownerUserId: session.user.id,
  };
}

/**
 * 可选认证
 * 
 * 如果用户已认证则返回会话，否则返回 null
 * 用于允许匿名访问但为已认证用户提供额外功能的场景
 * 
 * @param request 请求对象
 * @returns 会话对象或 null
 */
export async function optionalAuth(request: NextRequest): Promise<AuthSession | null> {
  try {
    return await getSession(request);
  } catch (error) {
    console.error('可选认证错误:', error);
    return null;
  }
}

/**
 * 检查用户是否拥有指定权限
 * 
 * 用于条件性权限检查，不直接返回错误响应
 * 
 * @param session 认证会话
 * @param permission 权限名称
 * @returns 是否拥有权限
 */
export function hasPermission(
  session: AuthSession,
  permission: PermissionName
): boolean {
  if (session.user.permissions.has('*') || session.user.role === 'ADMIN') {
    return true;
  }

  if (session.user.permissions.has(permission)) {
    return true;
  }

  const [module] = permission.split(':');
  if (session.user.permissions.has(`${module}:*`)) {
    return true;
  }

  return false;
}

/**
 * 检查用户是否拥有任意一个权限
 */
export function hasAnyPermission(
  session: AuthSession,
  permissions: PermissionName[]
): boolean {
  return permissions.some(p => hasPermission(session, p));
}

/**
 * 检查用户是否拥有所有权限
 */
export function hasAllPermissions(
  session: AuthSession,
  permissions: PermissionName[]
): boolean {
  return permissions.every(p => hasPermission(session, p));
}
