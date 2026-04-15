import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// 软删除中间件 — 自动过滤已删除记录 + 将 delete 转为软删除
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(prisma as any).$use(async (params: any, next: any) => {
    // 需要软删除过滤的模型
    const softDeleteModels = ['Customer', 'Supplier', 'Product', 'Order', 'Quotation', 'Inquiry', 'PurchaseOrder'];
    
    if (softDeleteModels.includes(params.model!)) {
      // 将 delete 操作转为软删除
      if (params.action === 'delete') {
        params.action = 'update';
        params.args = { ...params.args, data: { deletedAt: new Date() } };
      }
      
      // 将 deleteMany 转为批量软删除
      if (params.action === 'deleteMany') {
        params.action = 'updateMany';
        params.args = {
          where: { ...params.args.where, deletedAt: null },
          data: { deletedAt: new Date() },
        };
      }
      
      // 查询时自动过滤已删除记录
      if (['findUnique', 'findFirst', 'findMany', 'count', 'aggregate', 'groupBy'].includes(params.action)) {
        if (params.args) {
          // 如果用户明确要求包含已删除记录，跳过过滤
          if (params.args.includeDeleted !== true) {
            if (params.args.where) {
              // 如果 where 中已有 deletedAt，不覆盖
              if (!('deletedAt' in params.args.where)) {
                params.args.where = { ...params.args.where, deletedAt: null };
              }
            } else {
              params.args.where = { deletedAt: null };
            }
          }
        } else {
          params.args = { where: { deletedAt: null } };
        }
      }
    }
    
    return next(params);
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
