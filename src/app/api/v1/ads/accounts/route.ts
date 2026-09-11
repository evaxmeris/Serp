import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { hasPermission } from '@/lib/permissions';
import {
  listResponse,
  createdResponse,
  errorResponse,
  forbiddenResponse,
  notFoundResponse,
  conflictResponse,
} from '@/lib/api-response';
import { withValidation } from '@/lib/api-validation';
import { z } from 'zod';
import { encrypt } from '@/lib/crypto-utils';
import { maskCredential } from '@/lib/ads/mask';
import { writeAdsAuditLog } from '@/lib/ads/audit';

// ──────────────────────────────────────────────────────────────
// Zod 校验（BE 设计 §4.1/§4.2，B1：禁用 z.coerce.boolean()）
// ──────────────────────────────────────────────────────────────

const AccountsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).catch(1),
  limit: z.coerce.number().int().positive().max(100).default(20).catch(20),
  search: z.string().max(100).optional(),
  // ⚠️ 禁止 z.coerce.boolean()（Boolean('false') === true 陷阱），enum+transform
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

const CreateAdAccountSchema = z.object({
  marketplaceId: z.string().min(1, 'marketplaceId 不能为空'),
  name: z.string().min(1, '账户名不能为空').max(100, '账户名最长 100 字'),
  externalId: z.string().max(100).optional().nullable(),
  clientId: z.string().max(500).optional().nullable(), // 非空即加密
  clientSecret: z.string().max(2000).optional().nullable(), // 非空即加密
  refreshToken: z.string().max(2000).optional().nullable(), // 非空即加密
  platformAccountId: z.string().max(100).optional().nullable(), // 订单域弱引用，不建 FK
  isActive: z.boolean().default(true),
  // D6 引擎参数：内层 .catch() 保证字段缺省/非法时容错（breakEvenAcos 默认 40）
  settings: z
    .object({
      breakEvenAcos: z.coerce.number().min(0).max(100).catch(40),
      negateClicks: z.coerce.number().int().min(0).nullable().catch(null), // null=动态计算（AC-4）
      stopSpend: z.coerce.number().min(0).nullable().catch(null), // null=动态计算（AC-4）
    })
    .default(() => ({ breakEvenAcos: 40, negateClicks: null, stopSpend: null })),
});

// ──────────────────────────────────────────────────────────────
// 账户脱敏序列化（§17-9：凭据一律 ****后4位 或 ''，任何角色不可回读明文 AC-7）
// ──────────────────────────────────────────────────────────────

type AccountWithMarketplace = {
  id: string;
  platformCode: string;
  marketplaceId: string;
  marketplace: { code: string; name: string; currency: string; adEndpoint: string | null } | null;
  name: string;
  externalId: string | null;
  clientId: string | null;
  clientSecret: string | null;
  refreshToken: string | null;
  platformAccountId: string | null;
  isActive: boolean;
  settings: unknown;
  createdAt: Date;
};

function maskAccount(a: AccountWithMarketplace) {
  return {
    id: a.id,
    platformCode: a.platformCode,
    marketplaceId: a.marketplaceId,
    marketplace: a.marketplace
      ? {
          code: a.marketplace.code,
          name: a.marketplace.name,
          currency: a.marketplace.currency,
          adEndpoint: a.marketplace.adEndpoint,
        }
      : null,
    name: a.name,
    externalId: a.externalId,
    clientId: maskCredential(a.clientId),
    clientSecret: maskCredential(a.clientSecret),
    refreshToken: maskCredential(a.refreshToken),
    platformAccountId: a.platformAccountId,
    isActive: a.isActive,
    settings: a.settings,
    createdAt: a.createdAt,
  };
}

/** 认证 + 权限前置（BE 设计 §3.4） */
async function requirePermission(request: NextRequest, code: string) {
  const session = await getUserFromRequest(request);
  if (!session) return { error: errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401) };
  const ok = await hasPermission(session.id, code);
  if (!ok) return { error: forbiddenResponse() };
  return { session };
}

