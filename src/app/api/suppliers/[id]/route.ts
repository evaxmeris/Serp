import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-api';
import { errorResponse, successResponse, notFoundResponse, conflictResponse } from '@/lib/api-response';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateOrReturn } from '@/lib/api-validation';
import { UpdateSupplierSchema } from '@/lib/api-schemas';

// GET /api/suppliers/[id] - 获取供应商详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            items: true,
          },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(supplier);
  } catch (error) {
    console.error('Error fetching supplier:', error);
    return NextResponse.json(
      { error: 'Failed to fetch supplier' },
      { status: 500 }
    );
  }
}

// PUT /api/suppliers/[id] - 更新供应商
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const v = validateOrReturn(UpdateSupplierSchema, body);
    if (!v.success) return v.response;
    const {
      companyName,
      contactName,
      email,
      phone,
      address,
      country,
      website,
      products,
      status,
      creditTerms,
      notes,
    } = v.data;

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        companyName,
        contactName,
        email,
        phone,
        address,
        country,
        website,
        products,
        status,
        creditTerms,
        notes,
      },
    });

    return NextResponse.json(supplier);
  } catch (error) {
    console.error('Error updating supplier:', error);
    return NextResponse.json(
      { error: 'Failed to update supplier' },
      { status: 500 }
    );
  }
}

// DELETE /api/suppliers/[id] - 删除供应商（需检查关联采购订单）
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

    // 检查供应商是否存在
    const supplier = await prisma.supplier.findUnique({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!supplier) {
      return notFoundResponse('供应商');
    }

    // 检查关联采购订单
    const relatedPurchaseOrders = await prisma.purchaseOrder.findMany({
      where: { supplierId: id },
      select: { id: true, poNo: true },
      take: 10,
    });

    // 如果有关联采购订单，返回 409 禁止删除
    if (relatedPurchaseOrders.length > 0) {
      return conflictResponse(
        `无法删除供应商：存在关联采购订单(${relatedPurchaseOrders.map(po => po.poNo).join(', ')})`
      );
    }

    await prisma.supplier.delete({
      where: { id },
    });

    return successResponse(null, '供应商删除成功');
  } catch (error) {
    console.error('Error deleting supplier:', error);
    return NextResponse.json(
      { error: 'Failed to delete supplier' },
      { status: 500 }
    );
  }
}
