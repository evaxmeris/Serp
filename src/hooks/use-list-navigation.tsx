'use client';

/**
 * Trade ERP 列表页键盘导航 Hook
 *
 * 在列表页中使用 j/k 选中行、Enter 进入详情。
 * 基于 useKeyboardShortcuts 的注册机制实现。
 *
 * @example
 * ```tsx
 * function OrderListPage() {
 *   const items = [...]; // 列表数据
 *   const { selectedIndex, selectedItem } = useListNavigation({
 *     items,
 *     idField: 'id',
 *     detailPath: '/orders',
 *     onEnter: (item) => router.push(`/orders/${item.id}`),
 *   });
 *
 *   return (
 *     <table>
 *       {items.map((item, index) => (
 *         <tr
 *           key={item.id}
 *           className={index === selectedIndex ? 'bg-blue-50' : ''}
 *         >
 *           ...
 *         </tr>
 *       ))}
 *     </table>
 *   );
 * }
 * ```
 *
 * @作者 应亮
 * @创建日期 2026-05-02
 * @最后更新 2026-05-02
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useKeyboardShortcuts, type ShortcutDefinition } from './use-keyboard-shortcuts';

// ============================================================
// 类型定义
// ============================================================

export interface UseListNavigationOptions<T extends Record<string, any>> {
  /** 列表数据 */
  items: T[];
  /** 用于构造详情路径的 ID 字段名（默认 'id'） */
  idField?: string;
  /** 详情页基础路径（如 '/orders'，最终跳转 '/orders/${id}'） */
  detailPath?: string;
  /** 自定义 Enter 处理函数（优先级高于 detailPath） */
  onEnter?: (item: T) => void;
  /** 是否启用键盘导航（默认 true） */
  enabled?: boolean;
  /** 是否允许在输入框中禁用导航（默认 true） */
  disabledInInput?: boolean;
  /** 选中行变化回调 */
  onSelectionChange?: (index: number, item: T | null) => void;
}

export interface UseListNavigationResult<T extends Record<string, any>> {
  /** 当前选中行索引 */
  selectedIndex: number;
  /** 当前选中行数据 */
  selectedItem: T | null;
  /** 设置选中行索引 */
  setSelectedIndex: (index: number) => void;
  /** 重置选中行 */
  resetSelection: () => void;
  /** 选中上一个 */
  selectPrevious: () => void;
  /** 选中下一个 */
  selectNext: () => void;
  /** 当前行是否为选中行 */
  isSelected: (index: number) => boolean;
  /** 选中行 CSS class */
  rowClass: (index: number, baseClassName?: string) => string;
}

// ============================================================
// Hook
// ============================================================

export function useListNavigation<T extends Record<string, any>>(
  options: UseListNavigationOptions<T>
): UseListNavigationResult<T> {
  const {
    items,
    idField = 'id',
    detailPath,
    onEnter,
    enabled = true,
    disabledInInput = true,
    onSelectionChange,
  } = options;

  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const previousIndexRef = useRef<number>(-1);

  // 重置选中行
  const resetSelection = useCallback(() => {
    setSelectedIndex(-1);
  }, []);

  // 选中上一个
  const selectPrevious = useCallback(() => {
    setSelectedIndex((prev) => {
      if (prev <= 0) return items.length - 1; // 循环到末尾
      return prev - 1;
    });
  }, [items.length]);

  // 选中下一个
  const selectNext = useCallback(() => {
    setSelectedIndex((prev) => {
      if (prev >= items.length - 1 || prev < 0) return 0; // 循环到开头
      return prev + 1;
    });
  }, [items.length]);

  // 获取当前选中项
  const selectedItem: T | null =
    selectedIndex >= 0 && selectedIndex < items.length
      ? items[selectedIndex]
      : null;

  // 判断当前是否为选中行
  const isSelected = useCallback(
    (index: number) => index === selectedIndex,
    [selectedIndex]
  );

  // 选中行 CSS class
  const rowClass = useCallback(
    (index: number, baseClassName?: string) => {
      const base = baseClassName || '';
      return isSelected(index)
        ? `${base} bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-300 dark:ring-blue-700`
        : base;
    },
    [isSelected]
  );

  // 建立基础路径
  const buildDetailPath = useCallback(
    (item: T) => {
      if (!detailPath) return null;
      const id = item[idField];
      if (id == null) return null;
      return `${detailPath}/${id}`;
    },
    [detailPath, idField]
  );

  // 注册键盘快捷键
  const shortcuts: ShortcutDefinition[] = [
    {
      label: 'j',
      keys: 'j',
      description: '列表页：选中下一行',
      handler: () => {
        if (!enabled || items.length === 0) return;
        selectNext();
      },
      disabledInInput,
      priority: 50,
    },
    {
      label: 'k',
      keys: 'k',
      description: '列表页：选中上一行',
      handler: () => {
        if (!enabled || items.length === 0) return;
        selectPrevious();
      },
      disabledInInput,
      priority: 50,
    },
    {
      label: 'Enter',
      keys: 'Enter',
      description: '列表页：进入选中行详情',
      handler: () => {
        if (!enabled || !selectedItem) return;

        // 优先使用自定义 onEnter 处理函数
        if (onEnter) {
          onEnter(selectedItem);
          return;
        }

        // 使用 detailPath 构造路径跳转
        const path = buildDetailPath(selectedItem);
        if (path) {
          router.push(path);
        }
      },
      disabledInInput,
      priority: 50,
    },
  ];

  // 注册到全局快捷键系统
  useKeyboardShortcuts(enabled ? shortcuts : []);

  // 选中项变化回调
  useEffect(() => {
    if (
      onSelectionChange &&
      previousIndexRef.current !== selectedIndex
    ) {
      previousIndexRef.current = selectedIndex;
      onSelectionChange(selectedIndex, selectedItem);
    }
  }, [selectedIndex, selectedItem, onSelectionChange]);

  // 当 items 变化时重置选中行
  useEffect(() => {
    setSelectedIndex(-1);
  }, [items.length]);

  return {
    selectedIndex,
    selectedItem,
    setSelectedIndex,
    resetSelection,
    selectPrevious,
    selectNext,
    isSelected,
    rowClass,
  };
}
