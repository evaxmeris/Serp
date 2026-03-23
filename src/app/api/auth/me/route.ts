/**
 * 获取当前用户信息 API
 * 
 * @文件说明 获取已登录用户的详细信息
 * @作者 Trade ERP 团队
 * @创建日期 2026-03-23
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-simple';

/**
 * GET /api/auth/me - 获取当前用户信息
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (user) {
      return NextResponse.json({
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } else {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { authenticated: false, error: '获取用户信息失败' },
      { status: 500 }
    );
  }
}
