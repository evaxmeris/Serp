/**
 * 自定义报表配置页面
 * 创建和管理自定义报表
 */

'use client';

import { useState, useEffect } from 'react';
import { useToast, ToastContainer } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirmation-dialog';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function CustomReportPage() {
  const { confirm, ConfirmDialog } = useConfirm();
  const { toast, toasts, removeToast } = useToast();
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    type: 'CUSTOM'
  });

  // 加载自定义报表列表
  async function loadReports() {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/reports/custom');
      if (!response.ok) throw new Error('请求失败');
      const result = await response.json();
      setReports(result.data || []);
    } catch (error) {
      console.error('加载自定义报表失败:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (mode === 'edit' && editId) {
        const response = await fetch('/api/v1/reports/custom', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editId, ...formData })
        });
        if (!response.ok) throw new Error('更新失败');
      } else {
        const response = await fetch('/api/v1/reports/custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        if (!response.ok) throw new Error('创建失败');
      }

      setMode('list');
      setEditId(null);
      setFormData({ name: '', code: '', description: '', type: 'CUSTOM' });
      await loadReports();
    } catch (error) {
      console.error('保存报表失败:', error);
    }
  }

  async function handleDelete(id: string) {
    if (!await confirm({ title: '确认删除', description: '确定要删除此报表吗？' })) return;
    try {
      const response = await fetch(`/api/v1/reports/custom?id=${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('删除失败');
      toast.success('删除成功');
      await loadReports();
    } catch (error) {
      console.error('删除报表失败:', error);
    }
  }

  function handleEdit(report: any) {
    setEditId(report.id);
    setFormData({
      name: report.name,
      code: report.code,
      description: report.description || '',
      type: report.type || 'CUSTOM'
    });
    setMode('edit');
  }

  function handleCancel() {
    setMode('list');
    setEditId(null);
    setFormData({ name: '', code: '', description: '', type: 'CUSTOM' });
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">自定义报表</h1>
            <p className="mt-2 text-gray-600">创建和管理自定义报表配置</p>
          </div>
          {mode === 'list' && (
            <button
              onClick={() => setMode('create')}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              + 新建报表
            </button>
          )}
        </div>
      </div>

      {/* 报表列表 */}
      {mode === 'list' && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          {loading ? (
            <div className="p-12 text-center text-gray-500">加载中...</div>
          ) : reports.length === 0 ? (
            <div className="p-12 text-center text-gray-500">暂未创建自定义报表，点击"+ 新建报表"开始创建</div>
          ) : (
            <>
              {/* 报表类型分布图表 */}
              {reports.length > 2 && (
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">报表类型分布</h3>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={(() => {
                        const typeCount: Record<string, number> = {};
                        reports.forEach((r: any) => {
                          const t = r.type || 'CUSTOM';
                          typeCount[t] = (typeCount[t] || 0) + 1;
                        });
                        return Object.entries(typeCount).map(([type, count]) => ({ type, count }));
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="type" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                        <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                        <Bar dataKey="count" fill="#3b82f6" name="count" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名称</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">代码</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类型</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{report.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{report.code}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{report.type}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${report.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {report.isActive ? '启用' : '禁用'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button
                          onClick={() => handleEdit(report)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(report.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      )}

      {/* 创建/编辑表单 */}
      {(mode === 'create' || mode === 'edit') && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            {mode === 'create' ? '创建自定义报表' : '编辑自定义报表'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">报表名称 *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="例如：月度销售分析"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">报表代码 *</label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="例如：MONTHLY_SALES"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="报表描述..."
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                {mode === 'create' ? '创建' : '保存'}
              </button>
            </div>
          </form>
        </div>
      )}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmDialog />
    </div>
  );
}
