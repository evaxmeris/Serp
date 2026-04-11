import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/products/[id] - 获取产品详情
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
}

// PUT /api/products/[id] - 更新产品
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { attributes, ...productData } = body;

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
}

// DELETE /api/products/[id] - 删除产品
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
}
