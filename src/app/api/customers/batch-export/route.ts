/**
 * 客户批量导出 API
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-simple';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/customers/batch-export
 * 批量导出客户
 */
export async function GET(request: Request) {
  try {
    // 认证检查
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids');

    // 构建查询条件
    const whereClause: any = {};
    if (ids) {
      whereClause.id = { in: ids.split(',') };
    }

    // 查询客户
    const customers = await prisma.customer.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 10000,
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
    return NextResponse.json(
      { error: '导出失败：' + error.message },
      { status: 500 }
    );
  }
}
