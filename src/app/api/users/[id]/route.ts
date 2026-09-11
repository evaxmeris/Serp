import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { hasPermission } from '@/lib/permissions';
import bcrypt from 'bcryptjs';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';
import { successResponse, errorResponse, forbiddenResponse, notFoundResponse } from '@/lib/api-response';

/**
 * 写入审计日志（项目统一模式）
 */
async function writeAuditLog(params: {
  action: string;
  entityType: string;
  entityId: string;
  userId?: string | null;
  details?: Record<string, unknown>;
}) {
  const { userId, ...rest } = params;
  await prisma.auditLog.create({
    data: {
      ...rest,
      ...(userId ? { userId } : {}),
    } as any,
  });
}

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
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    // 只有管理员可以更新用户
    if (currentUser.role !== 'admin' && currentUser.role !== 'super-admin' && currentUser.role !== 'super_admin') {
      return forbiddenResponse('权限不足');
    }

    const body = await request.json();
    const v = validateOrReturn(z.object({
      email: z.string().email().optional(),
      name: z.string().optional(),
      role: z.string().optional(),
      password: z.string().optional(),
      isApproved: z.boolean().optional(),
      isActive: z.boolean().optional(),
      disabledReason: z.string().max(200).optional(),
    }), body);
    if (!v.success) return v.response;
    const { email, name, password, role, isApproved, isActive, disabledReason } = v.data;

    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return notFoundResponse('用户');
    }

    // ── 停用/启用（user-disable-arch §2.1）：独立权限点 + 防锁死校验 ──
    const currentActive = existingUser.isActive !== false; // 兼容旧 client：undefined 视为启用（fail-open）
    const isToggle = isActive !== undefined && isActive !== currentActive;
    if (isToggle) {
      const canDisable = await hasPermission(currentUser.id, 'user:disable');
      if (!canDisable) {
        return forbiddenResponse('缺少停用/启用用户权限（user:disable）');
      }

      // 防锁死 1：不能停用当前登录账号
      if (isActive === false && id === currentUser.id) {
        return errorResponse('不能停用当前登录账号', 'INVALID_OPERATION', 400);
      }

      // 防锁死 2：不能停用最后一个启用的超级管理员（角色名兼容 super-admin / super_admin 两种历史命名）
      if (isActive === false) {
        const superAdminRoles = await prisma.role.findMany({
          where: { name: { in: ['super-admin', 'super_admin'] } },
          select: { id: true },
        });
        if (superAdminRoles.length > 0) {
          const saIds = superAdminRoles.map(r => r.id);
          const targetIsSuperAdmin = await prisma.userRole.findFirst({
            where: { userId: id, roleId: { in: saIds } },
          });
          if (targetIsSuperAdmin) {
            const activeSuperAdmins = await prisma.user.count({
              where: {
                isActive: true,
                userRoles: { some: { roleId: { in: saIds } } },
              },
            });
            if (activeSuperAdmins <= 1) {
              return errorResponse('不能停用最后一个启用的超级管理员', 'INVALID_OPERATION', 400);
            }
          }
        }
      }
    }

    // 构建更新数据
    const updateData: any = {};
    if (email !== undefined) updateData.email = email;
    if (name !== undefined) updateData.name = name;
    if (isApproved !== undefined) updateData.isApproved = isApproved;

    // 停用/启用副作用：记录时间/操作人/原因（启用时清空）
    if (isActive !== undefined) {
      updateData.isActive = isActive;
      if (isActive === false) {
        updateData.disabledAt = new Date();
        updateData.disabledBy = currentUser.id;
        updateData.disabledReason = disabledReason ? disabledReason.slice(0, 200) : null;
      } else {
        updateData.disabledAt = null;
        updateData.disabledBy = null;
        updateData.disabledReason = null;
      }
    }

    // 更新主角色（UserRole）
    if (role !== undefined) {
      const roleRecord = await prisma.role.findUnique({ where: { name: role } });
      if (roleRecord) {
        // 先取消所有主角色标记
        await prisma.userRole.updateMany({
          where: { userId: id, isPrimary: true },
          data: { isPrimary: false },
        });
        // 创建或更新主角色
        await prisma.userRole.upsert({
          where: { userId_roleId: { userId: id, roleId: roleRecord.id } },
          create: { userId: id, roleId: roleRecord.id, isPrimary: true },
          update: { isPrimary: true },
        });
      }
    }

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
        isApproved: true,
        isActive: true,
        disabledAt: true,
        disabledReason: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 审计日志（仅停用/启用动作）
    if (isToggle) {
      await writeAuditLog({
        action: isActive ? 'USER_ENABLED' : 'USER_DISABLED',
        entityType: 'User',
        entityId: id,
        userId: currentUser.id,
        details: {
          targetEmail: existingUser.email,
          reason: isActive ? null : (disabledReason || null),
        },
      });
    }

    const message = isToggle
      ? (isActive ? '用户已启用' : '用户已停用')
      : '用户更新成功';

    return successResponse(updatedUser, message);
  } catch (error) {
    console.error('Error updating user:', error);
    return errorResponse('更新用户失败', 'INTERNAL_ERROR', 500);
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
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    // 只有管理员可以删除用户
    if (currentUser.role !== 'admin' && currentUser.role !== 'super-admin' && currentUser.role !== 'super_admin') {
      return forbiddenResponse('权限不足');
    }

    // 防误删：不能删除当前登录账号
    if (id === currentUser.id) {
      return errorResponse('不能删除当前登录账号（如需移除请先停用）', 'INVALID_OPERATION', 400);
    }

    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return notFoundResponse('用户');
    }

    await prisma.user.delete({
      where: { id },
    });

    await writeAuditLog({
      action: 'USER_DELETED',
      entityType: 'User',
      entityId: id,
      userId: currentUser.id,
      details: { targetEmail: existingUser.email },
    });

    return successResponse({ success: true }, '用户已删除');
  } catch (error) {
    console.error('Error deleting user:', error);
    return errorResponse('删除用户失败', 'INTERNAL_ERROR', 500);
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
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        isApproved: true,
        isActive: true,
        disabledAt: true,
        disabledReason: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return notFoundResponse('用户');
    }

    return successResponse(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return errorResponse('获取用户信息失败', 'INTERNAL_ERROR', 500);
  }
}
