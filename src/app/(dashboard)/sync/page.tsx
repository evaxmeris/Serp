'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import {
  RefreshCw,
  Settings,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  Eye,
  EyeOff,
  Plus,
  Save,
} from 'lucide-react';

// 类型定义
interface PlatformStatus {
  code: string;
  name: string;
  enabled: boolean;
  configured: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  syncIntervalMin: number;
}

interface SyncLog {
  id: string;
  platformCode: string;
  triggerType: string;
  status: string;
  ordersFound: number;
  ordersSynced: number;
  ordersFailed: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

export default function SyncPage() {
  const { toast } = useToast();
  const [platforms, setPlatforms] = useState<PlatformStatus[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformStatus | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);
  
  // 配置表单状态
  const [configForm, setConfigForm] = useState({
    enabled: false,
    syncIntervalMin: 120,
    credentials: {} as Record<string, string>,
  });

  // 加载状态
  const loadStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sync/status');
      const data = await response.json();
      
      if (data.success) {
        setPlatforms(data.data.platforms);
        setLogs(data.data.recentLogs);
      }
    } catch (error) {
      console.error('Failed to load sync status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  // 手动触发同步
  const handleSync = async (platformCode?: string) => {
    try {
      setSyncing(true);
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platformCode }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        const totalSynced = data.data.results.reduce((sum: number, r: any) => sum + r.ordersSynced, 0);
        toast.success(`同步完成：成功同步 ${totalSynced} 个订单`);
        loadStatus();
      } else {
        toast.error(`同步失败：${data.error}`);
      }
    } catch (error) {
      toast.error('同步请求失败，请检查网络连接');
    } finally {
      setSyncing(false);
    }
  };

  // 打开配置对话框
  const openConfigDialog = async (platform: PlatformStatus) => {
    setSelectedPlatform(platform);
    
    try {
      const response = await fetch(`/api/sync/config?platformCode=${platform.code}`);
      const data = await response.json();
      
      if (data.success && data.data.config) {
        setConfigForm({
          enabled: data.data.config.enabled,
          syncIntervalMin: data.data.config.syncIntervalMin,
          credentials: data.data.config.credentials || {},
        });
      } else {
        setConfigForm({
          enabled: platform.enabled,
          syncIntervalMin: platform.syncIntervalMin,
          credentials: {},
        });
      }
      
      setConfigDialogOpen(true);
    } catch (error) {
      console.error('Failed to load config:', error);
      setConfigDialogOpen(true);
    }
  };

  // 保存配置
  const saveConfig = async () => {
    if (!selectedPlatform) return;
    
    try {
      const response = await fetch('/api/sync/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformCode: selectedPlatform.code,
          ...configForm,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(`${selectedPlatform.name} 的配置已更新`);
        setConfigDialogOpen(false);
        loadStatus();
      } else {
        toast.error(`保存失败：${data.error}`);
      }
    } catch (error) {
      toast.error('请求失败，请检查网络连接');
    }
  };

