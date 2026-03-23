/**
 * 登出 API
 * 
 * @文件说明 处理用户登出请求
 * @作者 Trade ERP 团队
 * @创建日期 2026-03-23
 */

import { NextResponse } from 'next/server';
import { logout } from '@/lib/auth-simple';

/**
 * POST /api/auth/logout - 用户登出
 */
export async function POST() {
  try {
    await logout();
    
    const response = NextResponse.json({
      success: true,
      message: '登出成功',
    });
    
    // 手动清除客户端 cookie
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
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
