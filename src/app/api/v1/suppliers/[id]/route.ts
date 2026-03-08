import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  extractZodErrors,
  notFoundResponse,
} from '@/lib/api-response';
import { UpdateSupplierSchema, SupplierIdSchema } from '@/lib/validators/supplier';

// GET /api/v1/suppliers/[id] - 获取供应商详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const validationResult = SupplierIdSchema.safeParse({ id });

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        contacts: {
          orderBy: { isPrimary: 'desc' },
        },
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            items: {
              take: 5,
            },
          },
        },
        evaluations: {
          orderBy: { evaluationDate: 'desc' },
          take: 5,
        },
        _count: {
          select: {
            purchaseOrders: true,
            contacts: true,
            evaluations: true,
          },
        },
      },
    });

    if (!supplier) {
      return notFoundResponse('供应商');
    }

    return successResponse(supplier);
  } catch (error) {
    console.error('Error fetching supplier:', error);
    return errorResponse('获取供应商详情失败', 'INTERNAL_ERROR');
  }
}

// PUT /api/v1/suppliers/[id] - 更新供应商
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const validationResult = SupplierIdSchema.safeParse({ id });

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    // 检查供应商是否存在
    const existingSupplier = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!existingSupplier) {
      return notFoundResponse('供应商');
    }

    const body = await request.json();
    const updateResult = UpdateSupplierSchema.safeParse(body);

    if (!updateResult.success) {
      return validationErrorResponse(extractZodErrors(updateResult.error));
    }

    const data = updateResult.data;

    // 更新供应商
    const supplier = await prisma.supplier.update({
      where: { id },
      data,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return successResponse(supplier, '供应商更新成功');
  } catch (error) {
    console.error('Error updating supplier:', error);
    return errorResponse('更新供应商失败', 'INTERNAL_ERROR');
  }
}

// DELETE /api/v1/suppliers/[id] - 删除供应商
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const validationResult = SupplierIdSchema.safeParse({ id });

    if (!validationResult.success) {
      return validationErrorResponse(extractZodErrors(validationResult.error));
    }

    // 检查供应商是否存在
    const existingSupplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            purchaseOrders: true,
          },
        },
      },
    });

    if (!existingSupplier) {
      return notFoundResponse('供应商');
    }

    // 检查是否有关联的采购订单
    if (existingSupplier._count.purchaseOrders > 0) {
      return errorResponse(
        '供应商存在关联的采购订单，无法删除',
        'CONFLICT',
        409
      );
    }

    // 删除供应商
    await prisma.supplier.delete({
      where: { id },
    });

    return successResponse(null, '供应商删除成功', 'NO_CONTENT');
  } catch (error) {
    console.error('Error deleting supplier:', error);
    return errorResponse('删除供应商失败', 'INTERNAL_ERROR');
  }
}
