'use client';

import { FormField } from '../FormField';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CURRENCY_OPTIONS } from '../types';
import type { ProductFormData, EditPageAction, ProductDetail } from '../types';

interface PriceSectionProps {
  form: ProductFormData;
  dispatch: React.Dispatch<EditPageAction>;
  product: ProductDetail | null;
}

export function PriceSection({ form, dispatch, product }: PriceSectionProps) {
  const update = (field: keyof ProductFormData, value: any) => {
    dispatch({ type: 'UPDATE_FIELD', field, value });
  };

  const tieredPricing =
    product?.rawData?.tieredPricing ||
    (product?.rawData as any)?.tieredPricing ||
    [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField
          label="售价"
          name="price"
          type="number"
          step="0.01"
          value={form.price}
          onChange={v => update('price', v)}
          placeholder="0.00"
          suffix={form.currency || 'USD'}
        />
        <FormField
          label="划线价"
          name="compareAtPrice"
          type="number"
          step="0.01"
          value={form.compareAtPrice}
          onChange={v => update('compareAtPrice', v)}
          placeholder="0.00"
          suffix={form.currency || 'USD'}
        />
        <FormField
          label="币种"
          name="currency"
          type="select"
          value={form.currency}
          onChange={v => update('currency', v)}
          options={[...CURRENCY_OPTIONS]}
        />
      </div>
      <FormField
        label="库存数量"
        name="stockQuantity"
        type="number"
        value={form.stockQuantity}
        onChange={v => update('stockQuantity', v)}
        placeholder="0"
      />

      {/* 阶梯定价（只读参考） */}
      {tieredPricing.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-gray-400">
            阶梯定价（采集于来源平台，仅供参考）
          </p>
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">数量区间</TableHead>
                  <TableHead className="text-xs">单价</TableHead>
                  <TableHead className="text-xs">币种</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tieredPricing.map((tier: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm py-2">
                      {tier.minQty || 1}{tier.maxQty ? ` - ${tier.maxQty}` : '+'}
                    </TableCell>
                    <TableCell className="text-sm py-2">
                      {tier.price || '-'}
                    </TableCell>
                    <TableCell className="text-sm py-2">
                      {tier.unit || form.currency || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
