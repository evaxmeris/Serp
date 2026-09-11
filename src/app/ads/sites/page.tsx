'use client';

/**
 * 站点管理（M1）— 广告账户绑定 + marketplace 配置
 * 权限：ads:view 查看 / ads:admin 增删改
 */
import { useState } from 'react';
import {
  useAdsAccounts,
  useAdsMarketplaces,
  useCreateAdAccount,
  useUpdateAdAccount,
  useDeleteAdAccount,
  useCreateMarketplace,
  useUpdateMarketplace,
  useDeleteMarketplace,
} from '@/hooks/use-ads';
import { useAdsPerms, NONE_VALUE, fmtDate } from '@/components/ads/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast, ToastContainer } from '@/components/ui/toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export default function AdsSitesPage() {
  const { hasPerm } = useAdsPerms();
  const { toast, toasts, removeToast } = useToast();
  const canAdmin = hasPerm('ads:admin');
  const canView = hasPerm('ads:view');

  const { data: accounts, isLoading: accLoading } = useAdsAccounts({});
  const { data: marketplaces, isLoading: mpLoading } = useAdsMarketplaces();
  const accountList = accounts?.items ?? [];
  const marketplaceList = marketplaces?.items ?? [];

  const createAccount = useCreateAdAccount();
  const updateAccount = useUpdateAdAccount();
  const deleteAccount = useDeleteAdAccount();
  const createMarketplace = useCreateMarketplace();
  const updateMarketplace = useUpdateMarketplace();
  const deleteMarketplace = useDeleteMarketplace();

  // 账户编辑弹窗
  const [accDialog, setAccDialog] = useState<{ open: boolean; id?: string }>({ open: false });
  const [accForm, setAccForm] = useState({
    name: '',
    marketplaceId: '',
    externalId: '',
    clientId: '',
    clientSecret: '',
    refreshToken: '',
  });

  const openCreate = () => {
    setAccForm({ name: '', marketplaceId: marketplaceList[0]?.marketplaceId ?? '', externalId: '', clientId: '', clientSecret: '', refreshToken: '' });
    setAccDialog({ open: true });
  };

  const openEdit = (a: { id: string; name: string; marketplaceId: string; externalId: string | null; isActive: boolean; createdAt?: string }) => {
    setAccForm({
      name: a.name,
      marketplaceId: a.marketplaceId,
      externalId: a.externalId ?? '',
      clientId: '',
      clientSecret: '',
      refreshToken: '',
    });
    setAccDialog({ open: true, id: a.id });
  };

  const saveAccount = async () => {
    try {
      if (accDialog.id) {
        await updateAccount.mutateAsync({ id: accDialog.id, data: accForm });
        toast.success('账户更新成功');
      } else {
        await createAccount.mutateAsync(accForm);
        toast.success('账户创建成功');
      }
      setAccDialog({ open: false });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const removeAccount = async (id: string, name: string) => {
    if (!confirm(`确认删除广告账户「${name}」？数据保留可追溯（软删除）`)) return;
    try {
      await deleteAccount.mutateAsync(id);
      toast.success('账户已删除');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  if (!canView) {
    return <div className="py-16 text-center text-muted-foreground">无权查看广告站点管理（需 ads:view 权限）</div>;
  }

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">站点管理</h1>
          <p className="text-sm text-muted-foreground">广告账户绑定与站点配置（凭据加密存储，M2 自动拉取预留）</p>
        </div>
        {canAdmin && (
          <Button onClick={openCreate} disabled={createAccount.isPending}>
            新建广告账户
          </Button>
        )}
      </div>

      {/* 广告账户列表 */}
      <div>
        <h2 className="mb-2 text-lg font-medium">广告账户</h2>
        {accLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : accountList.length === 0 ? (
          <div className="rounded-lg border py-10 text-center text-muted-foreground">暂无广告账户，点击右上角新建</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="table-auto w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left whitespace-nowrap">名称</th>
                  <th className="px-3 py-2 text-left">站点</th>
                  <th className="px-3 py-2 text-left">状态</th>
                  <th className="px-3 py-2 text-left">profileId</th>
                  <th className="px-3 py-2 text-left">创建时间</th>
                  {canAdmin && <th className="px-3 py-2 text-right">操作</th>}
                </tr>
              </thead>
              <tbody>
                {accountList.map(a => (
                  <tr key={a.id} className="border-t">
                    <td className="px-3 py-2 font-medium truncate max-w-[200px]">{a.name}</td>
                    <td className="px-3 py-2">{a.marketplace?.name ?? a.marketplaceId}</td>
                    <td className="px-3 py-2">
                      <Badge variant={a.isActive ? 'default' : 'secondary'}>{a.isActive ? '启用' : '停用'}</Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{a.externalId ?? '-'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(a.createdAt)}</td>
                    {canAdmin && (
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Button size="sm" variant="outline" onClick={() => openEdit(a)}>编辑</Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeAccount(a.id, a.name)}>删除</Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* marketplace 列表（只读展示 + admin 可编辑） */}
      <div>
        <h2 className="mb-2 text-lg font-medium">站点配置（marketplace）</h2>
        {mpLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="table-auto w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">名称</th>
                  <th className="px-3 py-2 text-left">marketplaceId</th>
                  <th className="px-3 py-2 text-left">货币</th>
                  <th className="px-3 py-2 text-left">广告端点</th>
                  <th className="px-3 py-2 text-left">状态</th>
                </tr>
              </thead>
              <tbody>
                {marketplaceList.map(m => (
                  <tr key={m.id} className="border-t">
                    <td className="px-3 py-2 font-mono">{m.code}</td>
                    <td className="px-3 py-2">{m.name}</td>
                    <td className="px-3 py-2 font-mono text-xs">{m.marketplaceId}</td>
                    <td className="px-3 py-2">{m.currency}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[220px]">{m.adEndpoint}</td>
                    <td className="px-3 py-2">
                      <Badge variant={m.isActive ? 'default' : 'secondary'}>{m.isActive ? '启用' : '停用'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          预设站点 US/CA/BR/UK/DE/FR/ES/IT/JP（marketplaceId 已内置）；增删改需 ads:admin
        </p>
      </div>

      {/* 账户编辑弹窗 */}
      <Dialog key={accDialog.id ?? 'new'} open={accDialog.open} onOpenChange={o => setAccDialog(v => ({ ...v, open: o }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{accDialog.id ? '编辑广告账户' : '新建广告账户'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>账户名称</Label>
              <Input value={accForm.name} onChange={e => setAccForm({ ...accForm, name: e.target.value })} placeholder="如：美国站主账号" />
            </div>
            <div>
              <Label>站点（marketplace）</Label>
              <Select value={accForm.marketplaceId || NONE_VALUE} onValueChange={v => setAccForm({ ...accForm, marketplaceId: v === NONE_VALUE ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="选择站点" /></SelectTrigger>
                <SelectContent>
                  {marketplaceList.map(m => (
                    <SelectItem key={m.id} value={m.marketplaceId}>{m.name}（{m.code}）</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ads profileId（外部 ID）</Label>
              <Input value={accForm.externalId} onChange={e => setAccForm({ ...accForm, externalId: e.target.value })} placeholder="M2 API 对接用，可留空" />
            </div>
            <div>
              <Label>Client ID（加密存储）</Label>
              <Input value={accForm.clientId} onChange={e => setAccForm({ ...accForm, clientId: e.target.value })} placeholder={accDialog.id ? '留空保持不变' : ''} />
            </div>
            <div>
              <Label>Client Secret（加密存储）</Label>
              <Input type="password" value={accForm.clientSecret} onChange={e => setAccForm({ ...accForm, clientSecret: e.target.value })} placeholder={accDialog.id ? '留空保持不变' : ''} />
            </div>
            <div>
              <Label>Refresh Token（加密存储）</Label>
              <Input type="password" value={accForm.refreshToken} onChange={e => setAccForm({ ...accForm, refreshToken: e.target.value })} placeholder={accDialog.id ? '留空保持不变' : ''} />
            </div>
            <p className="text-xs text-muted-foreground">凭据用于 M2 自动拉取（Ads API 审批后），当前阶段仅手动上传报告</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccDialog({ open: false })}>取消</Button>
            <Button onClick={saveAccount} disabled={createAccount.isPending || updateAccount.isPending}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
