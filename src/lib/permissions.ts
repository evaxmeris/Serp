/**
 * 权限检查工具
 * 支持基于 RBAC（基于角色的访问控制）的权限验证
 * 
 * @updated 2026-04-11 - 添加内存缓存优化性能
 */

import { prisma } from './prisma';

/**
 * 权限缓存配置
 */
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟

/**
 * 缓存项结构
 */
interface CacheItem<T> {
  data: T;
  timestamp: number;
}

/**
 * 权限缓存 - 使用 Node.js Map 实现内存缓存
 * 缓存键格式：permissions:{userId}
 */
const permissionsCache = new Map<string, CacheItem<string[]>>();

/**
 * 清理过期缓存项
 * @param userId 可选，指定清理某个用户的缓存，不传则清理所有过期缓存
 */
export function cleanupExpiredCache(userId?: string): void {
  const now = Date.now();
  
  if (userId) {
    // 清理指定用户的缓存
    const key = `permissions:${userId}`;
    const item = permissionsCache.get(key);
    if (item && now - item.timestamp > CACHE_TTL_MS) {
      permissionsCache.delete(key);
    }
  } else {
    // 清理所有过期缓存
    permissionsCache.forEach((item, key) => {
      if (now - item.timestamp > CACHE_TTL_MS) {
        permissionsCache.delete(key);
      }
    });
  }
}

/**
 * 从缓存获取用户权限
 * @param userId 用户 ID
 * @returns 权限码数组，缓存未命中返回 undefined
 */
export function getPermissionsFromCache(userId: string): string[] | undefined {
  const key = `permissions:${userId}`;
  const item = permissionsCache.get(key);
  
  if (!item) {
    return undefined;
  }
  
  // 检查是否过期
  if (Date.now() - item.timestamp > CACHE_TTL_MS) {
    permissionsCache.delete(key);
    return undefined;
  }
  
  return item.data;
}

/**
 * 将用户权限存入缓存
 * @param userId 用户 ID
 * @param permissions 权限码数组
 */
export function setPermissionsToCache(userId: string, permissions: string[]): void {
  const key = `permissions:${userId}`;
  permissionsCache.set(key, {
    data: permissions,
    timestamp: Date.now(),
  });
}

/**
 * 清理用户权限缓存
 * @param userId 用户 ID
 */
export function invalidateUserPermissionsCache(userId: string): void {
  const key = `permissions:${userId}`;
  permissionsCache.delete(key);
}

/**
 * 获取缓存统计信息（用于监控）
 */
export function getCacheStats(): {
  size: number;
  keys: string[];
} {
  cleanupExpiredCache();
  return {
    size: permissionsCache.size,
    keys: Array.from(permissionsCache.keys()),
  };
}

/**
 * 获取用户的所有权限码（带缓存优化）
 * @param userId 用户 ID
 * @returns 权限码数组
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  // 1. 先尝试从缓存获取
  const cachedPermissions = getPermissionsFromCache(userId);
  if (cachedPermissions) {
    return cachedPermissions;
  }
  
  // 2. 缓存未命中，从数据库查询
  // 从用户角色关联表获取用户的所有角色
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  // 如果用户没有分配角色，检查旧的角色字段（向后兼容）
  if (userRoles.length === 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user) {
      const permissions = getDefaultPermissionsForRole(user.role);
      // 存入缓存
      setPermissionsToCache(userId, permissions);
      return permissions;
    }
    const emptyPermissions: string[] = [];
    setPermissionsToCache(userId, emptyPermissions);
    return emptyPermissions;
  }

  // 汇总所有权限
  const permissions = userRoles.flatMap(ur =>
    ur.role.permissions.map(rp => rp.permission.code)
  );

  // 去重
  const uniquePermissions = [...new Set(permissions)];
  
  // 3. 存入缓存
  setPermissionsToCache(userId, uniquePermissions);
  
  return uniquePermissions;
}

/**
 * 检查用户是否有指定权限（带缓存优化）
 * @param userId 用户 ID
 * @param permission 权限码
 * @returns 是否有权限
 */
