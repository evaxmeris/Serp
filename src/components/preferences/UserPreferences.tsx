'use client';

/**
 * 用户偏好设置组件
 * 提供主题色、语言、每页条数、通知开关的设置界面
 * 
 * 可嵌入到个人中心/profile 或 settings 页面中
 * 
 * @example
 * ```tsx
 * import { UserPreferencesPanel } from '@/components/preferences/UserPreferences';
 * 
 * // 在页面中使用
 * <UserPreferencesPanel />
 * ```
 */

import {
  Palette,
  Globe,
  List,
  Bell,
  Sun,
  Moon,
  Monitor,
  CheckCircle2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { usePreferences, applyTheme, type ThemeMode } from '@/hooks/use-preferences';

// ============================================================
// 主题选项
// ============================================================

interface ThemeOption {
  value: ThemeMode;
  label: string;
  labelZh: string;
  icon: React.ReactNode;
}

const themeOptions: ThemeOption[] = [
  {
    value: 'light',
    label: 'Light',
    labelZh: '浅色模式',
    icon: <Sun className="h-4 w-4" />,
  },
  {
    value: 'dark',
    label: 'Dark',
    labelZh: '深色模式',
    icon: <Moon className="h-4 w-4" />,
  },
  {
    value: 'system',
    label: 'System',
    labelZh: '跟随系统',
    icon: <Monitor className="h-4 w-4" />,
  },
];

// ============================================================
// 语言选项
// ============================================================

const languageOptions = [
  { value: 'zh' as const, label: '中文', labelEn: 'Chinese' },
  { value: 'en' as const, label: 'English', labelEn: 'English' },
];

// ============================================================
// 每页条数选项
// ============================================================

const pageSizeOptions = [
  { value: 10 as const, label: '10 条/页' },
  { value: 20 as const, label: '20 条/页' },
  { value: 50 as const, label: '50 条/页' },
];

// ============================================================
// 组件
// ============================================================

export function UserPreferencesPanel() {
  const { preferences, updatePreference, updatePreferences, resetPreferences, loaded } =
    usePreferences();

  if (!loaded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>个人偏好</CardTitle>
          <CardDescription>自定义您的使用体验</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-zinc-400">
            加载中...
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentThemeOption = themeOptions.find(
    (opt) => opt.value === preferences.theme
  );

  const handleThemeChange = (value: string) => {
    const theme = value as ThemeMode;
    updatePreference('theme', theme);
    applyTheme(theme);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
            <Palette className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <CardTitle>个人偏好</CardTitle>
            <CardDescription>自定义您的使用体验</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* 主题色设置 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-zinc-400" />
              <Label className="text-sm font-medium">主题色</Label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleThemeChange(option.value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    preferences.theme === option.value
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      preferences.theme === option.value
                        ? 'text-purple-600'
                        : 'text-zinc-400'
                    }`}
                  >
                    {option.icon}
                  </div>
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {option.labelZh}
                  </span>
                  {preferences.theme === option.value && (
                    <CheckCircle2 className="h-3 w-3 text-purple-600 absolute top-2 right-2" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* 语言设置 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-zinc-400" />
              <div>
                <Label className="text-sm font-medium">语言</Label>
                <p className="text-xs text-zinc-500">界面显示语言</p>
              </div>
            </div>
            <Select
              value={preferences.language}
              onValueChange={(value: string) =>
                updatePreference('language', value as 'zh' | 'en')
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="选择语言" />
              </SelectTrigger>
              <SelectContent>
                {languageOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* 每页条数设置 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <List className="h-4 w-4 text-zinc-400" />
              <div>
                <Label className="text-sm font-medium">每页条数</Label>
                <p className="text-xs text-zinc-500">列表页默认显示条数</p>
              </div>
            </div>
            <Select
              value={String(preferences.pageSize)}
              onValueChange={(value: string) =>
                updatePreference('pageSize', Number(value) as 10 | 20 | 50)
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="选择每页条数" />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* 通知开关 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-zinc-400" />
              <div>
                <Label className="text-sm font-medium">系统通知</Label>
                <p className="text-xs text-zinc-500">
                  接收订单更新、审批提醒等系统通知
                </p>
              </div>
            </div>
            <Switch
              checked={preferences.notifications}
              onCheckedChange={(checked) =>
                updatePreference('notifications', checked)
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
