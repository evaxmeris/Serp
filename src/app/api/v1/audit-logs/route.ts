import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { getSession } from '@/middleware/auth';
import { listResponse, errorResponse } from '@/lib/api-response';

/**
 * 审计日志 API - GET /api/v1/audit-logs
 *
 * 列表查询，支持分页、按操作类型筛选、按用户筛选、按日期范围筛选
 *
 * 查询参数:
 *   page      - 页码（默认 1）
 *   limit     - 每页条数（默认 20，最大 100）
 *   action    - 操作类型（可选：LOGIN, CREATE, UPDATE, DELETE, EXPORT 等）
 *   userId    - 操作人 ID（可选）
 *   entityType - 操作对象类型（可选）
 *   startDate - 开始日期（ISO 字符串，可选）
 *   endDate   - 结束日期（ISO 字符串，可选）
 *   search    - 搜索关键字（搜索 entityType/entityId，可选）
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const action = searchParams.get('action') || '';
    const userId = searchParams.get('userId') || '';
    const entityType = searchParams.get('entityType') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const search = searchParams.get('search') || '';

    // 构建筛选条件
    const where: any = {};

    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (entityType) where.entityType = entityType;

    // 日期范围筛选
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // 搜索关键字
    if (search) {
      where.OR = [
        { entityType: { contains: search } },
        { entityId: { contains: search } },
        { action: { contains: search } },
      ];
    }

    // 并行查询列表和总数
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return listResponse(logs, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    console.error('获取审计日志失败:', e);
    return errorResponse('获取审计日志失败', 'INTERNAL_ERROR', 500);
  }
}
