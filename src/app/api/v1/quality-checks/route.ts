/**
 * 质检管理 API
 * GET  - 获取质检列表（分页、筛选、搜索）
 * POST - 创建质检单（含检测项）
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requirePermission } from '@/middleware/auth';
import { getUserFromRequest } from '@/lib/auth-unified';
import {
  successResponse,
  createdResponse,
  errorResponse,
  notFoundResponse,
  listResponse,
} from '@/lib/api-response';
import { generateQcNo } from '@/lib/id-generator';

// GET /api/v1/quality-checks
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const type = searchParams.get('type') || '';

    const where: any = {};
    if (search) {
      where.OR = [
        { qcNo: { contains: search } },
        { inspector: { contains: search } },
        { order: { orderNo: { contains: search } } },
      ];
    }
    if (status) where.status = status;
    if (type) where.type = type;

    const [items, total] = await Promise.all([
      prisma.qualityCheck.findMany({
        where,
        include: {
          order: { select: { id: true, orderNo: true } },
          items: { select: { id: true, itemName: true, passed: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.qualityCheck.count({ where }),
    ]);

    return listResponse(items, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('获取质检列表失败:', error);
    return errorResponse('获取质检列表失败', 'INTERNAL_ERROR', 500);
  }
}

// POST /api/v1/quality-checks
export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    // RBAC 权限检查：quality:create
    const authSession = await getSession(request);
    const permError = requirePermission(authSession!, 'quality:create');
    if (permError) return permError;

    const body = await request.json();
    const { orderId, type, inspector, inspectionDate, notes, items } = body;

    if (!orderId) return errorResponse('关联订单不能为空', 'VALIDATION_ERROR', 400);

    // 验证订单存在
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return errorResponse('关联订单不存在', 'NOT_FOUND', 404);

    // 生成质检单号
    const qcNo = await generateQcNo();

    const qualityCheck = await prisma.qualityCheck.create({
      data: {
        orderId,
        qcNo,
        type: type || 'FINAL',
        inspector: inspector || null,
        inspectionDate: inspectionDate ? new Date(inspectionDate) : new Date(),
        notes: notes || null,
        items: items && items.length > 0
          ? {
              create: items.map((item: any) => ({
                itemName: item.itemName,
                standard: item.standard || null,
                result: item.result || null,
                passed: item.passed ?? true,
              })),
            }
          : undefined,
      },
      include: {
        order: { select: { id: true, orderNo: true } },
        items: true,
      },
    });

    return createdResponse(qualityCheck, '质检单创建成功');
  } catch (error) {
    console.error('创建质检单失败:', error);
    return errorResponse('创建质检单失败', 'INTERNAL_ERROR', 500);
  }
}
