/**
 * 产品-供应商关联 API - 单个关联的更新和删除
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { getSession, requirePermission } from '@/middleware/auth';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  extractZodErrors,
} from '@/lib/api-response';
import { z } from 'zod';

// 更新 Schema
const UpdateSchema = z.object({
  supplierSKU: z.string().optional().nullable(),
  unitPrice: z.number().positive('单价必须大于 0').optional().nullable(),
  currency: z.string().optional(),
  moq: z.number().int().positive('MOQ 必须大于 0').optional().nullable(),
  leadTime: z.number().int().positive('交期必须大于 0').optional().nullable(),
  isPreferred: z.boolean().optional(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  notes: z.string().optional().nullable(),
});

/**
 * GET /api/v1/product-suppliers/[id]
 * 获取单个关联详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    // RBAC 权限检查
    const authSession = await getSession(request);
    const permError = requirePermission(authSession!, 'supplier_product:list');
    if (permError) return permError;

    const { id } = await params;

    const record = await prisma.productSupplier.findUnique({
      where: { id },
      include: {
        product: {
          select: { id: true, name: true, sku: true, specification: true, unit: true, costPrice: true, salePrice: true, images: true },
        },
        supplier: {
          select: { id: true, companyName: true, companyEn: true, supplierNo: true, contactName: true, email: true, phone: true, status: true, level: true, currency: true },
        },
      },
    });

    if (!record) return notFoundResponse('关联记录');

    return successResponse(record);
  } catch (error) {
    console.error('获取关联详情失败:', error);
    return errorResponse('获取关联详情失败');
  }
}

/**
 * PUT /api/v1/product-suppliers/[id]
 * 更新关联
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    // RBAC 权限检查
    const authSession = await getSession(request);
    const permError = requirePermission(authSession!, 'supplier_product:edit');
    if (permError) return permError;

    const { id } = await params;

    const existing = await prisma.productSupplier.findUnique({ where: { id } });
    if (!existing) return notFoundResponse('关联记录');

    const body = await request.json();
    const validationResult = UpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    const data = validationResult.data;

    // 如果标记为首选，先取消该产品的其他首选标记
    if (data.isPreferred) {
      await prisma.productSupplier.updateMany({
        where: { productId: existing.productId, isPreferred: true, id: { not: id } },
        data: { isPreferred: false },
      });
    }

    const updated = await prisma.productSupplier.update({
      where: { id },
      data,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        supplier: { select: { id: true, companyName: true, supplierNo: true } },
      },
    });

    return successResponse(updated, '关联更新成功');
  } catch (error) {
    console.error('更新关联失败:', error);
    return errorResponse('更新关联失败');
  }
}

/**
 * DELETE /api/v1/product-suppliers/[id]
 * 删除关联
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    // RBAC 权限检查
    const authSession = await getSession(request);
    const permError = requirePermission(authSession!, 'supplier_product:delete');
    if (permError) return permError;

    const { id } = await params;

    const existing = await prisma.productSupplier.findUnique({ where: { id } });
    if (!existing) return notFoundResponse('关联记录');

    await prisma.productSupplier.delete({ where: { id } });

    return successResponse(null, '关联删除成功');
  } catch (error) {
    console.error('删除关联失败:', error);
    return errorResponse('删除关联失败');
  }
}
