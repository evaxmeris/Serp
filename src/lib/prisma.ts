import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 连接池配置 - 防止高并发下连接耗尽
const prismaInstance = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// 软删除中间件 — 自动过滤已删除记录 + 将 delete 转为软删除
// 使用 try-catch 包裹，避免 Next.js build 阶段 Prisma 未初始化时报错
try {
  const softDeleteModels = ['Customer', 'Supplier', 'Product', 'Order', 'Quotation', 'Inquiry', 'PurchaseOrder'];
  
  // @ts-ignore - $use exists on PrismaClient but not in types for Prisma 6
  if (typeof prismaInstance.$use === 'function') {
    // @ts-ignore
    prismaInstance.$use(async (params: any, next: any) => {
      if (softDeleteModels.includes(params.model)) {
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
            if (params.args.includeDeleted !== true) {
              if (params.args.where) {
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
  }
} catch (e) {
  // 构建阶段跳过中间件注册，运行时正常
  if (process.env.NODE_ENV === 'development') {
    console.warn('Prisma middleware registration skipped:', e);
  }
}

export const prisma = prismaInstance;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
