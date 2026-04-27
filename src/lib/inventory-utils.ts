/**
 * 库存工具函数
 *
 * 提供 availableQty 的动态计算，避免手动维护 availableQty 字段导致不一致。
 *
 * 计算公式：availableQty = quantity - reservedQty
 * - quantity: 实际库存数量（入库增加，出库发货后减少）
 * - reservedQty: 已预留数量（出库单创建时预留，发货/取消时释放）
 *
 * 使用动态计算而非手动维护 availableQty 字段，
 * 杜绝多处手动 increment/decrement 导致的数据不一致问题。
 */

import { prisma } from '@/lib/prisma';

/**
 * 计算单个产品的可用库存数量
 * availableQty = quantity - reservedQty
 *
 * @param productId - 产品 ID
 * @param warehouseId - 仓库 ID
 * @returns 可用库存数量，如果库存记录不存在则返回 0
 */
export async function getAvailableQty(
  productId: string,
  warehouseId: string
): Promise<number> {
  const item = await prisma.inventoryItem.findUnique({
    where: {
      productId_warehouse: {
        productId,
        warehouse: warehouseId,
      },
    },
    select: {
      quantity: true,
      reservedQty: true,
    },
  });

  if (!item) return 0;
  return computeAvailableQty(item.quantity, item.reservedQty);
}

/**
 * 批量计算产品的可用库存数量
 * 用于需要同时检查多个产品库存的场景，减少数据库查询次数
 *
 * @param items - 产品-仓库配对数组
 * @returns Map<"productId:warehouseId", availableQty>
 */
export async function getAvailableQtyBatch(
  items: Array<{ productId: string; warehouseId: string }>
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  // 构建唯一的产品-仓库组合去重
  const uniqueKeys = new Set(items.map(i => `${i.productId}:${i.warehouseId}`));
  const conditions = Array.from(uniqueKeys).map(key => {
    const [productId, warehouse] = key.split(':');
    return { productId, warehouse };
  });

  const inventoryItems = await prisma.inventoryItem.findMany({
    where: { OR: conditions },
    select: {
      productId: true,
      warehouse: true,
      quantity: true,
      reservedQty: true,
    },
  });

  // 构建查找表
  const lookup = new Map<string, { quantity: number; reservedQty: number }>();
  for (const item of inventoryItems) {
    lookup.set(`${item.productId}:${item.warehouse}`, {
      quantity: item.quantity,
      reservedQty: item.reservedQty,
    });
  }

  // 计算每个请求项的可用库存
  for (const { productId, warehouseId } of items) {
    const key = `${productId}:${warehouseId}`;
    const data = lookup.get(key);
    result.set(key, data ? computeAvailableQty(data.quantity, data.reservedQty) : 0);
  }

  return result;
}

/**
 * 同步计算 availableQty（纯函数，无数据库查询）
 * 用于已有 InventoryItem 数据对象时直接计算
 *
 * @param quantity - 实际库存数量
 * @param reservedQty - 已预留数量
 * @returns 可用库存数量
 */
export function computeAvailableQty(quantity: number, reservedQty: number): number {
  return quantity - reservedQty;
}
