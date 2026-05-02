/**
 * 客户批量导出 API
 */

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { applyRowLevelFilter } from '@/lib/row-level-filter';
import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/api-response';

/**
 * GET /api/customers/batch-export
 * 批量导出客户
 */
export async function GET(request: Request) {
  try {
    // 认证检查
    const user = await getCurrentUser();
    if (!user) {
      return errorResponse('请先登录', 'UNAUTHORIZED', 401);
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids');
    const limitParam = searchParams.get('limit');
    
    // VAL-002: 导出数量上限保护，默认100，最大1000
    const limit = Math.min(
      limitParam ? parseInt(limitParam) : 100,
      1000
    );

    // 构建查询条件（含行级过滤和软删除过滤）
    const whereClause: any = { deletedAt: null };
    if (ids) {
      whereClause.id = { in: ids.split(',') };
    }

    // 应用行级过滤：非 ADMIN 只能导出自己负责的客户
    const filteredWhere = applyRowLevelFilter(
      { id: user.id, email: user.email, name: user.name || '', role: user.role },
      'customer',
      whereClause
    );

    // 查询客户（限制导出数量）
    const customers = await prisma.customer.findMany({
      where: filteredWhere,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // 生成 CSV
    const headers = [
      '公司名',
      '联系人',
      '邮箱',
      '电话',
      '国家',
      '状态',
      '等级',
      '来源',
      '网站',
      '地址',
      '备注',
    ];

    const rows = customers.map((c) => [
      c.companyName,
      c.contactName || '',
      c.email,
      c.phone || '',
      c.country || 'CN',
      c.status || 'ACTIVE',
      c.creditLevel || 'NORMAL',
      c.source || '',
      c.website || '',
      c.address || '',
      c.notes || '',
    ]);

    // 组合 CSV 内容
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((cell) => {
            const str = String(cell);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(',')
      ),
    ].join('\n');

    // 返回 CSV 文件
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="customers-${Date.now()}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('批量导出错误:', error);
    return errorResponse('导出失败：' + error.message, 'INTERNAL_ERROR', 500);
  }
}
