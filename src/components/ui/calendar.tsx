/**
 * 日历组件（简化版）
 * 用于日期选择
 */

'use client';

import { useState } from 'react';
import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './dialog';

interface CalendarProps {
  value?: string;
  onChange?: (date: string) => void;
  onSelect?: (date: Date) => void;
}

export function Calendar({ value, onChange, onSelect }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const handleDateSelect = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    if (onChange) onChange(dateStr);
    if (onSelect) onSelect(date);
  };

  const handleToday = () => {
    const today = new Date();
    handleDateSelect(today);
  };

  const handleClear = () => {
    if (onChange) onChange('');
  };

  return (
    <div className="space-y-2">
      <input
        type="date"
        value={value || ''}
        onChange={(e) => handleDateSelect(new Date(e.target.value))}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleToday}>
          今天
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleClear}>
          清空
        </Button>
      </div>
    </div>
  );
}

export default Calendar;
