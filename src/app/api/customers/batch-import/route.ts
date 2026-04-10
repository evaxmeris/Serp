/**
 * 客户批量导入 API
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-simple';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/customers/batch-import
 * 批量导入客户
 */
export async function POST(request: Request) {
  try {
    // 认证检查
    const user = await getCurrentUser();
    if (!user || !['ADMIN', 'SALES'].includes(user.role)) {
      return NextResponse.json(
        { error: '需要客户管理权限' },
        { status: 403 }
      );
    }

    // 解析请求数据
    const body = await request.json();
    const { customers, mode = 'create' } = body;

    if (!Array.isArray(customers) || customers.length === 0) {
      return NextResponse.json(
        { error: '客户数据不能为空' },
        { status: 400 }
      );
    }

    // 限制批量大小
    if (customers.length > 1000) {
      return NextResponse.json(
        { error: '单次最多导入 1000 条客户' },
        { status: 400 }
      );
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ index: number; error: string }>,
    };

    // 批量处理
    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];
      try {
        // 验证必填字段
        if (!customer.companyName || !customer.email) {
          results.failed++;
          results.errors.push({
            index: i + 1,
            error: '缺少必填字段：公司名或邮箱',
          });
          continue;
        }

        // 检查邮箱是否重复
        const existing = await prisma.customer.findFirst({
          where: { email: customer.email },
        });

        if (existing && mode === 'create') {
          results.failed++;
          results.errors.push({
            index: i + 1,
            error: `邮箱 ${customer.email} 已存在`,
          });
          continue;
        }

        // 创建或更新客户
        if (mode === 'update' && existing) {
          await prisma.customer.update({
            where: { id: existing.id },
            data: {
              companyName: customer.companyName,
              contactName: customer.contactName,
              email: customer.email,
              phone: customer.phone,
              country: customer.country || 'CN',
              status: customer.status || 'ACTIVE',
              creditLevel: customer.level || 'NORMAL',
              source: customer.source,
              website: customer.website,
              address: customer.address,
              notes: customer.notes,
            },
          });
        } else {
          await prisma.customer.create({
            data: {
              companyName: customer.companyName,
              contactName: customer.contactName,
              email: customer.email,
              phone: customer.phone,
              country: customer.country || 'CN',
              status: customer.status || 'ACTIVE',
              creditLevel: customer.level || 'NORMAL',
              source: customer.source,
              website: customer.website,
              address: customer.address,
              notes: customer.notes,
            },
          });
        }

        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          index: i + 1,
          error: error.message || '未知错误',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `导入完成：成功 ${results.success} 条，失败 ${results.failed} 条`,
      results,
    });
  } catch (error: any) {
    console.error('批量导入错误:', error);
    return NextResponse.json(
      { error: '导入失败：' + error.message },
      { status: 500 }
    );
  }
}
