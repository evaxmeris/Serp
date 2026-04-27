/**
 * 行级过滤工具 - 为不同实体类型统一应用 getRowLevelFilter
 * 
 * PERM-005: 在 customers/suppliers/inquiries/purchases/orders 列表查询中统一应用行级过滤
 * 
 * @module lib/row-level-filter
 * @created 2026-04-27
 */

/**
 * 简化用户对象（兼容 getUserFromRequest 返回的格式）
 */
export interface SimpleUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

/**
 * 支持的实体类型
 */
export type EntityType = 'customer' | 'supplier' | 'inquiry' | 'purchase' | 'order';

/**
 * 实体字段映射：将通用的行级过滤映射到各实体的具体字段
 * - customer/supplier: 使用 ownerId 字段
 * - inquiry: 通过关联的 customer.ownerId 过滤
 * - purchase: 使用 purchaserId 字段
 * - order: 使用 salesRepId 字段
 */
const ENTITY_FIELD_MAP: Record<EntityType, (userId: string) => Record<string, any>> = {
  customer: (userId) => ({ ownerId: userId }),
  supplier: (userId) => ({ ownerId: userId }),
  inquiry: (userId) => ({ customer: { ownerId: userId } }),
  purchase: (userId) => ({ purchaserId: userId }),
  order: (userId) => ({ salesRepId: userId }),
};

/**
 * 统一应用行级过滤到查询条件
 * 
 * ADMIN 用户无限制，可以查看所有数据
 * 普通用户只能查看自己负责的数据
 * 
 * @param user 当前用户对象（需包含 id 和 role）
 * @param entityType 实体类型
 * @param existingWhere 现有的 where 查询条件（可选）
 * @returns 合并了行级过滤的查询条件
 * 
 * @example
 * ```typescript
 * const currentUser = await getUserFromRequest(request);
 * const where = applyRowLevelFilter(currentUser, 'customer', { status: 'ACTIVE' });
 * const customers = await prisma.customer.findMany({ where });
 * ```
 */
export function applyRowLevelFilter(
  user: SimpleUser | null | undefined,
  entityType: EntityType,
  existingWhere: Record<string, any> = {}
): Record<string, any> {
  // 未认证用户不添加过滤（调用方应先检查认证）
  if (!user) {
    return existingWhere;
  }

  // ADMIN 角色无限制，返回原始条件
  if (user.role === 'ADMIN') {
    return existingWhere;
  }

  // 普通用户：获取实体对应的字段映射
  const filterField = ENTITY_FIELD_MAP[entityType](user.id);
  
  // 合并现有条件和行级过滤条件
  return { ...existingWhere, ...filterField };
}