export async function hasPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  // ADMIN 用户拥有所有权限（快速路径，不查库）
  // 注意：这里为了性能牺牲了一点点准确性，如果需要精确判断，应该先查用户信息
  const cachedPermissions = getPermissionsFromCache(userId);
  if (cachedPermissions?.includes('*')) {
    return true;
  }
  
  // 检查缓存中是否有该权限
  if (cachedPermissions) {
    // 直接匹配
    if (cachedPermissions.includes(permission)) {
      return true;
    }
    
    // PERM-004: 通配符匹配 — 统一使用冒号分隔格式 module:action
    // 如 customer:* 匹配 customer:list, customer:create 等
    const permissionParts = permission.split(':');
    const module = permissionParts[0];
    if (cachedPermissions.includes(`${module}:*`)) {
      return true;
    }
    
    return false;
  }
  
  // 缓存未命中，需要查询数据库
  // ADMIN 用户拥有所有权限
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (user?.role === 'ADMIN') {
    return true;
  }

  const permissions = await getUserPermissions(userId);

  // 直接匹配
  if (permissions.includes(permission)) {
    return true;
  }

  // PERM-004: 通配符匹配 — 统一使用冒号分隔格式
  const permissionParts2 = permission.split(':');
  const module2 = permissionParts2[0];

  if (permissions.includes(`${module2}:*`)) {
    return true;
  }

  return false;
}

/**
 * 检查用户是否拥有任意一个权限
 * @param userId 用户 ID
 * @param permissions 权限码数组
 * @returns 是否有任意一个权限
 */
export async function hasAnyPermission(
  userId: string,
  permissions: string[]
): Promise<boolean> {
  for (const permission of permissions) {
    if (await hasPermission(userId, permission)) {
      return true;
    }
  }
  return false;
}

/**
 * 检查用户是否拥有所有权限
 * @param userId 用户 ID
 * @param permissions 权限码数组
 * @returns 是否拥有所有权限
 */
export async function hasAllPermissions(
  userId: string,
  permissions: string[]
): Promise<boolean> {
  for (const permission of permissions) {
    if (!(await hasPermission(userId, permission))) {
      return false;
    }
  }
  return true;
}

/**
 * 向后兼容：为旧的单角色系统获取默认权限
 * @param role 角色名
 * @returns 默认权限列表
 */
function getDefaultPermissionsForRole(role: string): string[] {
  // PERM-004: 统一使用冒号分隔格式 module:action
  switch (role) {
    case 'ADMIN':
      return ['*'];
    case 'SALES':
      return [
        'customer:list', 'customer:create', 'customer:edit',
        'quotation:list', 'quotation:create', 'quotation:edit',
        'order:list', 'order:create', 'order:edit',
        'inquiry:list', 'inquiry:create', 'inquiry:edit',
      ];
    case 'PURCHASING':
      return [
        'supplier:list', 'supplier:create', 'supplier:edit',
        'purchase:list', 'purchase:create', 'purchase:edit',
        'inventory:list',
      ];
    case 'WAREHOUSE':
      return [
        'inventory:list', 'inventory:edit',
        'inbound:list', 'inbound:edit',
        'outbound:list', 'outbound:edit',
        'product:list',
      ];
    case 'VIEWER':
      return [
        'customer:list', 'product:list', 'order:list',
        'quotation:list', 'supplier:list', 'inventory:list',
      ];
    default:
      return [];
  }
}

/**
 * 初始化默认权限数据
 * 根据现有的模块创建标准权限点
 */
