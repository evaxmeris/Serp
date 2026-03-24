/**
 * 登录 API - 简化认证方案
 * 
 * @文件说明 处理用户登录请求
 * @作者 Trade ERP 团队
 * @创建日期 2026-03-23
 */

import { NextResponse } from 'next/server';
import { login } from '@/lib/auth-simple';

// 失败登录计数 Map（只记录失败登录）
const failedLoginMap = new Map<string, { count: number; resetTime: number }>();

/**
 * POST /api/auth/login - 用户登录
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: '邮箱和密码不能为空' },
        { status: 400 }
      );
    }

    // 调用简化认证
    const result = await login(email, password);

    if (result.success) {
      return NextResponse.json({
        success: true,
        user: result.user,
        message: '登录成功',
      });
    } else {
      // 登录失败，计数
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
        return NextResponse.json(
          { 
            error: '请求过于频繁，请稍后再试',
            retryAfter: retryAfter,
            message: `请在 ${retryAfter} 秒后重试`
          },
          { 
            status: 429,
            headers: { 'Retry-After': retryAfter.toString() }
          }
        );
      }
      
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: '登录失败，请稍后重试' },
      { status: 500 }
    );
  }
}
