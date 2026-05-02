'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirmation-dialog';
import { Shield, Plus, Edit, Trash2, Search, Check, Eye } from 'lucide-react';
import PermissionTree, { Permission } from '@/components/permission-tree/PermissionTree';

type Role = {
  id: string; name: string; displayName: string; description?: string;
  isSystem: boolean; isActive: boolean; createdAt: string;
  _count?: { users: number; permissions: number };
};

export default function RolesManagementTab() {
  const [roles, setRoles] = useState<Role[]>([]);
  const { toast, toasts, removeToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [perms, setPerms] = useState<string[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openPermDialog, setOpenPermDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [selectedPermIds, setSelectedPermIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({ name: '', displayName: '', description: '', isActive: true });

  const loadRoles = async () => {
    try {
      const res = await fetch('/api/roles');
      const data = await res.json();
      setRoles(data.data?.items ?? data.data ?? []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const loadPermissions = async () => {
    try {
      const res = await fetch('/api/permissions');
      const data = await res.json();
      setPermissions(data.data?.items ?? data.data ?? []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadRoles(); loadPermissions(); loadPerms(); }, []);

  const loadPerms = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      const user = data.user || data;
      if (user.role === 'ADMIN') { setPerms(['*']); }
      else { const p = user.permissions || []; setPerms(Array.isArray(p) ? p : []); }
    } catch { setPerms([]); }
  };
  const hasPerm = (p: string) => perms.includes(p) || perms.includes('*');

  const openCreate = () => { setEditingRole(null); setFormData({ name: '', displayName: '', description: '', isActive: true }); setOpenDialog(true); };
  const openEdit = (role: Role) => { setEditingRole(role); setFormData({ name: role.name, displayName: role.displayName, description: role.description || '', isActive: role.isActive }); setOpenDialog(true); };

  const openPermissions = async (role: Role) => {
    setEditingRole(role);
    try {
      const res = await fetch(`/api/roles/${role.id}/permissions`);
      const data = await res.json();
      const perms = data.data?.items ?? data.data ?? [];
      setSelectedPermIds(perms.map((p: any) => p.id));
      setOpenPermDialog(true);
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.displayName.trim()) { toast.warning('名称不能为空'); return; }
    const url = editingRole ? `/api/roles/${editingRole.id}` : '/api/roles';
    const method = editingRole ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
    if (res.ok) { setOpenDialog(false); loadRoles(); } else { toast.error('保存失败'); }
  };

  const handleDelete = async (role: Role) => {
    if (!await confirm({ title: '确认删除', description: `确定要删除角色 "${role.displayName}" 吗？` })) return;
    await fetch(`/api/roles/${role.id}`, { method: 'DELETE' });
    loadRoles();
  };

  const handleSavePermissions = async () => {
    if (!editingRole) return;
    await fetch(`/api/roles/${editingRole.id}/permissions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissionIds: selectedPermIds }),
    });
    setOpenPermDialog(false);
    loadRoles();
  };

  const filteredRoles = roles.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return r.displayName.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q);
  });

  return (
    <>
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input placeholder="搜索角色..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        {hasPerm('role:create') && (
          <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" />创建角色</Button>
        )}
      </div>

      {loading ? <div className="text-center py-8 text-zinc-500">加载中...</div> : filteredRoles.length === 0 ? (
        <div className="text-center py-8 text-zinc-500"><Shield className="h-12 w-12 mx-auto mb-4 opacity-20" />暂无角色</div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>角色名称</TableHead>
                <TableHead>标识</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>用户数</TableHead>
                <TableHead>权限数</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRoles.map(role => (
                <TableRow key={role.id}>
                  <TableCell>
                    <div className="font-medium">{role.displayName}</div>
                    {role.description && <div className="text-xs text-zinc-500">{role.description}</div>}
                    {role.isSystem && <Badge variant="secondary" className="text-xs mt-1">系统</Badge>}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{role.name}</TableCell>
                  <TableCell>
                    <Badge className={role.isActive ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}>
                      {role.isActive ? '启用' : '禁用'}
                    </Badge>
                  </TableCell>
                  <TableCell>{role._count?.users ?? 0}</TableCell>
                  <TableCell>{role._count?.permissions ?? 0}</TableCell>
                  <TableCell className="text-sm text-zinc-500">{new Date(role.createdAt).toLocaleDateString('zh-CN')}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {hasPerm('role:permissions') && (
                        <Button variant="ghost" size="sm" onClick={() => openPermissions(role)} title="权限配置">
                          <Shield className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {hasPerm('role:edit') && (
                        <Button variant="ghost" size="sm" onClick={() => openEdit(role)} title="编辑">
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {hasPerm('role:delete') && !role.isSystem && (
                        <Button variant="ghost" size="sm" className="text-red-400" onClick={() => handleDelete(role)} title="删除">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 创建/编辑角色 */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? '编辑角色' : '创建角色'}</DialogTitle>
            <DialogDescription>{editingRole ? '修改角色的基本信息和状态' : '创建一个新的系统角色'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">角色标识 *</label>
              <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="如：SALES_MANAGER" disabled={!!editingRole} />
            </div>
            <div>
              <label className="text-sm font-medium">显示名称 *</label>
              <Input value={formData.displayName} onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="如：销售经理" />
            </div>
            <div>
              <label className="text-sm font-medium">描述</label>
              <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="角色职责说明" rows={2} />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">启用</label>
              <Switch checked={formData.isActive} onCheckedChange={v => setFormData({ ...formData, isActive: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>取消</Button>
            <Button onClick={handleSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 权限配置 */}
      <Dialog open={openPermDialog} onOpenChange={setOpenPermDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>权限配置 - {editingRole?.displayName}</DialogTitle>
            <DialogDescription>勾选该角色拥有的权限，保存后立即生效</DialogDescription>
          </DialogHeader>
          <PermissionTree
            permissions={permissions}
            selectedIds={selectedPermIds}
            onChange={setSelectedPermIds}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenPermDialog(false)}>取消</Button>
            <Button onClick={handleSavePermissions}>保存权限</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    <ToastContainer toasts={toasts} removeToast={removeToast} />
    <ConfirmDialog />
    </>
  );
}
