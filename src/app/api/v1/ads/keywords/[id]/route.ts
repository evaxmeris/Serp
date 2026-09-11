import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { hasPermission } from '@/lib/permissions';
import { successResponse, errorResponse, forbiddenResponse, notFoundResponse } from '@/lib/api-response';
import { withValidation } from '@/lib/api-validation';
import { z } from 'zod';
import { AD_ACTIONS } from '@/types/ads';
import { writeAdsAuditLog } from '@/lib/ads/audit';

// ──────────────────────────────────────────────────────────────
// Zod 校验（BE 设计 §4.14：PUT /keywords/:id，ads:edit 非 admin）
// ──────────────────────────────────────────────────────────────

const KeywordParamsSchema = z.object({ id: z.string().min(1, '决策行 ID 不能为空') });

const UpdateKeywordSchema = z
  .object({
    isSelected: z.boolean().optional(),
    action: z.enum(AD_ACTIONS).optional(),
    actionBid: z.coerce.number().min(0.2).max(999).optional().nullable(), // 下限 $0.20（§4.7 铁律五）
    actionReason: z.string().min(1, '依据文字不能为空').max(1000).optional(),
  })
  .refine(
    (v) => v.isSelected !== undefined || v.action !== undefined || v.actionBid !== undefined || v.actionReason !== undefined,
    { message: '至少提交一个可更新字段' }
  );

/**
 * PUT /api/v1/ads/keywords/[id] — 勾选 / 手工覆写（ads:edit，REQ-004，非 admin）
 *
 * 更新语义（架构 §4.8 / BE 设计 §5.5，关键区分）：
 *  | 提交内容                    | 落库                     | 覆写标记            |
 *  |-----------------------------|--------------------------|---------------------|
 *  | 仅 isSelected               | 只更新 isSelected        | 不置（勾选不是覆写）|
 *  | action / actionBid          | 更新对应字段             | 置 override* + 人   |
 *  | actionReason（补填依据）     | 更新 actionReason        | 置 overriddenAt/By   |
 */
export const PUT = withValidation(
  { body: UpdateKeywordSchema, params: KeywordParamsSchema },
  async (request, { body, params }) => {
    try {
      const session = await getUserFromRequest(request);
      if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
      const ok = await hasPermission(session.id, 'ads:edit');
      if (!ok) return forbiddenResponse();

      // 1. 行存在校验（404）
      const prev = await prisma.adKeyword.findUnique({ where: { id: params.id } });
      if (!prev) return notFoundResponse('决策行');

      // 2. 组装 update data
      const data: any = {};
      if (body.isSelected !== undefined) data.isSelected = body.isSelected;
      if (body.actionReason !== undefined) data.actionReason = body.actionReason;

      // 覆写标记：action/actionBid 提交 → 置 override*；actionBid=null → 清空对应覆写
      let isOverride = false;
      if (body.action !== undefined) {
        data.overrideAction = body.action;
        isOverride = true;
      }
      if (body.actionBid !== undefined) {
        data.overrideBid = body.actionBid; // null 清空覆写 bid
        isOverride = true;
      }
      // 人工修订依据（补填"待补充"）也算手工修改，R7 留痕
      if (isOverride || body.actionReason !== undefined) {
        data.overriddenBy = session.id;
        data.overriddenAt = new Date();
      }

      // 3. 单条 update（§11.3：单语句原子）
      const updated = await prisma.adKeyword.update({
        where: { id: params.id },
        data,
      });

      // 4. 审计（R7：前后 isSelected/action/actionBid 对比，不记无关字段）
      await writeAdsAuditLog({
        action: 'UPDATE',
        entityType: 'AdKeyword',
        entityId: updated.id,
        userId: session.id,
        details: {
          before: {
            isSelected: prev.isSelected,
            overrideAction: prev.overrideAction,
            overrideBid: prev.overrideBid,
            actionReason: prev.actionReason,
          },
          after: {
            isSelected: updated.isSelected,
            overrideAction: updated.overrideAction,
            overrideBid: updated.overrideBid,
            actionReason: updated.actionReason,
          },
        },
        request,
      });

      // 5. 返回更新后行（含派生标记，与 GET /keywords 行结构一致）
      return successResponse(
        {
          ...updated,
          isManualOverride: updated.overriddenAt != null,
          reasonPending: updated.actionReason === '待补充',
          cpa: updated.orders && updated.orders > 0 && updated.spend != null ? Number((updated.spend / updated.orders).toFixed(2)) : null,
        },
        '决策行更新成功'
      );
    } catch (error) {
      console.error('更新决策行失败:', error);
      return errorResponse('更新决策行失败', 'INTERNAL_ERROR', 500);
    }
  }
);
