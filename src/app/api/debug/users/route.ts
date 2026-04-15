import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
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

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isApproved: true,
        passwordHash: false,
      },
    });

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
