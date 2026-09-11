import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { hasPermission } from '@/lib/permissions';
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/api-response';
import { z } from 'zod';

/** 站点（marketplace）配置 — 亚马逊主流站点预设 + CRUD */

const MarketplaceSchema = z.object({
  code: z.string().min(2).max(10),
  name: z.string().min(1).max(50),
  marketplaceId: z.string().min(1).max(30),
  currency: z.string().min(3).max(3).default('USD'),
  adEndpoint: z.string().min(1).default('advertising-api.amazon.com'),
  isActive: z.boolean().default(true),
});

// GET /api/v1/ads/marketplaces?limit=100
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return errorResponse('未登录', 'UNAUTHORIZED', 401);
  const ok = await hasPermission(user.id, 'ads:view');
  if (!ok) return errorResponse('权限不足', 'FORBIDDEN', 403);

  const limit = z.coerce.number().int().positive().max(500).default(100).catch(100).parse(
    request.nextUrl.searchParams.get('limit'),
  );
  const items = await prisma.adMarketplace.findMany({
    where: { isActive: true },
    take: limit,
    orderBy: { code: 'asc' },
  });
  return successResponse(items);
}

// POST /api/v1/ads/marketplaces
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return errorResponse('未登录', 'UNAUTHORIZED', 401);
  const ok = await hasPermission(user.id, 'ads:admin');
  if (!ok) return errorResponse('权限不足', 'FORBIDDEN', 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('请求体不是合法 JSON', 'INVALID_JSON', 400);
  }
  const v = MarketplaceSchema.safeParse(body);
  if (!v.success) return validationErrorResponse(v.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })));

  try {
    const item = await prisma.adMarketplace.create({ data: v.data });
    return successResponse(item, '站点创建成功');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Unique')) return errorResponse('站点 code 已存在', 'CONFLICT', 409);
    return errorResponse('创建失败：' + msg.slice(0, 200), 'DB_ERROR', 500);
  }
}
