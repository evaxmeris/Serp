'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { UserRound, Shield, Search, Check, X, Eye, Edit, Trash2, Power, PowerOff } from 'lucide-react';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirmation-dialog';

type User = {
  id: string; email: string; name?: string; isApproved: boolean;
  isActive?: boolean; disabledAt?: string | null; disabledReason?: string | null;
  createdAt: string; roles: Role[]; permissions: string[];
  userRoles?: { role: { name: string; displayName: string } }[];
};
type Role = {
  id: string; name: string; displayName: string; description?: string;
  isSystem: boolean; isActive: boolean;
};

export default function UserListTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [perms, setPerms] = useState<string[]>([]);

  // 弹窗状态
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [toggleUser, setToggleUser] = useState<User | null>(null);
  const [disableReason, setDisableReason] = useState('');
  const [assignUser, setAssignUser] = useState<User | null>(null);
  const [assignedRoleIds, setAssignedRoleIds] = useState<string[]>([]);
  const [primaryRoleId, setPrimaryRoleId] = useState<string>('');

  // 编辑表单
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '', password: '', isApproved: true });

  const { toast, toasts, removeToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const usersData = await res.json();
      // API 可能返回 {success, data: [...]} 或直接返回数组
      const usersList = Array.isArray(usersData) ? usersData : (usersData.data ?? []);
      const usersWithRoles = await Promise.all(
        usersList.map(async (u: any) => {
          try {
            const rr = await fetch(`/api/users/${u.id}/roles`);
            const rd = await rr.json();
            // 兼容多层包裹：{success, data: {data: [...]}} 或 {success, data: [...]} 或直接数组
            let userRoles = rd.data?.data ?? rd.data ?? rd ?? [];
            if (!Array.isArray(userRoles)) userRoles = [];
            return { ...u, roles: userRoles, permissions: [] };
          } catch { return { ...u, roles: [], permissions: [] }; }
        })
      );
      setUsers(usersWithRoles);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const loadRoles = async () => {
    try {
      const res = await fetch('/api/roles');
      const data = await res.json();
      // API 可能返回 {success, data: {items: [...]}} 或直接返回数组
      const rolesList = data.data?.items ?? data.data ?? data ?? [];
      setRoles(rolesList.filter((r: Role) => r.isActive));
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadUsers(); loadRoles(); loadPerms(); }, []);

  const loadPerms = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      // API 可能返回 {success, data: {...}} 或直接返回用户对象
      const user = data.data || data.user || data;
      // ADMIN 拥有全部权限；其他角色从 API 返回的 permissions 读取
      if (user.role === 'admin' || user.role === 'super-admin') {
        setPerms(['*']);
      } else {
        const p = user.permissions || [];
        setPerms(Array.isArray(p) ? p : []);
      }
    } catch { setPerms([]); }
  };

  const hasPerm = (p: string) => perms.includes(p) || perms.includes('*');

  // 打开编辑
  const openEdit = (user: User) => {
    setEditUser(user);
    setEditForm({
      name: user.name || '',
      email: user.email,
      role: user.userRoles?.[0]?.role?.name || 'viewer',
      password: '',
      isApproved: user.isApproved !== undefined ? user.isApproved : true,
    });
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editUser) return;
    try {
      const body: any = { name: editForm.name, email: editForm.email, role: editForm.role, isApproved: editForm.isApproved };
      if (editForm.password) body.password = editForm.password;
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) { setEditUser(null); loadUsers(); } else {
        const err = await res.json();
        toast.error(err.error || err.message || '保存失败');
      }
    } catch (e: any) {
      toast.warning('网络错误：' + (e?.message || '请检查连接'));
    }
  };

  // 删除用户
  const handleDelete = async () => {
    if (!deleteUser) return;
    try {
      const res = await fetch(`/api/users/${deleteUser.id}`, { method: 'DELETE' });
      if (res.ok) { setDeleteUser(null); loadUsers(); } else {
        const err = await res.json();
        toast.error(err.error || err.message || '删除失败');
      }
    } catch (e: any) { toast.warning('网络错误：' + (e?.message || '请检查连接')); }
  };

  // 停用/启用用户
  const openToggle = (user: User) => {
    setToggleUser(user);
    setDisableReason('');
  };

  const handleToggleActive = async () => {
    if (!toggleUser) return;
    const isCurrentlyActive = toggleUser.isActive !== false;
    try {
      const res = await fetch(`/api/users/${toggleUser.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isCurrentlyActive
          ? { isActive: false, disabledReason: disableReason }
          : { isActive: true }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.success(data.message || (isCurrentlyActive ? '用户已停用' : '用户已启用'));
        setToggleUser(null);
        loadUsers();
      } else {
        const err = await res.json();
        toast.error(err.error || err.message || '操作失败');
      }
    } catch (e: any) { toast.warning('网络错误：' + (e?.message || '请检查连接')); }
  };

  // 角色分配
  const openAssign = (user: User) => {
    setAssignUser(user);
    setAssignedRoleIds(user.roles.map(r => r.id));
    setPrimaryRoleId(user.roles[0]?.id || ''); // 默认第一个（后端亦有兜底）
  };
  const toggleRole = (roleId: string) => {
    setAssignedRoleIds(prev => {
      const next = prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId];
      // 取消主角色勾选时，主角色跟着切换（避免指向已移除的角色）
      if (!next.includes(primaryRoleId)) setPrimaryRoleId(next[0] || '');
      return next;
    });
  };
  const handleSaveAssign = async () => {
    if (!assignUser) return;
    try {
      const res = await fetch(`/api/users/${assignUser.id}/roles`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleIds: assignedRoleIds, primaryRoleId }),
      });
      if (res.ok) { setAssignUser(null); loadUsers(); }
      else { const err = await res.json(); toast.error(err.error || '保存失败'); }
    } catch (e: any) { toast.warning('网络错误：' + (e?.message || '请检查连接')); }
  };

  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return user.name?.toLowerCase().includes(q) || user.email.toLowerCase().includes(q);
  });

  return (<>
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input placeholder="搜索用户名或邮箱..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
      </div>

      {loading ? <div className="text-center py-8 text-zinc-500">加载中...</div> : filteredUsers.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">暂无用户</div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>主角色</TableHead>
                <TableHead>兼任角色</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right w-52">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map(user => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <UserRound className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="font-medium">{user.name || '-'}</span>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {user.isActive === false ? (
                      <Badge className="bg-red-100 text-red-700">
                        <PowerOff className="h-3 w-3 mr-1" />已停用
                      </Badge>
                    ) : (
                      <Badge className={user.isApproved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                        {user.isApproved ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                        {user.isApproved ? '已批准' : '待批准'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">
                      {(() => {
                        const primary = user.userRoles?.[0]?.role;
                        return primary?.displayName || primary?.name || '-';
                      })()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.length === 0 ? <span className="text-sm text-zinc-400">无角色</span> :
                        user.roles.map(r => <Badge key={r.id} variant="outline" className="text-xs">{r.displayName}</Badge>)
                      }
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-500">{new Date(user.createdAt).toLocaleDateString('zh-CN')}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setViewUser(user)} title="查看">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {hasPerm('user:edit') && (
                        <Button variant="ghost" size="sm" onClick={() => openEdit(user)} title="编辑">
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {hasPerm('user:edit') && (
                        <Button variant="ghost" size="sm" onClick={() => openAssign(user)} title="角色">
                          <Shield className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {hasPerm('user:disable') && (
                        <Button
                          variant="ghost" size="sm"
                          className={user.isActive === false ? 'text-green-600' : 'text-amber-600'}
                          onClick={() => openToggle(user)}
                          title={user.isActive === false ? '启用' : '停用'}
                        >
                          {user.isActive === false ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                      {hasPerm('user:delete') && (
                        <Button variant="ghost" size="sm" className="text-red-400" onClick={() => setDeleteUser(user)} title="删除">
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

      {/* 查看详情 */}
      <Dialog open={!!viewUser} onOpenChange={() => setViewUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>用户详情</DialogTitle></DialogHeader>
          {viewUser && (
            <div className="space-y-3 text-sm">
              <div><span className="text-zinc-500">姓名：</span>{viewUser.name || '-'}</div>
              <div><span className="text-zinc-500">邮箱：</span>{viewUser.email}</div>
              <div><span className="text-zinc-500">主角色：</span>{viewUser.userRoles?.[0]?.role?.displayName || viewUser.userRoles?.[0]?.role?.name || '-'}</div>
              <div><span className="text-zinc-500">账号状态：</span>
                {viewUser.isActive === false
                  ? <span className="text-red-600">已停用{viewUser.disabledAt ? `（${new Date(viewUser.disabledAt).toLocaleDateString('zh-CN')}${viewUser.disabledReason ? ` · ${viewUser.disabledReason}` : ''}）` : ''}</span>
                  : <span className="text-green-600">正常</span>}
              </div>
              <div><span className="text-zinc-500">审批状态：</span>{viewUser.isApproved ? '已批准' : '待批准'}</div>
              <div><span className="text-zinc-500">创建时间：</span>{new Date(viewUser.createdAt).toLocaleString('zh-CN')}</div>
              <div>
                <span className="text-zinc-500">兼任角色：</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {viewUser.roles.length === 0 ? <span className="text-zinc-400">无</span> :
                    viewUser.roles.map(r => <Badge key={r.id} variant="outline" className="text-xs">{r.displayName}</Badge>)
                  }
                </div>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setViewUser(null)}>关闭</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑 */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑用户</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">姓名</label>
              <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">邮箱</label>
              <Input value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">主角色</label>
              <select
                value={editForm.role}
                onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm bg-white"
              >
                {roles.map(r => (
                  <option key={r.id} value={r.name}>{r.displayName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">新密码（留空不修改）</label>
              <Input type="password" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} placeholder="输入新密码" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isApproved" checked={editForm.isApproved}
                onChange={e => setEditForm({ ...editForm, isApproved: e.target.checked })} />
              <label htmlFor="isApproved" className="text-sm">已批准</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>取消</Button>
            <Button onClick={handleSaveEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <Dialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>确认删除</DialogTitle></DialogHeader>
          <p>确定要删除用户 <strong>{deleteUser?.name || deleteUser?.email}</strong> 吗？此操作不可撤销。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 停用/启用确认 */}
      <Dialog open={!!toggleUser} onOpenChange={() => setToggleUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{toggleUser?.isActive === false ? '启用用户' : '停用用户'}</DialogTitle>
          </DialogHeader>
          {toggleUser?.isActive === false ? (
            <p>确认恢复 <strong>{toggleUser?.name || toggleUser?.email}</strong> 的登录权限？</p>
          ) : (
            <>
              <p>确认停用 <strong>{toggleUser?.name || toggleUser?.email}</strong>？停用后该账号将无法登录，历史数据保留，可随时启用。</p>
              <div className="mt-3">
                <label className="text-sm font-medium">停用原因（可选）</label>
                <Input
                  value={disableReason}
                  onChange={e => setDisableReason(e.target.value)}
                  placeholder="如：离职 / 长期休假"
                  maxLength={200}
                />
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setToggleUser(null)}>取消</Button>
            <Button
              variant={toggleUser?.isActive === false ? 'default' : 'destructive'}
              onClick={handleToggleActive}
            >
              {toggleUser?.isActive === false ? '确认启用' : '确认停用'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 分配角色 */}
      <Dialog open={!!assignUser} onOpenChange={() => setAssignUser(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>分配角色 - {assignUser?.name || assignUser?.email}</DialogTitle>
            <DialogDescription>选择要分配给该用户的角色，用户将获得所有选中角色的权限；点"设为主"指定主角色（决定其基础身份）</DialogDescription>
          </DialogHeader>
          <div className="py-4 grid grid-cols-2 gap-3">
            {roles.map(role => (
              <div key={role.id} className={`border rounded-lg p-4 cursor-pointer transition-all ${assignedRoleIds.includes(role.id) ? 'border-blue-500 bg-blue-50' : 'border-zinc-200 hover:border-blue-300'}`}
                onClick={() => toggleRole(role.id)}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{role.displayName}</div>
                    {role.description && <div className="text-sm text-zinc-500 mt-1">{role.description}</div>}
                    <code className="text-xs bg-zinc-100 px-2 py-0.5 rounded mt-2 inline-block">{role.name}</code>
                    {role.isSystem && <Badge variant="secondary" className="ml-2 text-xs">系统</Badge>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="w-5 h-5 border rounded flex items-center justify-center">
                      {assignedRoleIds.includes(role.id) && <Check className="h-3 w-3 text-blue-600" />}
                    </div>
                    {assignedRoleIds.includes(role.id) && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setPrimaryRoleId(role.id); }}
                        className={`text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${primaryRoleId === role.id ? 'bg-blue-600 text-white border-blue-600' : 'text-zinc-500 border-zinc-300 hover:border-blue-400'}`}
                        title="设为主角色（决定用户的基础身份标识）"
                      >
                        {primaryRoleId === role.id ? '主角色' : '设为主'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignUser(null)}>取消</Button>
            <Button onClick={handleSaveAssign}>保存分配</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmDialog />
    </>
  );
}
