import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { hasPermission } from '@/lib/permissions';
import { successResponse, errorResponse } from '@/lib/api-response';
import { z } from 'zod';

const MarketplaceUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  marketplaceId: z.string().min(1).max(30).optional(),
  currency: z.string().min(3).max(3).optional(),
  adEndpoint: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

// PUT /api/v1/ads/marketplaces/:id
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return errorResponse('未登录', 'UNAUTHORIZED', 401);
  const ok = await hasPermission(user.id, 'ads:admin');
  if (!ok) return errorResponse('权限不足', 'FORBIDDEN', 403);

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('请求体不是合法 JSON', 'INVALID_JSON', 400);
  }
  const v = MarketplaceUpdateSchema.safeParse(body);
  if (!v.success) return errorResponse('参数校验失败', 'VALIDATION_ERROR', 400);

  try {
    const item = await prisma.adMarketplace.update({ where: { id }, data: v.data });
    return successResponse(item, '站点更新成功');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Unique')) return errorResponse('marketplaceId 已存在', 'CONFLICT', 409);
    return errorResponse('更新失败：' + msg.slice(0, 200), 'DB_ERROR', 500);
  }
}

// DELETE /api/v1/ads/marketplaces/:id
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return errorResponse('未登录', 'UNAUTHORIZED', 401);
  const ok = await hasPermission(user.id, 'ads:admin');
  if (!ok) return errorResponse('权限不足', 'FORBIDDEN', 403);

  const { id } = await params;
  try {
    await prisma.adMarketplace.delete({ where: { id } });
    return successResponse({ id }, '站点删除成功');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Foreign')) return errorResponse('站点下存在账户，无法删除', 'CONFLICT', 409);
    return errorResponse('删除失败：' + msg.slice(0, 200), 'DB_ERROR', 500);
  }
}
