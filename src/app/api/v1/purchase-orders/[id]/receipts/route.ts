import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';
import {
  listResponse,
  createdResponse,
  errorResponse,
  successResponse,
  conflictResponse,
} from '@/lib/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);
    const { id } = await params;
    const receipts = await prisma.purchaseReceipt.findMany({
      where: { purchaseOrderId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        items: {
          include: { purchaseOrderItem: { select: { productName: true, productSku: true } } },
        },
      },
    });
    return listResponse(receipts, {
      page: 1,
      limit: 100,
      total: receipts.length,
      totalPages: 1,
    });
  } catch (e) {
    return errorResponse('获取失败', 'INTERNAL_ERROR', 500);
  }
}

/**
 * POST /api/v1/purchase-orders/[id]/receipts
 * 采购收货 — 创建收货单并自动完成入库（更新库存）
 *
 * 请求体:
 * {
 *   warehouse: string       // 入库仓库
 *   items: Array<{          // 收货明细
 *     purchaseOrderItemId: string
 *     acceptedQty: number   // 合格数量
 *     rejectedQty: number   // 不合格数量
 *     location?: string     // 库位
 *   }>
 *   notes?: string
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) return errorResponse('未认证', 'UNAUTHORIZED', 401);
    const { id } = await params;
    const body = await request.json();

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return errorResponse('请填写收货明细', 'VALIDATION_ERROR', 422);
    }
    if (!body.warehouse) {
      return errorResponse('请指定入库仓库', 'VALIDATION_ERROR', 422);
    }

    // 在事务内完成：收货登记 + 入库确认 + 库存更新 + 采购单状态推进
    const result = await prisma.$transaction(async (tx) => {
      // 1. 验证采购订单存在且状态正确
      const purchaseOrder = await tx.purchaseOrder.findUnique({
        where: { id },
        select: { id: true, poNo: true, status: true, supplierId: true },
      });
      if (!purchaseOrder) throw new Error('采购订单不存在');
      if (!['CONFIRMED', 'IN_PRODUCTION', 'READY', 'PARTIAL'].includes(purchaseOrder.status)) {
        throw new Error(`当前采购单状态 (${purchaseOrder.status}) 不允许收货`);
      }

      // 2. 验证收货商品全部属于该采购单
      const itemIds = body.items.map((i: any) => i.purchaseOrderItemId);
      const poItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: id, id: { in: itemIds } },
        select: {
          id: true,
          productId: true,
          productName: true,
          quantity: true,
          receivedQty: true,
          rejectedQty: true,
        },
      });
      if (poItems.length !== itemIds.length) {
        throw new Error('部分收货商品不属于此采购单');
      }

      // 3. 创建收货单
      const receipt = await tx.purchaseReceipt.create({
        data: {
          purchaseOrderId: id,
          warehouse: body.warehouse,
          status: 'COMPLETED',
          receiptDate: new Date(),
          notes: body.notes || null,
        },
      });

      // 4. 创建收货明细 + 更新采购明细已收数量
      for (const item of body.items) {
        const poItem = poItems.find((p) => p.id === item.purchaseOrderItemId)!;
        const newReceivedQty = poItem.receivedQty + (item.acceptedQty || 0);
        const newRejectedQty = poItem.rejectedQty + (item.rejectedQty || 0);
        const newPendingQty = Math.max(0, poItem.quantity - newReceivedQty - newRejectedQty);

        await tx.purchaseReceiptItem.create({
          data: {
            receiptId: receipt.id,
            purchaseOrderItemId: item.purchaseOrderItemId,
            quantity: (item.acceptedQty || 0) + (item.rejectedQty || 0),
            acceptedQty: item.acceptedQty || 0,
            rejectedQty: item.rejectedQty || 0,
            warehouse: body.warehouse,
            location: item.location || null,
          },
        });

        await tx.purchaseOrderItem.update({
          where: { id: item.purchaseOrderItemId },
          data: {
            receivedQty: newReceivedQty,
            rejectedQty: newRejectedQty,
            pendingQty: newPendingQty,
          },
        });
      }

      // 5. 更新库存 — 对每个合格入库的商品创建/更新 InventoryItem
      for (const item of body.items) {
        const poItem = poItems.find((p) => p.id === item.purchaseOrderItemId)!;
        const acceptedQty = item.acceptedQty || 0;
        if (acceptedQty <= 0) continue;

        // 更新或创建库存记录
        const existingInventory = await tx.inventoryItem.findUnique({
          where: {
            productId_warehouse: {
              productId: poItem.productId!,
              warehouse: body.warehouse,
            },
          },
          select: {
            id: true,
            quantity: true,
            version: true,
          },
        });

        if (existingInventory) {
          // 带乐观锁更新
          const updateResult = await tx.inventoryItem.updateMany({
            where: {
              id: existingInventory.id,
              version: existingInventory.version,
            },
            data: {
              quantity: { increment: acceptedQty },
              lastInboundDate: new Date(),
              version: { increment: 1 },
            },
          });
          if (updateResult.count === 0) {
            throw new Error(`库存数据并发冲突: ${poItem.productName}`);
          }
        } else {
          await tx.inventoryItem.create({
            data: {
              productId: poItem.productId!,
              warehouse: body.warehouse,
              quantity: acceptedQty,
              availableQty: acceptedQty,
              reservedQty: 0,
              lastInboundDate: new Date(),
            },
          });
        }

        // 获取更新后的库存记录用于日志
        const updatedInv = await tx.inventoryItem.findUnique({
          where: {
            productId_warehouse: {
              productId: poItem.productId!,
              warehouse: body.warehouse,
            },
          },
          select: { quantity: true },
        });

        // 创建库存流水
        await tx.inventoryLog.create({
          data: {
            productId: poItem.productId!,
            warehouseId: body.warehouse,
            type: 'IN',
            quantity: acceptedQty,
            beforeQuantity: existingInventory?.quantity || 0,
            afterQuantity: updatedInv?.quantity || acceptedQty,
            referenceType: 'PURCHASE_RECEIPT',
            referenceId: receipt.id,
            note: `采购收货: ${purchaseOrder.poNo} - ${poItem.productName}`,
          },
        });
      }

      // 6. 判断采购单是否全部收完，推进状态
      const allItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: id },
        select: { quantity: true, receivedQty: true, rejectedQty: true },
      });
      const allReceived = allItems.every(
        (i) => i.receivedQty + i.rejectedQty >= i.quantity
      );

      await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: allReceived ? 'RECEIVED' : 'READY',
        },
      });

      return receipt;
    });

    return createdResponse(result, '收货登记并入库成功');
  } catch (e) {
    const message = e instanceof Error ? e.message : '未知错误';
    return errorResponse(`收货失败：${message}`, 'INTERNAL_ERROR', 500);
  }
}
