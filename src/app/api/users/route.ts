import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/middleware/auth';

// GET /api/users - 获取用户列表
export async function GET(request: Request) {
  try {
    // BUG-PERM-001: 添加认证检查
    // 转换 request 兼容 NextRequest 类型
    const authError = await requireAuth(request as any);
    if (authError) return authError;

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST /api/users - 创建用户
export async function POST(request: Request) {
  try {
    // BUG-PERM-001: 添加认证检查
    // 转换 request 兼容 NextRequest 类型
    const authError = await requireAuth(request as any);
    if (authError) return authError;

    const body = await request.json();
    const { email, name, password, role } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }

    // 这里应该加密密码，简单起见先直接存储
    // 实际生产环境请使用 bcrypt
    const user = await prisma.user.create({
      data: {
        email,
        name,
        role: role || 'USER',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
