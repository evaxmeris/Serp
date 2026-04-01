'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

// 前端表单验证
const validateForm = (email: string, password: string): string | null => {
  if (!email || !password) {
    return '请填写邮箱和密码';
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return '请输入有效的邮箱地址';
  }
  if (password.length < 6) {
    return '密码长度至少6位';
  }
  return null;
};

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });

  // 页面加载时读取记住的邮箱
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    const remember = localStorage.getItem('rememberMe') === 'true';
    if (savedEmail && remember) {
      setFormData(prev => ({ ...prev, email: savedEmail }));
      setRememberMe(true);
    }
  }, []);

  // 处理键盘回车提交
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const form = e.currentTarget.closest('form');
      if (form) {
        form.requestSubmit();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // 前端验证
    const validationError = validateForm(formData.email, formData.password);
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        // 处理记住我
        if (rememberMe) {
          localStorage.setItem('rememberedEmail', formData.email);
          localStorage.setItem('rememberMe', 'true');
        } else {
          localStorage.removeItem('rememberedEmail');
          localStorage.removeItem('rememberMe');
        }
        // 保存用户信息到 localStorage
        localStorage.setItem('user', JSON.stringify(data.user));
        // 跳转到首页（中间件会处理认证）
        router.push('/');
        router.refresh();
      } else {
        setError(data.error || '登录失败');
      }
    } catch (error) {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-zinc-900 dark:via-zinc-950 dark:to-black px-4 sm:px-6 py-8">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
      
      <Card className="w-full max-w-md shadow-xl border-0 ring-1 ring-zinc-200 dark:ring-zinc-800 rounded-2xl">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
            <LogIn className="h-8 w-8 text-white" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Trade ERP
            </CardTitle>
            <CardDescription className="text-base">
              外贸业务管理专家
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300" htmlFor="email">
                邮箱
              </label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
                onKeyDown={handleKeyDown}
                className="h-11"
                required
                aria-required="true"
              />
              {touched.email && formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) && (
                <p className="text-xs text-red-500">请输入有效的邮箱地址</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300" htmlFor="password">
                密码
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
                  onKeyDown={handleKeyDown}
                  className="h-11 pr-11"
                  required
                  aria-required="true"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <label
                  htmlFor="remember"
                  className="text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer select-none"
                >
                  记住我
                </label>
              </div>
              <Link
                href="/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
              >
                忘记密码?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all"
              disabled={loading}
            >
              {loading ? '登录中...' : '登录'}
            </Button>

            <div className="text-center text-sm pt-2">
              <Link
                href="/register"
                className="text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
              >
                没有账户？立即注册 →
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
