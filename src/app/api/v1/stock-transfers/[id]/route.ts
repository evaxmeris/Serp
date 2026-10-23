import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api-response';

const INCLUDE = {
  items: { include: { product: { select: { id: true, name: true, sku: true } } } },
  fromWarehouse: { select: { id: true, code: true, name: true } },
  toWarehouse: { select: { id: true, code: true, name: true } },
  fromOverseasWarehouse: { select: { id: true, code: true, name: true, country: true } },
  toOverseasWarehouse: { select: { id: true, code: true, name: true, country: true } },
  logisticsOrder: { select: { id: true, orderNo: true, status: true, trackingNo: true } },
} as const;

/** GET /api/v1/stock-transfers/[id] — 调拨单详情 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const { id } = await params;
    const transfer = await prisma.stockTransfer.findUnique({ where: { id }, include: INCLUDE });
    if (!transfer) return notFoundResponse('调拨单');

    // 该调拨单产生过的库存流水（国内仓 + 海外仓）
    const [domesticLogs, overseasMovements] = await Promise.all([
      prisma.inventoryLog.findMany({
        where: { referenceType: 'STOCK_TRANSFER', referenceId: id },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.stockMovement.findMany({
        where: { referenceType: 'STOCK_TRANSFER', referenceId: id },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return successResponse({ ...transfer, domesticLogs, overseasMovements });
  } catch (error) {
    console.error('获取调拨单详情失败:', error);
    return errorResponse('获取调拨单详情失败');
  }
}
