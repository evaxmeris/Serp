/**
 * 登录 API - 简化认证方案
 * 
 * @文件说明 处理用户登录请求
 * @作者 Trade ERP 团队
 * @创建日期 2026-03-23
 */

import { SignJWT } from 'jose';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { LoginSchema, validateBody } from '@/lib/api-schemas';
import { validationErrorResponse, errorResponse } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limit';
import { loadUserPermissions } from '@/lib/auth';

// 失败登录计数 Map（只记录失败登录）
const failedLoginMap = new Map<string, { count: number; resetTime: number }>();

/**
 * POST /api/auth/login - 用户登录
 * 速率限制：每 IP 每 15 分钟最多 20 次登录请求
 */
export async function POST(request: Request) {
  try {
    // 速率限制：防止暴力破解
    const rateLimitError = rateLimit(request as any, { limit: 20, windowMs: 15 * 60 * 1000 });
    if (rateLimitError) return rateLimitError;

    const body = await request.json();

    // Zod 验证
    const validation = validateBody(LoginSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }
    const { email, password } = validation.data;

    // 查找用户并验证密码
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user || !user.passwordHash) {
      // 登录失败，计数 + 审计日志
      const { ipAddress, userAgent } = getClientInfo(request);
      await writeAuditLog({
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: email,
        details: { email, reason: 'user_not_found' },
        ipAddress,
        userAgent,
      });
      const failedResponse = handleFailedLogin(request);
      if (failedResponse) {
        return NextResponse.json(
          { error: failedResponse.error, retryAfter: failedResponse.retryAfter },
          { status: failedResponse.status, headers: failedResponse.headers }
        );
      }
      return errorResponse('账号或密码错误', 'UNAUTHORIZED', 401);
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      // 登录失败，计数 + 审计日志
      const { ipAddress, userAgent } = getClientInfo(request);
      await writeAuditLog({
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: email,
        details: { email, reason: 'invalid_password' },
        ipAddress,
        userAgent,
      });
      const failedResponse = handleFailedLogin(request);
      if (failedResponse) {
        return NextResponse.json(
          { error: failedResponse.error, retryAfter: failedResponse.retryAfter },
          { status: failedResponse.status, headers: failedResponse.headers }
        );
      }
      return errorResponse('账号或密码错误', 'UNAUTHORIZED', 401);
    }

    if (!user.isApproved) {
      // 登录失败：账号未批准，记录审计日志
      const { ipAddress, userAgent } = getClientInfo(request);
      await writeAuditLog({
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        userId: user.id,
        details: { email: user.email, reason: 'not_approved' },
        ipAddress,
        userAgent,
      });
      return NextResponse.json(
        { error: '账号尚未批准，请联系管理员审批。' },
        { status: 403 }
      );
    }

    // 查找用户的主角色
    const primaryRole = await prisma.userRole.findFirst({
      where: { userId: user.id, isPrimary: true },
      include: { role: true },
    });

    // 加载用户权限
    const perms = await loadUserPermissions(user.id);
    const roleName = primaryRole?.role?.name || 'viewer';
    const isAdmin = roleName === 'admin' || roleName === 'super-admin';
    const permissions = isAdmin ? ['*'] : Array.from(perms.permissions);

    // 生成 JWT token
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
    const token = await new SignJWT({ 
      id: user.id, 
      email: user.email,
      name: user.name,
      role: primaryRole?.role?.name || 'viewer'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(secret);

    // 登录成功，记录审计日志
    const { ipAddress, userAgent } = getClientInfo(request);
    await writeAuditLog({
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      userId: user.id,
      details: { email: user.email },
      ipAddress,
      userAgent,
    });

    // 创建响应并设置 cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: primaryRole?.role?.name || 'viewer',
        permissions,
      },
      message: '登录成功',
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 天
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: '登录失败，请稍后重试' },
      { status: 500 }
    );
  }
}

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

// 失败登录计数辅助函数
function handleFailedLogin(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  const now = Date.now();
  let record = failedLoginMap.get(ip);
  
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + 15 * 60 * 1000 };
  } else {
    record.count += 1;
  }
  
  failedLoginMap.set(ip, record);
  
  // 检查是否超过限制
  if (record.count > 5) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return {
      error: '请求过于频繁，请稍后再试',
      retryAfter: retryAfter,
      message: `请在 ${retryAfter} 秒后重试`,
      status: 429,
      headers: { 'Retry-After': retryAfter.toString() }
    };
  }
  
  return null;
}
