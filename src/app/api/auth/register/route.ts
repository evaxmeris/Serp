import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

/**
 * POST /api/auth/register - 用户注册（待审批状态）
 * 新用户注册需要管理员审批后才能正式激活账号
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name, password, username, department, position, phone } = body;

    // 必填字段验证 - 前端也已经验证过，这里做后端双重验证
    if (!email || !password || !name || !phone) {
      return NextResponse.json(
        { error: '请填写所有必填字段' },
        { status: 400 }
      );
    }

    // 密码长度验证
    if (password.length < 8) {
      return NextResponse.json(
        { error: '密码长度至少需要8个字符' },
        { status: 400 }
      );
    }

    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '请输入有效的邮箱地址' },
        { status: 400 }
      );
    }

    // 检查邮箱是否已被注册（正式用户中）
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: '该邮箱已被注册' },
        { status: 400 }
      );
    }

    // 检查是否已有待审批的注册申请
    const existingRegistration = await prisma.userRegistration.findUnique({
      where: { email },
    });

    if (existingRegistration) {
      if (existingRegistration.status === 'PENDING') {
        return NextResponse.json(
          { error: '该邮箱已有注册申请正在审批中' },
          { status: 400 }
        );
      } else if (existingRegistration.status === 'APPROVED') {
        return NextResponse.json(
          { error: '该邮箱已通过审批，请直接登录' },
          { status: 400 }
        );
      }
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(password, 10);

    // 创建注册申请（状态默认为 PENDING）
    const registration = await prisma.userRegistration.create({
      data: {
        username: username || email.split('@')[0],
        email,
        passwordHash,
        name,
        phone,
        department: department || '',
        position: position || '',
      },
    });

    // 返回注册申请信息
    return NextResponse.json(
      {
        success: true,
        message: '注册申请已提交，等待管理员审批',
        registration: {
          id: registration.id,
          email: registration.email,
          name: registration.name,
          phone: registration.phone,
          status: registration.status,
          createdAt: registration.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error registering user:', error);
    return NextResponse.json(
      { error: '提交注册申请失败，请重试' },
      { status: 500 }
    );
  }
}
