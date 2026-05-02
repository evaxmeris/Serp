'use client';

/**
 * 用户偏好设置 Context 和 Hook
 * 
 * 提供全局用户偏好访问，使用 localStorage 持久化
 * 可在任何页面通过 usePreferences() 读取和更新偏好
 * 
 * 可配置项:
 * - theme: 主题色 (light/dark/system)
 * - language: 语言 (zh/en)
 * - pageSize: 每页条数 (10/20/50)
 * - notifications: 通知开关
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';

// ============================================================
// 类型定义
// ============================================================

export type ThemeMode = 'light' | 'dark' | 'system';
export type Language = 'zh' | 'en';
export type PageSize = 10 | 20 | 50;

export interface UserPreferences {
  /** 主题色模式 */
  theme: ThemeMode;
  /** 界面语言 */
  language: Language;
  /** 列表每页显示条数 */
  pageSize: PageSize;
  /** 是否启用通知 */
  notifications: boolean;
}

export interface UserPreferencesContextValue {
  /** 当前偏好设置 */
  preferences: UserPreferences;
  /** 更新指定偏好字段 */
  updatePreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => void;
  /** 批量更新偏好 */
  updatePreferences: (partial: Partial<UserPreferences>) => void;
  /** 重置为默认值 */
  resetPreferences: () => void;
  /** 是否已加载（避免 SSR 闪烁） */
  loaded: boolean;
}

// ============================================================
// 默认值 & localStorage key
// ============================================================

const STORAGE_KEY = 'trade_erp_user_preferences';

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  language: 'zh',
  pageSize: 20,
  notifications: true,
};

// ============================================================
// Context
// ============================================================

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(
  null
);

// ============================================================
// Provider
// ============================================================

interface UserPreferencesProviderProps {
  children: ReactNode;
}

export function UserPreferencesProvider({
  children,
}: UserPreferencesProviderProps) {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loaded, setLoaded] = useState(false);

  // 初始化：从 localStorage 读取偏好
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
      }
    } catch (error) {
      console.error('读取用户偏好失败:', error);
    } finally {
      setLoaded(true);
    }
  }, []);

  // 写入 localStorage
  const persist = useCallback((prefs: UserPreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (error) {
      console.error('保存用户偏好失败:', error);
    }
  }, []);

  // 同步到后端 API（异步，不阻塞）
  const syncToServer = useCallback(async (prefs: UserPreferences) => {
    try {
      await fetch('/api/v1/user-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
    } catch (error) {
      // 静默失败，不影响用户体验
      console.warn('同步偏好到服务器失败:', error);
    }
  }, []);

  // 更新单个偏好字段
  const updatePreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPreferences((prev) => {
        const next = { ...prev, [key]: value };
        persist(next);
        syncToServer(next);
        return next;
      });
    },
    [persist, syncToServer]
  );

  // 批量更新偏好
  const updatePreferences = useCallback(
    (partial: Partial<UserPreferences>) => {
      setPreferences((prev) => {
        const next = { ...prev, ...partial };
        persist(next);
        syncToServer(next);
        return next;
      });
    },
    [persist, syncToServer]
  );

  // 重置为默认值
  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    persist(DEFAULT_PREFERENCES);
    syncToServer(DEFAULT_PREFERENCES);
  }, [persist, syncToServer]);

  return (
    <UserPreferencesContext.Provider
      value={{
        preferences,
        updatePreference,
        updatePreferences,
        resetPreferences,
        loaded,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================

/**
 * 使用用户偏好的 Hook
 * 
 * @example
 * ```tsx
 * const { preferences, updatePreference } = usePreferences();
 * 
 * // 读取
 * console.log(preferences.theme); // 'light' | 'dark' | 'system'
 * console.log(preferences.pageSize); // 10 | 20 | 50
 * 
 * // 更新
 * updatePreference('theme', 'dark');
 * updatePreference('pageSize', 50);
 * 
 * // 批量更新
 * updatePreferences({ theme: 'light', pageSize: 10 });
 * ```
 */
export function usePreferences(): UserPreferencesContextValue {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error(
      'usePreferences 必须在 UserPreferencesProvider 内部使用'
    );
  }
  return context;
}

// ============================================================
// 工具函数：应用主题到 <html> 元素
// ============================================================

/**
 * 根据偏好主题设置，在 <html> 上添加/移除 dark class
 * 支持 'light' | 'dark' | 'system' 三种模式
 * 
 * 应在应用根组件的 useEffect 中调用
 */
export function applyTheme(theme: ThemeMode): void {
  const root = document.documentElement;

  // 移除现有 class
  root.classList.remove('dark', 'light');

  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
  } else {
    // 'system' - 跟随系统
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      root.classList.add('dark');
    }
  }
}
