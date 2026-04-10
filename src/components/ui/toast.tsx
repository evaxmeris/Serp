'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToastProps {
  id?: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onClose?: () => void;
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ message, type = 'info', duration = 3000, onClose }, ref) => {
    React.useEffect(() => {
      if (duration > 0) {
        const timer = setTimeout(() => {
          onClose?.();
        }, duration);
        return () => clearTimeout(timer);
      }
    }, [duration, onClose]);

    const typeStyles = {
      success: 'bg-green-500 text-white',
      error: 'bg-red-500 text-white',
      warning: 'bg-yellow-500 text-white',
      info: 'bg-blue-500 text-white',
    };

    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-between px-4 py-3 rounded-lg shadow-lg min-w-[300px] max-w-md',
          typeStyles[type]
        )}
        style={{
          backgroundColor: type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : type === 'warning' ? '#eab308' : '#3b82f6',
          color: 'white',
          pointerEvents: 'auto',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{icons[type]}</span>
          <span className="text-sm font-medium">{message}</span>
        </div>
        <button
          onClick={onClose}
          className="ml-2 hover:opacity-70 transition-opacity"
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }
);

Toast.displayName = 'Toast';

export interface ToastContainerProps {
  toasts: ToastProps[];
  removeToast: (id: string) => void;
  position?: 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center';
}

export function ToastContainer({ toasts, removeToast, position = 'top-right' }: ToastContainerProps) {
  const positionStyles = {
    'top-right': 'top-4 right-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-right': 'bottom-4 right-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  // Debug logging
  React.useEffect(() => {
    console.log('[ToastContainer] Rendered with toasts:', toasts.length, toasts);
  }, [toasts]);

  if (typeof window === 'undefined') {
    console.log('[ToastContainer] SSR - returning null');
    return null;
  }

  console.log('[ToastContainer] Creating portal, toasts count:', toasts.length);

  return createPortal(
    <div
      className={cn(
        'fixed z-[9999] flex flex-col gap-2 pointer-events-auto',
        positionStyles[position]
      )}
      style={{ pointerEvents: 'auto' }}
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={() => toast.id && removeToast(toast.id)}
        />
      ))}
    </div>,
    document.body
  );
}

// Toast 管理器 Hook
export function useToast() {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);

  const addToast = React.useCallback((message: string, type: ToastProps['type'] = 'info', duration?: number) => {
    const id = Math.random().toString(36).substr(2, 9);
    console.log('[useToast] Adding toast:', { id, message, type, duration });
    setToasts((prev) => {
      const newToasts = [...prev, { id, message, type, duration }];
      console.log('[useToast] New toasts state:', newToasts);
      return newToasts;
    });
    return id;
  }, []);

  const removeToast = React.useCallback((id: string) => {
    console.log('[useToast] Removing toast:', id);
    setToasts((prev) => {
      const newToasts = prev.filter((t) => t.id !== id);
      console.log('[useToast] After remove:', newToasts);
      return newToasts;
    });
  }, []);

  const toast = React.useMemo(() => ({
    success: (message: string, duration?: number) => {
      console.log('[useToast.toast] Calling success:', message);
      return addToast(message, 'success', duration);
    },
    error: (message: string, duration?: number) => {
      console.log('[useToast.toast] Calling error:', message);
      return addToast(message, 'error', duration);
    },
    warning: (message: string, duration?: number) => {
      console.log('[useToast.toast] Calling warning:', message);
      return addToast(message, 'warning', duration);
    },
    info: (message: string, duration?: number) => {
      console.log('[useToast.toast] Calling info:', message);
      return addToast(message, 'info', duration);
    },
  }), [addToast]);

  console.log('[useToast] Returning:', { toastsCount: toasts.length, toasts });
  return { toasts, removeToast, toast };
}

export { Toast };
