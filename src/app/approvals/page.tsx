'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, Clock, User, Mail, Phone, Calendar } from 'lucide-react';


interface UserRegistration {
  id: string;
  username: string;
  email: string;
  name: string | null;
  phone: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedById: string | null;
  approvedAt: string | null;
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
  approvedBy?: {
    id: string;
    name: string | null;
    email: string;
  };
}

const statusConfig = {
  PENDING: { label: '待审批', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
  APPROVED: { label: '已批准', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
  REJECTED: { label: '已拒绝', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
};

export default function ApprovalsPage() {
  const [registrations, setRegistrations] = useState<UserRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('PENDING');
  const [selectedRegistration, setSelectedRegistration] = useState<UserRegistration | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  // 获取注册申请列表
  const fetchRegistrations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/approvals?status=${activeTab === 'all' ? '' : activeTab}`);
      const data = await res.json();
      if (res.ok) {
        setRegistrations(data.registrations || []);
      } else {
        setError(data.error || '获取数据失败');
      }
    } catch (error) {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, [activeTab]);

  // 批准申请
  const handleApprove = async (registration: UserRegistration) => {
    if (!confirm(`确认批准 ${registration.email} 的注册申请吗？`)) {
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch(`/api/auth/approvals/${registration.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        fetchRegistrations();
      } else {
        alert(data.error || '批准失败');
      }
    } catch (error) {
      alert('网络错误，请重试');
    } finally {
      setProcessing(false);
    }
  };

  // 打开拒绝对话框
  const openRejectDialog = (registration: UserRegistration) => {
    setSelectedRegistration(registration);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  // 拒绝申请
  const handleReject = async () => {
    if (!selectedRegistration) return;
    if (!rejectReason.trim()) {
      alert('请填写拒绝原因');
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch(`/api/auth/approvals/${selectedRegistration.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectReason }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setRejectDialogOpen(false);
        fetchRegistrations();
      } else {
        alert(data.error || '拒绝失败');
      }
    } catch (error) {
      alert('网络错误，请重试');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusConfig = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const pendingCount = registrations.filter(r => r.status === 'PENDING').length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">用户注册审批</CardTitle>
              <CardDescription>
                管理新用户注册申请，批准后用户才能正常登录系统
              </CardDescription>
            </div>
            {pendingCount > 0 && (
              <Badge variant="outline" className="text-base px-3 py-1 bg-yellow-50">
                {pendingCount} 个待审批
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="PENDING">待审批 {pendingCount > 0 && `(${pendingCount})`}</TabsTrigger>
              <TabsTrigger value="APPROVED">已批准</TabsTrigger>
              <TabsTrigger value="REJECTED">已拒绝</TabsTrigger>
              <TabsTrigger value="all">全部</TabsTrigger>
            </TabsList>

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg mb-4">
                {error}
              </div>
            )}

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : registrations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">暂无{activeTab !== 'all' ? getStatusConfig(activeTab).label : ''}注册申请</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>用户信息</TableHead>
                      <TableHead>联系方式</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>申请时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registrations.map((registration) => {
                      const { icon: StatusIcon, ...config } = getStatusConfig(registration.status);
                      return (
                        <TableRow key={registration.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{registration.name || registration.username}</span>
                              <span className="text-sm text-muted-foreground">{registration.email}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center text-sm">
                              <Phone className="h-4 w-4 mr-1 text-muted-foreground" />
                              {registration.phone || '-'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={config.color + ' flex w-fit gap-1 items-center'}>
                              <StatusIcon className="h-3 w-3" />
                              {config.label}
                            </Badge>
                            {registration.rejectReason && registration.status === 'REJECTED' && (
                              <div className="text-xs text-muted-foreground mt-1">
                                原因：{registration.rejectReason}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center text-sm">
                              <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                              {formatDate(registration.createdAt)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {registration.status === 'PENDING' && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleApprove(registration)}
                                    disabled={processing}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    批准
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => openRejectDialog(registration)}
                                    disabled={processing}
                                  >
                                    <XCircle className="h-4 w-4 mr-1" />
                                    拒绝
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒绝注册申请</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">拒绝原因</label>
              <Textarea
                placeholder="请填写拒绝原因，将告知申请人..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
            {selectedRegistration && (
              <div className="text-sm text-muted-foreground">
                申请人：{selectedRegistration.name || selectedRegistration.username} ({selectedRegistration.email})
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>取消</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processing}
            >
              确认拒绝
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
