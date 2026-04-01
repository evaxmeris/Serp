import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js 中间件 - 认证和路由控制
 * 
 * 功能：
 * 1. 检查用户认证状态
 * 2. 未登录用户重定向到登录页
 * 3. 已登录用户访问登录页重定向到首页
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公开路径（不需要认证）
  const publicPaths = ['/login', '/register', '/api/auth/'];
  
  // 检查是否是公开路径
  const isPublicPath = publicPaths.some(path => 
    pathname === path || pathname.startsWith(path)
  );

  // 获取认证 cookie
  const authToken = request.cookies.get('auth-token')?.value;

  // 如果是公开路径
  if (isPublicPath) {
    // 已登录用户访问登录页，重定向到首页
    if (authToken && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // API 路由的认证检查
  if (pathname.startsWith('/api/')) {
    // /api/auth/* 不需要认证（登录、注册等）
    if (pathname.startsWith('/api/auth/')) {
      return NextResponse.next();
    }
    // 所有其他 API 都需要认证
    if (!authToken) {
      return NextResponse.json(
        { success: false, error: '未认证，请先登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // 保护的路径（需要认证）
  if (!authToken) {
    // 未登录，重定向到登录页
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 已登录，允许访问
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
