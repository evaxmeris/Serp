import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { listResponse, createdResponse, errorResponse } from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import { CreateLogisticsProviderSchema } from '@/lib/api-schemas';

// GET /api/v1/logistics/providers — 获取物流服务商列表
// 支持 search（公司名称/联系人搜索）、status 筛选、分页
export async function GET(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    // 构建查询条件
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { companyName: { contains: search } },
        { contactName: { contains: search } },
        { contactPhone: { contains: search } },
      ];
    }

    const [providers, total] = await Promise.all([
      prisma.logisticsProvider.findMany({
        where,
        include: {
          _count: {
            select: {
              quotations: true,
              orders: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.logisticsProvider.count({ where }),
    ]);

    return listResponse(providers, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('获取物流服务商列表失败:', error);
    return errorResponse('获取物流服务商列表失败', 'INTERNAL_ERROR', 500);
  }
}

// POST /api/v1/logistics/providers — 创建物流服务商
// 验证必填: companyName, contactName, contactPhone
export async function POST(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const body = await request.json();
    const v = validateOrReturn(CreateLogisticsProviderSchema, body);
    if (!v.success) return v.response;

    const {
      companyName,
      taxId,
      companyAddress,
      businessLicense,
      legalRepName,
      legalRepIdFront,
      legalRepIdBack,
      contactName,
      contactPhone,
      contactIdFront,
      contactIdBack,
      status,
      notes,
    } = v.data;

    const provider = await prisma.logisticsProvider.create({
      data: {
        companyName,
        taxId,
        companyAddress,
        businessLicense,
        legalRepName,
        legalRepIdFront,
        legalRepIdBack,
        contactName,
        contactPhone,
        contactIdFront,
        contactIdBack,
        status: status || 'ACTIVE',
        notes,
      },
    });

    return createdResponse(provider, '物流服务商创建成功');
  } catch (error) {
    console.error('创建物流服务商失败:', error);
    return errorResponse('创建物流服务商失败', 'INTERNAL_ERROR', 500);
  }
}
