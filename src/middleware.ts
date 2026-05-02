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

  // CSRF 保护：所有环境均启用，但排除 /api/auth/
  // 通过校验 Origin/Referer 与请求 Host 是否一致来防御跨站请求
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/') && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const host = request.headers.get('host'); // 请求目标主机

    if (origin) {
      // 检查 Origin 与 Host 是否一致（同源校验）
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          console.warn(`[CSRF] Origin mismatch: origin=${originHost}, host=${host}`);
          return NextResponse.json({ success: false, error: 'CSRF 验证失败', code: 'CSRF_INVALID' }, { status: 403 });
        }
      } catch {
        // Origin 解析失败（格式非法）
        return NextResponse.json({ success: false, error: 'CSRF 验证失败', code: 'CSRF_INVALID' }, { status: 403 });
      }
    } else if (referer) {
      // Fallback：部分浏览器不发送 Origin，使用 Referer
      try {
        const refererHost = new URL(referer).host;
        if (refererHost !== host) {
          console.warn(`[CSRF] Referer mismatch: referer=${refererHost}, host=${host}`);
          return NextResponse.json({ success: false, error: 'CSRF 验证失败', code: 'CSRF_INVALID' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ success: false, error: 'CSRF 验证失败', code: 'CSRF_INVALID' }, { status: 403 });
      }
    }
    // 如果既没有 Origin 也没有 Referer，且无 Cookie（未认证），则放行
    // 有 Cookie 但没有 Origin/Referer 的请求（如原生 app、curl），信任 Cookie 认证
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
