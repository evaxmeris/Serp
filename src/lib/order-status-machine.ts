/**
 * 订单状态机 — 定义并验证合法状态流转
 *
 * 审计问题 2.5: 禁止非法状态跳转。
 * 所有订单状态变更必须经过此模块验证。
 *
 * 合法流转规则:
 *   PENDING       → CONFIRMED | CANCELLED
 *   CONFIRMED     → IN_PRODUCTION | CANCELLED
 *   IN_PRODUCTION → READY | CANCELLED
 *   READY         → SHIPPED
 *   SHIPPED       → DELIVERED
 *   DELIVERED     → COMPLETED
 *   COMPLETED     → (终态，不可跳转)
 *   CANCELLED     → (终态，不可跳转)
 *
 * 权限规则:
 *   ADMIN 可跳过中间状态强制流转（但不能从终态跳出，也不能跳转到 CANCELLED）
 *
 * @module lib/order-status-machine
 */

import { OrderStatus } from '@/types/order';

// ============================================================================
// 状态流转映射表
// ============================================================================

/**
 * 合法状态流转定义
 * key = 当前状态, value = 允许跳转到的目标状态集合
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, ReadonlySet<OrderStatus>> = {
  PENDING:       new Set(['CONFIRMED', 'CANCELLED']),
  CONFIRMED:     new Set(['IN_PRODUCTION', 'CANCELLED']),
  IN_PRODUCTION: new Set(['READY', 'CANCELLED']),
  READY:         new Set(['SHIPPED']),
  SHIPPED:       new Set(['DELIVERED']),
  DELIVERED:     new Set(['COMPLETED']),
  COMPLETED:     new Set([]), // 终态
  CANCELLED:     new Set([]), // 终态
};

/**
 * 终态集合 — 不允许再从这些状态跳转到其他状态
 */
export const TERMINAL_STATUSES: ReadonlySet<OrderStatus> = new Set([
  'COMPLETED',
  'CANCELLED',
]);

/**
 * ADMIN 可强制跳转到的目标状态（仅限非取消的活跃状态）
 * 注意: ADMIN 也不能跳转到 CANCELLED（取消操作有专门的取消流程）
 */
const ADMIN_FORCE_TARGETS: ReadonlySet<OrderStatus> = new Set([
  'PENDING',
  'CONFIRMED',
  'IN_PRODUCTION',
  'READY',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
]);

// ============================================================================
// 公开 API
// ============================================================================

/**
 * 判断状态跳转是否合法
 *
 * @param from    - 当前状态
 * @param to      - 目标状态
 * @param options - 可选参数
 * @param options.isAdmin - 是否为管理员（管理员可跳过中间状态）
 * @returns 是否允许跳转
 *
 * @example
 * canTransition('PENDING', 'CONFIRMED')          // true
 * canTransition('PENDING', 'SHIPPED')            // false (跳过太多中间状态)
 * canTransition('PENDING', 'SHIPPED', { isAdmin: true }) // true
 * canTransition('CANCELLED', 'PENDING')          // false (终态不可逆)
 */
export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  options?: { isAdmin?: boolean },
): boolean {
  // 状态不变，始终允许
  if (from === to) return true;

  // 不允许从终态跳出
  if (TERMINAL_STATUSES.has(from)) return false;

  // 检查标准流转
  const allowed = ORDER_TRANSITIONS[from];
  if (allowed?.has(to)) return true;

  // ADMIN 可跳过中间状态强制流转（但不能跳转到 CANCELLED）
  if (options?.isAdmin && ADMIN_FORCE_TARGETS.has(to)) {
    return true;
  }

  return false;
}

/**
 * 验证状态跳转，不合法时返回错误信息
 *
 * @param from    - 当前状态
 * @param to      - 目标状态
 * @param options - 可选参数
 * @param options.isAdmin - 是否为管理员
 * @returns 验证结果
 *
 * @example
 * validateTransition('PENDING', 'CONFIRMED')
 * // { valid: true }
 *
 * validateTransition('CANCELLED', 'PENDING')
 * // { valid: false, message: '已取消的订单不可修改状态' }
 *
 * validateTransition('PENDING', 'SHIPPED')
 * // { valid: false, message: '非法状态跳转: PENDING → SHIPPED。允许跳转: CONFIRMED, CANCELLED' }
 */
export function validateTransition(
  from: OrderStatus,
  to: OrderStatus,
  options?: { isAdmin?: boolean },
): { valid: true } | { valid: false; message: string } {
  // 状态不变，直接允许
  if (from === to) return { valid: true };

  // 终态检查（给出明确的中文提示）
  if (from === 'CANCELLED') {
    return { valid: false, message: '已取消的订单不可修改状态' };
  }
  if (from === 'COMPLETED') {
    return { valid: false, message: '已完成的订单不可修改状态' };
  }

  if (canTransition(from, to, options)) {
    return { valid: true };
  }

  // 构造友好错误信息
  const allowedList = ORDER_TRANSITIONS[from]
    ? [...ORDER_TRANSITIONS[from]].join('、')
    : '无';
  return {
    valid: false,
    message: `非法状态跳转: ${from} → ${to}。当前状态允许跳转: ${allowedList}`,
  };
}

/**
 * 判断指定状态是否可取消
 * 仅 PENDING / CONFIRMED / IN_PRODUCTION / READY 可取消
 */
export function canCancel(status: OrderStatus): boolean {
  return ['PENDING', 'CONFIRMED', 'IN_PRODUCTION', 'READY'].includes(status);
}

/**
 * 获取从指定状态允许的所有目标状态列表
 */
export function getAllowedTransitions(from: OrderStatus): readonly OrderStatus[] {
  return [...(ORDER_TRANSITIONS[from] ?? [])];
}
