'use client';

/**
 * Trade ERP 全局键盘快捷键系统
 *
 * 使用 React Context 模式，支持：
 * - 全局快捷键注册（Ctrl/Cmd + 字母）
 * - 按键序列（g + d, g + o, g + c）
 * - 子组件动态注册/注销快捷键
 * - 自动检测输入框焦点，避免干扰输入
 *
 * @作者 应亮
 * @创建日期 2026-05-02
 * @最后更新 2026-05-02
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';

// ============================================================
// 类型定义
// ============================================================

/** 快捷键处理器 */
export type ShortcutHandler = () => void;

/** 快捷键定义 */
export interface ShortcutDefinition {
  /** 显示名称（快捷键帮助中使用） */
  label: string;
  /** 快捷键描述 */
  description: string;
  /** 快捷键按键（用于显示，如 'Ctrl+K'） */
  keys: string;
  /** 执行处理函数 */
  handler: ShortcutHandler;
  /** 是否在输入框中禁用此快捷键（默认 true） */
  disabledInInput?: boolean;
  /** 优先级（数字越大优先级越高，默认 0） */
  priority?: number;
}

/** 按键序列定义（如 g + d） */
interface SequenceDefinition {
  key: string;
  handler: ShortcutHandler;
  label: string;
  keys: string;
  description: string;
}

/** 上下文值 */
interface KeyboardShortcutsContextValue {
  /** 注册组件级快捷键（在 useEffect 中调用，返回注销函数） */
  registerShortcuts: (shortcuts: ShortcutDefinition[]) => () => void;
  /** 是否正在显示快捷键帮助 */
  showHelp: boolean;
  /** 打开快捷键帮助 */
  openHelp: () => void;
  /** 关闭快捷键帮助 */
  closeHelp: () => void;
}

// ============================================================
// Context
// ============================================================

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | null>(
  null
);

// ============================================================
// Provider
// ============================================================

interface KeyboardShortcutsProviderProps {
  children: ReactNode;
}

