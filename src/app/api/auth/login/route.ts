/**
 * 登录 API - 简化认证方案
 * 
 * @文件说明 处理用户登录请求
 * @作者 Trade ERP 团队
 * @创建日期 2026-03-23
 */

import { NextResponse } from 'next/server';
import { login } from '@/lib/auth-simple';
import { rateLimit } from '@/lib/rate-limit';

/**
 * POST /api/auth/login - 用户登录
 */
export async function POST(request: Request) {
  try {
    // 速率限制：5 次/15 分钟
    const rateLimitError = rateLimit(request as any, {
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    
    if (rateLimitError) {
      return rateLimitError;
    }

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
