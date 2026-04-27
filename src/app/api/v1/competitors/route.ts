import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { listResponse, createdResponse, errorResponse, successResponse, notFoundResponse } from '@/lib/api-response';

// GET /api/v1/competitors — 竞品分析列表
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || '';

    const where: any = {};
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { competitorName: { contains: search } },
        { productName: { contains: search } },
      ];
    }

    const [competitors, total] = await Promise.all([
      prisma.competitorAnalysis.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.competitorAnalysis.count({ where }),
    ]);

    return listResponse(competitors, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('获取竞品列表失败:', error);
    return errorResponse('获取竞品列表失败', 'INTERNAL_ERROR', 500);
  }
}

// POST /api/v1/competitors — 创建竞品分析
export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const body = await request.json();
    const competitor = await prisma.competitorAnalysis.create({
      data: {
        competitorName: body.competitorName,
        competitorNameEn: body.competitorNameEn || null,
        website: body.website || null,
        country: body.country || 'CN',
        type: body.type || 'DOMESTIC',
        productName: body.productName,
        productModel: body.productModel || null,
        category: body.category || null,
        price: body.price || null,
        currency: body.currency || 'CNY',
        features: body.features || [],
        strengths: body.strengths || [],
        weaknesses: body.weaknesses || [],
        vsOurProduct: body.vsOurProduct || null,
        suggestion: body.suggestion || null,
      },
    });

    return createdResponse(competitor, '竞品分析创建成功');
  } catch (error) {
    console.error('创建竞品分析失败:', error);
    return errorResponse('创建竞品分析失败', 'INTERNAL_ERROR', 500);
  }
}
