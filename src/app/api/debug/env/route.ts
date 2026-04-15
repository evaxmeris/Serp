import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-api';

export async function GET(request: NextRequest) {
  // 仅允许管理员访问
  const session = await getUserFromRequest(request);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: '需要管理员权限', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  // 仅返回非敏感的环境变量
  return NextResponse.json({
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  });
}
