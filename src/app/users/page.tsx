'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Search, Edit, Trash2, User, Shield, Mail, CheckCircle, XCircle, Clock, Key, Users, MoreVertical, Download, Filter, ArrowLeft } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PermissionTree, { Permission } from '@/components/permission-tree/PermissionTree';

// ============ 类型定义 ============

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SALES' | 'PURCHASING' | 'WAREHOUSE' | 'VIEWER';
  roles?: Role[]; // 多角色支持
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

const roleLabels = {
  ADMIN: { label: '管理员', color: 'bg-red-100 text-red-800' },
  SALES: { label: '业务员', color: 'bg-blue-100 text-blue-800' },
  PURCHASING: { label: '采购员', color: 'bg-green-100 text-green-800' },
  WAREHOUSE: { label: '仓管员', color: 'bg-orange-100 text-orange-800' },
  VIEWER: { label: '访客', color: 'bg-gray-100 text-gray-800' },
};

interface PendingRegistration {
  id: string;
  username: string;
  email: string;
  name: string | null;
  phone: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

type Role = {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    users: number;
    permissions: number;
  };
};

type FilterType = 'all' | 'system' | 'custom';

// ============ 主页面组件 ============

export default function UsersPage() {
  const [activeTab, setActiveTab] = useState('users');
  
  // 用户相关状态
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState({
    email: '',
    name: '',
    password: '',
    roleIds: [] as string[], // 多角色支持
  });
  
  // 审批相关状态
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(true);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<PendingRegistration | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  
  // 角色权限相关状态
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [roleSearchQuery, setRoleSearchQuery] = useState('');
  const [roleFilterType, setRoleFilterType] = useState<FilterType>('all');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [isCreateRoleDialogOpen, setIsCreateRoleDialogOpen] = useState(false);
  const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    isActive: true,
  });
  const [roleFormErrors, setRoleFormErrors] = useState<Record<string, string>>({});
  const [openPermissionDialog, setOpenPermissionDialog] = useState(false);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);

  // ============ 数据加载 ============

  useEffect(() => {
    fetchUsers();
    fetchPendingRegistrations();
    fetchRoles();
    fetchPermissions();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        const usersData = Array.isArray(data) ? data : [];
        // 为每个用户获取角色列表
        const usersWithRoles = await Promise.all(
          usersData.map(async (user: User) => {
            try {
              const res = await fetch(`/api/users/${user.id}/roles`);
              if (res.ok) {
                const rolesData = await res.json();
                return { ...user, roles: rolesData.data || rolesData || [] };
              }
            } catch (error) {
              console.error(`Failed to fetch roles for user ${user.id}:`, error);
            }
            return { ...user, roles: [] };
          })
        );
        setUsers(usersWithRoles);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };
  
  const fetchPendingRegistrations = async () => {
    setRegistrationsLoading(true);
    try {
      const response = await fetch('/api/auth/approvals?status=PENDING');
      const data = await response.json();
      if (response.ok) {
        const regsData = Array.isArray(data.registrations) ? data.registrations : [];
        setPendingRegistrations(regsData);
      } else {
        setPendingRegistrations([]);
      }
    } catch (error) {
      console.error('Failed to fetch pending registrations:', error);
      setPendingRegistrations([]);
    } finally {
      setRegistrationsLoading(false);
    }
  };
  
  const fetchRoles = async () => {
    setRolesLoading(true);
    try {
      const res = await fetch('/api/roles');
      const data = await res.json();
      const rolesData = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
      setRoles(rolesData);
    } catch (error) {
      console.error('加载角色失败:', error);
      setRoles([]);
    } finally {
      setRolesLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const res = await fetch('/api/permissions');
      const data = await res.json();
      const permsData = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
      setPermissions(permsData);
    } catch (error) {
      console.error('加载权限失败:', error);
      setPermissions([]);
    }
  };

  // ============ 用户管理操作 ============

  const handleCreateUser = async () => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...userFormData,
          roleIds: userFormData.roleIds, // 多角色支持
        }),
      });
      if (response.ok) {
        await fetchUsers();
        setIsCreateUserDialogOpen(false);
        setUserFormData({ email: '', name: '', password: '', roleIds: [] });
      }
    } catch (error) {
      console.error('Failed to create user:', error);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    try {
      // 更新用户基本信息
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userFormData.email,
          name: userFormData.name,
          password: userFormData.password || undefined, // 空密码则不修改
        }),
      });
      if (response.ok) {
        // 更新用户角色
        if (selectedUser) {
          await fetch(`/api/users/${selectedUser.id}/roles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roleIds: userFormData.roleIds }),
          });
        }
        await fetchUsers();
        setIsEditUserDialogOpen(false);
        setSelectedUser(null);
        setUserFormData({ email: '', name: '', password: '', roleIds: [] });
      }
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('确定要删除这个用户吗？')) return;
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        await fetchUsers();
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const openEditUserDialog = (user: User) => {
    setSelectedUser(user);
    setUserFormData({
      email: user.email,
      name: user.name || '',
      password: '',
      roleIds: [], // 编辑时从 API 获取实际角色
    });
    // 获取用户当前角色
    fetch(`/api/users/${user.id}/roles`)
      .then(res => res.json())
      .then(data => {
        const roleIds = (data.data || data || []).map((r: any) => r.id);
        setUserFormData(prev => ({ ...prev, roleIds }));
      })
      .catch(() => setUserFormData(prev => ({ ...prev, roleIds: [] })));
    setIsEditUserDialogOpen(true);
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      user.name?.toLowerCase().includes(userSearchTerm.toLowerCase());
    const matchesRole = userRoleFilter === 'all' || user.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  // ============ 审批操作 ============
  
  const handleApprove = async (registration: PendingRegistration) => {
    if (!confirm(`确认批准 ${registration.email} 的注册申请吗？`)) return;
    
    setProcessing(true);
    try {
      const response = await fetch(`/api/auth/approvals/${registration.id}/approve`, {
        method: 'POST',
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        fetchPendingRegistrations();
      } else {
        alert(data.error || '批准失败');
      }
    } catch (error) {
      alert('批准失败，请重试');
    } finally {
      setProcessing(false);
    }
  };
  
  const handleReject = async () => {
    if (!selectedRegistration || !rejectReason.trim()) return;
    
    setProcessing(true);
    try {
      const response = await fetch(`/api/auth/approvals/${selectedRegistration.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        setRejectDialogOpen(false);
        setRejectReason('');
        setSelectedRegistration(null);
        fetchPendingRegistrations();
      } else {
        alert(data.error || '拒绝失败');
      }
    } catch (error) {
      alert('拒绝失败，请重试');
    } finally {
      setProcessing(false);
    }
  };

  // ============ 角色管理操作 ============

  const handleCreateRole = () => {
    setEditingRole(null);
    setRoleFormData({
      name: '',
      displayName: '',
      description: '',
      isActive: true,
    });
    setRoleFormErrors({});
    setIsCreateRoleDialogOpen(true);
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setRoleFormData({
      name: role.name,
      displayName: role.displayName,
      description: role.description || '',
      isActive: role.isActive,
    });
    setRoleFormErrors({});
    setIsEditRoleDialogOpen(true);
  };

  const handleConfigurePermissions = async (role: Role) => {
    setEditingRole(role);
    try {
      const res = await fetch(`/api/roles/${role.id}/permissions`);
      const data = await res.json();
      const permissions = data.data || data || [];
      setSelectedPermissionIds(permissions.map((p: any) => p.id));
      setOpenPermissionDialog(true);
    } catch (error) {
      console.error('加载角色权限失败:', error);
    }
  };

  const validateRoleForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!roleFormData.name.trim()) {
      errors.name = '角色标识不能为空';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(roleFormData.name)) {
      errors.name = '角色标识只能包含字母、数字、连字符和下划线';
    }
    
    if (!roleFormData.displayName.trim()) {
      errors.displayName = '显示名称不能为空';
    }
    
    if (!editingRole) {
      const nameExists = roles.some(r => r.name === roleFormData.name);
      const displayNameExists = roles.some(r => r.displayName === roleFormData.displayName);
      
      if (nameExists) {
        errors.name = '该角色标识已存在';
      }
      if (displayNameExists) {
        errors.displayName = '该显示名称已存在';
      }
    }
    
    setRoleFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveRole = async () => {
    if (!validateRoleForm()) {
      return;
    }
    
    try {
      const url = editingRole
        ? `/api/roles/${editingRole.id}`
        : '/api/roles';
      const method = editingRole ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleFormData),
      });

      if (res.ok) {
        setIsCreateRoleDialogOpen(false);
        setIsEditRoleDialogOpen(false);
        setRoleFormErrors({});
        fetchRoles();
      } else {
        const errorData = await res.json();
        setRoleFormErrors({ submit: errorData.message || '保存失败' });
      }
    } catch (error) {
      console.error('保存角色失败:', error);
      setRoleFormErrors({ submit: '保存失败，请稍后重试' });
    }
  };

  const handleSavePermissions = async () => {
    if (!editingRole) return;

    try {
      const res = await fetch(`/api/roles/${editingRole.id}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissionIds: selectedPermissionIds,
        }),
      });

      if (res.ok) {
        setOpenPermissionDialog(false);
        fetchRoles();
      } else {
        const error = await res.json();
        console.error('保存权限失败:', error);
        alert('保存权限失败：' + (error.error || '未知错误'));
      }
    } catch (error) {
      console.error('保存权限失败:', error);
      alert('保存权限失败，请重试');
    }
  };

  const handleDeleteRole = async (roleId: string, displayName: string) => {
    if (!window.confirm(`确定要删除角色 "${displayName}" 吗？此操作不可恢复。`)) {
      return;
    }

    try {
      const res = await fetch(`/api/roles/${roleId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchRoles();
        setSelectedRoleIds(prev => prev.filter(id => id !== roleId));
      } else {
        console.error('删除失败');
      }
    } catch (error) {
      console.error('删除角色失败:', error);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRoleIds.length === 0) return;
    
    if (!window.confirm(`确定要删除选中的 ${selectedRoleIds.length} 个角色吗？此操作不可恢复。`)) {
      return;
    }

    try {
      const promises = selectedRoleIds.map(id => 
        fetch(`/api/roles/${id}`, { method: 'DELETE' })
      );
      await Promise.all(promises);
      
      setSelectedRoleIds([]);
      fetchRoles();
    } catch (error) {
      console.error('批量删除失败:', error);
    }
  };

  const handleBatchExport = () => {
    const rolesToExport = roles.filter(r => selectedRoleIds.includes(r.id));
    const data = rolesToExport.map(r => ({
      角色名称: r.displayName,
      标识: r.name,
      状态: r.isActive ? '启用' : '禁用',
      类型: r.isSystem ? '系统角色' : '自定义角色',
      描述: r.description || '',
      用户数: r._count?.users ?? 0,
      权限数: r._count?.permissions ?? 0,
      创建时间: new Date(r.createdAt).toLocaleString('zh-CN'),
    }));

    const csvContent = [
      Object.keys(data[0] || {}).join(','),
      ...data.map(row => Object.values(row).map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `roles-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const toggleRoleSelection = (roleId: string) => {
    setSelectedRoleIds(prev =>
      prev.includes(roleId)
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedRoleIds.length === filteredRoles.length) {
      setSelectedRoleIds([]);
    } else {
      setSelectedRoleIds(filteredRoles.map(r => r.id));
    }
  };

  const filteredRoles = roles.filter(role => {
    if (roleFilterType === 'system' && !role.isSystem) return false;
    if (roleFilterType === 'custom' && role.isSystem) return false;
    
    if (roleSearchQuery) {
      const query = roleSearchQuery.toLowerCase();
      return (
        role.displayName.toLowerCase().includes(query) ||
        role.name.toLowerCase().includes(query) ||
        role.description?.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  // ============ 统计信息 ============
  
  const userStats = {
    total: users.length,
    admin: users.filter(u => u.role === 'ADMIN').length,
    sales: users.filter(u => u.role === 'SALES').length,
    other: users.filter(u => !['ADMIN', 'SALES'].includes(u.role)).length,
  };

  const roleStats = {
    total: roles.length,
    system: roles.filter(r => r.isSystem).length,
    custom: roles.filter(r => !r.isSystem).length,
  };

  // ============ 渲染 ============

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">👤 用户及权限</h1>
        <p className="text-muted-foreground">管理系统用户、审批注册、配置角色权限</p>
      </div>

      {/* 快速统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{userStats.total}</div>
                <div className="text-xs text-muted-foreground">总用户</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Shield className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{userStats.admin}</div>
                <div className="text-xs text-muted-foreground">管理员</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Key className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{roleStats.total}</div>
                <div className="text-xs text-muted-foreground">角色总数</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{pendingRegistrations.length}</div>
                <div className="text-xs text-muted-foreground">待审批</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 标签页导航 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="users">用户列表</TabsTrigger>
          <TabsTrigger value="pending" className="relative">
            待审批用户
            {pendingRegistrations.length > 0 && (
              <Badge className="ml-2 bg-red-500 text-white">
                {pendingRegistrations.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="roles">角色权限管理</TabsTrigger>
        </TabsList>

        {/* ========== 标签页 1: 用户列表 ========== */}
        <TabsContent value="users" className="mt-0">
          {/* 工具栏 */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索邮箱或姓名..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="所有角色" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有角色</SelectItem>
                <SelectItem value="ADMIN">管理员</SelectItem>
                <SelectItem value="SALES">业务员</SelectItem>
                <SelectItem value="PURCHASING">采购员</SelectItem>
                <SelectItem value="WAREHOUSE">仓管员</SelectItem>
                <SelectItem value="VIEWER">访客</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setIsCreateUserDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              创建用户
            </Button>
          </div>

          {/* 用户表格 */}
          <Card>
            <CardHeader>
              <CardTitle>用户列表 ({filteredUsers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="text-center py-8">加载中...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>用户</TableHead>
                      <TableHead>邮箱</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          暂无用户数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <div className="font-medium">{user.name || '未设置'}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              {user.email}
                            </div>
                          </TableCell>
                          <TableCell>
                            {user.roles && user.roles.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {user.roles.map((role) => (
                                  <Badge key={role.id} className={roleLabels[role.name as keyof typeof roleLabels]?.color || 'bg-zinc-100 text-zinc-800'}>
                                    <Shield className="h-3 w-3 mr-1" />
                                    {role.displayName}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <Badge className={roleLabels[user.role].color}>
                                <Shield className="h-3 w-3 mr-1" />
                                {roleLabels[user.role].label}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditUserDialog(user)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteUser(user.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== 标签页 2: 待审批用户 ========== */}
        <TabsContent value="pending" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>待审批用户 ({pendingRegistrations.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {registrationsLoading ? (
                <div className="text-center py-8">加载中...</div>
              ) : pendingRegistrations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <h3 className="text-lg font-semibold mb-2">全部已处理</h3>
                  <p className="text-muted-foreground">暂无待审批的注册申请</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>用户名</TableHead>
                      <TableHead>邮箱</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead>电话</TableHead>
                      <TableHead>注册时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRegistrations.map((registration) => (
                      <TableRow key={registration.id}>
                        <TableCell>{registration.username || '未设置'}</TableCell>
                        <TableCell>{registration.email}</TableCell>
                        <TableCell>{registration.name || '-'}</TableCell>
                        <TableCell>{registration.phone || '-'}</TableCell>
                        <TableCell>{new Date(registration.createdAt).toLocaleDateString('zh-CN')}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(registration)}
                              disabled={processing}
                            >
                              <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                              批准
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedRegistration(registration);
                                setRejectDialogOpen(true);
                              }}
                              disabled={processing}
                            >
                              <XCircle className="h-4 w-4 mr-1 text-red-600" />
                              拒绝
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== 标签页 3: 角色权限管理 ========== */}
        <TabsContent value="roles" className="mt-0">
          <div className="space-y-6">
            {/* 角色列表 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">系统角色</CardTitle>
                  <Button size="sm" onClick={handleCreateRole}>
                    <Plus className="h-4 w-4 mr-1" />
                    创建
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* 搜索和筛选 */}
                <div className="space-y-3 mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索角色..."
                      value={roleSearchQuery}
                      onChange={(e) => setRoleSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={roleFilterType} onValueChange={(v) => setRoleFilterType(v as FilterType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="全部类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      <SelectItem value="system">系统角色</SelectItem>
                      <SelectItem value="custom">自定义角色</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 批量操作 */}
                {selectedRoleIds.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary">已选 {selectedRoleIds.length} 项</Badge>
                    <Button variant="outline" size="sm" onClick={handleBatchDelete} className="text-red-600">
                      <Trash2 className="h-3 w-3 mr-1" />
                      删除
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleBatchExport}>
                      <Download className="h-3 w-3 mr-1" />
                      导出
                    </Button>
                  </div>
                )}

                {/* 角色列表 */}
                <div className="space-y-2">
                  {rolesLoading ? (
                    <div className="text-center py-8 text-muted-foreground">加载中...</div>
                  ) : filteredRoles.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Shield className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>暂无角色</p>
                    </div>
                  ) : (
                    filteredRoles.map((role) => (
                      <div
                        key={role.id}
                        className={`
                          p-3 rounded-lg border transition-all
                          ${selectedRoleIds.includes(role.id)
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-zinc-200 dark:border-zinc-800 hover:border-blue-300'
                          }
                        `}
                      >
                        <div className="flex items-start justify-between gap-3">
                          {/* 左侧：角色信息（点击打开权限配置） */}
                          <div 
                            className="flex-1 cursor-pointer" 
                            onClick={() => handleConfigurePermissions(role)}
                          >
                            <div className="font-medium flex items-center gap-2 mb-1">
                              {role.displayName}
                              {role.isSystem && (
                                <Badge variant="secondary" className="text-xs">系统</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mb-2">
                              {role.description || role.name}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {role._count?.users ?? 0} 个用户
                              </span>
                              <span className="flex items-center gap-1">
                                <Key className="h-3 w-3" />
                                {role._count?.permissions ?? 0} 个权限
                              </span>
                            </div>
                          </div>
                          
                          {/* 右侧：操作按钮（两行布局） */}
                          <div className="flex flex-col items-end gap-1.5">
                            {/* 第一行：权限、编辑并排 */}
                            <div className="flex gap-1.5">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleConfigurePermissions(role);
                                }}
                                className="h-8 px-3"
                              >
                                <Key className="h-3 w-3 mr-1" />
                                权限
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditRole(role);
                                }}
                                className="h-8 px-3"
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                编辑
                              </Button>
                            </div>
                            {/* 第二行：删除按钮（独占一行） */}
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRole(role.id, role.displayName);
                              }}
                              disabled={role.isSystem}
                              className="h-8 px-3 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              删除
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* 底部统计 */}
                <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                  共 {filteredRoles.length} 个角色
                  {selectedRoleIds.length > 0 && `，已选 ${selectedRoleIds.length} 个`}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ========== 对话框：创建/编辑用户 ========== */}
      <Dialog open={isCreateUserDialogOpen || isEditUserDialogOpen} onOpenChange={(open) => {
        setIsCreateUserDialogOpen(open);
        setIsEditUserDialogOpen(open);
        if (!open) {
          setSelectedUser(null);
          setUserFormData({ email: '', name: '', password: '', roleIds: [] });
        }
      }}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedUser ? '编辑用户' : '创建新用户'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={userFormData.email}
                onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">姓名</Label>
              <Input
                id="name"
                placeholder="张三"
                value={userFormData.name}
                onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{selectedUser ? '新密码（留空则不修改）' : '密码'}</Label>
              <Input
                id="password"
                type="password"
                placeholder="至少 6 位"
                value={userFormData.password}
                onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>角色（支持多选）</Label>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                {rolesLoading ? (
                  <div className="text-center py-4 text-muted-foreground">加载角色列表中...</div>
                ) : roles.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <p>暂无角色</p>
                    <p className="text-xs mt-1">请先在“角色权限管理”标签页创建角色</p>
                  </div>
                ) : (
                  roles.map((role) => (
                    <div
                      key={role.id}
                      className="flex items-center gap-2 p-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                      onClick={() => {
                        const newRoleIds = userFormData.roleIds.includes(role.id)
                          ? userFormData.roleIds.filter(id => id !== role.id)
                          : [...userFormData.roleIds, role.id];
                        setUserFormData({ ...userFormData, roleIds: newRoleIds });
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={userFormData.roleIds.includes(role.id)}
                        onChange={() => {
                          const newRoleIds = userFormData.roleIds.includes(role.id)
                            ? userFormData.roleIds.filter(id => id !== role.id)
                            : [...userFormData.roleIds, role.id];
                          setUserFormData({ ...userFormData, roleIds: newRoleIds });
                        }}
                        className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                        id={`role-${role.id}`}
                      />
                      <label htmlFor={`role-${role.id}`} className="flex-1 cursor-pointer text-sm">
                        <span className="font-medium">{role.displayName}</span>
                        {role.isSystem && (
                          <Badge variant="secondary" className="text-xs ml-2">系统</Badge>
                        )}
                        {role.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>
                        )}
                      </label>
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                已选择 {userFormData.roleIds.length} 个角色
              </p>
            </div>
            <Button className="w-full" onClick={selectedUser ? handleUpdateUser : handleCreateUser}>
              {selectedUser ? '保存修改' : '创建用户'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========== 对话框：拒绝审批 ========== */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒绝注册申请</DialogTitle>
            <DialogDescription>
              拒绝 {selectedRegistration?.email} 的注册申请
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>拒绝原因</Label>
              <Textarea
                placeholder="请输入拒绝原因（将通过邮件通知用户）"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)} disabled={processing}>
                取消
              </Button>
              <Button variant="destructive" onClick={handleReject} disabled={processing || !rejectReason.trim()}>
                确认拒绝
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========== 对话框：创建/编辑角色 ========== */}
      <Dialog open={isCreateRoleDialogOpen || isEditRoleDialogOpen} onOpenChange={(open) => {
        setIsCreateRoleDialogOpen(open);
        setIsEditRoleDialogOpen(open);
        if (!open) {
          setEditingRole(null);
          setRoleFormData({ name: '', displayName: '', description: '', isActive: true });
          setRoleFormErrors({});
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRole ? '编辑角色' : '创建角色'}</DialogTitle>
            <DialogDescription>
              {editingRole ? '修改角色信息和基本设置' : '创建新的系统角色'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">角色标识</Label>
              <Input
                id="role-name"
                placeholder="例如：sales_manager"
                value={roleFormData.name}
                onChange={(e) => {
                  setRoleFormData({ ...roleFormData, name: e.target.value });
                  if (roleFormErrors.name) setRoleFormErrors({ ...roleFormErrors, name: '' });
                }}
                disabled={editingRole?.isSystem}
              />
              {roleFormErrors.name && (
                <p className="text-xs text-red-600">{roleFormErrors.name}</p>
              )}
              {!roleFormErrors.name && (
                <p className="text-xs text-muted-foreground">
                  用于代码识别，只能包含字母、数字、连字符和下划线
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-display-name">显示名称</Label>
              <Input
                id="role-display-name"
                placeholder="例如：销售经理"
                value={roleFormData.displayName}
                onChange={(e) => {
                  setRoleFormData({ ...roleFormData, displayName: e.target.value });
                  if (roleFormErrors.displayName) setRoleFormErrors({ ...roleFormErrors, displayName: '' });
                }}
              />
              {roleFormErrors.displayName && (
                <p className="text-xs text-red-600">{roleFormErrors.displayName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">描述</Label>
              <Textarea
                id="role-description"
                placeholder="描述这个角色的职责和用途"
                value={roleFormData.description}
                onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>启用状态</Label>
                <p className="text-xs text-muted-foreground">禁用后该角色的用户将无法登录</p>
              </div>
              <Switch
                checked={roleFormData.isActive}
                onCheckedChange={(checked) => setRoleFormData({ ...roleFormData, isActive: checked })}
              />
            </div>
          </div>
          {roleFormErrors.submit && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600">{roleFormErrors.submit}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateRoleDialogOpen(false);
              setIsEditRoleDialogOpen(false);
            }}>
              取消
            </Button>
            <Button onClick={handleSaveRole}>
              {editingRole ? '保存修改' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== 对话框：配置权限 ========== */}
      <Dialog open={openPermissionDialog} onOpenChange={setOpenPermissionDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              配置权限 - {editingRole?.displayName}
            </DialogTitle>
            <DialogDescription>
              为该角色选择可访问的功能权限
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <PermissionTree
              permissions={permissions}
              selectedIds={selectedPermissionIds}
              onChange={setSelectedPermissionIds}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenPermissionDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSavePermissions}>
              保存权限配置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
