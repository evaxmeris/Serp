import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api-response';

// GET /api/v1/competitors/[id] — 获取竞品详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const { id } = await params;
    const competitor = await prisma.competitorAnalysis.findUnique({ where: { id } });
    if (!competitor) return notFoundResponse('竞品分析');

    return successResponse(competitor, '获取成功');
  } catch (error) {
    console.error('获取竞品详情失败:', error);
    return errorResponse('获取竞品详情失败', 'INTERNAL_ERROR', 500);
  }
}

// PUT /api/v1/competitors/[id] — 更新竞品分析
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const { id } = await params;
    const existing = await prisma.competitorAnalysis.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return notFoundResponse('竞品分析');

    const body = await request.json();
    const competitor = await prisma.competitorAnalysis.update({
      where: { id },
      data: {
        competitorName: body.competitorName,
        competitorNameEn: body.competitorNameEn,
        website: body.website,
        country: body.country,
        type: body.type,
        productName: body.productName,
        productModel: body.productModel,
        category: body.category,
        price: body.price,
        currency: body.currency,
        features: body.features,
        strengths: body.strengths,
        weaknesses: body.weaknesses,
        vsOurProduct: body.vsOurProduct,
        suggestion: body.suggestion,
      },
    });

    return successResponse(competitor, '竞品分析更新成功');
  } catch (error) {
    console.error('更新竞品分析失败:', error);
    return errorResponse('更新竞品分析失败', 'INTERNAL_ERROR', 500);
  }
}

// DELETE /api/v1/competitors/[id] — 删除竞品分析
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const { id } = await params;
    const existing = await prisma.competitorAnalysis.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return notFoundResponse('竞品分析');

    await prisma.competitorAnalysis.delete({ where: { id } });
    return successResponse(null, '竞品分析删除成功');
  } catch (error) {
    console.error('删除竞品分析失败:', error);
    return errorResponse('删除竞品分析失败', 'INTERNAL_ERROR', 500);
  }
}
