/**
 * Loading 状态组件
 * 统一加载状态显示
 */

import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface LoadingProps {
  className?: string;
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  overlay?: boolean;
}

export function Loading({ className, text, size = 'md', overlay = false }: LoadingProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const content = (
    <div className="flex flex-col items-center justify-center gap-2">
      <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} />
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  );

  if (overlay) {
    return (
      <div className={cn(
        'fixed inset-0 bg-background/80 backdrop-blur-sm z-50',
        'flex items-center justify-center',
        className
      )}>
        {content}
      </div>
    );
  }

  return (
    <div className={cn(
      'flex items-center justify-center py-8',
      className
    )}>
      {content}
    </div>
  );
}

/**
 * 按钮 Loading 状态
 */
export function ButtonLoading({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
  };

  return <Loader2 className={cn('animate-spin', sizeClasses[size])} />;
}

/**
 * 页面 Loading（全屏）
 */
export function PageLoading({ text = '加载中...' }: { text?: string }) {
  return (
    <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
      <Loading size="lg" text={text} />
    </div>
  );
}

export default Loading;
