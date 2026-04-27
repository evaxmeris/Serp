import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import {
  successResponse,
  createdResponse,
  errorResponse,
  notFoundResponse,
} from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import { CreateLogisticsQuotationSchema } from '@/lib/api-schemas';

// GET /api/v1/logistics/providers/[id]/quotations — 获取某服务商的所有报价
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { id: providerId } = await params;

    // 检查服务商是否存在
    const provider = await prisma.logisticsProvider.findUnique({
      where: { id: providerId },
      select: { id: true },
    });
    if (!provider) {
      return notFoundResponse('物流服务商');
    }

    const quotations = await prisma.logisticsQuotation.findMany({
      where: { providerId },
      orderBy: [{ region: 'asc' }, { transportMethod: 'asc' }],
    });

    return successResponse(quotations, '获取报价列表成功');
  } catch (error) {
    console.error('获取物流报价列表失败:', error);
    return errorResponse('获取物流报价列表失败', 'INTERNAL_ERROR', 500);
  }
}

// POST /api/v1/logistics/providers/[id]/quotations — 添加报价
// providerId 从 URL 提取, 必填: region, transportMethod, transitDays, pricePerKg
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { id: providerId } = await params;

    // 检查服务商是否存在
    const provider = await prisma.logisticsProvider.findUnique({
      where: { id: providerId },
      select: { id: true, companyName: true },
    });
    if (!provider) {
      return notFoundResponse('物流服务商');
    }

    const body = await request.json();
    const v = validateOrReturn(CreateLogisticsQuotationSchema, body);
    if (!v.success) return v.response;

    const {
      region,
      transportMethod,
      transitDays,
      pricePerKg,
      pricePerCbm,
      minimumCharge,
      validFrom,
      validUntil,
      notes,
    } = v.data;

    // 检查同一服务商、同一区域、同一运输方式的报价是否已存在
    const existing = await prisma.logisticsQuotation.findFirst({
      where: { providerId, region, transportMethod },
    });
    if (existing) {
      return errorResponse(
        `该服务商已存在 ${region} - ${transportMethod} 的报价`,
        'CONFLICT',
        409
      );
    }

    const quotation = await prisma.logisticsQuotation.create({
      data: {
        providerId,
        region,
        transportMethod,
        transitDays,
        pricePerKg,
        pricePerCbm,
        minimumCharge: minimumCharge ?? 0,
        validFrom: validFrom ? new Date(validFrom) : null,
        validUntil: validUntil ? new Date(validUntil) : null,
        notes,
      },
    });

    return createdResponse(quotation, '物流报价添加成功');
  } catch (error) {
    console.error('添加物流报价失败:', error);
    return errorResponse('添加物流报价失败', 'INTERNAL_ERROR', 500);
  }
}
