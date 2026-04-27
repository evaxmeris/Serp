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

// 软删除中间件 — 自动过滤已删除记录 + 将 delete 转为软删除 + 子记录过滤已删除父记录
// 使用 try-catch 包裹，避免 Next.js build 阶段 Prisma 未初始化时报错

// ============================================================
// 辅助函数：构建嵌套关系过滤条件（支持 a.b.c 点号路径）
// ============================================================
function buildNestedFilter(path: string, value: any): any {
  const parts = path.split('.');
  if (parts.length === 1) {
    return { [path]: value };
  }
  return { [parts[0]]: buildNestedFilter(parts.slice(1).join('.'), value) };
}

// ============================================================
// 子模型 → 父模型（有软删除）映射
// 当查询子模型时，自动过滤已软删除的父记录
// relationField: Prisma 关系字段名（支持 a.b 点号用于传递过滤）
// fkField: 数据库外键列名（用于可选关系 IS NULL 检查）
// isOptional: 外键是否允许 null（可选关系需要 OR [fk IS NULL, parent.deletedAt IS NULL]）
// ============================================================
const childParentSoftDeleteMap: Record<string, Array<{
  relationField: string;
  fkField: string;
  isOptional: boolean;
}>> = {
  // ========== Order 的子记录（Order 有 deletedAt） ==========
  'OrderItem': [
    { relationField: 'order',           fkField: 'orderId',        isOptional: false },
    { relationField: 'product',         fkField: 'productId',      isOptional: true  },
  ],
  'ProductionRecord': [
    { relationField: 'order',           fkField: 'orderId',        isOptional: false },
  ],
  'QualityCheck': [
    { relationField: 'order',           fkField: 'orderId',        isOptional: false },
  ],
  'Payment': [
    { relationField: 'order',           fkField: 'orderId',        isOptional: false },
  ],
  'Shipment': [
    { relationField: 'order',           fkField: 'orderId',        isOptional: false },
  ],
  'OutboundOrder': [
    { relationField: 'order',           fkField: 'orderId',        isOptional: false },
  ],

  // ========== Customer 的子记录（Customer 有 deletedAt） ==========
  'CustomerContact': [
    { relationField: 'customer',        fkField: 'customerId',     isOptional: false },
  ],

  // ========== Supplier 的子记录（Supplier 有 deletedAt） ==========
  'SupplierContact': [
    { relationField: 'supplier',        fkField: 'supplierId',     isOptional: false },
  ],
  'SupplierEvaluation': [
    { relationField: 'supplier',        fkField: 'supplierId',     isOptional: false },
  ],

  // ========== Quotation 的子记录（Quotation 有 deletedAt） ==========
  'QuotationItem': [
    { relationField: 'quotation',       fkField: 'quotationId',    isOptional: false },
    { relationField: 'product',         fkField: 'productId',      isOptional: true  },
  ],

  // ========== Inquiry 的子记录（Inquiry 有 deletedAt） ==========
  'FollowUp': [
    { relationField: 'inquiry',         fkField: 'inquiryId',      isOptional: false },
  ],

  // ========== PurchaseOrder 的子记录（PurchaseOrder 有 deletedAt） ==========
  'PurchaseOrderItem': [
    { relationField: 'purchaseOrder',   fkField: 'purchaseOrderId', isOptional: false },
    { relationField: 'product',         fkField: 'productId',       isOptional: true  },
  ],
  'PurchaseReceipt': [
    { relationField: 'purchaseOrder',   fkField: 'purchaseOrderId', isOptional: false },
  ],
  'SupplierPayment': [
    { relationField: 'purchaseOrder',   fkField: 'purchaseOrderId', isOptional: false },
  ],

  // ========== Product 的子记录（Product 有 deletedAt） ==========
  'InventoryItem': [
    { relationField: 'product',         fkField: 'productId',      isOptional: false },
  ],
  'InventoryLog': [
    { relationField: 'product',         fkField: 'productId',      isOptional: false },
  ],
  'InboundOrderItem': [
    { relationField: 'product',         fkField: 'productId',      isOptional: false },
  ],
  'OutboundOrderItem': [
    { relationField: 'product',         fkField: 'productId',      isOptional: false },
    // 传递过滤：OutboundOrder → Order（Order 有 deletedAt）
    { relationField: 'outboundOrder.order', fkField: '',           isOptional: false },
  ],
};

// ============================================================
// 查询操作类型（需要注入过滤条件的操作）
// ============================================================
const queryActions = ['findUnique', 'findFirst', 'findMany', 'count'];

try {
  const softDeleteModels = ['Customer', 'Supplier', 'Product', 'Order', 'Quotation', 'Inquiry', 'PurchaseOrder'];
  
  // @ts-ignore - $use exists on PrismaClient but not in types for Prisma 6
  if (typeof prismaInstance.$use === 'function') {
    // @ts-ignore
    prismaInstance.$use(async (params: any, next: any) => {
      // ============================================================
      // 第一步：处理自身有 deletedAt 的软删除模型
      // ============================================================
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

      // ============================================================
      // 第二步：子记录查询 → 自动过滤已软删除的父记录
      // 例如: 查询 OrderItem 时自动排除已删除 Order 的记录
      // ============================================================
      const parentRelations = childParentSoftDeleteMap[params.model];
      if (parentRelations && queryActions.includes(params.action)) {
        // 允许通过 includeDeletedParents 标志跳过父记录过滤
        const includeDeletedParents = params.args?.includeDeletedParents === true;
        if (!includeDeletedParents) {
          const parentFilters: any[] = [];
          
          for (const rel of parentRelations) {
            if (rel.isOptional) {
              // 可选外键: (fk IS NULL) OR (parent.deletedAt IS NULL)
              parentFilters.push({
                OR: [
                  { [rel.fkField]: null },
                  buildNestedFilter(rel.relationField, { deletedAt: null }),
                ],
              });
            } else {
              // 必填外键: parent.deletedAt IS NULL
              parentFilters.push(
                buildNestedFilter(rel.relationField, { deletedAt: null })
              );
            }
          }

          // 合并到现有 where 条件（使用 AND 包裹以避免覆盖用户条件）
          if (parentFilters.length > 0) {
            const existingWhere = params.args?.where || {};
            // 如果 existingWhere 为空对象，直接使用 parentFilters
            // 否则用 AND 包裹
            const hasExistingConditions = Object.keys(existingWhere).length > 0;
            if (hasExistingConditions) {
              params.args = {
                ...params.args,
                where: {
                  AND: [existingWhere, ...parentFilters],
                },
              };
            } else {
              // 单个 parentFilter 直接使用；多个则用 AND
              params.args = {
                ...params.args,
                where: parentFilters.length === 1
                  ? parentFilters[0]
                  : { AND: parentFilters },
              };
            }
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
