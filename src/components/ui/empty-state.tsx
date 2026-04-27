/**
 * 空状态组件 — 统一各页面的"暂无数据"展示
 */
'use client';

import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: string;           // emoji 图标
  title?: string;          // 主标题
  description?: string;     // 副描述
  action?: ReactNode;       // 可选操作按钮/链接
}

export function EmptyState({
  icon = '📭',
  title = '暂无数据',
  description = '',
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-lg font-medium text-gray-600 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-400 mb-4 max-w-md">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
