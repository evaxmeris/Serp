import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth-unified';
import { successResponse, errorResponse, notFoundResponse, conflictResponse } from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import {
  dismissSuggestion,
  ReplenishmentSuggestionNotFoundError,
  ReplenishmentSuggestionStateError,
} from '@/lib/replenishment-convert';

/**
 * 忽略补货建议
 *   POST /api/v1/replenishment/suggestions/[id]/dismiss
 *   body: { reason?: string }
 *
 * PENDING/APPROVED → DISMISSED（终态）。已转单/已忽略 → 409。
 */

const ALLOWED_ROLES = [
  'super-admin',
  'super_admin',
  'admin',
  'ops',
  'Operator_Manager',
  'purchasing',
  'purchasing_manager',
  'warehouse',
  'warehouse_manager',
];

const DismissSchema = z.object({
  reason: z.string().max(500).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    if (!ALLOWED_ROLES.includes(session.role)) {
      return errorResponse('无权限忽略补货建议', 'FORBIDDEN', 403);
    }

    const { id } = await params;
    if (!id || typeof id !== 'string' || id.length < 1) {
      return errorResponse('建议 ID 不能为空', 'VALIDATION_ERROR', 422);
    }

    const body = await request.json().catch(() => ({}));
    const v = validateOrReturn(DismissSchema, body);
    if (!v.success) return v.response;

    const updated = await dismissSuggestion({
      id,
      reason: v.data.reason ?? null,
      operatorId: session.email ?? session.id,
    });

    return successResponse(updated, '补货建议已忽略');
  } catch (error) {
    if (error instanceof ReplenishmentSuggestionNotFoundError) {
      return notFoundResponse('补货建议');
    }
    if (error instanceof ReplenishmentSuggestionStateError) {
      return conflictResponse(error.message, 'INVALID_STATE');
    }
    console.error('忽略补货建议失败:', error);
    return errorResponse('忽略补货建议失败');
  }
}
