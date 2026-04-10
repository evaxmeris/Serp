/**
 * 认证守卫组件
 * 未登录时显示登录提示
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogIn, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requiredRoles?: string[];
}

export function AuthGuard({ children, fallback, requiredRoles }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('ADMIN');
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = () => {
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      const user = JSON.parse(userStr);
      setIsAuthenticated(true);
      setUserRole(user.role || 'ADMIN');
      setIsLoading(false);

      // 检查角色权限
      if (requiredRoles && !requiredRoles.includes(user.role)) {
        // 权限不足，显示提示
      }
    } catch (error) {
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md p-8">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-6 border border-yellow-200 dark:border-yellow-800">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">请先登录</h2>
            <p className="text-muted-foreground mb-6">
              您需要登录后才能访问此页面
            </p>
            <div className="flex gap-4 justify-center">
              <Button asChild>
                <Link href="/login">
                  <LogIn className="h-4 w-4 mr-2" />
                  立即登录
                </Link>
              </Button>
              <Button variant="outline" onClick={() => router.back()}>
                返回上一页
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (requiredRoles && !requiredRoles.includes(userRole)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md p-8">
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 border border-red-200 dark:border-red-800">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">权限不足</h2>
            <p className="text-muted-foreground mb-6">
              您的角色（{userRole}）无权访问此页面
            </p>
            <Button variant="outline" onClick={() => router.back()}>
              返回上一页
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
