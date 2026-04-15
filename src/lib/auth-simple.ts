/**
 * 简化认证模块 - Trade ERP (临时方案)
 * 
 * 使用 cookies + JWT 实现简单认证
 * 
 * @文件说明 简化认证
 * @作者 应亮
 * @创建日期 2026-03-22
 */

import { cookies } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

/**
 * 获取密钥（动态获取，避免模块缓存导致的密钥不一致问题）
 */
function getSecret() {
  // 🔴 强制检查 JWT 密钥，不使用默认值（安全修复）
  if (!process.env.NEXTAUTH_SECRET) {
    throw new Error('NEXTAUTH_SECRET 环境变量必须设置！请在 .env.local 中配置');
  }
  return new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
}

/**
 * 用户登录
 */
export async function login(email: string, password: string) {
  try {
    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return { success: false, error: '账号或密码错误' };
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return { success: false, error: '账号或密码错误' };
    }

    // 验证用户是否已批准
    if (!user.isApproved) {
      return { success: false, error: '账号等待管理员审批，请联系管理员批准后再登录' };
    }

    // 生成 JWT token
    const SECRET = getSecret();
    const token = await new SignJWT({ 
      id: user.id, 
      email: user.email,
      name: user.name,
      role: user.role 
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(SECRET);

    // 设置 cookie
    const cookieStore = await cookies();
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 天
      path: '/',
    });

    return { 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      }
    };
  } catch (error) {
    console.error('登录错误:', error);
    return { success: false, error: '系统错误' };
  }
}

/**
 * 获取当前用户
 */
export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return null;
    }

    const SECRET = getSecret();
    const { payload } = await jwtVerify(token, SECRET);
    
    return {
      id: payload.id as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as string,
    };
  } catch (error) {
    console.error('获取用户错误:', error);
    return null;
  }
}

/**
 * 登出
 */
export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete('auth-token');
}
