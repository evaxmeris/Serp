import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { listResponse, createdResponse, errorResponse } from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import { CreateLogisticsOrderSchema } from '@/lib/api-schemas';
import { generateLogisticsOrderNo } from '@/lib/id-generator';

// GET /api/v1/logistics/orders — 获取物流订单列表
// 支持 status/providerId/search 筛选、分页
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
    const status = searchParams.get('status') || '';
    const providerId = searchParams.get('providerId') || '';
    const search = searchParams.get('search') || '';

    // 构建查询条件
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (providerId) {
      where.providerId = providerId;
    }

    if (search) {
      where.OR = [
        { orderNo: { contains: search } },
        { destination: { contains: search } },
        { trackingNo: { contains: search } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.logisticsOrder.findMany({
        where,
        include: {
          provider: {
            select: {
              id: true,
              companyName: true,
              contactName: true,
              contactPhone: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.logisticsOrder.count({ where }),
    ]);

    return listResponse(orders, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('获取物流订单列表失败:', error);
    return errorResponse('获取物流订单列表失败', 'INTERNAL_ERROR', 500);
  }
}

// POST /api/v1/logistics/orders — 创建物流订单
// 自动生成 LO-YYYYMMDD-XXXX 编号
// 支持 items、费用明细 amountBreakdown
export async function POST(request: NextRequest) {
  try {
    // 认证检查
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const body = await request.json();
    const v = validateOrReturn(CreateLogisticsOrderSchema, body);
    if (!v.success) return v.response;

    const {
      providerId,
      salesOrderId,
      items,
      totalQuantity,
      totalNetWeight,
      totalGrossWeight,
      totalVolume,
      origin,
      destination,
      transportMethod,
      transitDays,
      currency,
      totalAmount,
      amountBreakdown,
      insurance,
      insuranceAmount,
      customsBroker,
      trackingNo,
      estimatedDeparture,
      estimatedArrival,
      notes,
      documents,
    } = v.data;

    // 验证物流服务商存在
    const provider = await prisma.logisticsProvider.findUnique({
      where: { id: providerId },
      select: { id: true, status: true },
    });
    if (!provider) {
      return errorResponse('物流服务商不存在', 'NOT_FOUND', 404);
    }
    if (provider.status !== 'ACTIVE') {
      return errorResponse('物流服务商已停用，无法创建订单', 'CONFLICT', 409);
    }

    // 生成物流订单编号
    const orderNo = await generateLogisticsOrderNo();

    const order = await prisma.logisticsOrder.create({
      data: {
        orderNo,
        providerId,
        salesOrderId: salesOrderId || null,
        items: items || [],
        totalQuantity,
        totalNetWeight,
        totalGrossWeight,
        totalVolume,
        origin,
        destination,
        transportMethod,
        transitDays,
        currency: currency || 'CNY',
        totalAmount,
        amountBreakdown: amountBreakdown || null,
        insurance,
        insuranceAmount,
        customsBroker,
        trackingNo,
        estimatedDeparture: estimatedDeparture ? new Date(estimatedDeparture) : null,
        estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : null,
        status: 'DRAFT',
        notes,
        documents: documents || null,
      },
      include: {
        provider: {
          select: {
            id: true,
            companyName: true,
            contactName: true,
            contactPhone: true,
          },
        },
      },
    });

    return createdResponse(order, '物流订单创建成功');
  } catch (error) {
    console.error('创建物流订单失败:', error);
    return errorResponse('创建物流订单失败', 'INTERNAL_ERROR', 500);
  }
}
