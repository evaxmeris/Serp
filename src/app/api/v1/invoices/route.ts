import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { getSession, requirePermission } from '@/middleware/auth';
import { listResponse, createdResponse, errorResponse, successResponse } from '@/lib/api-response';
import { generateInvoiceNo } from '@/lib/id-generator';

/**
 * 发票 API - GET /api/v1/invoices
 * 列表查询，支持分页、搜索、状态筛选、类型筛选
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const type = searchParams.get('type') || '';

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { invoiceNo: { contains: search } },
        { issuerName: { contains: search } },
        { recipientName: { contains: search } },
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { order: { select: { orderNo: true } }, customer: { select: { companyName: true } } },
      }),
      prisma.invoice.count({ where }),
    ]);
    return listResponse(invoices, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (e) {
    console.error(e);
    return errorResponse('获取发票列表失败', 'INTERNAL_ERROR', 500);
  }
}

/**
 * 发票 API - POST /api/v1/invoices
 * 创建新发票，自动生成发票编号
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);

    // 权限检查：invoices:create
    const authSession = await getSession(request);
    const permError = requirePermission(authSession!, 'invoices:create');
    if (permError) return permError;

    const body = await request.json();

    // 自动生成发票编号
    const invoiceNo = await generateInvoiceNo(body.type || 'PROFORMA');

    // 如果有订单ID，自动从订单获取客户信息
    let recipientName = body.recipientName;
    let recipientAddress = body.recipientAddress;
    let recipientTaxId = body.recipientTaxId;

    if (body.orderId && !recipientName) {
      const order = await prisma.order.findUnique({
        where: { id: body.orderId },
        include: { customer: true },
      });
      if (order?.customer) {
        recipientName = order.customer.companyName;
        if (!recipientAddress) recipientAddress = order.customer.address || undefined;
        body.customerId = order.customerId;
      }
    }

    // 计算金额
    const items = body.items || [];
    const subtotal = items.reduce((sum: number, item: any) => sum + Number(item.totalPrice || 0), 0);
    const taxRate = Number(body.taxRate || 0);
    const taxAmount = subtotal * taxRate;
    const discountRate = Number(body.discountRate || 0);
    const discountAmount = subtotal * discountRate;
    const totalAmount = subtotal + taxAmount - discountAmount;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNo,
        type: body.type || 'PROFORMA',
        status: 'DRAFT',
        orderId: body.orderId || null,
        customerId: body.customerId || null,
        invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : new Date(),
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        currency: body.currency || 'USD',
        exchangeRate: Number(body.exchangeRate || 1.0),
        subtotal,
        taxRate,
        taxAmount,
        discountRate,
        discountAmount,
        totalAmount,
        issuerName: body.issuerName || 'Trade ERP Co., Ltd.',
        issuerAddress: body.issuerAddress || null,
        issuerTaxId: body.issuerTaxId || null,
        issuerPhone: body.issuerPhone || null,
        recipientName: recipientName || null,
        recipientAddress: recipientAddress || null,
        recipientTaxId: recipientTaxId || null,
        items,
        notes: body.notes || null,
        terms: body.terms || null,
        createdById: session.id,
      },
    });

    return createdResponse(invoice, '发票创建成功');
  } catch (e) {
    console.error(e);
    return errorResponse('创建发票失败', 'INTERNAL_ERROR', 500);
  }
}
