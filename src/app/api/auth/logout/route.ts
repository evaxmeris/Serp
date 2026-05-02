/**
 * 登出 API
 * 
 * @文件说明 处理用户登出请求
 * @作者 Trade ERP 团队
 * @创建日期 2026-03-23
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { logout } from '@/lib/auth';

/**
 * 获取客户端 IP 和 User-Agent
 */
function getClientInfo(request: Request) {
  const ipAddress = request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown';
  const userAgent = request.headers.get('user-agent') || undefined;
  return { ipAddress, userAgent };
}

/**
 * 写入审计日志
 */
async function writeAuditLog(params: {
  action: string;
  entityType: string;
  entityId: string;
  userId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  const { userId, ...rest } = params;
  await prisma.auditLog.create({
    data: {
      ...rest,
      ...(userId ? { userId } : {}),
    } as any,
  });
}

/**
 * POST /api/auth/logout - 用户登出
 */
export async function POST(request: Request) {
  try {
    // 获取当前登录用户（登出前记录）
    const session = await getUserFromRequest(request);
    const userId = session?.id;

    await logout();

    // 记录审计日志
    const { ipAddress, userAgent } = getClientInfo(request);
    await writeAuditLog({
      action: 'LOGOUT',
      entityType: 'USER',
      entityId: userId || 'unknown',
      userId,
      details: { email: session?.email },
      ipAddress,
      userAgent,
    });

    const response = NextResponse.json({
      success: true,
      message: '登出成功',
    });

    // 手动清除客户端 cookie
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,  // 立即过期
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: '登出失败' },
      { status: 500 }
    );
  }
}
