'use client';

import { ExternalLink, Calendar, Globe } from 'lucide-react';
import type { ProductDetail } from '../types';

interface CollectedInfoProps {
  product: ProductDetail | null;
}

export function CollectedInfo({ product }: CollectedInfoProps) {
  if (!product) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">采集信息</h4>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <Calendar className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs">
            {product.collectedAt
              ? new Date(product.collectedAt).toLocaleString()
              : '-'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs text-gray-500">{product.source}</span>
        </div>

        {product.sourceUrl && (
          <a
            href={product.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            打开源页面
          </a>
        )}
      </div>
    </div>
  );
}
