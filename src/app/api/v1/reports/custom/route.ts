/**
 * 自定义报表 API
 * 提供自定义报表的创建、查询和管理
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { getCurrentUser } from '@/lib/auth';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';

/**
 * GET /api/v1/reports/custom
 * 获取自定义报表列表
 */
export async function GET(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const isActive = searchParams.get('isActive');

    const where: any = {};
    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    const reports = await prisma.reportDefinition.findMany({
      where: {
        ...where,
        type: 'CUSTOM'
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error('获取自定义报表失败:', error);
    return NextResponse.json(
      { error: '获取自定义报表失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/reports/custom
 * 创建自定义报表
 * 
 * BUG-S6-002 修复：添加权限验证，只有 ADMIN 和 MANAGER 角色可以创建
 */
export async function POST(request: NextRequest) {
  try {
    // BUG-S6-002 修复：获取当前用户并验证权限
    const user = await getCurrentUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: '未授权访问，请先登录' },
        { status: 401 }
      );
    }

    // 只有 ADMIN 和 MANAGER 角色可以创建自定义报表
    const allowedRoles = ['ADMIN'];
    if (!allowedRoles.includes(user.user.role)) {
      return NextResponse.json(
        { error: '权限不足，只有管理员或经理可以创建自定义报表' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const v = validateOrReturn(z.object({ name: z.string(), code: z.string(), description: z.string().optional(), config: z.record(z.string(), z.any()).optional(), columns: z.array(z.any()).optional(), filters: z.array(z.any()).optional() }), body);
    if (!v.success) return v.response;
    const { name, code, description, config, columns, filters } = v.data;

    if (!name || !code) {
      return NextResponse.json(
        { error: '缺少必要的参数：name, code' },
        { status: 400 }
      );
    }

    const report = await prisma.reportDefinition.create({
      data: {
        name,
        code,
        type: 'CUSTOM',
        description: description || '',
        config: config ? (JSON.parse(JSON.stringify(config)) as any) : {},
        columns: columns || [],
        filters: filters || [],
        isSystem: false,
        isActive: true,
        createdBy: user.user.id  // 记录创建者
      }
    });

    return NextResponse.json({
      success: true,
      data: report,
      message: '自定义报表创建成功'
    });
  } catch (error) {
    console.error('创建自定义报表失败:', error);
    return NextResponse.json(
      { error: '创建自定义报表失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/reports/custom
 * 更新自定义报表
 */
export async function PUT(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, description, config, columns, filters, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: '缺少报表 ID' },
        { status: 400 }
      );
    }

    const report = await prisma.reportDefinition.update({
      where: { id },
      data: {
        name,
        description,
        config,
        columns,
        filters,
        isActive
      }
    });

    return NextResponse.json({
      success: true,
      data: report,
      message: '自定义报表更新成功'
    });
  } catch (error) {
    console.error('更新自定义报表失败:', error);
    return NextResponse.json(
      { error: '更新自定义报表失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/reports/custom
 * 删除自定义报表
 */
export async function DELETE(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '缺少报表 ID' },
        { status: 400 }
      );
    }

    await prisma.reportDefinition.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: '自定义报表删除成功'
    });
  } catch (error) {
    console.error('删除自定义报表失败:', error);
    return NextResponse.json(
      { error: '删除自定义报表失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
