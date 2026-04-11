import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import bcrypt from 'bcryptjs';

// PATCH/PUT /api/users/[id] - 更新用户
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 获取当前登录用户
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '未认证，请先登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // 只有管理员可以更新用户
    if (currentUser.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: '权限不足', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, name, password, role, isApproved } = body;

    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 构建更新数据
    const updateData: any = {};
    if (email !== undefined) updateData.email = email;
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (isApproved !== undefined) updateData.isApproved = isApproved;
    
    // 如果提供了新密码，加密后更新
    if (password && password.trim()) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isApproved: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - 删除用户
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 获取当前登录用户
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '未认证，请先登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // 只有管理员可以删除用户
    if (currentUser.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: '权限不足', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}

// GET /api/users/[id] - 获取单个用户
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 获取当前登录用户
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '未认证，请先登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isApproved: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}
