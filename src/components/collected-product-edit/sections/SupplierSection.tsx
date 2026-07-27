'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FormField } from '../FormField';
import { ExternalLink, Star, ShieldCheck, TrendingUp } from 'lucide-react';
import type { ProductFormData, EditPageAction, ProductDetail } from '../types';

interface SupplierSectionProps {
  form: ProductFormData;
  dispatch: React.Dispatch<EditPageAction>;
  product: ProductDetail | null;
}

export function SupplierSection({ form, dispatch, product }: SupplierSectionProps) {
  const update = (field: keyof ProductFormData, value: any) => {
    dispatch({ type: 'UPDATE_FIELD', field, value });
  };

  const rawData = product?.rawData as any;
  const supplier = rawData?.supplier;

  if (!supplier) {
    return (
      <div className="space-y-4">
        <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
          无可用的供应商信息
        </div>
        <FormField
          label="MOQ（最小起订量）"
          name="stockQuantity"
          type="number"
          value={form.stockQuantity}
          onChange={v => update('stockQuantity', v)}
          placeholder="0"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-gray-50 border-gray-200">
        <CardContent className="p-4 space-y-2">
          {supplier.name && (
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{supplier.name}</span>
              {supplier.url && (
                <a
                  href={supplier.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 text-xs flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> 打开店铺
                </a>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {supplier.verified && (
              <Badge variant="secondary" className="text-xs gap-1">
                <ShieldCheck className="h-3 w-3 text-green-500" />
                {typeof supplier.verified === 'string' ? supplier.verified : 'Verified'}
              </Badge>
            )}
            {supplier.rating && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Star className="h-3 w-3 text-yellow-500" />
                {typeof supplier.rating === 'number' ? supplier.rating.toFixed(1) : supplier.rating}
              </Badge>
            )}
            {supplier.responseRate && (
              <Badge variant="secondary" className="text-xs gap-1">
                <TrendingUp className="h-3 w-3 text-blue-500" />
                {supplier.responseRate}
              </Badge>
            )}
          </div>
          {(rawData?.moq || rawData?.moq === 0) && (
            <div className="text-xs text-gray-500">
              MOQ: {rawData.moq} 件
            </div>
          )}
        </CardContent>
      </Card>

      <FormField
        label="MOQ（最小起订量）"
        name="stockQuantity"
        type="number"
        value={form.stockQuantity}
        onChange={v => update('stockQuantity', v)}
        placeholder="0"
      />
    </div>
  );
}
