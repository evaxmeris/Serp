import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-api';
import { errorResponse } from '@/lib/api-response';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * 默认系统权限定义
 */
const defaultPermissions = [
  // 用户管理模块
  { name: 'user:list', code: 'user:list', displayName: '查看用户列表', module: 'user' },
  { name: 'user:create', code: 'user:create', displayName: '创建用户', module: 'user' },
  { name: 'user:edit', code: 'user:edit', displayName: '编辑用户', module: 'user' },
  { name: 'user:delete', code: 'user:delete', displayName: '删除用户', module: 'user' },
  { name: 'user:assign-role', code: 'user:assign-role', displayName: '分配用户角色', module: 'user' },

  // 角色管理模块
  { name: 'role:list', code: 'role:list', displayName: '查看角色列表', module: 'role' },
  { name: 'role:create', code: 'role:create', displayName: '创建角色', module: 'role' },
  { name: 'role:edit', code: 'role:edit', displayName: '编辑角色', module: 'role' },
  { name: 'role:delete', code: 'role:delete', displayName: '删除角色', module: 'role' },
  { name: 'role:assign-permission', code: 'role:assign-permission', displayName: '分配角色权限', module: 'role' },

  // 权限管理模块
  { name: 'permission:list', code: 'permission:list', displayName: '查看权限列表', module: 'permission' },
  { name: 'permission:create', code: 'permission:create', displayName: '创建权限', module: 'permission' },
  { name: 'permission:edit', code: 'permission:edit', displayName: '编辑权限', module: 'permission' },
  { name: 'permission:delete', code: 'permission:delete', displayName: '删除权限', module: 'permission' },

  // 客户管理模块
  { name: 'customer:list', code: 'customer:list', displayName: '查看客户列表', module: 'customer' },
  { name: 'customer:create', code: 'customer:create', displayName: '创建客户', module: 'customer' },
  { name: 'customer:edit', code: 'customer:edit', displayName: '编辑客户', module: 'customer' },
  { name: 'customer:delete', code: 'customer:delete', displayName: '删除客户', module: 'customer' },
  { name: 'customer:export', code: 'customer:export', displayName: '导出客户数据', module: 'customer' },

  // 供应商管理模块
  { name: 'supplier:list', code: 'supplier:list', displayName: '查看供应商列表', module: 'supplier' },
  { name: 'supplier:create', code: 'supplier:create', displayName: '创建供应商', module: 'supplier' },
  { name: 'supplier:edit', code: 'supplier:edit', displayName: '编辑供应商', module: 'supplier' },
  { name: 'supplier:delete', code: 'supplier:delete', displayName: '删除供应商', module: 'supplier' },

  // 产品管理模块
  { name: 'product:list', code: 'product:list', displayName: '查看产品列表', module: 'product' },
  { name: 'product:create', code: 'product:create', displayName: '创建产品', module: 'product' },
  { name: 'product:edit', code: 'product:edit', displayName: '编辑产品', module: 'product' },
  { name: 'product:delete', code: 'product:delete', displayName: '删除产品', module: 'product' },
  { name: 'product:category:manage', code: 'product:category:manage', displayName: '管理产品分类', module: 'product' },

  // 询盘管理模块
  { name: 'inquiry:list', code: 'inquiry:list', displayName: '查看询盘列表', module: 'inquiry' },
  { name: 'inquiry:create', code: 'inquiry:create', displayName: '创建询盘', module: 'inquiry' },
  { name: 'inquiry:edit', code: 'inquiry:edit', displayName: '编辑询盘', module: 'inquiry' },
  { name: 'inquiry:delete', code: 'inquiry:delete', displayName: '删除询盘', module: 'inquiry' },
  { name: 'inquiry:assign', code: 'inquiry:assign', displayName: '分配询盘', module: 'inquiry' },

  // 报价管理模块
  { name: 'quotation:list', code: 'quotation:list', displayName: '查看报价列表', module: 'quotation' },
  { name: 'quotation:create', code: 'quotation:create', displayName: '创建报价', module: 'quotation' },
  { name: 'quotation:edit', code: 'quotation:edit', displayName: '编辑报价', module: 'quotation' },
  { name: 'quotation:delete', code: 'quotation:delete', displayName: '删除报价', module: 'quotation' },
  { name: 'quotation:send', code: 'quotation:send', displayName: '发送报价', module: 'quotation' },

  // 订单管理模块
  { name: 'order:list', code: 'order:list', displayName: '查看订单列表', module: 'order' },
  { name: 'order:create', code: 'order:create', displayName: '创建订单', module: 'order' },
  { name: 'order:edit', code: 'order:edit', displayName: '编辑订单', module: 'order' },
  { name: 'order:delete', code: 'order:delete', displayName: '删除订单', module: 'order' },
  { name: 'order:approve', code: 'order:approve', displayName: '审批订单', module: 'order' },
  { name: 'order:export', code: 'order:export', displayName: '导出订单数据', module: 'order' },

  // 采购管理模块
  { name: 'purchase:list', code: 'purchase:list', displayName: '查看采购列表', module: 'purchase' },
  { name: 'purchase:create', code: 'purchase:create', displayName: '创建采购', module: 'purchase' },
  { name: 'purchase:edit', code: 'purchase:edit', displayName: '编辑采购', module: 'purchase' },
  { name: 'purchase:delete', code: 'purchase:delete', displayName: '删除采购', module: 'purchase' },
  { name: 'purchase:approve', code: 'purchase:approve', displayName: '审批采购', module: 'purchase' },

  // 库存管理模块
  { name: 'inventory:list', code: 'inventory:list', displayName: '查看库存', module: 'inventory' },
  { name: 'inventory:adjust', code: 'inventory:adjust', displayName: '调整库存', module: 'inventory' },
  { name: 'inventory:transfer', code: 'inventory:transfer', displayName: '调拨库存', module: 'inventory' },
  { name: 'warehouse:manage', code: 'warehouse:manage', displayName: '管理仓库', module: 'inventory' },

  // 财务管理模块
  { name: 'finance:payment:list', code: 'finance:payment:list', displayName: '查看付款列表', module: 'finance' },
  { name: 'finance:payment:approve', code: 'finance:payment:approve', displayName: '审批付款', module: 'finance' },
  { name: 'finance:expense:list', code: 'finance:expense:list', displayName: '查看支出列表', module: 'finance' },
  { name: 'finance:expense:create', code: 'finance:expense:create', displayName: '创建支出', module: 'finance' },
  { name: 'finance:expense:approve', code: 'finance:expense:approve', displayName: '审批支出', module: 'finance' },
  { name: 'finance:report', code: 'finance:report', displayName: '查看财务报表', module: 'finance' },

  // 数据分析模块
  { name: 'report:view', code: 'report:view', displayName: '查看报表', module: 'report' },
  { name: 'report:export', code: 'report:export', displayName: '导出报表', module: 'report' },
  { name: 'report:schedule', code: 'report:schedule', displayName: '订阅报表', module: 'report' },

  // 市场研究模块
  { name: 'research:list', code: 'research:list', displayName: '查看研究列表', module: 'research' },
  { name: 'research:create', code: 'research:create', displayName: '创建研究', module: 'research' },
  { name: 'research:edit', code: 'research:edit', displayName: '编辑研究', module: 'research' },
  { name: 'research:delete', code: 'research:delete', displayName: '删除研究', module: 'research' },
];

