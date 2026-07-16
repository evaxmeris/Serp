/**
 * POST /api/inquiries/{id}/convert-to-quotation
 * 
 * 询盘一键转换报价单功能。
 * 从询盘提取客户和产品信息，自动创建 DRAFT 状态的报价单。
 * 如果询盘没有关联客户（理论上不会发生），自动创建一个 Customer。
 */
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { validateOrReturn } from '@/lib/api-validation';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api-response';
import type { NextRequest } from 'next/server';

/** 询盘转报价的请求体 Schema */
const ConvertToQuotationSchema = z.object({
  validityDays: z.number().int().min(1).optional().default(30),
  paymentTerms: z.string().optional(),
  deliveryTerms: z.string().optional(),
  notes: z.string().optional(),
  currency: z.string().max(10).optional(),
  // 可选的报价项覆盖（如不传，则从询盘 products/quantity 自动生成一项）
  items: z
    .array(
      z.object({
        productName: z.string().min(1, '产品名称不能为空'),
        specification: z.string().optional(),
        quantity: z.number().int().positive('数量必须大于 0'),
        unitPrice: z.number().min(0, '单价不能为负').default(0),
        notes: z.string().optional(),
      })
    )
    .min(1)
    .optional(),
});

// POST /api/inquiries/[id]/convert-to-quotation - 询盘转报价单
export async function POST(
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

    // 验证请求体
    const body = await request.json();
    const v = validateOrReturn(ConvertToQuotationSchema, body);
    if (!v.success) return v.response;
    const { validityDays, paymentTerms, deliveryTerms, notes, currency, items: overrideItems } = v.data;

    // 获取询盘详情（含客户信息）
    const inquiry = await prisma.inquiry.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            companyName: true,
            contactName: true,
            email: true,
            phone: true,
            ownerId: true,
          },
        },
      },
    });

    if (!inquiry) {
      return notFoundResponse('询盘');
    }

    // 行级权限：非 ADMIN 用户只能对自己负责的询盘操作
    if (session.role !== 'admin' && inquiry.assignedTo !== session.id) {
      return errorResponse('无权操作此询盘', 'FORBIDDEN', 403);
    }

    // --- 确定客户 ID ---
    let customerId = inquiry.customerId;

    // 理论上 Inquiry 一定有 customerId，但以防万一
    if (!customerId) {
      // 如果询盘没有关联客户（边界情况），创建一个客户
      const newCustomer = await prisma.customer.create({
        data: {
          companyName: `询盘-${inquiry.inquiryNo}`,
          contactName: inquiry.assignedTo || undefined,
          email: null,
          phone: null,
          source: 'Inquiry',
          ownerId: session.id,
        },
      });
      customerId = newCustomer.id;
    }

    // --- 构建报价项 ---
    let quotationItems: Array<{
      productName: string;
      specification?: string;
      quantity: number;
      unitPrice: number;
      amount: number;
      notes?: string;
    }>;

    if (overrideItems && overrideItems.length > 0) {
      // 使用前端传入的自定义项
      quotationItems = overrideItems.map((item) => ({
        productName: item.productName,
        specification: item.specification,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.unitPrice * item.quantity,
        notes: item.notes,
      }));
    } else {
      // 从询盘的 products / quantity 字段自动生成一项
      const productName = inquiry.products || '未命名产品';
      const qty = inquiry.quantity || 1;
      const unitPrice = inquiry.targetPrice ? Number(inquiry.targetPrice) : 0;

      quotationItems = [
        {
          productName,
          specification: inquiry.requirements || undefined,
          quantity: qty,
          unitPrice,
          amount: unitPrice * qty,
          notes: `源自询盘 ${inquiry.inquiryNo}`,
        },
      ];
    }

    // 计算总金额
    const totalAmount = quotationItems.reduce((sum, item) => sum + item.amount, 0);

    // --- 生成报价单号 ---
    const quotationNo = `QT${Date.now()}`;

    // --- 创建报价单（DRAFT 状态）---
    const quotation = await prisma.quotation.create({
      data: {
        quotationNo,
        customerId,
        inquiryId: id,
        currency: currency || inquiry.currency || 'USD',
        paymentTerms: paymentTerms || null,
        deliveryTerms: deliveryTerms || null,
        validityDays: validityDays || 30,
        notes: notes || null,
        totalAmount,
        status: 'DRAFT',
        items: {
          create: quotationItems.map((item) => ({
            productName: item.productName,
            specification: item.specification,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
            notes: item.notes,
          })),
        },
      },
      include: {
        items: true,
        customer: {
          select: {
            id: true,
            companyName: true,
            contactName: true,
          },
        },
      },
    });

    // --- 可选：自动更新询盘状态为 QUOTED ---
    // 如果当前状态是 NEW 或 CONTACTED，自动推进到 QUOTED
    if (['NEW', 'CONTACTED', 'NEGOTIATING'].includes(inquiry.status)) {
      await prisma.inquiry.update({
        where: { id },
        data: { status: 'QUOTED' },
      });
    }

    return successResponse(
      {
        quotation: {
          id: quotation.id,
          quotationNo: quotation.quotationNo,
          customerId: quotation.customerId,
          customer: quotation.customer,
          totalAmount: quotation.totalAmount,
          currency: quotation.currency,
          status: quotation.status,
          items: quotation.items,
          validityDays: quotation.validityDays,
          paymentTerms: quotation.paymentTerms,
          deliveryTerms: quotation.deliveryTerms,
          notes: quotation.notes,
          createdAt: quotation.createdAt,
        },
        inquiryId: id,
      },
      `报价单 ${quotation.quotationNo} 创建成功`
    );
  } catch (error) {
    console.error('Error converting inquiry to quotation:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return errorResponse('请求参数验证失败', 'VALIDATION_ERROR', 400);
    }
    return errorResponse('询盘转报价单失败', 'INTERNAL_ERROR', 500);
  }
}
