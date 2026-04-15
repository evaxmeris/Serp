/**
 * 产品批量导出 API
 * 导出为 CSV 格式
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-simple';
import { prisma } from '@/lib/prisma';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';

/**
 * POST /api/products/batch-export
 * 批量导出产品
 */
export async function POST(request: Request) {
  try {
    // 认证检查
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    // 解析请求数据
    const body = await request.json();
    const v = validateOrReturn(z.object({ ids: z.array(z.string()).optional(), format: z.enum(['csv','excel']).optional() }), body);
    if (!v.success) return v.response;
    const { ids } = v.data;

    // 构建查询条件
    const whereClause: any = {};
    if (ids && Array.isArray(ids) && ids.length > 0) {
      whereClause.id = { in: ids };
    }

    // 查询产品
    const products = await prisma.product.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 10000, // 限制导出数量
    });

    // 生成 CSV
    const headers = [
      'SKU',
      '名称',
      '英文名称',
      '单位',
      '成本价',
      '销售价',
      '币种',
      '状态',
      '分类',
      '描述',
    ];

    const rows = products.map((p) => [
      p.sku,
      p.name,
      p.nameEn || '',
      p.unit || 'PCS',
      p.costPrice || 0,
      p.salePrice || 0,
      p.currency || 'USD',
      p.status || 'ACTIVE',
      p.categoryId || '',
      p.description || '',
    ]);

    // 组合 CSV 内容
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((cell) => {
            const str = String(cell);
            // 处理包含逗号或引号的字段
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
        'Content-Disposition': `attachment; filename="products-${Date.now()}.csv"`,
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
