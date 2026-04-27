import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  conflictResponse,
} from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import { UpdateLogisticsProviderSchema } from '@/lib/api-schemas';

// PUT /api/v1/logistics/providers/[id] — 更新物流服务商
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { id } = await params;
    const body = await request.json();
    const v = validateOrReturn(UpdateLogisticsProviderSchema, body);
    if (!v.success) return v.response;

    // 检查服务商是否存在
    const existing = await prisma.logisticsProvider.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return notFoundResponse('物流服务商');
    }

    const provider = await prisma.logisticsProvider.update({
      where: { id },
      data: v.data,
    });

    return successResponse(provider, '物流服务商更新成功');
  } catch (error) {
    console.error('更新物流服务商失败:', error);
    return errorResponse('更新物流服务商失败', 'INTERNAL_ERROR', 500);
  }
}

// DELETE /api/v1/logistics/providers/[id] — 删除物流服务商
// 删除前检查是否有关联物流订单
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { id } = await params;

    // 检查服务商是否存在
    const provider = await prisma.logisticsProvider.findUnique({
      where: { id },
      select: { id: true, companyName: true },
    });
    if (!provider) {
      return notFoundResponse('物流服务商');
    }

    // 检查关联物流订单
    const relatedOrders = await prisma.logisticsOrder.findMany({
      where: { providerId: id },
      select: { id: true, orderNo: true },
      take: 10,
    });

    if (relatedOrders.length > 0) {
      return conflictResponse(
        `无法删除物流服务商：存在关联物流订单(${relatedOrders.map(o => o.orderNo).join(', ')})`
      );
    }

    // 级联删除报价和订单（数据库设置了 onDelete: Cascade for quotations）
    await prisma.logisticsProvider.delete({
      where: { id },
    });

    return successResponse(null, '物流服务商删除成功');
  } catch (error) {
    console.error('删除物流服务商失败:', error);
    return errorResponse('删除物流服务商失败', 'INTERNAL_ERROR', 500);
  }
}
