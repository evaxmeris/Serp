'use client';

import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut, Settings, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export type UserStatus = 'online' | 'away' | 'busy' | 'offline';

interface UserAvatarProps {
  user: {
    name?: string;
    email: string;
    avatarUrl?: string;
    status?: UserStatus;
  };
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
  showName?: boolean;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

const statusSizeClasses = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
};

const statusColorClasses: Record<UserStatus, string> = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
  offline: 'bg-zinc-400',
};

// 根据字符串生成稳定的渐变颜色
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = hash % 360;
  return `hsl(${h}, 70%, 50%)`;
}

// 获取用户首字母
function getInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const initials = name.trim().split(/\s+/).map(word => word[0]).join('');
    return initials.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return '?';
}

export function UserAvatar({ user, size = 'md', showStatus = true, showName = false }: UserAvatarProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const initials = getInitials(user.name, user.email);
  const bgColor = stringToColor(user.name || user.email);
  const status = user.status || 'online';

  const handleLogout = async () => {
    try {
      // 调用后端登出 API 清除 cookie
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // 清除 localStorage 中的用户信息
      localStorage.removeItem('user');
      // 使用 Next.js router 跳转到登录页面
      router.push('/login');
      router.refresh();
    }
  };

  const handleProfileClick = () => {
    router.push('/profile');
    setOpen(false);
  };

  const handleSettingsClick = () => {
    router.push('/settings');
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative flex items-center gap-2 p-1 rounded-full transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="用户菜单"
        >
          {/* 头像容器 */}
          <div
            className={cn(
              'relative overflow-hidden rounded-full flex items-center justify-center text-white font-semibold transition-transform duration-200 hover:scale-105',
              sizeClasses[size]
            )}
            style={{
              background: user.avatarUrl ? undefined : `linear-gradient(135deg, ${bgColor}, ${stringToColor(bgColor + 'salt')})`,
            }}
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name || user.email}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className={size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'}>
                {initials}
              </span>
            )}
          </div>

          {/* 状态指示器 */}
          {showStatus && (
            <div
              className={cn(
                'absolute bottom-0 right-0 rounded-full ring-2 ring-white dark:ring-zinc-900',
                statusSizeClasses[size],
                statusColorClasses[status]
              )}
            />
          )}

          {/* 用户名（大屏幕显示） */}
          {showName && user.name && (
            <span className="hidden md:inline text-sm font-medium text-zinc-700 dark:text-zinc-200 pr-1">
              {user.name}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="font-medium">{user.name || user.email}</span>
            {user.name && <span className="text-xs text-zinc-500 dark:text-zinc-400">{user.email}</span>}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleProfileClick}>
          <UserCircle className="mr-2 h-4 w-4" />
          <span>个人资料</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSettingsClick}>
          <Settings className="mr-2 h-4 w-4" />
          <span>设置</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default UserAvatar;
