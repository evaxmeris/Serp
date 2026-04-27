/**
 * 响应式表格 — 桌面端显示表格，移动端(<768px)自动切换为卡片视图
 *
 * 使用方式:
 * <ResponsiveTable columns={[...]} data={[...]} renderCard={(row) => <Card>...</Card>} />
 */
'use client';

import { ReactNode } from 'react';

interface Column<T> {
  key: string;
  title: string;
  render?: (row: T) => ReactNode;
  className?: string;
  hideOnMobile?: boolean;
}

interface ResponsiveTableProps<T> {
  columns: Column<T>[];
  data: T[];
  renderCard: (row: T) => ReactNode;
  keyField?: keyof T;
  emptyState?: ReactNode;
}

export function ResponsiveTable<T extends Record<string, any>>({
  columns,
  data,
  renderCard,
  keyField = 'id' as keyof T,
  emptyState,
}: ResponsiveTableProps<T>) {
  if (data.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <>
      {/* 桌面端：标准表格 */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.className || ''}`}
                >
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {data.map((row) => (
              <tr key={String(row[keyField])} className="hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-sm text-gray-700 ${col.className || ''}`}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 移动端：卡片视图 */}
      <div className="md:hidden space-y-3">
        {data.map((row) => (
          <div key={String(row[keyField])}>
            {renderCard(row)}
          </div>
        ))}
      </div>
    </>
  );
}
