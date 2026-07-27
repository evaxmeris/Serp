'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface FormFieldProps {
  label: string;
  name: string;
  value: any;
  onChange: (value: any) => void;
  type?: 'text' | 'number' | 'textarea' | 'select';
  placeholder?: string;
  options?: { value: string; label: string }[];
  suffix?: string;
  step?: string;
  disabled?: boolean;
  rows?: number;
  className?: string;
}

export function FormField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
  options,
  suffix,
  step,
  disabled,
  rows = 3,
  className = '',
}: FormFieldProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label htmlFor={name} className="text-xs text-gray-500 font-medium">
        {label}
      </Label>
      <div className="relative">
        {type === 'textarea' ? (
          <Textarea
            id={name}
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            disabled={disabled}
            className="text-sm"
          />
        ) : type === 'select' && options ? (
          <Select
            value={value || options[0]?.value || ''}
            onValueChange={onChange}
            disabled={disabled}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder={placeholder || '选择...'} />
            </SelectTrigger>
            <SelectContent>
              {options.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id={name}
            type={type}
            value={value ?? ''}
            onChange={e =>
              type === 'number'
                ? onChange(e.target.value ? parseFloat(e.target.value) : null)
                : onChange(e.target.value)
            }
            placeholder={placeholder}
            step={step}
            disabled={disabled}
            className="text-sm pr-8"
          />
        )}
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
