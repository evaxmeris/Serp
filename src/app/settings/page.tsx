'use client';

/**
 * 系统设置页面 - 重构版
 * 采用 Tab 切换架构，避免创建过多独立子页面
 * 
 * @作者 应亮
 * @创建日期 2026-04-09
 * @更新日期 2026-04-10
 */

import { useState } from 'react';
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
} from 'lucide-react';

// Tab 定义
type TabKey = 'business' | 'system' | 'security' | 'notification' | 'data' | 'appearance';

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
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
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
    </div>
  );
}

/**
 * 业务设置 - 币种、贸易条款、付款方式、物流方式
 */
function BusinessSettings() {
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
            {mockConfig.currencies.map((c) => (
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
            {mockConfig.tradeTerms.map((t) => (
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
            {mockConfig.paymentMethods.map((m) => (
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
            {mockConfig.shippingMethods.map((m) => (
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