export function KeyboardShortcutsProvider({
  children,
}: KeyboardShortcutsProviderProps) {
  const router = useRouter();
  const pathname = usePathname();

  // 快捷键帮助弹窗状态
  const [showHelp, setShowHelp] = useState(false);

  // 组件级注册的快捷键（使用 ref 避免不必要的重渲染）
  const componentShortcutsRef = useRef<Map<string, ShortcutDefinition[]>>(
    new Map()
  );
  const componentIdCounterRef = useRef(0);

  // 按键序列状态（g + d, g + o, g + c）
  const sequenceBufferRef = useRef<string>('');
  const sequenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ============================================================
  // 工具：聚焦全局搜索
  // ============================================================

  const focusGlobalSearch = useCallback(() => {
    const input = document.getElementById('global-search-input') as HTMLInputElement;
    if (input) {
      input.focus();
      input.select();
    }
  }, []);

  // ============================================================
  // 注册/注销组件级快捷键
  // ============================================================

  const registerShortcuts = useCallback(
    (shortcuts: ShortcutDefinition[]): (() => void) => {
      const id = `component_${++componentIdCounterRef.current}`;
      componentShortcutsRef.current.set(id, shortcuts);
      return () => {
        componentShortcutsRef.current.delete(id);
      };
    },
    []
  );

  // ============================================================
  // 全局快捷键映射
  // ============================================================

  /**
   * 获取当前页面的"新建"路径
   * 根据当前路由推断对应的 new 页面路径
   */
  const getNewPagePath = useCallback((): string | null => {
    const segment = pathname.split('/').filter(Boolean)[0];
    const newPageMap: Record<string, string> = {
      orders: '/orders/new',
      customers: '/customers/new',
      suppliers: '/suppliers/new',
      products: '/products/new',
      'purchase-orders': '/purchase-orders/new',
      'inbound-orders': '/inbound-orders/new',
      'outbound-orders': '/outbound-orders/new',
      invoices: '/invoices/new',
      quotations: '/quotations/new',
      inquiries: '/inquiries/new',
    };
    return newPageMap[segment] || null;
  }, [pathname]);

  // ============================================================
  // 全局快捷键定义
  // ============================================================

  /** 按键序列定义 */
  const sequenceKeys: SequenceDefinition[] = [
    {
      key: 'd',
      handler: () => router.push('/dashboard'),
      label: 'g → d',
      keys: 'g, d',
      description: '跳转至仪表盘 (Dashboard)',
    },
    {
      key: 'o',
      handler: () => router.push('/orders'),
      label: 'g → o',
      keys: 'g, o',
      description: '跳转至订单 (Orders)',
    },
    {
      key: 'c',
      handler: () => router.push('/customers'),
      label: 'g → c',
      keys: 'g, c',
      description: '跳转至客户 (Customers)',
    },
    {
      key: 'p',
      handler: () => router.push('/products'),
      label: 'g → p',
      keys: 'g, p',
      description: '跳转至产品 (Products)',
    },
    {
      key: 's',
      handler: () => router.push('/suppliers'),
      label: 'g → s',
      keys: 'g, s',
      description: '跳转至供应商 (Suppliers)',
    },
    {
      key: 'h',
      handler: () => router.push('/'),
      label: 'g → h',
      keys: 'g, h',
      description: '返回首页 (Home)',
    },
  ];

  /** 全局快捷键列表（优先于组件级快捷键） */
  const globalShortcuts: ShortcutDefinition[] = [
    {
      label: 'Ctrl+K / Cmd+K',
      keys: 'Ctrl+K / ⌘K',
      description: '打开全局搜索',
      handler: () => {
        focusGlobalSearch();
      },
      priority: 100,
    },
    {
      label: 'Ctrl+N / Cmd+N',
      keys: 'Ctrl+N / ⌘N',
      description: '新建（跳转到当前页面的新建页）',
      handler: () => {
        const newPath = getNewPagePath();
        if (newPath) {
          router.push(newPath);
        }
      },
      priority: 90,
    },
    {
      label: 'Ctrl+B / Cmd+B',
      keys: 'Ctrl+B / ⌘B',
      description: '切换侧边栏折叠',
      handler: () => {
        window.dispatchEvent(new CustomEvent('toggle-sidebar'));
      },
      priority: 80,
    },
    {
      label: '? / Shift+/',
      keys: '?',
      description: '显示快捷键帮助',
      handler: () => {
        setShowHelp(true);
      },
      priority: 70,
    },
    {
      label: 'Escape',
      keys: 'Esc',
      description: '关闭弹窗 / 取消操作',
      handler: () => {
        setShowHelp(false);
      },
      priority: 60,
    },
  ];

  // ============================================================
  // 判断当前焦点是否在输入框中
  // ============================================================

  const isInputFocused = useCallback((): boolean => {
    const activeElement = document.activeElement;
    if (!activeElement) return false;
    const tagName = activeElement.tagName.toLowerCase();
    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      (activeElement as HTMLElement).contentEditable === 'true' ||
      activeElement.getAttribute('role') === 'textbox'
    );
  }, []);

  // ============================================================
  // 全局键盘事件处理
  // ============================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ---- 按键序列处理（g + ?） ----
      if (sequenceBufferRef.current === 'g') {
        // 找到匹配的序列键
        const matchedSequence = sequenceKeys.find(
          (seq) => seq.key === e.key.toLowerCase()
        );
        if (matchedSequence) {
          e.preventDefault();
          matchedSequence.handler();
          // 清空序列缓冲区
          sequenceBufferRef.current = '';
          if (sequenceTimerRef.current) {
            clearTimeout(sequenceTimerRef.current);
            sequenceTimerRef.current = null;
          }
          return;
        }

        // g 后面跟了不匹配的键，清空缓冲区（除非又是 g）
        if (e.key.toLowerCase() !== 'g') {
          sequenceBufferRef.current = '';
          if (sequenceTimerRef.current) {
            clearTimeout(sequenceTimerRef.current);
            sequenceTimerRef.current = null;
          }
        }
      }

      // ---- 检测 g 键按下（序列开始） ----
      if (
        e.key.toLowerCase() === 'g' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !isInputFocused()
      ) {
        e.preventDefault();
        sequenceBufferRef.current = 'g';

        // 设置超时清空缓冲区
        if (sequenceTimerRef.current) {
          clearTimeout(sequenceTimerRef.current);
        }
        sequenceTimerRef.current = setTimeout(() => {
          sequenceBufferRef.current = '';
          sequenceTimerRef.current = null;
        }, 1000);

        return;
      }

      // ---- 修饰键快捷键处理（Ctrl/Cmd + ?） ----
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'k':
            e.preventDefault();
            // 聚焦到侧边栏 GlobalSearch 组件的搜索输入框
            focusGlobalSearch();
            return;

          case 'n':
            e.preventDefault();
            const newPath = getNewPagePath();
            if (newPath) {
              router.push(newPath);
            }
            return;

          case 'b':
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('toggle-sidebar'));
            return;

          case 'd':
            e.preventDefault();
            router.push('/dashboard');
            return;
        }

        return; // 其他 Ctrl/Cmd 组合键不继续处理
      }

      // ---- 单键处理 ----
      // 输入框中只处理 Escape
      if (isInputFocused()) {
        if (e.key === 'Escape') {
          setShowHelp(false);
          // Escape 关闭 GlobalSearch 由该组件自行处理
        }
        return;
      }

      switch (e.key) {
        case '?':
          e.preventDefault();
          setShowHelp(true);
          break;

        case 'Escape':
          setShowHelp(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router, getNewPagePath, isInputFocused, sequenceKeys, focusGlobalSearch]);

  // ============================================================
  // 辅助方法
  // ============================================================

  const openHelp = useCallback(() => setShowHelp(true), []);
  const closeHelp = useCallback(() => setShowHelp(false), []);

  // ============================================================
  // 提供上下文值
  // ============================================================

  const contextValue: KeyboardShortcutsContextValue = {
    registerShortcuts,
    showHelp,
    openHelp,
    closeHelp,
  };

  return (
    <KeyboardShortcutsContext.Provider value={contextValue}>
      {children}
      {/* Ctrl+K 搜索已统一由 GlobalSearch 组件处理 */}
    </KeyboardShortcutsContext.Provider>
  );
}

// ============================================================
// Hook：使用快捷键上下文
// ============================================================

/**
 * 使用键盘快捷键上下文
 *
 * 在任意子组件中调用此 hook，可以注册/注销组件级快捷键。
 *
 * @example
 * ```tsx
 * function MyListPage() {
 *   useKeyboardShortcuts([
 *     {
 *       label: 'Ctrl+N',
 *       keys: 'Ctrl+N',
 *       description: '新建订单',
 *       handler: () => router.push('/orders/new'),
 *     },
 *   ]);
 * }
 * ```
 */
export function useKeyboardShortcuts(
  shortcuts?: ShortcutDefinition[]
): KeyboardShortcutsContextValue {
  const context = useContext(KeyboardShortcutsContext);

  if (!context) {
    throw new Error(
      'useKeyboardShortcuts must be used within a KeyboardShortcutsProvider'
    );
  }

  // 注册组件级快捷键
  useEffect(() => {
    if (!shortcuts || shortcuts.length === 0) return;
    const unregister = context.registerShortcuts(shortcuts);
    return unregister;
  }, [shortcuts, context]);

  return context;
}
