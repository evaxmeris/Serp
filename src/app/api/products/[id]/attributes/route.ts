import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/products/[id]/attributes - 获取产品的所有属性值
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const attributes = await prisma.productAttributeValue.findMany({
      where: { productId: id },
      include: {
        attribute: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: attributes,
    });
  } catch (error) {
    console.error('Error fetching product attributes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product attributes' },
      { status: 500 }
    );
  }
}
