/**
 * 服务层基类
 * 
 * 提供通用的 RBAC 权限控制和行级数据过滤支持
 * 
 * @module services/base/BaseService
 */

import { prisma } from '@/lib/prisma';
import type { AuthSession } from '@/middleware/auth';
import { hasPermission, getRowLevelFilter } from '@/middleware/auth';
import type { PrismaClient } from '@prisma/client';

/**
 * 基础服务类
 * 
 * 所有业务服务都应继承此类，获得 RBAC 权限支持
 */
export abstract class BaseService {
  protected prisma: PrismaClient;
  protected session: AuthSession;

  constructor(session: AuthSession) {
    this.prisma = prisma;
    this.session = session;
  }

  /**
   * 检查当前用户是否拥有指定权限
   * 
   * @param permission 权限名称，格式：module:action
   * @returns 是否拥有权限
   */
  protected hasPermission(permission: string): boolean {
    return hasPermission(this.session, permission);
  }

  /**
   * 检查当前用户是否拥有任意一个权限
   */
  protected hasAnyPermission(permissions: string[]): boolean {
    return permissions.some(p => this.hasPermission(p));
  }

  /**
   * 检查当前用户是否拥有所有权限
   */
  protected hasAllPermissions(permissions: string[]): boolean {
    return permissions.every(p => this.hasPermission(p));
  }

  /**
   * 获取行级数据过滤条件
   * 
   * 根据当前用户权限自动生成过滤条件，确保：
   * - ADMIN：无过滤，可以查看所有数据
   * - 普通用户：只能查看自己的数据
   * - 未来扩展：支持部门级过滤
   * 
   * @returns Prisma where 过滤对象
   */
  protected getRowLevelFilter() {
    return getRowLevelFilter(this.session);
  }

  /**
   * 应用行级过滤到查询条件
   * 
   * @param where 现有的查询条件
   * @returns 合并了行级过滤的查询条件
   */
  protected applyRowLevelFilter(where: Record<string, any> = {}): Record<string, any> {
    const filter = this.getRowLevelFilter();
    return { ...where, ...filter };
  }

  /**
   * 检查权限并抛出错误（如果没有权限）
   * 
   * @param permission 需要检查的权限
   * @throws Error 如果没有权限抛出错误
   */
  protected checkPermissionOrThrow(permission: string): void {
    if (!this.hasPermission(permission)) {
      throw new Error(`无权限执行此操作，需要权限：${permission}`);
    }
  }
}
