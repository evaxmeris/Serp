'use client';

import { Separator } from '@/components/ui/separator';

interface SectionDividerProps {
  title: string;
  icon?: string;
  defaultOpen?: boolean;
}

export function SectionDivider({ title, icon }: SectionDividerProps) {
  return (
    <div className="flex items-center gap-2 pt-6 pb-3">
      {icon && <span className="text-base">{icon}</span>}
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      <Separator className="flex-1" />
    </div>
  );
}
