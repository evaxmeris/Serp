/**
 * POST /api/v1/products/convert-from-research
 * 一键将调研产品转为正式产品
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateProductSku } from '@/lib/sku-generator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { researchProductId, overrideData } = body;

    if (!researchProductId) {
      return NextResponse.json(
        { error: '缺少调研产品 ID' },
        { status: 400 }
      );
    }

    // 1. 获取调研产品数据
    const researchProduct = await prisma.productResearch.findUnique({
      where: { id: researchProductId },
      include: {
        attributes: {
          include: {
            attribute: true,
          },
        },
        category: true,
      },
    });

    if (!researchProduct) {
      return NextResponse.json(
        { error: '调研产品不存在' },
        { status: 404 }
      );
    }

    if (researchProduct.status !== 'APPROVED') {
      return NextResponse.json(
        { error: '只有已批准的调研产品才能转化' },
        { status: 400 }
      );
    }

    // 2. 检查是否已转化过
    const existingProduct = await prisma.product.findFirst({
      where: { sourceResearchId: researchProductId },
    });

    if (existingProduct) {
      return NextResponse.json(
        { error: '该调研产品已转化为正式产品', productId: existingProduct.id },
        { status: 400 }
      );
    }

    // 3. 生成正式产品数据
    const sku = await generateProductSku(researchProduct.category?.code);

    // 4. 事务：创建正式产品 + 复制属性值 + 更新调研产品状态
    const result = await prisma.$transaction(async (tx) => {
      // 创建正式产品
      const product = await tx.product.create({
        data: {
          sku,
          name: researchProduct.name,
          nameEn: researchProduct.nameEn,
          categoryId: researchProduct.categoryId,
          specification: researchProduct.specification,
          costPrice: researchProduct.costPrice || 0,
          salePrice: researchProduct.salePrice || 0,
          currency: 'USD',
          weight: researchProduct.weight,
          volume: researchProduct.volume,
          moq: researchProduct.moq,
          leadTime: researchProduct.leadTime,
          description: researchProduct.conclusion,
          images: researchProduct.images,
          status: 'ACTIVE',
          sourceResearchId: researchProductId,
        },
      });

      // 复制属性值
      if (researchProduct.attributes.length > 0) {
        await tx.productAttributeValue.createMany({
          data: researchProduct.attributes.map((attr) => ({
            productId: product.id,
            attributeId: attr.attributeId,
            valueText: attr.valueText,
            valueNumber: attr.valueNumber,
            valueBoolean: attr.valueBoolean,
            valueDate: attr.valueDate,
            valueOptions: attr.valueOptions,
            unit: attr.unit,
            notes: attr.notes,
          })),
        });
      }

      // 更新调研产品状态为 ARCHIVED
      await tx.productResearch.update({
        where: { id: researchProductId },
        data: { status: 'ARCHIVED' },
      });

      return product;
    });

    return NextResponse.json({
      success: true,
      message: '转化成功',
      data: {
        productId: result.id,
        sku: result.sku,
        name: result.name,
        researchProductId,
      },
    });
  } catch (error) {
    console.error('转化产品失败:', error);
    return NextResponse.json(
      { error: '转化失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
