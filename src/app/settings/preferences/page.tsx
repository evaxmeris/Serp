'use client';

/**
 * 偏好设置页面
 * 独立的偏好设置页面，位于 /settings/preferences
 * 也可通过个人中心的"个人偏好"Tab 访问
 */

import { UserPreferencesPanel } from '@/components/preferences/UserPreferences';

export default function PreferencesPage() {
  return (
    <div className="p-6 space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
            🎨 偏好设置
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            自定义您的系统使用体验
          </p>
        </div>
      </div>

      <UserPreferencesPanel />
    </div>
  );
}