/**
 * 默认系统角色
 */
const defaultRoles = [
  {
    name: 'super_admin',
    code: 'super_admin',
    displayName: '超级管理员',
    description: '系统超级管理员，拥有所有权限',
    isSystem: true,
  },
  {
    name: 'admin',
    code: 'admin',
    displayName: '管理员',
    description: '系统管理员，拥有大部分管理权限',
    isSystem: true,
  },
  {
    name: 'sales_manager',
    code: 'sales_manager',
    displayName: '销售经理',
    description: '销售经理，可管理客户、询盘、报价、订单',
    isSystem: false,
  },
  {
    name: 'sales',
    code: 'sales',
    displayName: '业务员',
    description: '普通业务员，只能管理自己的客户',
    isSystem: false,
  },
  {
    name: 'purchasing_manager',
    code: 'purchasing_manager',
    displayName: '采购经理',
    description: '采购经理，可管理供应商和采购',
    isSystem: false,
  },
  {
    name: 'purchasing',
    code: 'purchasing',
    displayName: '采购员',
    description: '普通采购员',
    isSystem: false,
  },
  {
    name: 'warehouse_manager',
    code: 'warehouse_manager',
    displayName: '仓库经理',
    description: '仓库经理，管理库存',
    isSystem: false,
  },
  {
    name: 'warehouse',
    code: 'warehouse',
    displayName: '仓管员',
    description: '普通仓管员',
    isSystem: false,
  },
  {
    name: 'finance',
    code: 'finance',
    displayName: '财务人员',
    description: '财务管理人员',
    isSystem: false,
  },
  {
    name: 'viewer',
    code: 'viewer',
    displayName: '只读访客',
    description: '只能查看，不能修改',
    isSystem: true,
  },
];

/**
 * POST /api/permissions/init - 初始化默认权限和角色
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    let createdPermissions = 0;
    let createdRoles = 0;

    // 创建权限
    for (const perm of defaultPermissions) {
      const existing = await prisma.permission.findUnique({
        where: { name: perm.name },
      });
      if (!existing) {
        await prisma.permission.create({
          data: perm,
        });
        createdPermissions++;
      }
    }

    // 创建角色
    for (const role of defaultRoles) {
      const existing = await prisma.role.findUnique({
        where: { name: role.name },
      });
      if (!existing) {
        await prisma.role.create({
          data: role,
        });
        createdRoles++;
      }
    }

    // 为超级管理员角色分配所有权限
    const superAdmin = await prisma.role.findUnique({
      where: { name: 'super_admin' },
    });

    if (superAdmin) {
      const allPermissions = await prisma.permission.findMany({
        select: { id: true },
      });

      // 清除现有并重新分配
      await prisma.rolePermission.deleteMany({
        where: { roleId: superAdmin.id },
      });

      if (allPermissions.length > 0) {
        await prisma.rolePermission.createMany({
          data: allPermissions.map(p => ({
            roleId: superAdmin.id,
            permissionId: p.id,
          })),
        });
      }
    }

    return NextResponse.json({
      message: 'Initialization completed',
      createdPermissions,
      createdRoles,
      totalPermissions: defaultPermissions.length,
      totalRoles: defaultRoles.length,
    });
  } catch (error) {
    console.error('Error initializing permissions:', error);
    return NextResponse.json(
      { error: 'Failed to initialize permissions', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/permissions/init - 获取初始化状态
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return errorResponse('未认证，请先登录', 'UNAUTHORIZED', 401);
    }

    const [permissionCount, roleCount] = await Promise.all([
      prisma.permission.count(),
      prisma.role.count(),
    ]);

    return NextResponse.json({
      initialized: permissionCount > 0 && roleCount > 0,
      permissionCount,
      roleCount,
      defaultPermissionsCount: defaultPermissions.length,
      defaultRolesCount: defaultRoles.length,
    });
  } catch (error) {
    console.error('Error checking initialization status:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}
