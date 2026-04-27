import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { successResponse, errorResponse, notFoundResponse, conflictResponse } from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import { UpdateCustomerSchema } from '@/lib/api-schemas';

// GET /api/customers/[id] - 获取客户详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { id } = await params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        contacts: true,
        inquiries: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!customer) {
      return notFoundResponse('客户');
    }

    return successResponse(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    return errorResponse('Failed to fetch customer', 'INTERNAL_ERROR', 500);
  }
}

// PUT /api/customers/[id] - 更新客户
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { id } = await params;
    const body = await request.json();
    const v = validateOrReturn(UpdateCustomerSchema, body);
    if (!v.success) return v.response;

    const customer = await prisma.customer.update({
      where: { id },
      data: v.data,
    });

    return successResponse(customer, '客户更新成功');
  } catch (error) {
    console.error('Error updating customer:', error);
    return errorResponse('Failed to update customer', 'INTERNAL_ERROR', 500);
  }
}

// DELETE /api/customers/[id] - 删除客户（需检查关联数据）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { id } = await params;

    // 检查客户是否存在
    const customer = await prisma.customer.findUnique({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!customer) {
      return notFoundResponse('客户');
    }

    // 检查关联订单
    const relatedOrders = await prisma.order.findMany({
      where: { customerId: id, deletedAt: null },
      select: { id: true, orderNo: true },
      take: 10,
    });

    // 检查关联询盘
    const relatedInquiries = await prisma.inquiry.findMany({
      where: { customerId: id, deletedAt: null },
      select: { id: true, inquiryNo: true },
      take: 10,
    });

    // 检查关联报价单
    const relatedQuotations = await prisma.quotation.findMany({
      where: { customerId: id, deletedAt: null },
      select: { id: true, quotationNo: true },
      take: 10,
    });

    // 如果有关联数据，返回 409 禁止删除
    if (relatedOrders.length > 0 || relatedInquiries.length > 0 || relatedQuotations.length > 0) {
      const entities: string[] = [];
      if (relatedOrders.length > 0) {
        entities.push(`订单(${relatedOrders.map(o => o.orderNo).join(', ')})`);
      }
      if (relatedInquiries.length > 0) {
        entities.push(`询盘(${relatedInquiries.map(i => i.inquiryNo).join(', ')})`);
      }
      if (relatedQuotations.length > 0) {
        entities.push(`报价单(${relatedQuotations.map(q => q.quotationNo).join(', ')})`);
      }
      return conflictResponse(`无法删除客户：存在关联${entities.join('、')}`);
    }

    await prisma.customer.delete({
      where: { id },
    });

    return successResponse(null, '客户删除成功');
  } catch (error) {
    console.error('Error deleting customer:', error);
    return errorResponse('Failed to delete customer', 'INTERNAL_ERROR', 500);
  }
}