// GET /api/v1/ads/accounts — 账户列表（ads:view，含 marketplace join + 凭据脱敏）
export const GET = withValidation(
  { query: AccountsQuerySchema },
  async (request, { query }) => {
    try {
      const auth = await requirePermission(request, 'ads:view');
      if (auth.error) return auth.error;

      const where: any = {
        deletedAt: null, // 软删除过滤（B12）
        ...(query.active !== undefined && { isActive: query.active }),
        ...(query.search && {
          OR: [{ name: { contains: query.search } }, { externalId: { contains: query.search } }],
        }),
      };

      const [accounts, total] = await Promise.all([
        prisma.adAccount.findMany({
          where,
          include: { marketplace: { select: { code: true, name: true, currency: true, adEndpoint: true } } },
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        prisma.adAccount.count({ where }),
      ]);

      // 凭据一律 maskCredential() 后回显，密文/明文不出接口（§9.2/§9.3 双保险）
      const items = accounts.map((a) => maskAccount(a as AccountWithMarketplace));
      return listResponse(items, {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      });
    } catch (error) {
      console.error('获取广告账户列表失败:', error);
      return errorResponse('获取广告账户列表失败', 'INTERNAL_ERROR', 500);
    }
  }
);

// POST /api/v1/ads/accounts — 创建账户（ads:admin，凭据 AES-256-GCM 加密写入）
export const POST = withValidation(
  { body: CreateAdAccountSchema },
  async (request, { body }) => {
    try {
      const auth = await requirePermission(request, 'ads:admin');
      if (auth.error) return auth.error;
      const session = auth.session;

      // 1. 站点必须存在（§4.2 步骤 1）
      const marketplace = await prisma.adMarketplace.findUnique({
        where: { marketplaceId: body.marketplaceId },
      });
      if (!marketplace) return notFoundResponse('站点');

      // 2. 凭据非空 → encrypt()；空串/undefined → null（禁止明文落库，AC-7）
      const encryptOrNull = (v?: string | null): string | null =>
        v && v.trim() !== '' ? encrypt(v) : null;

      try {
        const account = await prisma.adAccount.create({
          data: {
            platformCode: 'amazon',
            marketplaceId: body.marketplaceId,
            name: body.name,
            externalId: body.externalId ?? null,
            clientId: encryptOrNull(body.clientId),
            clientSecret: encryptOrNull(body.clientSecret),
            refreshToken: encryptOrNull(body.refreshToken),
            platformAccountId: body.platformAccountId ?? null,
            isActive: body.isActive,
            settings: (body.settings ?? {}) as object,
          },
          include: { marketplace: { select: { code: true, name: true, currency: true, adEndpoint: true } } },
        });

        // 3. 审计：凭据只记「已加密」不记明文（§10）
        await writeAdsAuditLog({
          action: 'CREATE',
          entityType: 'AdAccount',
          entityId: account.id,
          userId: session.id,
          details: {
            name: body.name,
            marketplaceId: body.marketplaceId,
            externalId: body.externalId ?? null,
            clientId: body.clientId ? 'encrypted' : null,
            clientSecret: body.clientSecret ? 'encrypted' : null,
            refreshToken: body.refreshToken ? 'encrypted' : null,
            isActive: body.isActive,
            settings: body.settings ?? {},
          },
          request,
        });

        return createdResponse(maskAccount(account as AccountWithMarketplace), '广告账户创建成功');
      } catch (error: any) {
        // 4. 唯一冲突（platformCode+marketplaceId）→ 409（§4.2 步骤 4）
        if (error?.code === 'P2002') {
          return conflictResponse('该站点已绑定广告账户', 'CONFLICT');
        }
        throw error;
      }
    } catch (error) {
      console.error('创建广告账户失败:', error);
      return errorResponse('创建广告账户失败', 'INTERNAL_ERROR', 500);
    }
  }
);