export async function initDefaultPermissions() {
  // PERM-004: 统一使用冒号分隔格式 module:action
  const defaultPermissions = [
    // 客户管理
    { name: 'customer:list', code: 'customer:list', displayName: '查看客户', module: 'customers', description: '查看客户信息' },
    { name: 'customer:create', code: 'customer:create', displayName: '创建客户', module: 'customers', description: '创建新客户' },
    { name: 'customer:edit', code: 'customer:edit', displayName: '编辑客户', module: 'customers', description: '编辑客户信息' },
    { name: 'customer:delete', code: 'customer:delete', displayName: '删除客户', module: 'customers', description: '删除客户' },

    // 产品管理
    { name: 'product:list', code: 'product:list', displayName: '查看产品', module: 'products', description: '查看产品信息' },
    { name: 'product:create', code: 'product:create', displayName: '创建产品', module: 'products', description: '创建新产品' },
    { name: 'product:edit', code: 'product:edit', displayName: '编辑产品', module: 'products', description: '编辑产品信息' },
    { name: 'product:delete', code: 'product:delete', displayName: '删除产品', module: 'products', description: '删除产品' },
    { name: 'product:import', code: 'product:import', displayName: '导入产品', module: 'products', description: '批量导入产品' },

    // 询盘管理
    { name: 'inquiry:list', code: 'inquiry:list', displayName: '查看询盘', module: 'inquiries', description: '查看询盘信息' },
    { name: 'inquiry:create', code: 'inquiry:create', displayName: '创建询盘', module: 'inquiries', description: '创建新询盘' },
    { name: 'inquiry:edit', code: 'inquiry:edit', displayName: '编辑询盘', module: 'inquiries', description: '编辑询盘信息' },
    { name: 'inquiry:delete', code: 'inquiry:delete', displayName: '删除询盘', module: 'inquiries', description: '删除询盘' },

    // 报价管理
    { name: 'quotation:list', code: 'quotation:list', displayName: '查看报价', module: 'quotations', description: '查看报价信息' },
    { name: 'quotation:create', code: 'quotation:create', displayName: '创建报价', module: 'quotations', description: '创建新报价' },
    { name: 'quotation:edit', code: 'quotation:edit', displayName: '编辑报价', module: 'quotations', description: '编辑报价信息' },
    { name: 'quotation:delete', code: 'quotation:delete', displayName: '删除报价', module: 'quotations', description: '删除报价' },
    { name: 'quotation:send', code: 'quotation:send', displayName: '发送报价', module: 'quotations', description: '发送报价给客户' },

    // 订单管理
    { name: 'order:list', code: 'order:list', displayName: '查看订单', module: 'orders', description: '查看订单信息' },
    { name: 'order:create', code: 'order:create', displayName: '创建订单', module: 'orders', description: '创建新订单' },
    { name: 'order:edit', code: 'order:edit', displayName: '编辑订单', module: 'orders', description: '编辑订单信息' },
    { name: 'order:delete', code: 'order:delete', displayName: '删除订单', module: 'orders', description: '删除订单' },
    { name: 'order:approve', code: 'order:approve', displayName: '审批订单', module: 'orders', description: '审批订单' },

    // 供应商管理
    { name: 'supplier:list', code: 'supplier:list', displayName: '查看供应商', module: 'suppliers', description: '查看供应商信息' },
    { name: 'supplier:create', code: 'supplier:create', displayName: '创建供应商', module: 'suppliers', description: '创建新供应商' },
    { name: 'supplier:edit', code: 'supplier:edit', displayName: '编辑供应商', module: 'suppliers', description: '编辑供应商信息' },
    { name: 'supplier:delete', code: 'supplier:delete', displayName: '删除供应商', module: 'suppliers', description: '删除供应商' },

    // 采购管理
    { name: 'purchase:list', code: 'purchase:list', displayName: '查看采购', module: 'purchases', description: '查看采购订单' },
    { name: 'purchase:create', code: 'purchase:create', displayName: '创建采购', module: 'purchases', description: '创建采购订单' },
    { name: 'purchase:edit', code: 'purchase:edit', displayName: '编辑采购', module: 'purchases', description: '编辑采购订单' },
    { name: 'purchase:delete', code: 'purchase:delete', displayName: '删除采购', module: 'purchases', description: '删除采购订单' },
    { name: 'purchase:approve', code: 'purchase:approve', displayName: '审批采购', module: 'purchases', description: '审批采购订单' },

    // 库存管理
    { name: 'inventory:list', code: 'inventory:list', displayName: '查看库存', module: 'inventory', description: '查看库存信息' },
    { name: 'inventory:adjust', code: 'inventory:adjust', displayName: '调整库存', module: 'inventory', description: '调整库存' },
    { name: 'inbound:list', code: 'inbound:list', displayName: '查看入库', module: 'inventory', description: '查看入库单' },
    { name: 'inbound:create', code: 'inbound:create', displayName: '创建入库', module: 'inventory', description: '创建入库单' },
    { name: 'outbound:list', code: 'outbound:list', displayName: '查看出库', module: 'inventory', description: '查看出库单' },
    { name: 'outbound:create', code: 'outbound:create', displayName: '创建出库', module: 'inventory', description: '创建出库单' },

    // 仓储管理
    { name: 'warehouse:list', code: 'warehouse:list', displayName: '查看仓库', module: 'warehouses', description: '查看仓库信息' },
    { name: 'warehouse:edit', code: 'warehouse:edit', displayName: '编辑仓库', module: 'warehouses', description: '编辑仓库信息' },

    // 财务
    { name: 'finance:list', code: 'finance:list', displayName: '查看财务', module: 'finance', description: '查看财务数据' },
    { name: 'finance:edit', code: 'finance:edit', displayName: '编辑财务', module: 'finance', description: '编辑财务数据' },

    // 报表
    { name: 'report:list', code: 'report:list', displayName: '查看报表', module: 'reports', description: '查看报表' },
    { name: 'report:export', code: 'report:export', displayName: '导出报表', module: 'reports', description: '导出报表' },

    // 系统设置
    { name: 'settings:list', code: 'settings:list', displayName: '查看设置', module: 'settings', description: '查看系统设置' },
    { name: 'settings:edit', code: 'settings:edit', displayName: '编辑设置', module: 'settings', description: '编辑系统设置' },
    { name: 'settings:roles', code: 'settings:roles', displayName: '角色管理', module: 'settings', description: '管理角色权限' },
    { name: 'settings:users', code: 'settings:users', displayName: '用户管理', module: 'settings', description: '管理用户' },
  ];

  // 批量创建（跳过已存在的）
  for (const perm of defaultPermissions) {
    const existing = await prisma.permission.findUnique({
      where: { code: perm.code },
    });
    if (!existing) {
      await prisma.permission.create({ data: perm });
    }
  }

  // 初始化默认角色
  const defaultRoles = [
    { name: 'ADMIN', code: 'ADMIN', displayName: '管理员', description: '系统管理员，拥有所有权限', isSystem: true },
    { name: 'SALES', code: 'SALES', displayName: '业务员', description: '负责客户、报价、订单业务', isSystem: true },
    { name: 'PURCHASING', code: 'PURCHASING', displayName: '采购员', description: '负责供应商、采购、入库', isSystem: true },
    { name: 'WAREHOUSE', code: 'WAREHOUSE', displayName: '仓管员', description: '负责出入库、库存管理', isSystem: true },
    { name: 'VIEWER', code: 'VIEWER', displayName: '访客', description: '只读访问权限', isSystem: true },
  ];

  for (const role of defaultRoles) {
    const existing = await prisma.role.findUnique({
      where: { name: role.name },
    });
    if (!existing) {
      await prisma.role.create({ data: role });
    }
  }

  return {
    permissionsCreated: defaultPermissions.length,
    rolesCreated: defaultRoles.length,
  };
}
