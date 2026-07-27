'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus } from 'lucide-react';
import type { EditableVariant, EditPageAction } from '../types';

interface VariantsSectionProps {
  variants: EditableVariant[];
  dispatch: React.Dispatch<EditPageAction>;
}

export function VariantsSection({ variants, dispatch }: VariantsSectionProps) {
  if (variants.length === 0) {
    return (
      <div className="space-y-3">
        <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
          无变体（单一规格产品）
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => dispatch({ type: 'ADD_VARIANT' })}
          >
            <Plus className="h-4 w-4 mr-1" /> 添加变体
          </Button>
        </div>
      </div>
    );
  }

  // 提取所有变体维度名称
  const groupNames = Array.from(
    new Set(variants.flatMap(v => v.options.map(o => o.name)))
  );

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left text-xs font-medium text-gray-500 px-2 py-2">SKU</th>
              {groupNames.map(name => (
                <th key={name} className="text-left text-xs font-medium text-gray-500 px-2 py-2">
                  {name}
                </th>
              ))}
              <th className="text-left text-xs font-medium text-gray-500 px-2 py-2">价格</th>
              <th className="text-left text-xs font-medium text-gray-500 px-2 py-2">库存</th>
              <th className="w-10 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {variants.map((variant, index) => (
              <tr key={variant.id || index} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-2 py-1.5">
                  <Input
                    value={variant.sku}
                    onChange={e =>
                      dispatch({
                        type: 'UPDATE_VARIANT',
                        index,
                        field: 'sku',
                        value: e.target.value,
                      })
                    }
                    placeholder="SKU"
                    className="text-sm h-8 w-24"
                  />
                </td>
                {groupNames.map(name => {
                  const opt = variant.options.find(o => o.name === name);
                  return (
                    <td key={name} className="px-2 py-1.5 text-sm text-gray-700">
                      {opt?.value || '-'}
                    </td>
                  );
                })}
                <td className="px-2 py-1.5">
                  <Input
                    type="number"
                    step="0.01"
                    value={variant.price ?? ''}
                    onChange={e =>
                      dispatch({
                        type: 'UPDATE_VARIANT',
                        index,
                        field: 'price',
                        value: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    placeholder="0.00"
                    className="text-sm h-8 w-20"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    type="number"
                    value={variant.stock ?? ''}
                    onChange={e =>
                      dispatch({
                        type: 'UPDATE_VARIANT',
                        index,
                        field: 'stock',
                        value: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                    placeholder="0"
                    className="text-sm h-8 w-16"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-gray-400 hover:text-red-500"
                    onClick={() => dispatch({ type: 'DELETE_VARIANT', index })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => dispatch({ type: 'ADD_VARIANT' })}
        >
          <Plus className="h-4 w-4 mr-1" /> 添加变体
        </Button>
      </div>
    </div>
  );
}
