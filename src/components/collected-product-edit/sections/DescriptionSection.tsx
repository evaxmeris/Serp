'use client';

import { FormField } from '../FormField';
import type { ProductFormData, EditPageAction } from '../types';

interface DescriptionSectionProps {
  form: ProductFormData;
  dispatch: React.Dispatch<EditPageAction>;
}

export function DescriptionSection({ form, dispatch }: DescriptionSectionProps) {
  const update = (field: keyof ProductFormData, value: any) => {
    dispatch({ type: 'UPDATE_FIELD', field, value });
  };

  return (
    <div className="space-y-4">
      <FormField
        label="短描述"
        name="shortDescription"
        type="textarea"
        value={form.shortDescription}
        onChange={v => update('shortDescription', v)}
        placeholder="简短的产品描述..."
        rows={3}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-gray-500 font-medium">详细描述（中文）</label>
          <textarea
            value={form.description || ''}
            onChange={e => update('description', e.target.value)}
            placeholder="请输入中文产品描述..."
            rows={12}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500 font-medium">英文描述</label>
          <textarea
            value={form.descriptionEn || ''}
            onChange={e => update('descriptionEn', e.target.value)}
            placeholder="English product description..."
            rows={12}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
