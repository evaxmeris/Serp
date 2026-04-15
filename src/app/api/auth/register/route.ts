import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { RegisterSchema, validateBody } from '@/lib/api-schemas';
import { validationErrorResponse } from '@/lib/api-response';

/**
 * POST /api/auth/register - 用户注册（待审批状态）
 * 新用户注册需要管理员审批后才能正式激活账号
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Zod 验证
    const registerSchema = RegisterSchema.extend({
      phone: z.string().min(1, '手机号不能为空').max(20, '手机号过长'),
      username: z.string().max(100).optional(),
      department: z.string().max(100).optional(),
      position: z.string().max(100).optional(),
    });
    const validation = validateBody(registerSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }
    const { email, name, password, username, department, position, phone } = validation.data;

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
