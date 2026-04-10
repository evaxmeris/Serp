'use client';

/**
 * 个人资料页面
 * 用户个人信息、账号安全、个人偏好
 * 
 * @作者 应亮
 * @创建日期 2026-04-10
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  User,
  Mail,
  Phone,
  Building2,
  Shield,
  Key,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  Camera,
  Clock,
  Globe,
  Bell,
  Palette,
} from 'lucide-react';

// 角色显示映射
const roleLabels: Record<string, { label: string; color: string }> = {
  ADMIN: { label: '管理员', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  SALES: { label: '业务员', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  PURCHASING: { label: '采购员', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  WAREHOUSE: { label: '仓管员', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  VIEWER: { label: '访客', color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400' },
};

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // 读取用户信息
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setUser(JSON.parse(userStr));
    }
  }, []);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <User className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
          <p className="text-zinc-500">请先登录后查看个人资料</p>
        </div>
      </div>
    );
  }

  const roleInfo = roleLabels[user.role] || roleLabels.VIEWER;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
            👤 个人资料
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            管理个人信息和账号设置
          </p>
        </div>
        <Button
          onClick={handleSave}
          className={`transition-all ${saved ? 'bg-green-600' : ''}`}
        >
          {saved ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              已保存
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              保存修改
            </>
          )}
        </Button>
      </div>

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>基本信息</CardTitle>
              <CardDescription>您的账号信息和联系方式</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            {/* 头像 */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <button className="absolute -bottom-1 -right-1 w-8 h-8 bg-white dark:bg-zinc-800 rounded-full shadow-md flex items-center justify-center border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 transition-colors">
                  <Camera className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                </button>
              </div>
              <Badge className={roleInfo.color}>{roleInfo.label}</Badge>
            </div>

            {/* 表单 */}
            <div className="flex-1 w-full space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium mb-1.5 block flex items-center gap-2">
                    <User className="h-4 w-4 text-zinc-400" />
                    姓名
                  </label>
                  <Input defaultValue={user.name || ''} placeholder="请输入姓名" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block flex items-center gap-2">
                    <Mail className="h-4 w-4 text-zinc-400" />
                    邮箱
                  </label>
                  <Input defaultValue={user.email} disabled className="bg-zinc-50 dark:bg-zinc-800/50" />
                  <p className="text-xs text-zinc-500 mt-1">邮箱不可修改</p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block flex items-center gap-2">
                    <Phone className="h-4 w-4 text-zinc-400" />
                    手机号
                  </label>
                  <Input placeholder="请输入手机号" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-zinc-400" />
                    部门
                  </label>
                  <Input placeholder="请输入部门" />
                </div>
              </div>

              <Separator />

              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">账号 ID</span>
                <span className="font-mono text-zinc-600 dark:text-zinc-400">{user.id}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">注册时间</span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '未知'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 账号安全 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
              <Shield className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <CardTitle>账号安全</CardTitle>
              <CardDescription>修改密码，保护账号安全</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block flex items-center gap-2">
              <Key className="h-4 w-4 text-zinc-400" />
              当前密码
            </label>
            <div className="relative">
              <Input type={showPassword ? 'text' : 'password'} placeholder="请输入当前密码" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">新密码</label>
              <Input type="password" placeholder="至少 8 位，含字母和数字" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">确认新密码</label>
              <Input type="password" placeholder="再次输入新密码" />
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            密码要求：至少 8 位字符，包含大小写字母和数字
          </p>
        </CardContent>
      </Card>

      {/* 个人偏好 */}
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
          <div className="space-y-4">
            {[
              {
                icon: <Globe className="h-4 w-4" />,
                label: '默认币种',
                value: 'USD (美元)',
                desc: '新建订单和报价时的默认币种',
              },
              {
                icon: <Bell className="h-4 w-4" />,
                label: '通知偏好',
                value: '站内消息 + 邮件',
                desc: '接收系统通知的方式',
              },
              {
                icon: <Clock className="h-4 w-4" />,
                label: '时区设置',
                value: 'Asia/Shanghai (UTC+8)',
                desc: '日期和时间的显示时区',
              },
              {
                icon: <Palette className="h-4 w-4" />,
                label: '主题',
                value: '跟随系统',
                desc: '界面外观风格',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="text-zinc-400">{item.icon}</div>
                  <div>
                    <div className="font-medium text-sm">{item.label}</div>
                    <div className="text-xs text-zinc-500">{item.desc}</div>
                  </div>
                </div>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">{item.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
