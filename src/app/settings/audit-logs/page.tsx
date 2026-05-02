'use client';

/**
 * 审计日志页面
 * /settings/audit-logs
 *
 * 功能：
 * - 卡片布局，标题"审计日志"
 * - 筛选：操作类型下拉、日期范围、用户搜索
 * - 表格：时间、操作人、操作类型、IP地址、详情、状态
 * - 分页
 * - Skeleton 加载态
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import {
  History,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { useToast, ToastContainer } from '@/components/ui/toast';

// ============================================================
// 类型定义
// ============================================================

interface AuditLogUser {
  id: string;
  name: string | null;
  email: string | null;
}

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string | null;
  details: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: AuditLogUser | null;
}

// 操作类型选项
const ACTION_OPTIONS = [
  { value: 'ALL', label: '全部操作' },
  { value: 'LOGIN', label: '登录' },
  { value: 'LOGOUT', label: '登出' },
  { value: 'CREATE', label: '创建' },
  { value: 'UPDATE', label: '更新' },
  { value: 'DELETE', label: '删除' },
  { value: 'EXPORT', label: '导出' },
  { value: 'IMPORT', label: '导入' },
  { value: 'APPROVE', label: '审批通过' },
  { value: 'REJECT', label: '审批拒绝' },
  { value: 'SUBMIT', label: '提交' },
];

// 操作类型 → 中文标签映射
const ACTION_LABEL: Record<string, string> = Object.fromEntries(
  ACTION_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label])
);

// ============================================================
// Skeleton 组件
// ============================================================

function TableSkeleton() {
  return (
    <div className="animate-pulse">
      {/* 表头 */}
      <div className="flex gap-4 py-3 px-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-36" />
        <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-20" />
        <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-24" />
        <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-32" />
        <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-28" />
        <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-20" />
      </div>
      {/* 数据行 */}
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 py-3 px-4 border-b border-zinc-100 dark:border-zinc-800/50"
        >
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-36" />
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-20" />
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-24" />
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-32" />
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-28" />
          <div className="h-6 bg-zinc-200 dark:bg-zinc-700 rounded-full w-16" />
        </div>
      ))}
    </div>
  );
}

// ============================================================
// 主页面组件
// ============================================================

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // 筛选状态
  const [actionFilter, setActionFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');

  const { toast, toasts, removeToast } = useToast();

  // ============================================================
  // 加载审计日志
  // ============================================================
  const fetchLogs = useCallback(async (pageOverride?: number) => {
    setLoading(true);
    try {
      const currentPage = pageOverride ?? page;
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
      });
      if (actionFilter && actionFilter !== 'ALL') params.set('action', actionFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (search) params.set('search', search);

      const res = await fetch(`/api/v1/audit-logs?${params}`);
      const json = await res.json();

      if (json.success) {
        setLogs(json.data.items || []);
        setTotal(json.data.pagination?.total || 0);
        setTotalPages(json.data.pagination?.totalPages || 0);
      }
    } catch (e) {
      console.error('获取审计日志失败:', e);
      toast.error('获取审计日志失败');
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, startDate, endDate, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // ============================================================
  // 搜索/重置
  // ============================================================
  const handleSearch = () => {
    setPage(1);
    fetchLogs(1);
  };

  const handleReset = () => {
    setActionFilter('ALL');
    setStartDate('');
    setEndDate('');
    setSearch('');
    setPage(1);
  };

  // ============================================================
  // 格式化时间
  // ============================================================
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // ============================================================
  // 获取操作类型 Badge 样式
  // ============================================================
  const getActionBadge = (action: string) => {
    const variantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      LOGIN: 'default',
      LOGOUT: 'secondary',
      CREATE: 'default',
      UPDATE: 'secondary',
      DELETE: 'destructive',
      EXPORT: 'outline',
      IMPORT: 'outline',
      APPROVE: 'default',
      REJECT: 'destructive',
      SUBMIT: 'secondary',
    };
    return variantMap[action] || 'secondary';
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <History className="h-6 w-6 text-blue-600" />
              <CardTitle className="text-2xl">审计日志</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 筛选区域 */}
          <div className="flex flex-wrap gap-4 mb-6 items-end">
            <div className="w-40">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="操作类型" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
                placeholder="开始日期"
              />
            </div>
            <div className="text-sm text-zinc-400 self-center">~</div>
            <div>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
                placeholder="结束日期"
              />
            </div>
            <div className="flex-1 max-w-xs">
              <Input
                placeholder="搜索对象类型 / ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" />
              搜索
            </Button>
            <Button variant="ghost" onClick={handleReset}>
              重置
            </Button>
          </div>

          {/* 加载态 */}
          {loading ? (
            <TableSkeleton />
          ) : (
            <>
              {/* 数据表格 */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-44">时间</TableHead>
                    <TableHead className="w-24">操作人</TableHead>
                    <TableHead className="w-24">操作类型</TableHead>
                    <TableHead className="w-28">对象</TableHead>
                    <TableHead className="w-36">IP 地址</TableHead>
                    <TableHead>详情</TableHead>
                    <TableHead className="w-20">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-zinc-500">
                        <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        暂无审计日志
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {formatTime(log.createdAt)}
                        </TableCell>
                        <TableCell>
                          {log.user ? (
                            <span className="text-sm">{log.user.name || log.user.email || '-'}</span>
                          ) : (
                            <span className="text-sm text-zinc-400">系统</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getActionBadge(log.action)}>
                            {ACTION_LABEL[log.action] || log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="text-zinc-500">{log.entityType}</span>
                          <span className="text-xs text-zinc-400 ml-1">#{log.entityId.slice(0, 8)}</span>
                        </TableCell>
                        <TableCell className="text-xs text-zinc-500 font-mono">
                          {log.ipAddress || '-'}
                        </TableCell>
                        <TableCell className="text-xs text-zinc-500 max-w-xs truncate">
                          {log.details ? (
                            <span title={JSON.stringify(log.details, null, 2)}>
                              {typeof log.details === 'object'
                                ? JSON.stringify(log.details).slice(0, 80)
                                : String(log.details).slice(0, 80)}
                              {JSON.stringify(log.details).length > 80 ? '...' : ''}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950/20"
                          >
                            成功
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-zinc-500">
                    共 {total} 条记录，第 {page}/{totalPages} 页
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      下一页
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
