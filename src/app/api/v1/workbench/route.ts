import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth-unified';
import { errorResponse, successResponse } from '@/lib/api-response';
import { validateOrReturn } from '@/lib/api-validation';
import { buildWorkbench } from '@/lib/workbench';

/**
 * 角色工作台
 *   GET /api/v1/workbench?role=   （role 仅管理员可用，用于 view-as 巡检）
 *
 * 按当前登录角色返回待办聚合：
 *   warehouse  ：待确认入库单 / 待发货调拨单 / 在途调拨单 / 待出库单
 *   purchasing ：待处理采购单 / 待收货采购单 / PENDING 补货建议数
 *   ops        ：对账超阈值告警数 / 平台同步失败数（近 24h）/ PENDING 补货建议数
 *   finance    ：待收款订单 / 待付供应商款 / 本月收付汇总
 *   owner/admin：今日订单数 / 库存总值 / 海外仓总可用 / 告警汇总
 *   sales      ：我的跟进中询盘 / 待报价 / 进行中订单
 *
 * 统一返回：{ role, roleDisplay, roles, todos:[{key,label,count,amount?,unit,href}], alerts, summary }
 */

const QuerySchema = z.object({
  role: z
    .enum(['owner', 'ops', 'finance', 'warehouse', 'purchasing', 'sales', 'viewer', 'admin'])
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const v = validateOrReturn(QuerySchema, Object.fromEntries(request.nextUrl.searchParams), 'query');
    if (!v.success) return v.response;

    const payload = await buildWorkbench({
      userId: session.id,
      jwtRole: session.role,
      roleOverride: v.data.role ?? null,
    });

    return successResponse(payload);
  } catch (error) {
    console.error('获取工作台数据失败:', error);
    return errorResponse('获取工作台数据失败');
  }
}
