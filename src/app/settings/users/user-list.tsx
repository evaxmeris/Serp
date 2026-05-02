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
import { UserRound, Shield, Search, Check, X, Eye, Edit, Trash2 } from 'lucide-react';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirmation-dialog';

type User = {
  id: string; email: string; name?: string; role?: string; isApproved: boolean;
  createdAt: string; roles: Role[]; permissions: string[];
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
  const [assignUser, setAssignUser] = useState<User | null>(null);
  const [assignedRoleIds, setAssignedRoleIds] = useState<string[]>([]);

  // 编辑表单
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '', password: '', isApproved: true });

  const { toast, toasts, removeToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const users = await res.json();
      const usersWithRoles = await Promise.all(
        (Array.isArray(users) ? users : []).map(async (u: any) => {
          try {
            const rr = await fetch(`/api/users/${u.id}/roles`);
            const rd = await rr.json();
            const userRoles = rd.data?.items || rd.data || rd || [];
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
      setRoles((data.data?.items ?? data.data ?? []).filter((r: Role) => r.isActive));
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadUsers(); loadRoles(); loadPerms(); }, []);

  const loadPerms = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      const user = data.user || data;
      // ADMIN 拥有全部权限；其他角色从 API 返回的 permissions 读取
      if (user.role === 'ADMIN') {
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
      role: user.role || 'VIEWER',
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

  // 角色分配
  const openAssign = (user: User) => {
    setAssignUser(user);
    setAssignedRoleIds(user.roles.map(r => r.id));
  };
  const toggleRole = (roleId: string) => {
    setAssignedRoleIds(prev => prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]);
  };
  const handleSaveAssign = async () => {
    if (!assignUser) return;
    try {
      const res = await fetch(`/api/users/${assignUser.id}/roles`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleIds: assignedRoleIds }),
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
                <TableHead>已分配角色</TableHead>
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
                    <Badge className={user.isApproved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                      {user.isApproved ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                      {user.isApproved ? '已批准' : '待批准'}
                    </Badge>
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
              <div><span className="text-zinc-500">角色：</span>{{ADMIN:'管理员',SALES:'业务员',PURCHASING:'采购员',WAREHOUSE:'仓管员',VIEWER:'访客'}[viewUser.role||''] || viewUser.role || '-'}</div>
              <div><span className="text-zinc-500">状态：</span>{viewUser.isApproved ? '已批准' : '待批准'}</div>
              <div><span className="text-zinc-500">创建时间：</span>{new Date(viewUser.createdAt).toLocaleString('zh-CN')}</div>
              <div>
                <span className="text-zinc-500">已分配角色：</span>
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
                  <option key={r.id} value={r.name.toUpperCase()}>{r.displayName}</option>
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

      {/* 分配角色 */}
      <Dialog open={!!assignUser} onOpenChange={() => setAssignUser(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>分配角色 - {assignUser?.name || assignUser?.email}</DialogTitle>
            <DialogDescription>选择要分配给该用户的角色，用户将获得所有选中角色的权限</DialogDescription>
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
                  <div className="w-5 h-5 border rounded flex items-center justify-center">
                    {assignedRoleIds.includes(role.id) && <Check className="h-3 w-3 text-blue-600" />}
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
