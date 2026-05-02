/**
 * 质检单详情 API（单条操作）
 * GET   - 获取质检单详情（含检测项）
 * PUT   - 更新质检单（含检测项全量替换）
 * DELETE - 删除质检单（级联删除 items）
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requirePermission } from '@/middleware/auth';
import { getUserFromRequest } from '@/lib/auth-unified';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
} from '@/lib/api-response';

// GET /api/v1/quality-checks/:id
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(_request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    const { id } = await params;
    const qualityCheck = await prisma.qualityCheck.findUnique({
      where: { id },
      include: {
        order: { select: { id: true, orderNo: true } },
        items: true,
      },
    });

    if (!qualityCheck) return notFoundResponse('质检单');

    return successResponse(qualityCheck);
  } catch (error) {
    console.error('获取质检单详情失败:', error);
    return errorResponse('获取质检单详情失败', 'INTERNAL_ERROR', 500);
  }
}

// PUT /api/v1/quality-checks/:id
export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(_request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    // RBAC 权限检查：quality:edit
    const authSession = await getSession(_request);
    const permError = requirePermission(authSession!, 'quality:edit');
    if (permError) return permError;

    const { id } = await params;
    const existing = await prisma.qualityCheck.findUnique({ where: { id } });
    if (!existing) return notFoundResponse('质检单');

    const body = await _request.json();
    const { type, inspector, inspectionDate, status, passRate, defectCount,
            defectReasons, photos, report, notes, items } = body;

    const data: any = {};
    if (type !== undefined) data.type = type;
    if (inspector !== undefined) data.inspector = inspector || null;
    if (inspectionDate !== undefined) data.inspectionDate = new Date(inspectionDate);
    if (status !== undefined) data.status = status;
    if (passRate !== undefined) data.passRate = passRate ? parseFloat(passRate) : null;
    if (defectCount !== undefined) data.defectCount = defectCount !== null ? parseInt(defectCount) : null;
    if (defectReasons !== undefined) data.defectReasons = defectReasons;
    if (photos !== undefined) data.photos = photos;
    if (report !== undefined) data.report = report || null;
    if (notes !== undefined) data.notes = notes || null;

    // 如果传入了 items，执行全量替换：先删除旧 items，再创建新 items
    if (items !== undefined && Array.isArray(items)) {
      await prisma.qualityCheckItem.deleteMany({ where: { qualityCheckId: id } });
      if (items.length > 0) {
        await prisma.qualityCheckItem.createMany({
          data: items.map((item: any) => ({
            qualityCheckId: id,
            itemName: item.itemName,
            standard: item.standard || null,
            result: item.result || null,
            passed: item.passed ?? true,
          })),
        });
      }
    }

    const qualityCheck = await prisma.qualityCheck.update({
      where: { id },
      data,
      include: {
        order: { select: { id: true, orderNo: true } },
        items: true,
      },
    });

    return successResponse(qualityCheck, '质检单更新成功');
  } catch (error) {
    console.error('更新质检单失败:', error);
    return errorResponse('更新质检单失败', 'INTERNAL_ERROR', 500);
  }
}

// DELETE /api/v1/quality-checks/:id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(_request);
    if (!session) return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);

    // RBAC 权限检查：quality:delete
    const authSession = await getSession(_request);
    const permError = requirePermission(authSession!, 'quality:delete');
    if (permError) return permError;

    const { id } = await params;
    const existing = await prisma.qualityCheck.findUnique({ where: { id } });
    if (!existing) return notFoundResponse('质检单');

    // 级联删除：onDelete: Cascade 会自动删除 items
    await prisma.qualityCheck.delete({ where: { id } });

    return successResponse(null, '质检单删除成功');
  } catch (error) {
    console.error('删除质检单失败:', error);
    return errorResponse('删除质检单失败', 'INTERNAL_ERROR', 500);
  }
}
