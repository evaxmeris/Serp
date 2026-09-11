import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { hasPermission } from '@/lib/permissions';
import {
  successResponse,
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
// Zod 校验（BE 设计 §4.3：UpdateAdAccountSchema = Create.partial()）
// ──────────────────────────────────────────────────────────────

const UpdateAdAccountSchema = z
  .object({
    marketplaceId: z.string().min(1, 'marketplaceId 不能为空'),
    name: z.string().min(1, '账户名不能为空').max(100, '账户名最长 100 字'),
    externalId: z.string().max(100).optional().nullable(),
    clientId: z.string().max(500).optional().nullable(),
    clientSecret: z.string().max(2000).optional().nullable(),
    refreshToken: z.string().max(2000).optional().nullable(),
    platformAccountId: z.string().max(100).optional().nullable(),
    isActive: z.boolean(),
    settings: z.object({
      breakEvenAcos: z.coerce.number().min(0).max(100).catch(40),
      negateClicks: z.coerce.number().int().min(0).nullable().catch(null),
      stopSpend: z.coerce.number().min(0).nullable().catch(null),
    }),
  })
  .partial();

const AccountParamsSchema = z.object({ id: z.string().min(1, '账户 ID 不能为空') });

// ──────────────────────────────────────────────────────────────
// 账户脱敏序列化（同 accounts/route.ts，凭据一律 ****后4位）
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

async function requirePermission(request: NextRequest, code: string) {
  const session = await getUserFromRequest(request);
  if (!session) return { error: errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401) };
  const ok = await hasPermission(session.id, code);
  if (!ok) return { error: forbiddenResponse() };
  return { session };
}

/**
 * 凭据更新语义（架构 §4.3 / BE 设计 §4.3）：
 *  - undefined / 空串 → 保持不变（不允许传空串覆盖）
 *  - null          → 显式清空
 *  - 非空串        → 重新加密
 */
function resolveCredential(input: string | null | undefined): string | null | undefined {
  if (input === undefined || input === '') return undefined;
  if (input === null) return null;
  return encrypt(input);
}

// PUT /api/v1/ads/accounts/[id] — 更新账户（ads:admin，凭据重加密 + 脱敏回显）
export const PUT = withValidation(
  { body: UpdateAdAccountSchema, params: AccountParamsSchema },
  async (request, { body, params }) => {
    try {
      const auth = await requirePermission(request, 'ads:admin');
      if (auth.error) return auth.error;
      const session = auth.session;

      // 1. 存在性校验（含软删除，B12）
      const prev = await prisma.adAccount.findUnique({
        where: { id: params.id },
        include: { marketplace: { select: { code: true, name: true, currency: true, adEndpoint: true } } },
      });
      if (!prev || prev.deletedAt) return notFoundResponse('广告账户');

      // 2. 若变更 marketplaceId，需校验新站点存在
      if (body.marketplaceId && body.marketplaceId !== prev.marketplaceId) {
        const marketplace = await prisma.adMarketplace.findUnique({
          where: { marketplaceId: body.marketplaceId },
        });
        if (!marketplace) return notFoundResponse('站点');
      }

      // 3. 组装 update data（只包含 body 出现的字段；凭据按语义处理）
      const data: any = {};
      if (body.marketplaceId !== undefined) data.marketplaceId = body.marketplaceId;
      if (body.name !== undefined) data.name = body.name;
      if (body.externalId !== undefined) data.externalId = body.externalId;
      if (body.platformAccountId !== undefined) data.platformAccountId = body.platformAccountId;
      if (body.isActive !== undefined) data.isActive = body.isActive;
      if (body.settings !== undefined) data.settings = body.settings as object;

      const credChange = {
        clientId: resolveCredential(body.clientId),
        clientSecret: resolveCredential(body.clientSecret),
        refreshToken: resolveCredential(body.refreshToken),
      };
      if (credChange.clientId !== undefined) data.clientId = credChange.clientId;
      if (credChange.clientSecret !== undefined) data.clientSecret = credChange.clientSecret;
      if (credChange.refreshToken !== undefined) data.refreshToken = credChange.refreshToken;

      try {
        const account = await prisma.adAccount.update({
          where: { id: params.id },
          data,
          include: { marketplace: { select: { code: true, name: true, currency: true, adEndpoint: true } } },
        });

        // 4. 审计：记变更前后字段；凭据只记状态不记明文（§10/§9.3）
        await writeAdsAuditLog({
          action: 'UPDATE',
          entityType: 'AdAccount',
          entityId: account.id,
          userId: session.id,
          details: {
            changed: {
              marketplaceId: body.marketplaceId !== undefined ? [prev.marketplaceId, body.marketplaceId] : undefined,
              name: body.name !== undefined ? [prev.name, body.name] : undefined,
              externalId: body.externalId !== undefined ? [prev.externalId, body.externalId] : undefined,
              isActive: body.isActive !== undefined ? [prev.isActive, body.isActive] : undefined,
              settings: body.settings !== undefined ? [prev.settings, body.settings] : undefined,
            },
            credentials: {
              clientId: credChange.clientId === undefined ? 'unchanged' : credChange.clientId === null ? 'cleared' : 'updated',
              clientSecret:
                credChange.clientSecret === undefined ? 'unchanged' : credChange.clientSecret === null ? 'cleared' : 'updated',
              refreshToken:
                credChange.refreshToken === undefined ? 'unchanged' : credChange.refreshToken === null ? 'cleared' : 'updated',
            },
          },
          request,
        });

        return successResponse(maskAccount(account as AccountWithMarketplace), '广告账户更新成功');
      } catch (error: any) {
        // 唯一冲突（platformCode+marketplaceId）→ 409
        if (error?.code === 'P2002') {
          return conflictResponse('该站点已绑定广告账户', 'CONFLICT');
        }
        throw error;
      }
    } catch (error) {
      console.error('更新广告账户失败:', error);
      return errorResponse('更新广告账户失败', 'INTERNAL_ERROR', 500);
    }
  }
);

// DELETE /api/v1/ads/accounts/[id] — 删除账户（ads:admin，软删除 + 审计）
export const DELETE = withValidation(
  { params: AccountParamsSchema },
  async (request, { params }) => {
    try {
      const auth = await requirePermission(request, 'ads:admin');
      if (auth.error) return auth.error;
      const session = auth.session;

      const prev = await prisma.adAccount.findUnique({ where: { id: params.id } });
      if (!prev || prev.deletedAt) return notFoundResponse('广告账户');

      // 软删除：保留数据可追溯，标记 deletedAt
      await prisma.adAccount.update({
        where: { id: params.id },
        data: { deletedAt: new Date(), isActive: false },
      });

      await writeAdsAuditLog({
        action: 'DELETE',
        entityType: 'AdAccount',
        entityId: params.id,
        userId: session.id,
        details: { name: prev.name, marketplaceId: prev.marketplaceId },
        request,
      });

      return successResponse({ id: params.id }, '广告账户已删除');
    } catch (error) {
      console.error('删除广告账户失败:', error);
      return errorResponse('删除广告账户失败', 'INTERNAL_ERROR', 500);
    }
  }
);
