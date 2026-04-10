/**
 * API 认证工具 - 用于 API 路由
 * 
 * 修复 Next.js 13+ App Router 中 API 路由的 cookie 读取问题
 */

import { jwtVerify } from 'jose';

/**
 * 获取密钥（动态获取，避免模块缓存导致的密钥不一致问题）
 */
function getSecret() {
  // 🔴 强制检查 JWT 密钥，不使用默认值（和 auth-simple.ts 保持一致）
  if (!process.env.NEXTAUTH_SECRET) {
    throw new Error('NEXTAUTH_SECRET 环境变量必须设置！请在 .env.local 中配置');
  }
  return new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
}

/**
 * 从请求头获取 token
 */
function getTokenFromHeaders(headers: Headers): string | null {
  // 1. 尝试从 Authorization header 获取
  const authHeader = headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // 2. 尝试从 Cookie header 获取
  const cookieHeader = headers.get('cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    for (const cookie of cookies) {
      const [name, value] = cookie.split('=');
      if (name === 'auth-token' && value) {
        return value;
      }
    }
  }

  return null;
}

/**
 * 验证并获取用户信息（用于 API 路由）
 */
export async function getUserFromRequest(request: Request) {
  try {
    const token = getTokenFromHeaders(request.headers);
    
    if (!token) {
      return null;
    }

    const SECRET = getSecret();
    const { payload } = await jwtVerify(token, SECRET);
    
    return {
      id: payload.id as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as string,
    };
  } catch (error) {
    console.error('API 认证错误:', error);
    return null;
  }
}

/**
 * 需要认证的 API 包装器
 */
export function requireAuth(handler: Function) {
  return async (request: Request) => {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return Response.json(
        { error: '未认证，请先登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    return handler(request, user);
  };
}

/**
 * 需要特定角色的 API 包装器
 */
export function requireRole(requiredRoles: string[]) {
  return (handler: Function) => {
    return async (request: Request) => {
      const user = await getUserFromRequest(request);
      
      if (!user) {
        return Response.json(
          { error: '未认证，请先登录', code: 'UNAUTHORIZED' },
          { status: 401 }
        );
      }

      if (!requiredRoles.includes(user.role)) {
        return Response.json(
          { error: '权限不足', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }

      return handler(request, user);
    };
  };
}
