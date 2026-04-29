/**
 * 发货记录 API
 * GET  - 获取发货列表
 * POST - 新增发货记录
 * PUT  - 更新发货信息
 * DELETE - 删除发货记录（根据 id query 参数）
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-api';
import { successResponse, createdResponse, errorResponse, notFoundResponse, listResponse } from '@/lib/api-response';

// GET /api/v1/shipments
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const search = searchParams.get('search') || '';

    const where: any = {};
    if (search) {
      where.OR = [
        { shipmentNo: { contains: search } },
        { trackingNo: { contains: search } },
        { carrier: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        include: { order: { select: { id: true, orderNo: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.shipment.count({ where }),
    ]);

    return listResponse(items, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('获取发货记录失败:', error);
    return errorResponse('获取发货记录失败', 'INTERNAL_ERROR', 500);
  }
}

// POST /api/v1/shipments
export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const body = await request.json();
    const { orderId, carrier, trackingNo, etd, eta, portOfLoading, portOfDischarge,
            containerNo, sealNo, packages, grossWeight, volume, notes } = body;

    if (!orderId) return errorResponse('关联订单不能为空', 'VALIDATION_ERROR', 400);

    // 验证订单存在
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return errorResponse('关联订单不存在', 'NOT_FOUND', 404);

    // 生成发货单号
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await prisma.shipment.count({
      where: { shipmentNo: { startsWith: `SH${dateStr}` } },
    });
    const shipmentNo = `SH${dateStr}${String(count + 1).padStart(4, '0')}`;

    const shipment = await prisma.shipment.create({
      data: {
        orderId,
        shipmentNo,
        carrier: carrier || null,
        trackingNo: trackingNo || null,
        etd: etd ? new Date(etd) : null,
        eta: eta ? new Date(eta) : null,
        portOfLoading: portOfLoading || null,
        portOfDischarge: portOfDischarge || null,
        containerNo: containerNo || null,
        sealNo: sealNo || null,
        packages: packages ? parseInt(packages) : null,
        grossWeight: grossWeight ? parseFloat(grossWeight) : null,
        volume: volume ? parseFloat(volume) : null,
        notes: notes || null,
      },
      include: { order: { select: { id: true, orderNo: true } } },
    });

    return createdResponse(shipment, '发货记录创建成功');
  } catch (error) {
    console.error('创建发货记录失败:', error);
    return errorResponse('创建发货记录失败', 'INTERNAL_ERROR', 500);
  }
}

// PUT /api/v1/shipments
export async function PUT(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const body = await request.json();
    const { shipmentId, carrier, trackingNo, etd, eta, portOfLoading, portOfDischarge,
            containerNo, sealNo, packages, grossWeight, volume, notes, status } = body;

    if (!shipmentId) return errorResponse('发货记录 ID 不能为空', 'VALIDATION_ERROR', 400);

    const existing = await prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!existing) return notFoundResponse('发货记录');

    const data: any = {};
    if (carrier !== undefined) data.carrier = carrier || null;
    if (trackingNo !== undefined) data.trackingNo = trackingNo || null;
    if (etd !== undefined) data.etd = etd ? new Date(etd) : null;
    if (eta !== undefined) data.eta = eta ? new Date(eta) : null;
    if (portOfLoading !== undefined) data.portOfLoading = portOfLoading || null;
    if (portOfDischarge !== undefined) data.portOfDischarge = portOfDischarge || null;
    if (containerNo !== undefined) data.containerNo = containerNo || null;
    if (sealNo !== undefined) data.sealNo = sealNo || null;
    if (packages !== undefined) data.packages = packages ? parseInt(packages) : null;
    if (grossWeight !== undefined) data.grossWeight = grossWeight ? parseFloat(grossWeight) : null;
    if (volume !== undefined) data.volume = volume ? parseFloat(volume) : null;
    if (notes !== undefined) data.notes = notes || null;
    if (status !== undefined) data.status = status;

    const shipment = await prisma.shipment.update({
      where: { id: shipmentId },
      data,
      include: { order: { select: { id: true, orderNo: true } } },
    });

    return successResponse(shipment, '发货记录更新成功');
  } catch (error) {
    console.error('更新发货记录失败:', error);
    return errorResponse('更新发货记录失败', 'INTERNAL_ERROR', 500);
  }
}

// DELETE /api/v1/shipments
export async function DELETE(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return errorResponse('发货记录 ID 不能为空', 'VALIDATION_ERROR', 400);

    const existing = await prisma.shipment.findUnique({ where: { id } });
    if (!existing) return notFoundResponse('发货记录');

    await prisma.shipment.delete({ where: { id } });

    return successResponse(null, '发货记录删除成功');
  } catch (error) {
    console.error('删除发货记录失败:', error);
    return errorResponse('删除发货记录失败', 'INTERNAL_ERROR', 500);
  }
}
