'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPlus, Check, X } from 'lucide-react';
import Link from 'next/link';

// 密码强度等级定义
type PasswordStrength = 0 | 1 | 2 | 3 | 4;

// 计算密码强度
const calculatePasswordStrength = (password: string): PasswordStrength => {
  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[a-z]/.test(password) && /[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;
  return Math.min(4, strength) as PasswordStrength;
};

// 获取密码强度颜色和文字
const getPasswordStrengthInfo = (strength: PasswordStrength) => {
  switch (strength) {
    case 0:
      return { label: '极弱', color: 'bg-red-500', text: 'text-red-600' };
    case 1:
      return { label: '弱', color: 'bg-orange-500', text: 'text-orange-600' };
    case 2:
      return { label: '中等', color: 'bg-yellow-500', text: 'text-yellow-600' };
    case 3:
      return { label: '强', color: 'bg-blue-500', text: 'text-blue-600' };
    case 4:
      return { label: '非常强', color: 'bg-green-500', text: 'text-green-600' };
    default:
      return { label: '极弱', color: 'bg-red-500', text: 'text-red-600' };
  }
};

// 密码验证规则
const passwordRules = [
  { test: (p: string) => p.length >= 8, label: '至少 8 个字符' },
  { test: (p: string) => /[A-Z]/.test(p), label: '包含大写字母' },
  { test: (p: string) => /[a-z]/.test(p), label: '包含小写字母' },
  { test: (p: string) => /[0-9]/.test(p), label: '包含数字' },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: '包含特殊字符' },
];

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>(0);

  // 当密码变化时重新计算强度
  useEffect(() => {
    setPasswordStrength(calculatePasswordStrength(formData.password));
  }, [formData.password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // 前端表单验证
    if (formData.password !== formData.confirmPassword) {
      setError('两次输入的密码不一致');
      setLoading(false);
      return;
    }

    if (passwordStrength < 2) {
      setError('密码强度太弱，请使用更强的密码');
      setLoading(false);
      return;
    }

    if (!formData.email || !formData.name || !formData.phone) {
      setError('请填写所有必填字段');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          password: formData.password,
          phone: formData.phone,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // 注册成功后跳转到待审批页面
        router.push('/pending-approval');
      } else {
        setError(data.error || '注册失败');
      }
    } catch (error) {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-zinc-900 dark:via-zinc-950 dark:to-black">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
      
      <Card className="w-full max-w-md shadow-xl border-0 ring-1 ring-zinc-200 dark:ring-zinc-800">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
            <UserPlus className="h-8 w-8 text-white" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-bold">创建账户</CardTitle>
            <CardDescription className="text-base">
              开始使用 Trade ERP
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
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
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300" htmlFor="name">
                姓名 <span className="text-red-500">*</span>
              </label>
              <Input
                id="name"
                placeholder="你的姓名"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300" htmlFor="phone">
                联系电话 <span className="text-red-500">*</span>
              </label>
              <Input
                id="phone"
                placeholder="手机号码"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300" htmlFor="password">
                密码 <span className="text-red-500">*</span>
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="h-11"
                required
                minLength={8}
              />
              
              {/* 密码强度条 */}
              {formData.password && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">密码强度：</span>
                    <span className={`text-sm font-semibold ${getPasswordStrengthInfo(passwordStrength).text}`}>
                      {getPasswordStrengthInfo(passwordStrength).label}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3].map((index) => (
                      <div
                        key={index}
                        className={`h-2 flex-1 rounded-full ${
                          index < passwordStrength
                            ? getPasswordStrengthInfo(passwordStrength).color
                            : 'bg-zinc-200 dark:bg-zinc-700'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    {passwordRules.map((rule, index) => {
                      const passed = rule.test(formData.password);
                      return (
                        <div
                          key={index}
                          className={`flex items-center gap-2 text-xs ${
                            passed ? 'text-green-600' : 'text-zinc-500'
                          }`}
                        >
                          {passed ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                          {rule.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300" htmlFor="confirmPassword">
                确认密码 <span className="text-red-500">*</span>
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                className="h-11"
                required
                minLength={8}
              />
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-xs text-red-500">两次输入的密码不一致</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 text-base font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-md hover:shadow-lg transition-all" 
              disabled={loading}
            >
              {loading ? '注册中...' : '注册'}
            </Button>

            <div className="text-center text-sm pt-2">
              <Link 
                href="/login" 
                className="text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
              >
                已有账户？立即登录 →
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
