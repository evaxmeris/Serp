import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import {
  listResponse,
  createdResponse,
  errorResponse,
  validationErrorResponse,
  conflictResponse,
} from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import { z } from 'zod';
import { clearWarehouseCache } from '@/lib/warehouse-resolver';

/**
 * 海外仓主数据
 *   GET  /api/v1/overseas/warehouses   列表（含在库合计）
 *   POST /api/v1/overseas/warehouses   新建（管理员）
 */

const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  type: z.enum(['FBA', 'FBN', 'SELF_OWNED', 'THIRD_PARTY']).optional(),
  country: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
});

const CreateOverseasWarehouseSchema = z.object({
  name: z.string().min(1, '仓库名称不能为空').max(120),
  code: z.string().min(1, '仓库编码不能为空').max(50),
  type: z.enum(['FBA', 'FBN', 'SELF_OWNED', 'THIRD_PARTY']),
  country: z.string().min(1, '国家不能为空').max(60),
  province: z.string().optional(),
  city: z.string().optional(),
  address: z.string().min(1, '地址不能为空').max(300),
  postcode: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  email: z.string().email('邮箱格式不正确').optional().or(z.literal('')),
  region: z.string().optional(),
  timezone: z.string().optional(),
  isActive: z.boolean().optional(),
});

const ADMIN_ROLES = ['super-admin', 'admin'];

export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const v = validateOrReturn(QuerySchema, Object.fromEntries(request.nextUrl.searchParams), 'query');
    if (!v.success) return v.response;
    const { page, limit, type, country, isActive, search } = v.data;

    const where: any = {};
    if (type) where.type = type;
    if (country) where.country = country;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.overseasWarehouse.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.overseasWarehouse.count({ where }),
    ]);

    // 在库合计（quantity 为准），一次 groupBy 取全量避免 N+1
    const ids = rows.map(r => r.id);
    const stats = ids.length
      ? await prisma.overseasInventory.groupBy({
          by: ['warehouseId'],
          where: { warehouseId: { in: ids } },
          _sum: { quantity: true, reservedQty: true },
          _count: { _all: true },
        })
      : [];
    const statMap = new Map(stats.map(s => [s.warehouseId, s]));

    const items = rows.map(r => {
      const s = statMap.get(r.id);
      return {
        ...r,
        skuCount: s?._count._all ?? 0,
        totalQuantity: s?._sum.quantity ?? 0,
        reservedQuantity: s?._sum.reservedQty ?? 0,
        availableQuantity: (s?._sum.quantity ?? 0) - (s?._sum.reservedQty ?? 0),
      };
    });

    return listResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    });
  } catch (error) {
    console.error('获取海外仓列表失败:', error);
    return errorResponse('获取海外仓列表失败');
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    if (!ADMIN_ROLES.includes(session.role)) {
      return errorResponse('权限不足：仅管理员可维护海外仓', 'FORBIDDEN', 403);
    }

    const body = await request.json().catch(() => ({}));
    const v = validateOrReturn(CreateOverseasWarehouseSchema, body);
    if (!v.success) return v.response;

    const code = v.data.code.trim().toUpperCase();
    const exists = await prisma.overseasWarehouse.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } },
      select: { id: true },
    });
    if (exists) return conflictResponse(`海外仓编码 ${code} 已存在`, 'DUPLICATE_CODE');

    const created = await prisma.overseasWarehouse.create({
      data: {
        ...v.data,
        code,
        email: v.data.email || null,
        type: v.data.type,
      },
    });

    // 海外仓编码也可能被库存归一化缓存引用，清一下本地缓存
    clearWarehouseCache();

    return createdResponse(created, '海外仓创建成功');
  } catch (error) {
    console.error('创建海外仓失败:', error);
    return errorResponse('创建海外仓失败');
  }
}
