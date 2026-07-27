'use client';

import { FormField } from '../FormField';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProductFormData, EditPageAction, ProductDetail } from '../types';

interface BasicInfoSectionProps {
  form: ProductFormData;
  dispatch: React.Dispatch<EditPageAction>;
  product: ProductDetail | null;
}

export function BasicInfoSection({ form, dispatch, product }: BasicInfoSectionProps) {
  const update = (field: keyof ProductFormData, value: any) => {
    dispatch({ type: 'UPDATE_FIELD', field, value });
  };

  return (
    <div className="space-y-4">
      <FormField
        label="标题"
        name="title"
        value={form.title}
        onChange={v => update('title', v)}
        placeholder="产品标题"
      />
      <FormField
        label="英文标题"
        name="titleEn"
        value={form.titleEn}
        onChange={v => update('titleEn', v)}
        placeholder="Product English Title"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          label="品牌"
          name="brand"
          value={form.brand}
          onChange={v => update('brand', v)}
          placeholder="品牌名"
        />
        <FormField
          label="SKU"
          name="sku"
          value={form.sku}
          onChange={v => update('sku', v)}
          placeholder="SKU 编号"
        />
      </div>
      {/* 来源信息（只读） */}
      {product && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-gray-50 rounded-md">
          <div>
            <Label className="text-xs text-gray-500 font-medium">来源</Label>
            <Input value={product.source} disabled className="text-sm bg-white mt-1" />
          </div>
          <div>
            <Label className="text-xs text-gray-500 font-medium">来源链接</Label>
            {product.sourceUrl ? (
              <a
                href={product.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-blue-600 underline truncate mt-1"
              >
                {product.sourceUrl}
              </a>
            ) : (
              <Input value="-" disabled className="text-sm bg-white mt-1" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
