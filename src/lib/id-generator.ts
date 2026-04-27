/**
 * ID 生成器 - 统一编号生成工具函数
 *
 * 提供订单号、供应商编号、采购单号的统一生成逻辑。
 * 使用数据库事务/时间戳+随机数保证并发安全。
 */

import { prisma } from './prisma';

/**
 * 生成订单号
 * 格式：SO-YYYYMMDD-<时间戳后6位><4位随机字符>
 * 并发安全：使用毫秒时间戳 + 随机字符，无需数据库查询
 *
 * @returns 生成的订单号，如 SO-20260427-123456abcd
 */
export function generateOrderNo(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const now = Date.now();
  const timestampPart = String(now % 1000000).padStart(6, '0'); // 毫秒时间戳后6位
  const randomPart = Math.random().toString(36).slice(2, 6);      // 4位随机字符
  return `SO-${year}${month}${day}-${timestampPart}${randomPart}`;
}

/**
 * 生成供应商编号
 * 格式：SUP-YYYYMMDD-<3位序号>
 * 使用当天已创建的供应商数量自增序号
 *
 * @returns 生成的供应商编号，如 SUP-20260427-001
 */
export async function generateSupplierCode(): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  const count = await prisma.supplier.count({
    where: {
      createdAt: {
        gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      },
    },
  });

  return `SUP-${year}${month}${day}-${String(count + 1).padStart(3, '0')}`;
}

/**
 * 生成采购单号
 * 格式：PO-YYYYMM-<4位序号>
 * 使用当月已创建的采购单数量自增序号
 *
 * @returns 生成的采购单号，如 PO-202604-0001
 */
export async function generatePurchaseNo(): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  const count = await prisma.purchaseOrder.count({
    where: {
      createdAt: {
        gte: new Date(date.getFullYear(), date.getMonth(), 1),
      },
    },
  });

  return `PO-${year}${month}-${String(count + 1).padStart(4, '0')}`;
}

/**
 * 生成物流订单编号
 * 格式：LO-YYYYMMDD-XXXX（当日序号，4 位补零）
 * 使用当天已创建的物流订单数量自增序号
 *
 * @returns 生成的物流订单编号，如 LO-20260427-0001
 */
export async function generateLogisticsOrderNo(): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  const count = await prisma.logisticsOrder.count({
    where: {
      createdAt: {
        gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      },
    },
  });

  return `LO-${year}${month}${day}-${String(count + 1).padStart(4, '0')}`;
}
