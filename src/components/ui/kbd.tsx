import { cn } from '@/lib/utils';

interface KbdProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Kbd({ children, className, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center px-2 py-1 text-xs font-semibold rounded border bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-600',
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}
