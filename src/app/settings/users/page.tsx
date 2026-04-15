'use client';

/**
 * 用户角色分配页面
 * /settings/users
 * 
 * 功能：
 * - 用户列表展示
 * - 为用户分配角色
 * - 查看用户权限汇总
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Users,
  UserRound,
  Shield,
  Settings,
  Search,
  KeyRound,
  Check,
  X,
} from 'lucide-react';

// 类型定义
type User = {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  isApproved: boolean;
  createdAt: string;
  roles: Role[];
  permissions: string[];
};

type Role = {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
};

type PermissionSummary = {
  module: string;
  permissions: number;
};

export default function UserRolesPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [openAssignDialog, setOpenAssignDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [assignedRoleIds, setAssignedRoleIds] = useState<string[]>([]);
  const [openPermissionsDialog, setOpenPermissionsDialog] = useState(false);
  const [permissionSummary, setPermissionSummary] = useState<PermissionSummary[]>([]);

  // 加载用户列表
  const loadUsers = async () => {
    try {
      const res = await fetch('/api/users-with-roles');
      const data = await res.json();
      setUsers(data.data?.items ?? data.data ?? []);
    } catch (error) {
      console.error('加载用户失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载角色列表
  const loadRoles = async () => {
    try {
      const res = await fetch('/api/roles');
      const data = await res.json();
      // 只显示启用的角色
      setRoles((data.data?.items ?? data.data ?? []).filter((r: Role) => r.isActive));
    } catch (error) {
      console.error('加载角色失败:', error);
    }
  };

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, []);

  // 打开分配角色对话框
  const handleAssignRoles = (user: User) => {
    setSelectedUser(user);
    setAssignedRoleIds(user.roles.map(r => r.id));
    setOpenAssignDialog(true);
  };

  // 打开权限汇总对话框
  const handleViewPermissions = async (user: User) => {
    setSelectedUser(user);
    try {
      const res = await fetch(`/api/users/${user.id}/permission-summary`);
      const data = await res.json();
      setPermissionSummary(data);
      setOpenPermissionsDialog(true);
    } catch (error) {
      console.error('加载权限汇总失败:', error);
    }
  };

  // 保存角色分配
  const handleSaveAssign = async () => {
    if (!selectedUser) return;

    try {
      const res = await fetch(`/api/users/${selectedUser.id}/roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleIds: assignedRoleIds,
        }),
      });

      if (res.ok) {
        setOpenAssignDialog(false);
        loadUsers();
      } else {
        console.error('保存角色分配失败');
      }
    } catch (error) {
      console.error('保存角色分配失败:', error);
    }
  };

  // 切换角色选择
  const toggleRole = (roleId: string) => {
    setAssignedRoleIds(prev =>
      prev.includes(roleId)
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    );
  };

  // 过滤用户
  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.name?.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  });

  // 获取用户所有权限名称汇总
  const getAllPermissions = (user: User): string[] => {
    const permissions: string[] = [];
    user.roles.forEach(role => {
      // 权限会通过API汇总到user.permissions
    });
    return user.permissions || [];
  };

  // 统计每个模块的权限数量
  const countPermissionsByModule = (permissions: string[]): Record<string, number> => {
    const counts: Record<string, number> = {};
    permissions.forEach(perm => {
      const module = perm.split(':')[0];
      counts[module] = (counts[module] || 0) + 1;
    });
    return counts;
  };

  const getModuleName = (module: string): string => {
    const map: Record<string, string> = {
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
    };
    return map[module] || module;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/settings')}
            className="gap-2"
            aria-label="返回设置页面"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-600" />
              用户角色管理
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              为用户分配角色，管理用户访问权限
            </p>
          </div>
        </div>
      </div>

      {/* 搜索框 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="搜索用户名或邮箱..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                aria-label="搜索用户"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 用户列表 */}
      <Card>
        <CardHeader>
          <CardTitle>用户列表</CardTitle>
          <CardDescription>
            共 {filteredUsers.length} 个用户
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-zinc-500">加载中...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>未找到匹配的用户</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>已分配角色</TableHead>
                    <TableHead>权限统计</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => {
                    const permCounts = countPermissionsByModule(user.permissions || []);
                    const totalPerms = Object.values(permCounts).reduce((a, b) => a + b, 0);
                    
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                              <UserRound className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <div className="font-medium">{user.name || '-'}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {user.isApproved ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              <Check className="h-3 w-3 mr-1" />
                              已批准
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <X className="h-3 w-3 mr-1" />
                              待批准
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.roles.length === 0 ? (
                              <span className="text-sm text-zinc-400">无角色</span>
                            ) : (
                              user.roles.map(role => (
                                <Badge key={role.id} variant="outline" className="text-xs">
                                  {role.displayName}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="font-medium">{totalPerms}</span> 项权限
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewPermissions(user)}
                              aria-label={`查看 ${user.name || user.email} 的权限`}
                            >
                              <KeyRound className="h-4 w-4 mr-1" />
                              权限
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleAssignRoles(user)}
                              aria-label={`为 ${user.name || user.email} 分配角色`}
                            >
                              <Shield className="h-4 w-4 mr-1" />
                              分配角色
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 分配角色对话框 */}
      <Dialog open={openAssignDialog} onOpenChange={setOpenAssignDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true">
          <DialogHeader>
            <DialogTitle>
              分配角色 - {selectedUser?.name || selectedUser?.email}
            </DialogTitle>
            <DialogDescription>
              选择要分配给该用户的角色，用户将获得所有选中角色的权限
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="grid grid-cols-2 gap-3">
              {roles.map(role => (
                <div
                  key={role.id}
                  className={`
                    border rounded-lg p-4 cursor-pointer transition-all
                    ${assignedRoleIds.includes(role.id)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-blue-300'
                    }
                  `}
                  onClick={() => toggleRole(role.id)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{role.displayName}</div>
                      {role.description && (
                        <div className="text-sm text-zinc-500 mt-1">
                          {role.description}
                        </div>
                      )}
                      <div className="mt-2">
                        <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                          {role.name}
                        </code>
                        {role.isSystem && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            系统
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="w-5 h-5 border rounded flex items-center justify-center">
                      {assignedRoleIds.includes(role.id) && (
                        <Check className="h-3 w-3 text-blue-600" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setOpenAssignDialog(false)} type="button">
              取消
            </Button>
            <Button onClick={handleSaveAssign} type="submit">
              保存分配
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 权限汇总对话框 */}
      <Dialog open={openPermissionsDialog} onOpenChange={setOpenPermissionsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true">
          <DialogHeader>
            <DialogTitle>
              权限汇总 - {selectedUser?.name || selectedUser?.email}
            </DialogTitle>
            <DialogDescription>
              用户通过角色获得的所有权限汇总
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">已分配角色</h4>
              <div className="flex flex-wrap gap-2">
                {selectedUser?.roles.map(role => (
                  <Badge key={role.id} variant="outline">
                    {role.displayName}
                  </Badge>
                ))}
                {(!selectedUser?.roles || selectedUser.roles.length === 0) && (
                  <span className="text-sm text-zinc-500">无角色分配</span>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-3">按模块统计</h4>
              <div className="grid grid-cols-2 gap-3">
                {permissionSummary.map((item) => (
                  <div
                    key={item.module}
                    className="border rounded-lg p-4 bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-700"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{getModuleName(item.module)}</div>
                      <Badge variant="secondary">
                        {item.permissions} 项权限
                      </Badge>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      模块标识: {item.module}
                    </div>
                  </div>
                ))}
                {permissionSummary.length === 0 && (
                  <div className="col-span-2 text-center py-8 text-zinc-500">
                    该用户没有任何权限
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setOpenPermissionsDialog(false)} type="button">
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
