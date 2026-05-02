'use client'

import { useState, useMemo, useCallback } from 'react'

/**
 * 排序方向
 */
export type SortDirection = 'asc' | 'desc'

/**
 * 排序配置
 */
export interface SortConfig {
  /** 当前排序的字段 key */
  key: string
  /** 排序方向 */
  direction: SortDirection
}

/**
 * 可复用列排序 hook
 *
 * 支持两种模式：
 * 1. 客户端排序（默认）：传入 items 数据，hook 内部用 useMemo 做本地排序
 * 2. 服务端排序：传入 onServerSort 回调，点击表头时触发回调（如刷新 API 数据），
 *    sorted 返回原始 items（不做本地排序）
 *
 * @example
 * ```tsx
 * // 客户端排序
 * const { sorted, requestSort, sortConfig } = useSortable(data, 'createdAt')
 *
 * // 服务端排序
 * const { requestSort, sortConfig } = useSortable(items, 'createdAt', 'asc', {
 *   onSort: (key, dir) => setSortParams({ sortBy: key, sortOrder: dir })
 * })
 *
 * // 表头使用
 * <TableHead
 *   className="cursor-pointer select-none"
 *   onClick={() => requestSort('companyName')}
 * >
 *   公司名称
 *   <SortIndicator field="companyName" sortConfig={sortConfig} />
 * </TableHead>
 * ```
 */
export function useSortable<T extends Record<string, any>>(
  items: T[],
  initialKey?: string,
  initialDirection: SortDirection = 'asc',
  options?: {
    onSort?: (key: string, direction: SortDirection) => void
  },
): {
  sorted: T[]
  requestSort: (key: string) => void
  sortConfig: SortConfig
  isSorted: (key: string) => boolean
  getSortDirection: (key: string) => SortDirection | null
} {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: initialKey || '',
    direction: initialDirection,
  })

  const sorted = useMemo(() => {
    // 服务端排序模式：不做本地排序，直接返回原始数据
    if (options?.onSort) return items

    if (!sortConfig.key) return items

    return [...items].sort((a, b) => {
      // 支持嵌套路径获取值，如 'customer.companyName'
      const getValue = (obj: any, path: string): any => {
        return path.split('.').reduce((current, key) => {
          return current?.[key]
        }, obj)
      }

      const aVal = getValue(a, sortConfig.key)
      const bVal = getValue(b, sortConfig.key)

      // null/undefined 排在最后
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1

      // 数值比较
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
      }

      // 字符串比较
      const aStr = String(aVal)
      const bStr = String(bVal)
      const cmp = aStr.localeCompare(bStr, 'zh-CN')
      return sortConfig.direction === 'asc' ? cmp : -cmp
    })
  }, [items, sortConfig, options?.onSort])

  const requestSort = useCallback((key: string) => {
    setSortConfig(prev => {
      const newDirection = prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
      // 服务端排序模式：触发外部回调
      if (options?.onSort) {
        options.onSort(key, newDirection)
      }
      return {
        key,
        direction: newDirection,
      }
    })
  }, [options])

  const isSorted = useCallback(
    (key: string) => sortConfig.key === key,
    [sortConfig.key],
  )

  const getSortDirection = useCallback(
    (key: string): SortDirection | null => {
      return sortConfig.key === key ? sortConfig.direction : null
    },
    [sortConfig],
  )

  return { sorted, requestSort, sortConfig, isSorted, getSortDirection }
}

/**
 * 排序方向指示器组件
 */
export function SortIndicator({
  field,
  sortConfig,
}: {
  field: string
  sortConfig: SortConfig
}) {
  if (sortConfig.key !== field) {
    return <span className="ml-1 text-muted-foreground/30">⇅</span>
  }

  return (
    <span className="ml-1 text-primary">
      {sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}
    </span>
  )
}
