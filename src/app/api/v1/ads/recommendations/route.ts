import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { hasPermission } from '@/lib/permissions';
import { listResponse, errorResponse } from '@/lib/api-response';
import { z } from 'zod';

// GET /api/v1/ads/recommendations?accountId=&page=&limit=
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return errorResponse('未登录', 'UNAUTHORIZED', 401);
  const ok = await hasPermission(user.id, 'ads:view');
  if (!ok) return errorResponse('权限不足', 'FORBIDDEN', 403);

  const sp = request.nextUrl.searchParams;
  const page = z.coerce.number().int().positive().default(1).catch(1).parse(sp.get('page'));
  const limit = z.coerce.number().int().positive().max(100).default(20).catch(20).parse(sp.get('limit'));
  const accountId = sp.get('accountId') || undefined;

  const where = { ...(accountId ? { adAccountId: accountId } : {}) };
  const [total, items] = await Promise.all([
    prisma.adRecommendation.count({ where }),
    prisma.adRecommendation.findMany({
      where,
      include: {
        report: { select: { id: true, reportType: true, startDate: true, endDate: true, fileName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return listResponse(
    items.map(r => {
      const result = (r.result ?? {}) as { degraded?: boolean; summary?: unknown };
      return {
        id: r.id,
        version: r.version,
        createdAt: r.createdAt,
        report: r.report,
        summary: result.summary ?? null,
        degraded: result.degraded ?? false,
      };
    }),
    { page, limit, total, totalPages: Math.ceil(total / limit) },
  );
}
