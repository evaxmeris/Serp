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
    console.log(`[Permissions Cache] HIT for userId: ${userId}`);
    return cachedPermissions;
  }
  
  console.log(`[Permissions Cache] MISS for userId: ${userId}, fetching from DB...`);
  
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
      console.log(`[Permissions Cache] STORED for userId: ${userId} (${permissions.length} permissions)`);
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
  console.log(`[Permissions Cache] STORED for userId: ${userId} (${uniquePermissions.length} permissions)`);
  
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
    
    // 通配符匹配：如 customers.* 匹配 customers.view
    const permissionParts = permission.split('.');
    const module = permissionParts[0];
    if (cachedPermissions.includes(`${module}.*`)) {
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

  // 通配符匹配：如 customers.* 匹配 customers.view
  const permissionParts = permission.split('.');
  const module = permissionParts[0];

  if (permissions.includes(`${module}.*`)) {
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
  switch (role) {
    case 'ADMIN':
      return ['*'];
    case 'SALES':
      return [
        'customers.view', 'customers.create', 'customers.edit',
        'quotations.view', 'quotations.create', 'quotations.edit',
        'orders.view', 'orders.create', 'orders.edit',
        'inquiries.view', 'inquiries.create', 'inquiries.edit',
      ];
    case 'PURCHASING':
      return [
        'suppliers.view', 'suppliers.create', 'suppliers.edit',
        'purchases.view', 'purchases.create', 'purchases.edit',
        'inventory.view',
      ];
    case 'WAREHOUSE':
      return [
        'inventory.view', 'inventory.edit',
        'inbound.view', 'inbound.edit',
        'outbound.view', 'outbound.edit',
        'products.view',
      ];
    case 'VIEWER':
      return [
        'customers.view', 'products.view', 'orders.view',
        'quotations.view', 'suppliers.view', 'inventory.view',
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
  const defaultPermissions = [
    // 客户管理
    { name: 'customers.view', code: 'customers.view', displayName: '查看客户', module: 'customers', description: '查看客户信息' },
    { name: 'customers.create', code: 'customers.create', displayName: '创建客户', module: 'customers', description: '创建新客户' },
    { name: 'customers.edit', code: 'customers.edit', displayName: '编辑客户', module: 'customers', description: '编辑客户信息' },
    { name: 'customers.delete', code: 'customers.delete', displayName: '删除客户', module: 'customers', description: '删除客户' },

    // 产品管理
    { name: 'products.view', code: 'products.view', displayName: '查看产品', module: 'products', description: '查看产品信息' },
    { name: 'products.create', code: 'products.create', displayName: '创建产品', module: 'products', description: '创建新产品' },
    { name: 'products.edit', code: 'products.edit', displayName: '编辑产品', module: 'products', description: '编辑产品信息' },
    { name: 'products.delete', code: 'products.delete', displayName: '删除产品', module: 'products', description: '删除产品' },
    { name: 'products.import', code: 'products.import', displayName: '导入产品', module: 'products', description: '批量导入产品' },

    // 询盘管理
    { name: 'inquiries.view', code: 'inquiries.view', displayName: '查看询盘', module: 'inquiries', description: '查看询盘信息' },
    { name: 'inquiries.create', code: 'inquiries.create', displayName: '创建询盘', module: 'inquiries', description: '创建新询盘' },
    { name: 'inquiries.edit', code: 'inquiries.edit', displayName: '编辑询盘', module: 'inquiries', description: '编辑询盘信息' },
    { name: 'inquiries.delete', code: 'inquiries.delete', displayName: '删除询盘', module: 'inquiries', description: '删除询盘' },

    // 报价管理
    { name: 'quotations.view', code: 'quotations.view', displayName: '查看报价', module: 'quotations', description: '查看报价信息' },
    { name: 'quotations.create', code: 'quotations.create', displayName: '创建报价', module: 'quotations', description: '创建新报价' },
    { name: 'quotations.edit', code: 'quotations.edit', displayName: '编辑报价', module: 'quotations', description: '编辑报价信息' },
    { name: 'quotations.delete', code: 'quotations.delete', displayName: '删除报价', module: 'quotations', description: '删除报价' },
    { name: 'quotations.send', code: 'quotations.send', displayName: '发送报价', module: 'quotations', description: '发送报价给客户' },

    // 订单管理
    { name: 'orders.view', code: 'orders.view', displayName: '查看订单', module: 'orders', description: '查看订单信息' },
    { name: 'orders.create', code: 'orders.create', displayName: '创建订单', module: 'orders', description: '创建新订单' },
    { name: 'orders.edit', code: 'orders.edit', displayName: '编辑订单', module: 'orders', description: '编辑订单信息' },
    { name: 'orders.delete', code: 'orders.delete', displayName: '删除订单', module: 'orders', description: '删除订单' },
    { name: 'orders.approve', code: 'orders.approve', displayName: '审批订单', module: 'orders', description: '审批订单' },

    // 供应商管理
    { name: 'suppliers.view', code: 'suppliers.view', displayName: '查看供应商', module: 'suppliers', description: '查看供应商信息' },
    { name: 'suppliers.create', code: 'suppliers.create', displayName: '创建供应商', module: 'suppliers', description: '创建新供应商' },
    { name: 'suppliers.edit', code: 'suppliers.edit', displayName: '编辑供应商', module: 'suppliers', description: '编辑供应商信息' },
    { name: 'suppliers.delete', code: 'suppliers.delete', displayName: '删除供应商', module: 'suppliers', description: '删除供应商' },

    // 采购管理
    { name: 'purchases.view', code: 'purchases.view', displayName: '查看采购', module: 'purchases', description: '查看采购订单' },
    { name: 'purchases.create', code: 'purchases.create', displayName: '创建采购', module: 'purchases', description: '创建采购订单' },
    { name: 'purchases.edit', code: 'purchases.edit', displayName: '编辑采购', module: 'purchases', description: '编辑采购订单' },
    { name: 'purchases.delete', code: 'purchases.delete', displayName: '删除采购', module: 'purchases', description: '删除采购订单' },
    { name: 'purchases.approve', code: 'purchases.approve', displayName: '审批采购', module: 'purchases', description: '审批采购订单' },

    // 库存管理
    { name: 'inventory.view', code: 'inventory.view', displayName: '查看库存', module: 'inventory', description: '查看库存信息' },
    { name: 'inventory.edit', code: 'inventory.edit', displayName: '编辑库存', module: 'inventory', description: '调整库存' },
    { name: 'inbound.view', code: 'inbound.view', displayName: '查看入库', module: 'inventory', description: '查看入库单' },
    { name: 'inbound.create', code: 'inbound.create', displayName: '创建入库', module: 'inventory', description: '创建入库单' },
    { name: 'outbound.view', code: 'outbound.view', displayName: '查看出库', module: 'inventory', description: '查看出库单' },
    { name: 'outbound.create', code: 'outbound.create', displayName: '创建出库', module: 'inventory', description: '创建出库单' },

    // 仓储管理
    { name: 'warehouses.view', code: 'warehouses.view', displayName: '查看仓库', module: 'warehouses', description: '查看仓库信息' },
    { name: 'warehouses.edit', code: 'warehouses.edit', displayName: '编辑仓库', module: 'warehouses', description: '编辑仓库信息' },

    // 财务
    { name: 'finance.view', code: 'finance.view', displayName: '查看财务', module: 'finance', description: '查看财务数据' },
    { name: 'finance.edit', code: 'finance.edit', displayName: '编辑财务', module: 'finance', description: '编辑财务数据' },

    // 报表
    { name: 'reports.view', code: 'reports.view', displayName: '查看报表', module: 'reports', description: '查看报表' },
    { name: 'reports.export', code: 'reports.export', displayName: '导出报表', module: 'reports', description: '导出报表' },

    // 系统设置
    { name: 'settings.view', code: 'settings.view', displayName: '查看设置', module: 'settings', description: '查看系统设置' },
    { name: 'settings.edit', code: 'settings.edit', displayName: '编辑设置', module: 'settings', description: '编辑系统设置' },
    { name: 'settings.roles', code: 'settings.roles', displayName: '角色管理', module: 'settings', description: '管理角色权限' },
    { name: 'settings.users', code: 'settings.users', displayName: '用户管理', module: 'settings', description: '管理用户' },
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
