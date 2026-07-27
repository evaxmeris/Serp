'use client';

import { FormField } from '../FormField';
import type { ProductFormData, EditPageAction } from '../types';

interface ShippingSectionProps {
  form: ProductFormData;
  dispatch: React.Dispatch<EditPageAction>;
}

export function ShippingSection({ form, dispatch }: ShippingSectionProps) {
  const update = (field: keyof ProductFormData, value: any) => {
    dispatch({ type: 'UPDATE_FIELD', field, value });
  };

  return (
    <div className="space-y-4">
      <FormField
        label="重量 (kg)"
        name="weight"
        type="number"
        step="0.01"
        value={form.weight}
        onChange={v => update('weight', v)}
        placeholder="0.00"
        suffix="kg"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField
          label="长 (cm)"
          name="length"
          type="number"
          step="0.1"
          value={form.length}
          onChange={v => update('length', v)}
          placeholder="0"
          suffix="cm"
        />
        <FormField
          label="宽 (cm)"
          name="width"
          type="number"
          step="0.1"
          value={form.width}
          onChange={v => update('width', v)}
          placeholder="0"
          suffix="cm"
        />
        <FormField
          label="高 (cm)"
          name="height"
          type="number"
          step="0.1"
          value={form.height}
          onChange={v => update('height', v)}
          placeholder="0"
          suffix="cm"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          label="运费分类"
          name="shippingClass"
          value={form.shippingClass}
          onChange={v => update('shippingClass', v)}
          placeholder="Standard / Express"
        />
        <FormField
          label="HS Code"
          name="hsCode"
          value={form.hsCode}
          onChange={v => update('hsCode', v)}
          placeholder="例如：8509.40"
        />
      </div>
    </div>
  );
}
