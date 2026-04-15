/**
 * 软删除工具函数
 * 
 * 核心模型（Customer/Supplier/Product/Order/Quotation/Inquiry）使用软删除，
 * Prisma 中间件已自动拦截 delete → update(deletedAt)。
 * 
 * 此文件提供额外的软删除辅助功能。
 */

import { prisma } from './prisma';

/**
 * 软删除记录（通过中间件自动处理，此函数为显式调用）
 */
export async function softDelete(model: string, id: string) {
  return prisma.$executeRawUnsafe(
    `UPDATE "${model.toLowerCase()}s" SET "deletedAt" = NOW() WHERE id = $1 AND "deletedAt" IS NULL`,
    id
  );
}

/**
 * 批量软删除
 */
export async function softDeleteMany(model: string, ids: string[]) {
  if (ids.length === 0) return 0;
  return prisma.$executeRawUnsafe(
    `UPDATE "${model.toLowerCase()}s" SET "deletedAt" = NOW() WHERE id = ANY($1::uuid[]) AND "deletedAt" IS NULL`,
    ids
  );
}

/**
 * 恢复已删除记录
 */
export async function restoreSoftDelete(model: string, id: string) {
  return prisma.$executeRawUnsafe(
    `UPDATE "${model.toLowerCase()}s" SET "deletedAt" = NULL WHERE id = $1`,
    id
  );
}

/**
 * 查询已删除记录（中间件默认过滤 deleted，此函数显式查询）
 */
export async function getDeletedRecords(model: string, page = 1, limit = 20) {
  const tableName = `${model.toLowerCase()}s`;
  const offset = (page - 1) * limit;
  
  const records = await prisma.$queryRawUnsafe(
    `SELECT * FROM "${tableName}" WHERE "deletedAt" IS NOT NULL ORDER BY "deletedAt" DESC LIMIT $1 OFFSET $2`,
    limit,
    offset
  );
  
  const total = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int FROM "${tableName}" WHERE "deletedAt" IS NOT NULL`
  );
  
  return {
    records,
    pagination: {
      page,
      limit,
      total: (total as any)[0].count,
      totalPages: Math.ceil((total as any)[0].count / limit),
    },
  };
}

/**
 * 永久删除（慎用！）
 */
export async function hardDelete(model: string, id: string) {
  return prisma.$executeRawUnsafe(
    `DELETE FROM "${model.toLowerCase()}s" WHERE id = $1`,
    id
  );
}
