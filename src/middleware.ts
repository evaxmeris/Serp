import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next.js 中间件 - 认证和路由控制
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Debug 端点：生产环境直接返回 404
  if (pathname.startsWith('/api/debug/')) {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ success: false, error: 'Not Found' }, { status: 404 });
    }
  }

  // CSRF 保护：仅生产环境启用，且排除 /api/auth/
  if (process.env.NODE_ENV === 'production' && pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/') && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    if (origin || referer) {
      const requestDomain = origin || (referer ? new URL(referer).origin : null);
      const isLocal = requestDomain?.startsWith('http://localhost:') || requestDomain?.startsWith('http://127.0.0.1:');
      if (!isLocal) {
        return NextResponse.json({ success: false, error: 'CSRF 验证失败', code: 'CSRF_INVALID' }, { status: 403 });
      }
    }
  }

  const publicPaths = ['/login', '/register', '/api/auth/', '/api/health'];
  if (process.env.NODE_ENV === 'development') publicPaths.push('/api/debug/');
  const isPublicPath = publicPaths.some(p => pathname === p || pathname.startsWith(p));
  const authToken = request.cookies.get('auth-token')?.value;

  if (isPublicPath) {
    if (authToken && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    if (pathname.startsWith('/api/auth/')) return NextResponse.next();
    if (!authToken) return NextResponse.json({ success: false, error: '未认证，请先登录', code: 'UNAUTHORIZED' }, { status: 401 });
    return NextResponse.next();
  }

  if (!authToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
