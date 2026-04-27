'use client';

/**
 * 个人资料页面
 * 用户个人信息、账号安全、个人偏好、我的权限
 * 
 * @作者 应亮
 * @创建日期 2026-04-10
 */

import { useState, useEffect } from 'react';
import Cookies from 'js-cookie';
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
  Lock,
  FileText,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  Settings,
  Warehouse,
  CircleDollarSign,
  Inbox,
  Truck,
  TrendingUp,
} from 'lucide-react';

// 角色显示映射
const roleLabels: Record<string, { label: string; color: string }> = {
  ADMIN: { label: '管理员', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  SALES: { label: '业务员', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  PURCHASING: { label: '采购员', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  WAREHOUSE: { label: '仓管员', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  VIEWER: { label: '访客', color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400' },
};

// 权限模块图标映射
const moduleIcons: Record<string, React.ElementType> = {
  orders: ShoppingCart,
  products: Package,
  customers: Users,
  suppliers: Building2,
  inventory: BarChart3,
  purchasing: CircleDollarSign,
  quotations: CircleDollarSign,
  reports: TrendingUp,
  settings: Settings,
  users: User,
  roles: Shield,
  inbound: Inbox,
  outbound: Truck,
  warehouse: Warehouse,
};

// 模块名称映射
const moduleNames: Record<string, string> = {
  orders: '订单管理',
  products: '产品管理',
  customers: '客户管理',
  suppliers: '供应商管理',
  inventory: '库存管理',
  purchasing: '采购管理',
  quotations: '报价管理',
  reports: '报表统计',
  settings: '系统设置',
  users: '用户管理',
  roles: '角色管理',
  inbound: '采购入库',
  outbound: '出库管理',
  warehouse: '仓储管理',
};

// 权限类型标签
const permissionTypeLabels: Record<string, string> = {
  menu: '页面访问',
  action: '操作权限',
  data: '数据权限',
};

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences' | 'permissions'>('profile');
  const [permissions, setPermissions] = useState<any[]>([]);
  const [permissionModules, setPermissionModules] = useState<Record<string, any[]>>({});

  // 受控表单状态
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // 读取用户信息（从 cookie）
  useEffect(() => {
    const loadUser = async () => {
      // 尝试从 cookie 读取
      const userId = Cookies.get('user_id');
      const token = Cookies.get('auth_token');
      
      if (userId && token) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (res.ok) {
            const data = await res.json();
            const userData = data.user || data;
            setUser(userData);
            // 初始化受控表单字段
            setFormName(userData.name || '');
          }
        } catch (error) {
          console.error('加载用户失败:', error);
        }
      }
    };
    
    loadUser();
  }, []);

  // 加载用户权限
  useEffect(() => {
    if (!user?.id) return;
    
    const loadPermissions = async () => {
      try {
        const res = await fetch(`/api/users/${user.id}/permissions`);
        const data = await res.json();
        setPermissions(data);
        
        // 按模块分组
        const modules: Record<string, any[]> = {};
        data.forEach((perm: any) => {
          const module = perm.module || perm.name.split(':')[0];
          if (!modules[module]) {
            modules[module] = [];
          }
          modules[module].push(perm);
        });
        setPermissionModules(modules);
      } catch (error) {
        console.error('加载权限失败:', error);
      }
    };
    
    loadPermissions();
  }, [user?.id]);

  const handleSave = async () => {
    setSaveError('');
    setSaving(true);
    try {
      // 调用 /api/profile PUT 接口，更新 name 字段
      const token = Cookies.get('auth_token');
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '保存失败');
      }

      // 更新本地 user 状态（保持 UI 一致）
      if (data.user) {
        setUser((prev: any) => ({ ...prev, ...data.user }));
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setSaveError(err.message || '保存失败，请稍后重试');
      console.error('保存用户资料失败:', err);
    } finally {
      setSaving(false);
    }
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

  // Tab 按钮组件
  const TabButton = ({ tab, label, icon: Icon }: { tab: typeof activeTab, label: string, icon: any }) => (
    <Button
      variant={activeTab === tab ? 'default' : 'ghost'}
      className={`gap-2 ${activeTab === tab ? '' : 'text-zinc-600 dark:text-zinc-400'}`}
      onClick={() => setActiveTab(tab)}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 w-full">
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
        {activeTab !== 'permissions' && (
          <Button
            onClick={handleSave}
            disabled={saving}
            className={`transition-all ${saved ? 'bg-green-600' : ''} ${saving ? 'opacity-70' : ''}`}
          >
            {saving ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                保存中...
              </>
            ) : saved ? (
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
        )}
      </div>

      {/* Tab 导航 */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <TabButton tab="profile" label="基本信息" icon={User} />
        <TabButton tab="security" label="账号安全" icon={Lock} />
        <TabButton tab="preferences" label="个人偏好" icon={Palette} />
        <TabButton tab="permissions" label="我的权限" icon={Key} />
      </div>

      {/* 基本信息 Tab */}
      {activeTab === 'profile' && (
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
                {/* 保存错误提示 */}
                {saveError && (
                  <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 px-3 py-2 rounded-md border border-red-200 dark:border-red-800">
                    {saveError}
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2" role="form" aria-label="基本信息表单">
                  <div>
                    <label htmlFor="profile-name" className="text-sm font-medium mb-1.5 block flex items-center gap-2">
                      <User className="h-4 w-4 text-zinc-400" />
                      姓名
                    </label>
                    <Input
                      id="profile-name"
                      value={formName}
                      onChange={(e) => { setFormName(e.target.value); setSaveError(''); }}
                      placeholder="请输入姓名"
                      aria-label="姓名"
                    />
                  </div>
                  <div>
                    <label htmlFor="profile-email" className="text-sm font-medium mb-1.5 block flex items-center gap-2">
                      <Mail className="h-4 w-4 text-zinc-400" />
                      邮箱
                    </label>
                    <Input id="profile-email" value={user.email || ''} disabled className="bg-zinc-50 dark:bg-zinc-800/50" aria-label="邮箱" readOnly />
                    <p className="text-xs text-zinc-500 mt-1">邮箱不可修改</p>
                  </div>
                  <div>
                    <label htmlFor="profile-phone" className="text-sm font-medium mb-1.5 block flex items-center gap-2">
                      <Phone className="h-4 w-4 text-zinc-400" />
                      手机号
                    </label>
                    <Input
                      id="profile-phone"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="请输入手机号"
                      aria-label="手机号"
                    />
                    <p className="text-xs text-zinc-400 mt-1">手机号暂未同步到数据库</p>
                  </div>
                  <div>
                    <label htmlFor="profile-department" className="text-sm font-medium mb-1.5 block flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-zinc-400" />
                      部门
                    </label>
                    <Input
                      id="profile-department"
                      value={formDepartment}
                      onChange={(e) => setFormDepartment(e.target.value)}
                      placeholder="请输入部门"
                      aria-label="部门"
                    />
                    <p className="text-xs text-zinc-400 mt-1">部门暂未同步到数据库</p>
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
      )}

      {/* 账号安全 Tab */}
      {activeTab === 'security' && (
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
            <div role="form" aria-label="修改密码表单">
              <div>
                <label htmlFor="current-password" className="text-sm font-medium mb-1.5 block flex items-center gap-2">
                  <Key className="h-4 w-4 text-zinc-400" />
                  当前密码
                </label>
                <div className="relative">
                  <Input id="current-password" type={showPassword ? 'text' : 'password'} placeholder="请输入当前密码" aria-label="当前密码" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="new-password" className="text-sm font-medium mb-1.5 block">新密码</label>
                  <Input id="new-password" type="password" placeholder="至少 8 位，含字母和数字" aria-label="新密码" />
                </div>
                <div>
                  <label htmlFor="confirm-password" className="text-sm font-medium mb-1.5 block">确认新密码</label>
                  <Input id="confirm-password" type="password" placeholder="再次输入新密码" aria-label="确认新密码" />
                </div>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              密码要求：至少 8 位字符，包含大小写字母和数字
            </p>
          </CardContent>
        </Card>
      )}

      {/* 个人偏好 Tab */}
      {activeTab === 'preferences' && (
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
      )}

      {/* 我的权限 Tab */}
      {activeTab === 'permissions' && (
        <div className="space-y-6">
          {/* 当前角色卡片 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center">
                  <Shield className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <CardTitle>当前角色</CardTitle>
                  <CardDescription>您的角色决定了您的系统访问权限</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Badge className={`${roleInfo.color} text-sm px-4 py-2`}>
                  <Shield className="h-4 w-4 mr-2" />
                  {roleInfo.label}
                </Badge>
                <span className="text-sm text-zinc-500">
                  标识：{user.role}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 权限清单 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <Key className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <CardTitle>权限清单</CardTitle>
                  <CardDescription>
                    您当前拥有 {permissions.length} 项权限，分布在 {Object.keys(permissionModules).length} 个模块
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {Object.keys(permissionModules).length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  <Key className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>暂无权限数据</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(permissionModules).map(([module, perms]) => {
                    const Icon = moduleIcons[module] || FileText;
                    const moduleName = moduleNames[module] || module;
                    
                    return (
                      <div
                        key={module}
                        className="border rounded-lg p-4 bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-700"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-8 h-8 bg-white dark:bg-zinc-800 rounded-lg flex items-center justify-center">
                            <Icon className="h-4 w-4 text-indigo-600" />
                          </div>
                          <div className="font-medium">{moduleName}</div>
                          <Badge variant="secondary" className="text-xs ml-auto">
                            {perms.length} 项
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          {perms.map((perm: any) => {
                            const permType = perm.name.split(':')[1] || 'action';
                            const typeLabel = permissionTypeLabels[permType] || '权限';
                            
                            return (
                              <div
                                key={perm.id}
                                className="flex items-center justify-between text-sm p-2 bg-white dark:bg-zinc-800 rounded"
                              >
                                <div className="flex items-center gap-2">
                                  {permType === 'menu' ? (
                                    <Eye className="h-3 w-3 text-blue-600" />
                                  ) : permType === 'action' ? (
                                    <Lock className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <FileText className="h-3 w-3 text-purple-600" />
                                  )}
                                  <span className="truncate max-w-[150px]">
                                    {perm.displayName}
                                  </span>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {typeLabel}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 无权限提示 */}
          {Object.keys(permissionModules).length > 0 && (
            <Card className="border-dashed">
              <CardContent className="py-6">
                <div className="text-center text-sm text-zinc-500">
                  <Lock className="h-4 w-4 inline mr-2" />
                  灰色项目表示您当前没有权限访问
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
