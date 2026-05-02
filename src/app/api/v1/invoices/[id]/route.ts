import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { getSession, requirePermission } from '@/middleware/auth';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api-response';

/**
 * 发票 API - GET /api/v1/invoices/[id]
 * 获取单个发票详情
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        order: { select: { id: true, orderNo: true, totalAmount: true, currency: true } },
        customer: { select: { id: true, companyName: true, email: true, phone: true, address: true } },
      },
    });
    if (!invoice) return notFoundResponse('发票');
    return successResponse(invoice);
  } catch (e) {
    console.error(e);
    return errorResponse('获取发票失败', 'INTERNAL_ERROR', 500);
  }
}

/**
 * 发票 API - PUT /api/v1/invoices/[id]
 * 更新发票（仅 DRAFT 状态下可编辑）
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);

    // 权限检查：invoices:edit
    const authSession = await getSession(request);
    const permError = requirePermission(authSession!, 'invoices:edit');
    if (permError) return permError;

    const { id } = await params;
    const body = await request.json();

    // 检查发票状态，只有 DRAFT 状态可编辑
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) return notFoundResponse('发票');
    if (existing.status !== 'DRAFT') {
      return errorResponse('只有草稿状态的发票可以编辑', 'INVALID_STATUS', 400);
    }

    // 重新计算金额
    const items = body.items || existing.items;
    const itemList = typeof items === 'string' ? JSON.parse(items) : items;
    const subtotal = Array.isArray(itemList)
      ? itemList.reduce((sum: number, item: any) => sum + Number(item.totalPrice || 0), 0)
      : 0;
    const taxRate = Number(body.taxRate ?? existing.taxRate);
    const taxAmount = subtotal * taxRate;
    const discountRate = Number(body.discountRate ?? existing.discountRate);
    const discountAmount = subtotal * discountRate;
    const totalAmount = subtotal + taxAmount - discountAmount;

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        type: body.type || undefined,
        orderId: body.orderId !== undefined ? body.orderId : undefined,
        customerId: body.customerId !== undefined ? body.customerId : undefined,
        invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : undefined,
        dueDate: body.dueDate ? new Date(body.dueDate) : body.dueDate === null ? null : undefined,
        currency: body.currency || undefined,
        exchangeRate: body.exchangeRate !== undefined ? Number(body.exchangeRate) : undefined,
        subtotal,
        taxRate,
        taxAmount,
        discountRate,
        discountAmount,
        totalAmount,
        issuerName: body.issuerName || undefined,
        issuerAddress: body.issuerAddress !== undefined ? body.issuerAddress : undefined,
        issuerTaxId: body.issuerTaxId !== undefined ? body.issuerTaxId : undefined,
        issuerPhone: body.issuerPhone !== undefined ? body.issuerPhone : undefined,
        recipientName: body.recipientName !== undefined ? body.recipientName : undefined,
        recipientAddress: body.recipientAddress !== undefined ? body.recipientAddress : undefined,
        recipientTaxId: body.recipientTaxId !== undefined ? body.recipientTaxId : undefined,
        items: body.items || undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
        terms: body.terms !== undefined ? body.terms : undefined,
      },
    });

    return successResponse(invoice, '发票更新成功');
  } catch (e) {
    console.error(e);
    return errorResponse('更新发票失败', 'INTERNAL_ERROR', 500);
  }
}

/**
 * 发票 API - DELETE /api/v1/invoices/[id]
 * 删除发票（仅 DRAFT 状态下可删除）
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);

    // 权限检查：invoices:delete
    const authSession = await getSession(request);
    const permError = requirePermission(authSession!, 'invoices:delete');
    if (permError) return permError;

    const { id } = await params;

    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) return notFoundResponse('发票');
    if (existing.status !== 'DRAFT') {
      return errorResponse('只有草稿状态的发票可以删除', 'INVALID_STATUS', 400);
    }

    await prisma.invoice.delete({ where: { id } });
    return successResponse(null, '发票删除成功');
  } catch (e) {
    console.error(e);
    return notFoundResponse('发票');
  }
}
