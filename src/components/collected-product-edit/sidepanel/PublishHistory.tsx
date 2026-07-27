'use client';

import { CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import type { ProductDetail, PublishLog } from '../types';

interface PublishHistoryProps {
  product: ProductDetail | null;
}

export function PublishHistory({ product }: PublishHistoryProps) {
  if (!product) return null;

  const logs: PublishLog[] = product.publishLogs || [];
  const recentLogs = logs.slice(0, 5);

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">发布历史</h4>

      {/* WooCommerce 关联信息 */}
      {product.woocommerceId && (
        <div className="p-2 bg-green-50 rounded text-xs space-y-1">
          <div className="flex items-center gap-1 text-green-700">
            <CheckCircle className="h-3 w-3" />
            <span>WooCommerce ID: {product.woocommerceId}</span>
          </div>
          {product.woocommerceUrl && (
            <a
              href={product.woocommerceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-600 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              打开独立站
            </a>
          )}
        </div>
      )}

      {/* 发布错误 */}
      {product.publishError && (
        <div className="p-2 bg-red-50 rounded text-xs flex items-start gap-1 text-red-700">
          <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{product.publishError}</span>
        </div>
      )}

      {/* 发布日志列表 */}
      {recentLogs.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {recentLogs.map(log => (
            <div
              key={log.id}
              className="flex items-start gap-2 p-1.5 rounded text-xs hover:bg-gray-50"
            >
              {log.status === 'success' ? (
                <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-gray-700">{log.action}</div>
                <div className="text-gray-400">
                  {new Date(log.createdAt).toLocaleString()}
                  {log.durationMs && ` · ${log.durationMs}ms`}
                </div>
                {log.errorMessage && (
                  <div className="text-red-500 truncate">{log.errorMessage}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {logs.length === 0 && !product.woocommerceId && (
        <div className="text-xs text-gray-400 py-2">暂无发布记录</div>
      )}
    </div>
  );
}