  // 格式化时间
  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '从未';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin} 分钟前`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)} 小时前`;
    return date.toLocaleString('zh-CN');
  };

  // 状态徽章
  const StatusBadge = ({ status }: { status: string }) => {
    const variants: Record<string, { text: string; color: string }> = {
      success: { text: '成功', color: 'bg-green-100 text-green-800' },
      failed: { text: '失败', color: 'bg-red-100 text-red-800' },
      partial: { text: '部分成功', color: 'bg-yellow-100 text-yellow-800' },
      not_configured: { text: '未配置', color: 'bg-gray-100 text-gray-800' },
    };
    
    const variant = variants[status] || { text: status, color: 'bg-gray-100 text-gray-800' };
    
    return <Badge className={variant.color}>{variant.text}</Badge>;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">多平台订单同步</h1>
          <p className="text-muted-foreground">管理各电商平台订单自动同步</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => handleSync()}
            disabled={syncing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? '同步中...' : '同步所有平台'}
          </Button>
          <Button
            variant="outline"
            onClick={loadStatus}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            刷新状态
          </Button>
        </div>
      </div>

      {/* 平台状态卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {platforms.map((platform) => (
          <Card key={platform.code}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{platform.name}</CardTitle>
                <Badge variant={platform.enabled ? 'default' : 'secondary'}>
                  {platform.enabled ? '已启用' : '已禁用'}
                </Badge>
              </div>
              <CardDescription>
                {platform.configured ? '已配置' : '未配置凭据'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">最后同步</span>
                <span>{formatTime(platform.lastSyncAt)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">同步状态</span>
                <StatusBadge status={platform.lastSyncStatus || 'not_configured'} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">同步间隔</span>
                <span>{platform.syncIntervalMin} 分钟</span>
              </div>
              <Separator />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={() => handleSync(platform.code)}
                  disabled={syncing || !platform.configured}
                >
                  <Play className="h-3 w-3" />
                  立即同步
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => openConfigDialog(platform)}
                >
                  <Settings className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 同步日志 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            最近同步日志
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>平台</TableHead>
                <TableHead>触发方式</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>发现订单</TableHead>
                <TableHead>同步成功</TableHead>
                <TableHead>同步失败</TableHead>
                <TableHead>耗时</TableHead>
                <TableHead>开始时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    暂无同步记录
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">
                      {platforms.find(p => p.code === log.platformCode)?.name || log.platformCode}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {log.triggerType === 'manual' ? '手动' : '定时'}
                      </Badge>
                    </TableCell>
                    <TableCell><StatusBadge status={log.status} /></TableCell>
                    <TableCell>{log.ordersFound}</TableCell>
                    <TableCell className="text-green-600">{log.ordersSynced}</TableCell>
                    <TableCell className={log.ordersFailed > 0 ? 'text-red-600' : ''}>
                      {log.ordersFailed}
                    </TableCell>
                    <TableCell>
                      {log.durationMs ? `${(log.durationMs / 1000).toFixed(1)}s` : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTime(log.startedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 配置对话框 */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{selectedPlatform?.name} - 配置</DialogTitle>
            <DialogDescription>
              配置平台 API 凭据和同步参数
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 启用开关 */}
            <div className="flex items-center justify-between">
              <Label htmlFor="enabled">启用同步</Label>
              <Switch
                id="enabled"
                checked={configForm.enabled}
                onCheckedChange={(checked) => setConfigForm({ ...configForm, enabled: checked })}
              />
            </div>
            
            <Separator />
            
            {/* 同步间隔 */}
            <div className="space-y-2">
              <Label htmlFor="interval">同步间隔（分钟）</Label>
              <Input
                id="interval"
                type="number"
                min={5}
                max={1440}
                value={configForm.syncIntervalMin}
                onChange={(e) => setConfigForm({ ...configForm, syncIntervalMin: parseInt(e.target.value) || 120 })}
              />
              <p className="text-xs text-muted-foreground">建议：120 分钟（2 小时），最小 5 分钟</p>
            </div>
            
            <Separator />
            
            {/* API 凭据 - 阿里国际站示例 */}
            {selectedPlatform?.code === 'alibaba' && (
              <div className="space-y-4">
                <h4 className="font-medium">阿里国际站 API 凭据</h4>
                
                <div className="space-y-2">
                  <Label htmlFor="appKey">App Key</Label>
                  <Input
                    id="appKey"
                    value={configForm.credentials.appKey || ''}
                    onChange={(e) => setConfigForm({
                      ...configForm,
                      credentials: { ...configForm.credentials, appKey: e.target.value },
                    })}
                    placeholder="例如：504486"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="appSecret">App Secret</Label>
                  <div className="relative">
                    <Input
                      id="appSecret"
                      type={showSecrets ? 'text' : 'password'}
                      value={configForm.credentials.appSecret || ''}
                      onChange={(e) => setConfigForm({
                        ...configForm,
                        credentials: { ...configForm.credentials, appSecret: e.target.value },
                      })}
                      placeholder="输入 App Secret"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowSecrets(!showSecrets)}
                    >
                      {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="accessToken">Access Token</Label>
                  <div className="relative">
                    <Input
                      id="accessToken"
                      type={showSecrets ? 'text' : 'password'}
                      value={configForm.credentials.accessToken || ''}
                      onChange={(e) => setConfigForm({
                        ...configForm,
                        credentials: { ...configForm.credentials, accessToken: e.target.value },
                      })}
                      placeholder="输入 Access Token"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowSecrets(!showSecrets)}
                    >
                      {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    从阿里开放平台控制台获取，或使用 OAuth2 流程获取
                  </p>
                </div>
              </div>
            )}
            
            {/* TikTok 配置提示 */}
            {selectedPlatform?.code === 'tiktok' && (
              <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                TikTok Shop 适配器尚未实现，敬请期待
              </div>
            )}
            
            {/* Amazon 配置提示 */}
            {selectedPlatform?.code === 'amazon' && (
              <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                Amazon SP-API 适配器尚未实现，敬请期待
              </div>
            )}
            
            {/* Shopify 配置提示 */}
            {selectedPlatform?.code === 'shopify' && (
              <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                Shopify 适配器尚未实现，敬请期待
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={saveConfig} className="gap-2">
              <Save className="h-4 w-4" />
              保存配置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
