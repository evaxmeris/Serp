import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth-unified';
import { errorResponse, successResponse } from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import {
  generateReplenishmentSuggestions,
  OverseasWarehouseNotFoundError,
} from '@/lib/replenishment';

/**
 * 生成补货建议（幂等）
 *   POST /api/v1/replenishment/generate
 *   body: {
 *     overseasWarehouseId?,      // 海外仓 id 或 code；不传 = 全部启用中的海外仓
 *     sku?,                      // 只算某个 SKU（调试/单点重算）
 *     salesWindowDays?,          // 销量统计窗口，默认 30
 *     replenishCycleDays?,       // 补货周期，默认 30
 *     serviceLevelZ?,            // 服务水平 z 值，默认 1.28（90%）
 *     manualDailySales?,         // 无销量数据时的手工日均（降级路径）
 *     manualTargetDays?,         // 手工目标周转天数（降级路径，仅记录）
 *     leadTimeDaysOverride?      // 强制头程天数（跳过历史统计）
 *   }
 *
 * 幂等语义：同一 (sku, 海外仓) 的 PENDING 行原地刷新；建议量归零的 PENDING 行清除；
 *          APPROVED / CONVERTED / DISMISSED 永不被本接口改写。
 */

const ALLOWED_ROLES = [
  'super-admin',
  'super_admin',
  'admin',
  'ops',
  'Operator_Manager',
  'purchasing',
  'purchasing_manager',
];

const GenerateSchema = z.object({
  overseasWarehouseId: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  salesWindowDays: z.number().int().min(1).max(365).optional(),
  replenishCycleDays: z.number().int().min(1).max(365).optional(),
  serviceLevelZ: z.number().min(0).max(5).optional(),
  manualDailySales: z.number().min(0).optional(),
  manualTargetDays: z.number().int().min(1).max(365).optional(),
  leadTimeDaysOverride: z.number().min(0).max(365).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    if (!ALLOWED_ROLES.includes(session.role)) {
      return errorResponse('无权限生成补货建议（需要采购/运营/管理员角色）', 'FORBIDDEN', 403);
    }

    const body = await request.json().catch(() => ({}));
    const v = validateOrReturn(GenerateSchema, body);
    if (!v.success) return v.response;

    const result = await generateReplenishmentSuggestions({
      warehouseInput: v.data.overseasWarehouseId ?? null,
      sku: v.data.sku ?? null,
      salesWindowDays: v.data.salesWindowDays ?? null,
      replenishCycleDays: v.data.replenishCycleDays ?? null,
      serviceLevelZ: v.data.serviceLevelZ ?? null,
      manualDailySales: v.data.manualDailySales ?? null,
      manualTargetDays: v.data.manualTargetDays ?? null,
      leadTimeDaysOverride: v.data.leadTimeDaysOverride ?? null,
      operator: session.email ?? session.id,
    });

    return successResponse(
      {
        generatedAt: result.generatedAt,
        params: result.params,
        totals: result.totals,
        warehouses: result.warehouses.map(w => ({
          warehouse: w.warehouse,
          leadTime: {
            days: w.leadTime.days,
            source: w.leadTime.source,
            sampleSize: w.leadTime.sampleSize,
          },
          created: w.created,
          refreshed: w.refreshed,
          cleared: w.cleared,
          skippedDismissed: w.skippedDismissed,
          suggestionCount: w.rows.filter(r => r.suggestedQty > 0).length,
          rows: w.rows,
        })),
      },
      '补货建议生成完成'
    );
  } catch (error) {
    if (error instanceof OverseasWarehouseNotFoundError) {
      return errorResponse(error.message, 'NOT_FOUND', 404);
    }
    console.error('生成补货建议失败:', error);
    return errorResponse('生成补货建议失败');
  }
}
