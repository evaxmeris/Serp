import { NextResponse } from 'next/server';

// GET /api/auth/me - 获取当前用户信息
export async function GET(request: Request) {
  // 简单实现，从 localStorage 读取（实际生产环境应该从 token 解析）
  // 这里返回一个示例响应
  return NextResponse.json({
    user: null,
    message: 'User information not available. Please login.',
  });
}
