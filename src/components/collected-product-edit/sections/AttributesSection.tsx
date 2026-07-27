'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, GripVertical } from 'lucide-react';
import type { EditableAttribute, EditPageAction } from '../types';

interface AttributesSectionProps {
  attributes: EditableAttribute[];
  dispatch: React.Dispatch<EditPageAction>;
}

export function AttributesSection({ attributes, dispatch }: AttributesSectionProps) {
  if (attributes.length === 0) {
    return (
      <div className="space-y-3">
        <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
          暂无属性
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => dispatch({ type: 'ADD_ATTRIBUTE' })}
        >
          <Plus className="h-4 w-4 mr-1" /> 添加属性
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="w-8 px-2 py-2"></th>
              <th className="text-left text-xs font-medium text-gray-500 px-2 py-2">属性名</th>
              <th className="text-left text-xs font-medium text-gray-500 px-2 py-2">属性值</th>
              <th className="text-left text-xs font-medium text-gray-500 px-2 py-2">单位</th>
              <th className="w-10 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {attributes.map((attr, index) => (
              <tr key={attr.id || index} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-2 py-1.5 text-gray-300">
                  <GripVertical className="h-4 w-4" />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    value={attr.name}
                    onChange={e =>
                      dispatch({
                        type: 'UPDATE_ATTRIBUTE',
                        index,
                        field: 'name',
                        value: e.target.value,
                      })
                    }
                    placeholder="如：成分"
                    className="text-sm h-8"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    value={attr.value}
                    onChange={e =>
                      dispatch({
                        type: 'UPDATE_ATTRIBUTE',
                        index,
                        field: 'value',
                        value: e.target.value,
                      })
                    }
                    placeholder="如：山茶花油"
                    className="text-sm h-8"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    value={attr.unit}
                    onChange={e =>
                      dispatch({
                        type: 'UPDATE_ATTRIBUTE',
                        index,
                        field: 'unit',
                        value: e.target.value,
                      })
                    }
                    placeholder="如：ml"
                    className="text-sm h-8"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-gray-400 hover:text-red-500"
                    onClick={() => dispatch({ type: 'DELETE_ATTRIBUTE', index })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => dispatch({ type: 'ADD_ATTRIBUTE' })}
      >
        <Plus className="h-4 w-4 mr-1" /> 添加属性
      </Button>
    </div>
  );
}
