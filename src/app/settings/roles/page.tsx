'use client';

/**
 * 角色管理页面
 * /settings/roles
 * 
 * 功能：
 * - Master-Detail 布局（左侧角色列表，右侧权限配置）
 * - 搜索功能
 * - 角色筛选（全部/系统角色/自定义角色）
 * - 批量操作（批量删除、批量导出）
 * - 创建/编辑角色
 * - 配置权限
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Shield,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Key,
  Search,
  CheckCircle2,
  XCircle,
  Users,
  Download,
  Filter,
  ArrowLeft,
} from 'lucide-react';
import PermissionTree, { Permission } from '@/components/permission-tree/PermissionTree';

// 类型定义
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

export default function RolesPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [openPermissionDialog, setOpenPermissionDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // 加载角色列表
  const loadRoles = async () => {
    try {
      const res = await fetch('/api/roles');
      const data = await res.json();
      setRoles(data.data || data || []);
    } catch (error) {
      console.error('加载角色失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载权限列表
  const loadPermissions = async () => {
    try {
      const res = await fetch('/api/permissions');
      const data = await res.json();
      setPermissions(data.data || data || []);
    } catch (error) {
      console.error('加载权限失败:', error);
    }
  };

  useEffect(() => {
    loadRoles();
    loadPermissions();
  }, []);

  // 打开创建对话框
  const handleCreate = () => {
    setEditingRole(null);
    setFormData({
      name: '',
      displayName: '',
      description: '',
      isActive: true,
    });
    setOpenDialog(true);
  };

  // 打开编辑对话框
  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      displayName: role.displayName,
      description: role.description || '',
      isActive: role.isActive,
    });
    setOpenDialog(true);
  };

  // 打开权限配置对话框
  const handleConfigurePermissions = async (role: Role) => {
    setEditingRole(role);
    try {
      const res = await fetch(`/api/roles/${role.id}/permissions`);
      const data = await res.json();
      // API 返回格式：{ data: [{id, name, displayName, ...}], ... }
      const permissions = data.data || data || [];
      setSelectedPermissionIds(permissions.map((p: any) => p.id));
      setOpenPermissionDialog(true);
    } catch (error) {
      console.error('加载角色权限失败:', error);
    }
  };

  // 验证表单
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    // 名称必填
    if (!formData.name.trim()) {
      errors.name = '角色标识不能为空';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.name)) {
      errors.name = '角色标识只能包含字母、数字、连字符和下划线';
    }
    
    // 显示名称必填
    if (!formData.displayName.trim()) {
      errors.displayName = '显示名称不能为空';
    }
    
    // 重复检测（仅在创建时）
    if (!editingRole) {
      const nameExists = roles.some(r => r.name === formData.name);
      const displayNameExists = roles.some(r => r.displayName === formData.displayName);
      
      if (nameExists) {
        errors.name = '该角色标识已存在';
      }
      if (displayNameExists) {
        errors.displayName = '该显示名称已存在';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 保存角色（创建或编辑）
  const handleSave = async () => {
    if (!validateForm()) {
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
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setOpenDialog(false);
        setFormErrors({});
        loadRoles();
      } else {
        const errorData = await res.json();
        setFormErrors({ submit: errorData.message || '保存失败' });
      }
    } catch (error) {
      console.error('保存角色失败:', error);
      setFormErrors({ submit: '保存失败，请稍后重试' });
    }
  };

  // 保存权限配置
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
        loadRoles();
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

  // 删除角色
  const handleDelete = async (roleId: string, displayName: string) => {
    if (!window.confirm(`确定要删除角色 "${displayName}" 吗？此操作不可恢复。`)) {
      return;
    }

    try {
      const res = await fetch(`/api/roles/${roleId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        loadRoles();
        setSelectedRoleIds(prev => prev.filter(id => id !== roleId));
      } else {
        console.error('删除失败');
      }
    } catch (error) {
      console.error('删除角色失败:', error);
    }
  };

  // 批量删除
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
      loadRoles();
    } catch (error) {
      console.error('批量删除失败:', error);
    }
  };

  // 批量导出
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

  // 切换角色选择
  const toggleRoleSelection = (roleId: string) => {
    setSelectedRoleIds(prev =>
      prev.includes(roleId)
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    );
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedRoleIds.length === filteredRoles.length) {
      setSelectedRoleIds([]);
    } else {
      setSelectedRoleIds(filteredRoles.map(r => r.id));
    }
  };

  // 过滤和搜索
  const filteredRoles = roles.filter(role => {
    // 筛选类型
    if (filterType === 'system' && !role.isSystem) return false;
    if (filterType === 'custom' && role.isSystem) return false;
    
    // 搜索
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        role.displayName.toLowerCase().includes(query) ||
        role.name.toLowerCase().includes(query) ||
        role.description?.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col md:flex-row">
      {/* 左侧：角色列表 */}
      <div className="w-full md:w-96 border-b md:border-b-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-1/2 md:h-full">
        {/* 标题栏 */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/settings')}
                aria-label="返回设置页面"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Shield className="h-6 w-6 text-indigo-600" />
                角色管理
              </h1>
            </div>
            <Button onClick={handleCreate} size="sm" className="gap-2" aria-label="创建新角色">
              <Plus className="h-4 w-4" />
              创建
            </Button>
          </div>

          {/* 搜索和筛选 */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="搜索角色..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                aria-label="搜索角色"
              />
            </div>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
              <SelectTrigger className="w-32">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
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
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">
                已选 {selectedRoleIds.length} 项
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchDelete}
                className="text-red-600"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                删除
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchExport}
              >
                <Download className="h-3 w-3 mr-1" />
                导出
              </Button>
            </div>
          )}
        </div>

        {/* 角色列表 */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="text-center py-8 text-zinc-500">加载中...</div>
          ) : filteredRoles.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>暂无角色</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredRoles.map((role) => (
                <div
                  key={role.id}
                  className={`
                    p-3 rounded-lg border cursor-pointer transition-all
                    ${selectedRoleIds.includes(role.id)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-blue-300'
                    }
                  `}
                  onClick={() => {
                    // 点击角色卡片时，先选择角色
                    if (!selectedRoleIds.includes(role.id)) {
                      setSelectedRoleIds([role.id]);
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2 flex-1">
                      <Checkbox
                        checked={selectedRoleIds.includes(role.id)}
                        onCheckedChange={() => toggleRoleSelection(role.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`选择角色 ${role.displayName}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium flex items-center gap-2">
                          {role.displayName}
                          {role.isSystem && (
                            <Badge variant="secondary" className="text-xs">
                              系统
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500 mt-1 truncate">
                          {role.description || role.name}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {role._count?.users ?? 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <Key className="h-3 w-3" />
                            {role._count?.permissions ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge
                        className={
                          role.isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                        }
                      >
                        {role.isActive ? (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        ) : (
                          <XCircle className="h-3 w-3 mr-1" />
                        )}
                        {role.isActive ? '启用' : '禁用'}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(role)}>
                            <Edit className="h-4 w-4 mr-2" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleConfigurePermissions(role)}>
                            <Key className="h-4 w-4 mr-2" />
                            配置权限
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDelete(role.id, role.displayName)}
                            disabled={role.isSystem}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部统计 */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
          共 {filteredRoles.length} 个角色
          {selectedRoleIds.length > 0 && `，已选 ${selectedRoleIds.length} 个`}
        </div>
      </div>

      {/* 右侧：权限配置（选中角色时显示） */}
      <div className="flex-1 flex flex-col h-1/2 md:h-full overflow-hidden">
        <Card className="m-4 h-full flex flex-col">
          <CardHeader className="flex-shrink-0">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Key className="h-5 w-5 text-indigo-600" />
                权限配置
              </h2>
              <p className="text-sm text-zinc-500">
                选择左侧角色进行权限配置
              </p>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {selectedRoleIds.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <Shield className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p>请从左侧选择一个角色</p>
              </div>
            ) : selectedRoleIds.length > 1 ? (
              <div className="text-center py-12 text-zinc-500">
                <p>已选择 {selectedRoleIds.length} 个角色</p>
                <p className="text-sm mt-2">请只选择一个角色进行权限配置</p>
              </div>
            ) : (
              <div className="text-center py-12 text-zinc-500">
                <p>选中角色：{roles.find(r => r.id === selectedRoleIds[0])?.displayName}</p>
                <Button 
                  className="mt-4 pointer-events-auto" 
                  onClick={() => handleConfigurePermissions(roles.find(r => r.id === selectedRoleIds[0])!)}
                >
                  配置权限
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 创建/编辑对话框 */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent 
          className="max-w-md max-h-[90vh] overflow-y-auto md:max-h-none" 
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="dialog-title"
        >
          <DialogHeader>
            <DialogTitle id="dialog-title">
              {editingRole ? '编辑角色' : '创建角色'}
            </DialogTitle>
            <DialogDescription id="dialog-description">
              {editingRole
                ? '修改角色信息和基本设置'
                : '创建新的系统角色'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4" role="form" aria-label={editingRole ? '编辑角色表单' : '创建角色表单'}>
            <div className="space-y-2">
              <label htmlFor="role-name" className="text-sm font-medium">角色标识</label>
              <Input
                id="role-name"
                placeholder="例如：sales_manager"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                }}
                disabled={editingRole?.isSystem}
                aria-invalid={!!formErrors.name}
                aria-describedby={formErrors.name ? 'role-name-error' : undefined}
              />
              {formErrors.name && (
                <p id="role-name-error" className="text-xs text-red-600" role="alert">
                  {formErrors.name}
                </p>
              )}
              {!formErrors.name && (
                <p className="text-xs text-zinc-500">
                  用于代码识别，只能包含字母、数字、连字符和下划线
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="role-display-name" className="text-sm font-medium">显示名称</label>
              <Input
                id="role-display-name"
                placeholder="例如：销售经理"
                value={formData.displayName}
                onChange={(e) => {
                  setFormData({ ...formData, displayName: e.target.value });
                  if (formErrors.displayName) setFormErrors({ ...formErrors, displayName: '' });
                }}
                aria-invalid={!!formErrors.displayName}
                aria-describedby={formErrors.displayName ? 'role-display-name-error' : undefined}
              />
              {formErrors.displayName && (
                <p id="role-display-name-error" className="text-xs text-red-600" role="alert">
                  {formErrors.displayName}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="role-description" className="text-sm font-medium">描述</label>
              <Textarea
                id="role-description"
                placeholder="描述这个角色的职责和用途"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">启用状态</label>
                <p className="text-xs text-zinc-500">
                  禁用后该角色的用户将无法登录
                </p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
            </div>
          </div>

          {formErrors.submit && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {formErrors.submit}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)} type="button">
              取消
            </Button>
            <Button onClick={handleSave} type="submit">
              {editingRole ? '保存修改' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 权限配置对话框 */}
      <Dialog open={openPermissionDialog} onOpenChange={setOpenPermissionDialog}>
        <DialogContent 
          className="max-w-4xl max-h-[90vh] overflow-y-auto md:max-h-[80vh]" 
          role="dialog" 
          aria-modal="true"
          aria-labelledby="permission-dialog-title"
        >
          <DialogHeader>
            <DialogTitle id="permission-dialog-title">
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

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setOpenPermissionDialog(false)} type="button">
              取消
            </Button>
            <Button onClick={handleSavePermissions} type="submit">
              保存权限配置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
