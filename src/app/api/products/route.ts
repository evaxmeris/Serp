import { getUserFromRequest } from '@/lib/auth-unified';
import { listResponse, createdResponse, errorResponse, successResponse } from '@/lib/api-response';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateOrReturn } from '@/lib/api-validation';
import { CreateProductSchema } from '@/lib/api-schemas';

/**
 * 获取客户端 IP 和 User-Agent
 */
function getClientInfo(request: Request) {
  const ipAddress = request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown';
  const userAgent = request.headers.get('user-agent') || undefined;
  return { ipAddress, userAgent };
}

/**
 * 写入审计日志
 */
async function writeAuditLog(params: {
  action: string;
  entityType: string;
  entityId: string;
  userId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  const { userId, ...rest } = params;
  await prisma.auditLog.create({
    data: {
      ...rest,
      ...(userId ? { userId } : {}),
    } as any,
  });
}

// GET /api/products - 获取产品列表
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const status = searchParams.get('status') || '';

    const where: any = {};
    
    if (search) {
      where.OR = [
        { sku: { contains: search } },
        { name: { contains: search } },
        { nameEn: { contains: search } },
      ];
    }
    
    if (category) {
      where.category = category;
    }
    
    if (status) {
      where.status = status;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return listResponse(products, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return errorResponse('获取产品列表失败', 'INTERNAL_ERROR', 500);
  }
}

// POST /api/products - 创建产品
export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const body = await request.json();
    const v = validateOrReturn(CreateProductSchema, body);
    if (!v.success) return v.response;
    const {
      sku,
      name,
      nameEn,
      categoryId,
      specification,
      unit,
      costPrice,
      salePrice,
      currency,
      status,
      description,
      descriptionEn,
      weight,
      volume,
      moq,
      leadTime,
      images,
      attributes: _attributes,
    } = v.data;

    const product = await prisma.product.create({
      data: {
        sku,
        name,
        nameEn,
        categoryId: categoryId || undefined,
        specification,
        unit: unit || 'PCS',
        costPrice: costPrice || 0,
        salePrice: salePrice || 0,
        currency: currency || 'USD',
        status: status || 'ACTIVE',
        description,
        descriptionEn,
        weight: weight || null,
        volume: volume || null,
        moq,
        leadTime,
        images: images || [],
      },
    });

    // 保存属性值（ProductAttributeValue）
    if (Array.isArray(_attributes) && _attributes.length > 0) {
      for (const attr of _attributes) {
        try {
          await prisma.productAttributeValue.create({
            data: {
              productId: product.id,
              attributeId: attr.attributeId,
              valueText: attr.valueText,
              valueNumber: attr.valueNumber,
              valueBoolean: attr.valueBoolean,
              valueDate: attr.valueDate,
              valueOptions: attr.valueOptions,
              unit: attr.unit,
            },
          });
        } catch (attrErr) {
          console.error(`[AttrSaveError] productId=${product.id}, attributeId=${attr.attributeId}, valueOptions=${JSON.stringify(attr.valueOptions)}:`, attrErr);
          throw attrErr; // 重新抛出让外层 catch 处理
        }
      }
    }

    // 记录创建产品审计日志
    const { ipAddress, userAgent } = getClientInfo(request);
    await writeAuditLog({
      action: 'CREATE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: product.id,
      userId: session.id,
      details: { sku: product.sku, name: product.name },
      ipAddress,
      userAgent,
    });

    return createdResponse(product, '产品创建成功');
  } catch (error) {
    console.error('Error creating product:', error);
    return errorResponse('创建产品失败', 'INTERNAL_ERROR', 500);
  }
}
