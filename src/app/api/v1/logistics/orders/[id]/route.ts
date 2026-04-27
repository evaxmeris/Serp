import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  conflictResponse,
} from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import { UpdateLogisticsOrderSchema } from '@/lib/api-schemas';

// 物流订单状态流转映射
// DRAFT → PENDING_REVIEW → PENDING_APPROVAL → PENDING_FINANCE → APPROVED → BOOKED → IN_TRANSIT → ARRIVED → DELIVERED → COMPLETED
// 任意状态 → CANCELLED / REJECTED
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  'DRAFT': ['PENDING_REVIEW', 'PENDING_APPROVAL', 'PENDING_FINANCE', 'APPROVED', 'BOOKED', 'CANCELLED'],
  'PENDING_REVIEW': ['PENDING_APPROVAL', 'CANCELLED', 'REJECTED'],
  'PENDING_APPROVAL': ['PENDING_FINANCE', 'CANCELLED', 'REJECTED'],
  'PENDING_FINANCE': ['APPROVED', 'CANCELLED', 'REJECTED'],
  'APPROVED': ['BOOKED', 'CANCELLED'],
  'REJECTED': ['DRAFT', 'CANCELLED'],
  'BOOKED': ['IN_TRANSIT', 'CANCELLED'],
  'IN_TRANSIT': ['ARRIVED', 'CANCELLED'],
  'ARRIVED': ['DELIVERED', 'CANCELLED'],
  'DELIVERED': ['COMPLETED', 'CANCELLED'],
  'COMPLETED': ['CANCELLED'],
  'CANCELLED': [],
};

/**
 * 验证状态流转是否合法
 */
function validateStatusTransition(currentStatus: string, newStatus: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  if (!allowed) return false;
  return allowed.includes(newStatus);
}

// GET /api/v1/logistics/orders/[id] — 获取物流订单详情
export async function GET(
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

    const order = await prisma.logisticsOrder.findUnique({
      where: { id },
      include: {
        provider: true,
        submitter: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true, email: true } },
        finance: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        financeConfirmedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!order) {
      return notFoundResponse('物流订单');
    }

    return successResponse(order, '获取物流订单详情成功');
  } catch (error) {
    console.error('获取物流订单详情失败:', error);
    return errorResponse('获取物流订单详情失败', 'INTERNAL_ERROR', 500);
  }
}

// PUT /api/v1/logistics/orders/[id] — 更新物流订单
// 含状态流转验证
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
    const v = validateOrReturn(UpdateLogisticsOrderSchema, body);
    if (!v.success) return v.response;

    // 检查订单是否存在
    const existing = await prisma.logisticsOrder.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) {
      return notFoundResponse('物流订单');
    }

    // 状态流转验证
    const { status: newStatus, ...updateData } = v.data;
    if (newStatus && newStatus !== existing.status) {
      if (!validateStatusTransition(existing.status, newStatus)) {
        return conflictResponse(
          `状态不能从 ${existing.status} 变更为 ${newStatus}。允许的流转: ${ALLOWED_TRANSITIONS[existing.status]?.join(', ') || '无'}`
        );
      }
    }

    // 构建更新数据（过滤 undefined，避免覆盖已有值）
    const data: any = {};
    for (const [key, value] of Object.entries({ ...updateData })) {
      if (value !== undefined) data[key] = value;
    }
    if (newStatus) {
      data.status = newStatus;
      // 四级审批：当状态更新为审批相关状态时，自动设置 approvalStep
      if (newStatus === 'PENDING_REVIEW') {
        data.approvalStep = 'PENDING_REVIEW';
      } else if (newStatus === 'PENDING_APPROVAL') {
        data.approvalStep = 'PENDING_APPROVAL';
      } else if (newStatus === 'PENDING_FINANCE') {
        data.approvalStep = 'PENDING_FINANCE';
      } else if (newStatus === 'APPROVED') {
        data.approvalStep = 'APPROVED';
      } else if (newStatus === 'REJECTED') {
        data.approvalStep = 'REJECTED';
      } else if (newStatus === 'DRAFT') {
        data.approvalStep = 'DRAFT';
      }
    }
    // 处理 datetime 字符串转换为 Date 对象
    if (data.estimatedDeparture && typeof data.estimatedDeparture === 'string') {
      data.estimatedDeparture = new Date(data.estimatedDeparture);
    }
    if (data.estimatedArrival && typeof data.estimatedArrival === 'string') {
      data.estimatedArrival = new Date(data.estimatedArrival);
    }
    if (data.actualDeparture && typeof data.actualDeparture === 'string') {
      data.actualDeparture = new Date(data.actualDeparture);
    }
    if (data.actualArrival && typeof data.actualArrival === 'string') {
      data.actualArrival = new Date(data.actualArrival);
    }
    if (data.approvedAt && typeof data.approvedAt === 'string') {
      data.approvedAt = new Date(data.approvedAt);
    }

    const order = await prisma.logisticsOrder.update({
      where: { id },
      data,
      include: {
        provider: {
          select: {
            id: true,
            companyName: true,
            contactName: true,
            contactPhone: true,
          },
        },
        submitter: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true, email: true } },
        finance: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        financeConfirmedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return successResponse(order, '物流订单更新成功');
  } catch (error) {
    console.error('更新物流订单失败:', error);
    return errorResponse('更新物流订单失败', 'INTERNAL_ERROR', 500);
  }
}

// DELETE /api/v1/logistics/orders/[id] — 删除物流订单
// 仅允许删除 DRAFT 或 CANCELLED 状态的订单
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

    // 检查订单是否存在
    const existing = await prisma.logisticsOrder.findUnique({
      where: { id },
      select: { id: true, status: true, orderNo: true },
    });
    if (!existing) {
      return notFoundResponse('物流订单');
    }

    // 仅允许删除 DRAFT 或 CANCELLED 状态的订单
    if (!['DRAFT', 'CANCELLED'].includes(existing.status)) {
      return conflictResponse(
        `只有草稿或已取消状态的物流订单可以删除，当前状态: ${existing.status}`
      );
    }

    await prisma.logisticsOrder.delete({
      where: { id },
    });

    return successResponse(null, '物流订单删除成功');
  } catch (error) {
    console.error('删除物流订单失败:', error);
    return errorResponse('删除物流订单失败', 'INTERNAL_ERROR', 500);
  }
}
