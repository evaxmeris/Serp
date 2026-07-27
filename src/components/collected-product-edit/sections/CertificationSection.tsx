'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { DEFAULT_CERTIFICATIONS } from '../types';
import type { EditPageAction } from '../types';

interface CertificationSectionProps {
  certifications: string[];
  dispatch: React.Dispatch<EditPageAction>;
}

export function CertificationSection({ certifications, dispatch }: CertificationSectionProps) {
  const [customCert, setCustomCert] = useState('');

  const handleAddCustom = () => {
    if (customCert.trim()) {
      dispatch({ type: 'ADD_CERT', name: customCert.trim().toUpperCase() });
      setCustomCert('');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {DEFAULT_CERTIFICATIONS.map(cert => {
          const active = certifications.includes(cert);
          return (
            <Badge
              key={cert}
              variant={active ? 'default' : 'outline'}
              className={`cursor-pointer select-none text-xs px-3 py-1 ${
                active
                  ? 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200'
                  : 'text-gray-400 hover:text-gray-600 hover:border-gray-300'
              }`}
              onClick={() => dispatch({ type: 'TOGGLE_CERT', cert })}
            >
              {active ? '✅ ' : ''}{cert}
            </Badge>
          );
        })}
      </div>

      {/* 自定义认证 */}
      <div className="flex items-center gap-2">
        <input
          value={customCert}
          onChange={e => setCustomCert(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
          placeholder="输入自定义认证名称..."
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddCustom}
          disabled={!customCert.trim()}
        >
          <Plus className="h-4 w-4 mr-1" /> 添加
        </Button>
      </div>

      {/* 已添加的自定义认证列表 */}
      {certifications
        .filter(c => !DEFAULT_CERTIFICATIONS.includes(c as any))
        .map(cert => (
          <Badge
            key={cert}
            variant="secondary"
            className="text-xs px-3 py-1 mr-1 mb-1 cursor-pointer hover:bg-red-50 hover:text-red-600 hover:border-red-200"
            onClick={() => dispatch({ type: 'REMOVE_CERT', name: cert })}
          >
            {cert} ✕
          </Badge>
        ))}
    </div>
  );
}
