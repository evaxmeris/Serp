import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { listResponse, createdResponse, errorResponse, successResponse, notFoundResponse } from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';

const CreateCompetitorSchema = z.object({
  competitorName: z.string().min(1, '竞品名称不能为空'),
  competitorNameEn: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  productName: z.string().min(1, '产品名称不能为空'),
  productModel: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  price: z.number().optional().nullable(),
  currency: z.string().optional().nullable(),
  features: z.array(z.string()).optional().nullable(),
  strengths: z.array(z.string()).optional().nullable(),
  weaknesses: z.array(z.string()).optional().nullable(),
  vsOurProduct: z.string().optional().nullable(),
  suggestion: z.string().optional().nullable(),
});

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
    const category = searchParams.get('category') || '';

    const where: any = {};
    if (type) where.type = type;
    if (category) where.category = category;
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

    // Zod 验证请求体
    const v = validateOrReturn(CreateCompetitorSchema, body);
    if (!v.success) return v.response;
    const data = v.data;

    const competitor = await prisma.competitorAnalysis.create({
      data: {
        competitorName: data.competitorName,
        competitorNameEn: data.competitorNameEn || null,
        website: data.website || null,
        country: data.country || 'CN',
        type: data.type || 'DOMESTIC',
        productName: data.productName,
        productModel: data.productModel || null,
        category: data.category || null,
        price: data.price || null,
        currency: data.currency || 'CNY',
        features: data.features || [],
        strengths: data.strengths || [],
        weaknesses: data.weaknesses || [],
        vsOurProduct: data.vsOurProduct || null,
        suggestion: data.suggestion || null,
      },
    });

    return createdResponse(competitor, '竞品分析创建成功');
  } catch (error) {
    console.error('创建竞品分析失败:', error);
    return errorResponse('创建竞品分析失败', 'INTERNAL_ERROR', 500);
  }
}
