import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/v1/warehouses/init-default
 * 初始化默认仓库（如果数据库中没有仓库数据）
 * 用于外贸业务场景的常见仓库配置
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 检查是否已有仓库
    const existingCount = await prisma.warehouse.count();
    if (existingCount > 0) {
      return successResponse({
        message: `已有 ${existingCount} 个仓库，无需初始化`,
        created: [],
      });
    }

    // 创建默认外贸仓库
    const defaultWarehouses = [
      {
        name: '深圳主仓库',
        code: 'SZ-MAIN',
        address: '深圳市宝安区',
        manager: '',
        phone: '',
        status: 'ACTIVE' as const,
      },
      {
        name: '广州仓库',
        code: 'GZ-WH',
        address: '广州市白云区',
        manager: '',
        phone: '',
        status: 'ACTIVE' as const,
      },
      {
        name: '义乌仓库',
        code: 'YW-WH',
        address: '义乌市',
        manager: '',
        phone: '',
        status: 'ACTIVE' as const,
      },
      {
        name: '海外仓（美国）',
        code: 'US-FBA',
        address: '美国洛杉矶',
        manager: '',
        phone: '',
        status: 'ACTIVE' as const,
      },
    ];

    const created = [];
    for (const wh of defaultWarehouses) {
      const warehouse = await prisma.warehouse.create({
        data: wh,
      });
      created.push(warehouse);
    }

    return successResponse({
      message: `成功创建 ${created.length} 个默认仓库`,
      created,
    });
  } catch (error) {
    console.error('Error initializing default warehouses:', error);
    return errorResponse('初始化仓库失败');
  }
}
