import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-unified';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateOrReturn } from '@/lib/api-validation';
import { UpdateProductSchema } from '@/lib/api-schemas';

// CODE-002: 使用 withAuth() 高阶函数统一认证逻辑
// GET /api/products/[id] - 获取产品详情
export const GET = withAuth(async (request, session) => {
  try {
    // 从 URL 路径提取产品 ID（withAuth 不传递 context，从 request 提取）
    const id = request.nextUrl.pathname.split('/').pop()!;
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
});

// PUT /api/products/[id] - 更新产品
export const PUT = withAuth(async (request, session) => {
  try {
    const id = request.nextUrl.pathname.split('/').pop()!;
    const body = await request.json();
    const v = validateOrReturn(UpdateProductSchema, body);
    if (!v.success) return v.response;
    const { attributes, ...rawProductData } = v.data;

    // 清理空字符串为 undefined（Prisma 不接受空字符串作为 UUID）
    const productData: Record<string, any> = {};
    for (const [key, value] of Object.entries(rawProductData)) {
      if (value !== '' && value !== undefined) {
        productData[key] = value;
      }
    }

    // 更新产品基本信息
    const product = await prisma.product.update({
      where: { id },
      data: productData,
    });

    // 如果有属性数据，更新属性值
    if (Array.isArray(attributes) && attributes.length > 0) {
      // 使用事务处理所有属性更新
      await prisma.$transaction(
        attributes.map(attr => {
          return prisma.productAttributeValue.upsert({
            where: {
              productId_attributeId: {
                productId: id,
                attributeId: attr.attributeId,
              },
            },
            update: {
              valueText: attr.valueText,
              valueNumber: attr.valueNumber,
              valueBoolean: attr.valueBoolean,
              valueDate: attr.valueDate,
              valueOptions: attr.valueOptions,
              unit: attr.unit,
            },
            create: {
              productId: id,
              attributeId: attr.attributeId,
              valueText: attr.valueText,
              valueNumber: attr.valueNumber,
              valueBoolean: attr.valueBoolean,
              valueDate: attr.valueDate,
              valueOptions: attr.valueOptions,
              unit: attr.unit,
            },
          });
        })
      );
    }

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
});

// DELETE /api/products/[id] - 删除产品
export const DELETE = withAuth(async (request, session) => {
  try {
    const id = request.nextUrl.pathname.split('/').pop()!;
    await prisma.product.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
});
