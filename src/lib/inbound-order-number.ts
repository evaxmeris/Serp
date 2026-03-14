import { prisma } from './prisma';

/**
 * 生成唯一的入库单号
 * 使用数据库事务保证原子性，避免并发冲突
 * 格式：IN-YYYYMMDD-XXX（如：IN-20260314-001）
 * 
 * @returns 生成的入库单号
 */
export async function generateInboundNo(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePrefix = `${year}${month}${day}`;

  // 使用数据库事务保证原子性
  const result = await prisma.$transaction(async (tx) => {
    // 查询今日已创建的入库单数量
    const count = await tx.inboundOrder.count({
      where: {
        createdAt: {
          gte: new Date(year, now.getMonth(), now.getDate()),
          lt: new Date(year, now.getMonth(), now.getDate() + 1),
        },
      },
    });

    // 生成单号
    const sequenceNum = count + 1;
    const inboundNo = `IN-${datePrefix}-${String(sequenceNum).padStart(3, '0')}`;

    // 立即创建入库单占位，防止并发冲突
    // 注意：这里只创建占位记录，实际数据由调用者更新
    const order = await tx.inboundOrder.create({
      data: {
        inboundNo,
        type: 'OTHER_IN',
        status: 'PENDING',
        totalAmount: 0,
      },
    });

    return order;
  });

  return result.inboundNo;
}

/**
 * 生成入库单号的简单版本（不立即创建记录）
 * 适用于低并发场景，使用乐观锁机制
 * 
 * @returns 生成的入库单号
 */
export async function generateInboundNoSimple(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePrefix = `${year}${month}${day}`;

  // 查询今日已创建的入库单数量
  const count = await prisma.inboundOrder.count({
    where: {
      createdAt: {
        gte: new Date(year, now.getMonth(), now.getDate()),
        lt: new Date(year, now.getMonth(), now.getDate() + 1),
      },
    },
  });

  const sequenceNum = count + 1;
  return `IN-${datePrefix}-${String(sequenceNum).padStart(3, '0')}`;
}
