'use client';

/**
 * 系统设置页面 - 重构版
 * 采用 Tab 切换架构，避免创建过多独立子页面
 * 
 * @作者 应亮
 * @创建日期 2026-04-09
 * @更新日期 2026-04-10
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Settings,
  Building2,
  Bell,
  Shield,
  Palette,
  Save,
  CheckCircle2,
  Database,
  Globe,
  Lock,
  Mail,
  Monitor,
  Cloud,
  FileText,
  ArrowUpDown,
  Ship,
  CreditCard,
  DollarSign,
  Users,
  Eye,
  EyeOff,
  AlertTriangle,
  Play,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirmation-dialog';

// Tab 定义
type TabKey = 'business' | 'system' | 'security' | 'notification' | 'data' | 'appearance' | 'sync';

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  desc: string;
}

const tabs: TabDef[] = [
  { key: 'business', label: '业务设置', icon: <Settings className="h-4 w-4" />, desc: '币种、贸易条款、付款、物流' },
  { key: 'system', label: '系统配置', icon: <Monitor className="h-4 w-4" />, desc: '公司信息、系统参数' },
  { key: 'security', label: '安全设置', icon: <Shield className="h-4 w-4" />, desc: '密码策略、登录安全' },
  { key: 'notification', label: '通知设置', icon: <Bell className="h-4 w-4" />, desc: '邮件通知、消息推送' },
  { key: 'data', label: '数据管理', icon: <Database className="h-4 w-4" />, desc: '备份、导出' },
  { key: 'appearance', label: '外观设置', icon: <Palette className="h-4 w-4" />, desc: '主题、语言' },
  { key: 'sync', label: '平台同步', icon: <Cloud className="h-4 w-4" />, desc: 'API凭据、同步间隔' },
];

// 模拟配置数据
const mockConfig = {
  currencies: [
    { code: 'USD', name: '美元', symbol: '$', default: true },
    { code: 'EUR', name: '欧元', symbol: '€', default: false },
    { code: 'CNY', name: '人民币', symbol: '¥', default: false },
    { code: 'GBP', name: '英镑', symbol: '£', default: false },
  ],
  tradeTerms: ['FOB', 'CIF', 'EXW', 'DDP', 'DAP', 'CFR', 'CIP', 'FCA'],
  paymentMethods: ['T/T', 'L/C', 'D/P', 'D/A', 'PayPal', 'Western Union', 'Credit Card'],
  shippingMethods: ['海运 (FCL)', '海运 (LCL)', '空运', '快递 (DHL/FedEx)', '铁路', '多式联运'],
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('business');
  const { toast, toasts, removeToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [saved, setSaved] = useState(false);
  const [syncPlatforms, setSyncPlatforms] = useState<any[]>([]);
  const [syncLoading, setSyncLoading] = useState(true);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<any>(null);
  const [showSecrets, setShowSecrets] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [configForm, setConfigForm] = useState({
    enabled: false,
    syncIntervalMin: 120,
    credentials: {} as Record<string, string>,
  });

  // 处理 OAuth 回调参数
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const oauth = params.get('oauth');
      const msg = params.get('msg');
      if (oauth === 'success' && msg) {
        setActiveTab('sync');
        setTimeout(() => toast.success(msg), 500);
      } else if (oauth === 'error' && msg) {
        setActiveTab('sync');
        setTimeout(() => toast.error('授权失败：' + msg), 500);
      }
      // 清理 URL 参数
      if (oauth) {
        window.history.replaceState({}, '', '/settings?tab=sync');
      }
    }
  }, []);

  const loadSyncStatus = async () => {
    try {
      setSyncLoading(true);
      const response = await fetch('/api/sync/status');
      const data = await response.json();
      if (data.success) {
        setSyncPlatforms(data.data.platforms);
      }
    } catch (error) {
      console.error('Failed to load sync status:', error);
    } finally {
      setSyncLoading(false);
    }
  };

  const openConfigDialog = async (platform: any) => {
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
    } catch {
      setConfigDialogOpen(true);
    }
  };

  const saveConfig = async () => {
    if (!selectedPlatform) return;
    try {
      const response = await fetch('/api/sync/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platformCode: selectedPlatform.code, ...configForm }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`${selectedPlatform.name} 配置已更新`);
        setConfigDialogOpen(false);
        loadSyncStatus();
      } else {
        toast.error(`保存失败：${data.error}`);
      }
    } catch {
      toast.error('请求失败');
    }
  };

  /** 测试平台连接 */
  const handleTestConnection = async () => {
    if (!selectedPlatform) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/sync/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platformCode: selectedPlatform.code }),
      });
      const data = await res.json();
      if (data.success) {
        const result = data.data;
        setTestResult({ ok: result.connected, msg: result.details || result.message });
      } else {
        setTestResult({ ok: false, msg: data.error || data.message || '请求失败' });
      }
    } catch {
      setTestResult({ ok: false, msg: '网络请求失败' });
    } finally {
      setTesting(false);
    }
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '从未';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin} 分钟前`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)} 小时前`;
    return date.toLocaleString('zh-CN');
  };

  // Load sync status when sync tab is active
  useEffect(() => {
    if (activeTab === 'sync') {
      loadSyncStatus();
    }
  }, [activeTab]);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 space-y-6 w-full">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
            ⚙️ 系统设置
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            配置系统参数和业务基础设置
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
              保存设置
            </>
          )}
        </Button>
      </div>

      {/* Tab 导航 */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      {activeTab === 'business' && <BusinessSettings />}
      {activeTab === 'system' && <SystemSettings />}
      {activeTab === 'security' && <SecuritySettings />}
      {activeTab === 'notification' && <NotificationSettings />}
      {activeTab === 'data' && <DataSettings />}
      {activeTab === 'appearance' && <AppearanceSettings />}
      {activeTab === 'sync' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Cloud className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle>平台同步配置</CardTitle>
                  <CardDescription>管理各电商平台 API 凭据和同步参数</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {syncLoading ? (
                  <div className="text-center py-8 text-muted-foreground">加载中...</div>
                ) : syncPlatforms.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">暂无平台配置</div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {syncPlatforms.map((platform: any) => (
                      <div
                        key={platform.code}
                        className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{platform.name}</span>
                            {platform.enabled ? (
                              <Badge className="bg-green-100 text-green-700 text-xs">已启用</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">已禁用</Badge>
                            )}
                          </div>
                          <div className="text-xs text-zinc-500 mt-1">
                            {platform.configured ? '已配置凭据' : '⚠️ 未配置凭据'}
                            {platform.lastSyncAt && ` · 最后同步: ${formatTime(platform.lastSyncAt)}`}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {platform.code === 'alibaba' && (
                            <Button variant="outline" size="sm" className="text-blue-600 border-blue-300" onClick={() => {
                              const cb = platform.callbackUrl || 'https://serp.cpolar.cn/api/auth/alibaba/callback';
                              window.open(
                                `https://open-api.alibaba.com/oauth/authorize?response_type=code&client_id=504486&redirect_uri=${encodeURIComponent(cb)}&state=1212`,
                                '_blank'
                              );
                            }}>
                              一键授权
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => openConfigDialog(platform)}>
                            <Settings className="h-4 w-4 mr-1" />
                            配置
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 配置对话框 */}
          <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{selectedPlatform?.name} - 配置</DialogTitle>
                <DialogDescription>配置平台 API 凭据和同步参数</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sync-enabled">启用同步</Label>
                  <Switch
                    id="sync-enabled"
                    checked={configForm.enabled}
                    onCheckedChange={(checked) => setConfigForm({ ...configForm, enabled: checked })}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="sync-interval">同步间隔（分钟）</Label>
                  <Input
                    id="sync-interval"
                    type="number"
                    min={5}
                    max={1440}
                    value={configForm.syncIntervalMin}
                    onChange={(e) => setConfigForm({ ...configForm, syncIntervalMin: parseInt(e.target.value) || 120 })}
                  />
                  <p className="text-xs text-muted-foreground">建议：120 分钟（2 小时），最小 5 分钟</p>
                </div>
                <Separator />
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
                          placeholder="输入 Access Token（一键授权会自动获取）"
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
                    <Separator />
                    <div className="space-y-2">
                      <Label htmlFor="callbackUrl">OAuth 回调地址</Label>
                      <Input
                        id="callbackUrl"
                        value={configForm.credentials.callbackUrl || 'https://serp.cpolar.cn/api/auth/alibaba/callback'}
                        onChange={(e) => setConfigForm({
                          ...configForm,
                          credentials: { ...configForm.credentials, callbackUrl: e.target.value },
                        })}
                        placeholder="https://serp.cpolar.cn/api/auth/alibaba/callback"
                      />
                      <p className="text-xs text-muted-foreground">
                        需与阿里开放平台应用设置中的回调地址一致，修改后「一键授权」链接自动更新
                      </p>
                    </div>
                  </div>
                )}
                {['tiktok', 'amazon', 'shopify'].includes(selectedPlatform?.code) && (
                  <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
                    <AlertTriangle className="h-4 w-4 inline mr-2" />
                    {selectedPlatform.name} 适配器尚未实现，敬请期待
                  </div>
                )}
              </div>
              <DialogFooter>
                <div className="flex-1">
                  {testResult && (
                    <div className={`text-sm px-3 py-1.5 rounded ${testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {testResult.ok ? '✅ ' : '❌ '}{testResult.msg}
                    </div>
                  )}
                </div>
                <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>取消</Button>
                <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
                  <Play className="h-4 w-4 mr-1" />{testing ? '测试中...' : '测试连接'}
                </Button>
                <Button onClick={saveConfig}><Save className="h-4 w-4 mr-1" />保存</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmDialog />
    </div>
  );
}

/**
 * 业务设置 - 币种、贸易条款、付款方式、物流方式
 * 从 API 加载真实数据
 */
function BusinessSettings() {
  const [config, setConfig] = useState<typeof mockConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/v1/settings');
        const json = await res.json();
        if (json.success && json.data) {
          setConfig(json.data);
        }
      } catch (err) {
        console.error('加载系统设置失败:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = config || mockConfig;

  return (
    <div className="space-y-6">
      {/* 币种设置 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>币种管理</CardTitle>
              <CardDescription>配置系统支持的交易币种和默认汇率</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.currencies.map((c) => (
              <div
                key={c.code}
                className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-zinc-400">{c.symbol}</span>
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-sm text-zinc-500">{c.code}</div>
                  </div>
                </div>
                {c.default && <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">默认</Badge>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 贸易条款 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <Globe className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle>贸易条款</CardTitle>
              <CardDescription>国际贸易术语，决定价格构成和责任划分</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {data.tradeTerms.map((t) => (
              <Badge
                key={t}
                variant="outline"
                className="px-4 py-2 text-sm cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 transition-colors"
              >
                {t}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 付款方式 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle>付款方式</CardTitle>
              <CardDescription>支持的国际贸易付款结算方式</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.paymentMethods.map((m) => (
              <div
                key={m}
                className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
              >
                <CreditCard className="h-4 w-4 text-zinc-400" />
                <span className="text-sm">{m}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 物流方式 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
              <Ship className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <CardTitle>物流方式</CardTitle>
              <CardDescription>支持的运输方式和渠道</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.shippingMethods.map((m) => (
              <div
                key={m}
                className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
              >
                <ArrowUpDown className="h-4 w-4 text-zinc-400" />
                <span className="text-sm">{m}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * 系统配置 - 公司信息、系统参数
 */
function SystemSettings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>公司信息</CardTitle>
              <CardDescription>企业基本信息，用于报价单、合同等文档</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">公司名称</label>
              <Input placeholder="请输入公司全称" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">英文名称</label>
              <Input placeholder="Company Name in English" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">统一社会信用代码</label>
              <Input placeholder="91310000MA..." />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">联系电话</label>
              <Input placeholder="+86-xxx-xxxx-xxxx" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium mb-1.5 block">公司地址</label>
              <Input placeholder="请输入详细地址" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 系统信息 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-500/10 rounded-lg flex items-center justify-center">
              <Monitor className="h-5 w-5 text-zinc-600" />
            </div>
            <div>
              <CardTitle>系统信息</CardTitle>
              <CardDescription>当前系统版本和运行状态</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-500">系统版本</span>
              <span className="font-medium text-sm">v0.9.0</span>
            </div>
            <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-500">构建时间</span>
              <span className="font-medium text-sm">2026-04-10</span>
            </div>
            <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-500">数据库状态</span>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">正常运行</Badge>
            </div>
            <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-500">API 状态</span>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">正常运行</Badge>
            </div>
            <div className="py-2">
              <div className="text-zinc-500 mb-2">角色体系</div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">ADMIN</Badge>
                <Badge variant="secondary">SALES</Badge>
                <Badge variant="secondary">PURCHASING</Badge>
                <Badge variant="secondary">WAREHOUSE</Badge>
                <Badge variant="secondary">VIEWER</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * 安全设置 - 密码策略、登录安全
 */
function SecuritySettings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
              <Lock className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <CardTitle>密码策略</CardTitle>
              <CardDescription>系统密码强度要求和有效期设置</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: '最小密码长度', value: '8', unit: '字符' },
            { label: '密码复杂度', value: '需要大小写字母+数字' },
            { label: '密码有效期', value: '90', unit: '天' },
            { label: '登录失败锁定', value: '5', unit: '次' },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{item.label}</span>
              <div className="flex items-center gap-2">
                <Input className="w-24 text-right" defaultValue={item.value} />
                {item.unit && <span className="text-sm text-zinc-500 w-12">{item.unit}</span>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
              <Shield className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle>登录安全</CardTitle>
              <CardDescription>会话管理和登录保护</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: '会话有效期', value: '7', unit: '天' },
            { label: '空闲超时', value: '30', unit: '分钟' },
            { label: 'IP 白名单', value: '未启用' },
            { label: '双因素认证', value: '未启用' },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{item.label}</span>
              <Badge variant={item.value === '未启用' ? 'secondary' : 'default'} className="text-xs">
                {item.value}{item.unit}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * 通知设置 - 邮件通知、消息推送
 */
function NotificationSettings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>邮件通知</CardTitle>
              <CardDescription>配置 SMTP 服务器和通知模板</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">SMTP 服务器</label>
              <Input placeholder="smtp.example.com" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">端口</label>
              <Input placeholder="587" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">发件邮箱</label>
              <Input placeholder="noreply@trade-erp.com" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">发件人名称</label>
              <Input placeholder="Trade ERP 系统" />
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">⚠️ 需保存后测试连接</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <Bell className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle>消息推送</CardTitle>
              <CardDescription>钉钉、企业微信等消息推送配置</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { name: '钉钉 Webhook', status: '未配置', icon: '📌' },
              { name: '企业微信', status: '未配置', icon: '💬' },
              { name: '邮件通知', status: '未配置', icon: '📧' },
            ].map((ch) => (
              <div key={ch.name} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{ch.icon}</span>
                  <div>
                    <div className="font-medium text-sm">{ch.name}</div>
                    <div className="text-xs text-zinc-500">用于订单、采购等关键业务通知</div>
                  </div>
                </div>
                <Button variant="outline" size="sm">配置</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * 数据管理 - 备份、导出
 */
function DataSettings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <Cloud className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle>数据备份</CardTitle>
              <CardDescription>数据库备份策略和恢复</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
            <div>
              <div className="font-medium text-sm">自动备份</div>
              <div className="text-xs text-zinc-500">每日凌晨 2:00 自动备份数据库</div>
            </div>
            <Badge className="bg-green-100 text-green-700">已启用</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Cloud className="h-4 w-4 mr-2" />
              立即备份
            </Button>
            <Button variant="outline" size="sm">
              恢复数据
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>数据导出</CardTitle>
              <CardDescription>导出系统数据为 Excel/CSV 格式</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              '客户数据',
              '产品数据',
              '订单数据',
              '采购数据',
              '库存数据',
              '供应商数据',
            ].map((item) => (
              <Button key={item} variant="outline" className="justify-start">
                <FileText className="h-4 w-4 mr-2" />
                导出 {item}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * 外观设置 - 主题、语言
 */
function AppearanceSettings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <Palette className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle>主题设置</CardTitle>
              <CardDescription>系统界面外观风格</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { name: '浅色模式', value: 'light', icon: '☀️' },
              { name: '深色模式', value: 'dark', icon: '🌙' },
              { name: '跟随系统', value: 'system', icon: '💻' },
            ].map((t) => (
              <div
                key={t.value}
                className="flex flex-col items-center gap-2 p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border-2 border-transparent hover:border-purple-300"
              >
                <span className="text-3xl">{t.icon}</span>
                <span className="text-sm font-medium">{t.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Globe className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>语言设置</CardTitle>
              <CardDescription>系统界面显示语言</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { name: '简体中文', code: 'zh-CN', default: true },
              { name: 'English', code: 'en-US', default: false },
            ].map((l) => (
              <div
                key={l.code}
                className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                  l.default
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50'
                }`}
              >
                <span className="font-medium">{l.name}</span>
                {l.default && <Badge>默认</Badge>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
