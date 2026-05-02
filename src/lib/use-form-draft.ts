'use client';

/**
 * 表单草稿自动保存与离开确认 Hook
 *
 * 功能：
 * 1. 自动保存表单数据到 localStorage（每 3 秒轮询）
 * 2. 提交成功后清除草稿
 * 3. 离开页面前确认（beforeunload）
 */

import { useEffect, useCallback, useRef } from 'react';

const DRAFT_PREFIX = 'trade-erp-draft-';

/**
 * 草稿自动保存 hook
 * @param formKey  唯一标识（如 'order-new'），用于 localStorage key
 * @param formData 当前表单数据对象
 * @param isDirty  表单是否有未保存的修改（react-hook-form 可用 form.formState.isDirty）
 * @param isSubmitting 是否正在提交（提交时暂停自动保存）
 */
export function useFormDraft<T>(
  formKey: string,
  formData: T,
  isDirty: boolean,
  isSubmitting: boolean,
) {
  const storageKey = DRAFT_PREFIX + formKey;
  const prevDataRef = useRef<T>(formData);

  // 自动保存草稿到 localStorage（每 3 秒检测一次变化）
  useEffect(() => {
    if (isSubmitting || !isDirty) return;

    const timer = setTimeout(() => {
      try {
        const serialized = JSON.stringify(formData);
        if (serialized !== JSON.stringify(prevDataRef.current)) {
          localStorage.setItem(storageKey, serialized);
          prevDataRef.current = formData;
        }
      } catch {
        // localStorage 已满，静默忽略
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [formData, storageKey, isDirty, isSubmitting]);

  // 从 localStorage 恢复草稿
  const loadDraft = useCallback((): T | null => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? (JSON.parse(saved) as T) : null;
    } catch {
      return null;
    }
  }, [storageKey]);

  // 提交成功后清除草稿
  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    prevDataRef.current = formData;
  }, [storageKey, formData]);

  // 检查草稿是否存在
  const hasDraft = useCallback((): boolean => {
    try {
      return localStorage.getItem(storageKey) !== null;
    } catch {
      return false;
    }
  }, [storageKey]);

  return { loadDraft, clearDraft, hasDraft };
}

/**
 * 离开确认 hook —— 表单有未保存内容时阻止浏览器关闭/刷新
 */
export function useLeaveConfirmation(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);
}
