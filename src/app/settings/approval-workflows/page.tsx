'use client';

/**
 * 审批流程设置页面
 * /settings/approval-workflows
 *
 * 功能：
 * - 审批流程列表 (Card + Table): 流程名称、编码、适用模块、步骤数、状态、操作
 * - 新建/编辑 Dialog: 流程名称、编码、说明、适用模块（多选：物流/采购/产品）
 * - 步骤列表（可增删排序），每个步骤可展开配置审批人
 * - 横向步骤条预览审批流程图
 * - 启用/禁用开关
 *
 * @作者 应亮
 * @创建日期 2026-04-27
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  ArrowLeft,
  GitBranch,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Eye,
  UserRound,
  Users,
  Shield,
  CheckCircle2,
  XCircle,
  Settings,
} from 'lucide-react';

// ============================================================
// 类型定义
// ============================================================

/** 适用模块 */
type ModuleKey = 'logistics' | 'procurement' | 'product';
const moduleOptions: { key: ModuleKey; label: string }[] = [
  { key: 'logistics', label: '物流' },
  { key: 'procurement', label: '采购' },
  { key: 'product', label: '产品' },
];

/** 审批人类型 */
type ApproverType = 'user' | 'role';

/** 审批人配置 */
interface ApproverConfig {
  id: string;
  type: ApproverType;
  /** 如果是 user 则为用户 ID，如果是 role 则为角色 ID */
  targetId: string;
  targetName: string;
}

/** 审批步骤 */
interface ApprovalStep {
  id: string;
  name: string;
  order: number;
  approvers: ApproverConfig[];
  /** 审批模式: or = 任一审批, and = 全部审批 */
  mode: 'or' | 'and';
  expanded: boolean;
}

/** 审批流程 */
interface ApprovalWorkflow {
  id: string;
  name: string;
  code: string;
  description: string;
  modules: ModuleKey[];
  steps: ApprovalStep[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// 模拟数据
// ============================================================

/** 模拟用户列表（用于选择审批人） */
const mockUsers = [
  { id: 'u1', name: '张三', email: 'zhangsan@example.com' },
  { id: 'u2', name: '李四', email: 'lisi@example.com' },
  { id: 'u3', name: '王五', email: 'wangwu@example.com' },
  { id: 'u4', name: '赵六', email: 'zhaoliu@example.com' },
  { id: 'u5', name: '孙七', email: 'sunqi@example.com' },
];

/** 模拟角色列表（用于选择审批人） */
const mockRoles = [
  { id: 'r1', name: 'ADMIN', displayName: '管理员' },
  { id: 'r2', name: 'SALES', displayName: '业务员' },
  { id: 'r3', name: 'PURCHASING', displayName: '采购员' },
  { id: 'r4', name: 'WAREHOUSE', displayName: '仓管员' },
];

/** 模拟审批流程数据 */
const mockWorkflows: ApprovalWorkflow[] = [
  {
    id: 'wf1',
    name: '采购订单审批',
    code: 'PURCHASE_ORDER_APPROVAL',
    description: '采购订单提交后需经采购主管和财务审批',
    modules: ['procurement'],
    steps: [
      {
        id: 's1',
        name: '采购主管审批',
        order: 1,
        approvers: [{ id: 'a1', type: 'role', targetId: 'r3', targetName: '采购员' }],
        mode: 'or',
        expanded: false,
      },
      {
        id: 's2',
        name: '财务审批',
        order: 2,
        approvers: [
          { id: 'a2', type: 'user', targetId: 'u2', targetName: '李四' },
          { id: 'a3', type: 'user', targetId: 'u3', targetName: '王五' },
        ],
        mode: 'and',
        expanded: false,
      },
    ],
    enabled: true,
    createdAt: '2026-04-10',
    updatedAt: '2026-04-20',
  },
  {
    id: 'wf2',
    name: '物流费用审批',
    code: 'LOGISTICS_COST_APPROVAL',
    description: '物流费用超过 5000 元需要审批',
    modules: ['logistics'],
    steps: [
      {
        id: 's1',
        name: '物流经理审批',
        order: 1,
        approvers: [{ id: 'a4', type: 'role', targetId: 'r3', targetName: '采购员' }],
        mode: 'or',
        expanded: false,
      },
    ],
    enabled: true,
    createdAt: '2026-04-15',
    updatedAt: '2026-04-18',
  },
  {
    id: 'wf3',
    name: '新品上架审批',
    code: 'NEW_PRODUCT_APPROVAL',
    description: '新品上架需经产品经理和市场部审批',
    modules: ['product'],
    steps: [
      {
        id: 's1',
        name: '产品经理确认',
        order: 1,
        approvers: [{ id: 'a5', type: 'user', targetId: 'u1', targetName: '张三' }],
        mode: 'or',
        expanded: false,
      },
      {
        id: 's2',
        name: '市场部审核',
        order: 2,
        approvers: [{ id: 'a6', type: 'role', targetId: 'r2', targetName: '业务员' }],
        mode: 'or',
        expanded: false,
      },
      {
        id: 's3',
        name: '总经理终审',
        order: 3,
        approvers: [{ id: 'a7', type: 'user', targetId: 'u1', targetName: '张三' }],
        mode: 'or',
        expanded: false,
      },
    ],
    enabled: false,
    createdAt: '2026-03-20',
    updatedAt: '2026-04-01',
  },
];

// ============================================================
// 辅助工具
// ============================================================

let stepIdCounter = 0;
const generateStepId = () => `step_${++stepIdCounter}`;
const generateApproverId = () => `approver_${++stepIdCounter}`;
const generateWorkflowId = () => `wf_${++stepIdCounter}`;

// ============================================================
// 主页面组件
// ============================================================

export default function ApprovalWorkflowsPage() {
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>(mockWorkflows);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<ApprovalWorkflow | null>(null);
  const [previewWorkflow, setPreviewWorkflow] = useState<ApprovalWorkflow | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // 表单状态
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formModules, setFormModules] = useState<ModuleKey[]>([]);
  const [formSteps, setFormSteps] = useState<ApprovalStep[]>([]);

  // ============================================================
  // 重置表单
  // ============================================================
  const resetForm = () => {
    setFormName('');
    setFormCode('');
    setFormDescription('');
    setFormModules([]);
    setFormSteps([]);
  };

  // ============================================================
  // 打开新建对话框
  // ============================================================
  const handleCreate = () => {
    setEditingWorkflow(null);
    resetForm();
    setDialogOpen(true);
  };

  // ============================================================
  // 打开编辑对话框
  // ============================================================
  const handleEdit = (workflow: ApprovalWorkflow) => {
    setEditingWorkflow(workflow);
    setFormName(workflow.name);
    setFormCode(workflow.code);
    setFormDescription(workflow.description);
    setFormModules([...workflow.modules]);
    setFormSteps(workflow.steps.map((s) => ({ ...s, approvers: s.approvers.map((a) => ({ ...a })) })));
    setDialogOpen(true);
  };

  // ============================================================
  // 保存（新建/编辑）
  // ============================================================
  const handleSave = () => {
    if (!formName.trim() || !formCode.trim()) return;

    const now = new Date().toISOString().slice(0, 10);

    if (editingWorkflow) {
      // 编辑模式
      setWorkflows((prev) =>
        prev.map((w) =>
          w.id === editingWorkflow.id
            ? {
                ...w,
                name: formName.trim(),
                code: formCode.trim(),
                description: formDescription.trim(),
                modules: formModules,
                steps: formSteps.map((s, i) => ({ ...s, order: i + 1 })),
                updatedAt: now,
              }
            : w,
        ),
      );
    } else {
      // 新建模式
      const newWorkflow: ApprovalWorkflow = {
        id: generateWorkflowId(),
        name: formName.trim(),
        code: formCode.trim(),
        description: formDescription.trim(),
        modules: formModules,
        steps: formSteps.map((s, i) => ({ ...s, order: i + 1 })),
        enabled: true,
        createdAt: now,
        updatedAt: now,
      };
      setWorkflows((prev) => [...prev, newWorkflow]);
    }

    setDialogOpen(false);
  };

  // ============================================================
  // 删除流程
  // ============================================================
  const handleDelete = (workflow: ApprovalWorkflow) => {
    if (!confirm(`确定删除审批流程「${workflow.name}」吗？此操作不可撤销。`)) return;
    setWorkflows((prev) => prev.filter((w) => w.id !== workflow.id));
  };

  // ============================================================
  // 切换启用/禁用
  // ============================================================
  const handleToggleEnabled = (workflow: ApprovalWorkflow, checked: boolean) => {
    setWorkflows((prev) =>
      prev.map((w) => (w.id === workflow.id ? { ...w, enabled: checked } : w)),
    );
  };

  // ============================================================
  // 打开预览
  // ============================================================
  const handlePreview = (workflow: ApprovalWorkflow) => {
    setPreviewWorkflow(workflow);
    setPreviewOpen(true);
  };

  // ============================================================
  // 步骤操作（在 Dialog 内使用）
  // ============================================================
  const addStep = () => {
    const newStep: ApprovalStep = {
      id: generateStepId(),
      name: '',
      order: formSteps.length + 1,
      approvers: [],
      mode: 'or',
      expanded: true,
    };
    setFormSteps((prev) => [...prev, newStep]);
  };

  const removeStep = (stepId: string) => {
    setFormSteps((prev) => prev.filter((s) => s.id !== stepId));
  };

  const updateStep = (stepId: string, patch: Partial<ApprovalStep>) => {
    setFormSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...patch } : s)));
  };

  const toggleStepExpanded = (stepId: string) => {
    setFormSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, expanded: !s.expanded } : s)),
    );
  };

  const moveStep = (stepId: string, direction: 'up' | 'down') => {
    setFormSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === stepId);
      if (idx === -1) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === prev.length - 1) return prev;

      const newSteps = [...prev];
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      [newSteps[idx], newSteps[swapIdx]] = [newSteps[swapIdx], newSteps[idx]];
      return newSteps;
    });
  };

  // 审批人操作
  const addApproverToStep = (stepId: string) => {
    const newApprover: ApproverConfig = {
      id: generateApproverId(),
      type: 'user',
      targetId: mockUsers[0]?.id || '',
      targetName: mockUsers[0]?.name || '',
    };
    setFormSteps((prev) =>
      prev.map((s) =>
        s.id === stepId ? { ...s, approvers: [...s.approvers, newApprover] } : s,
      ),
    );
  };

  const removeApproverFromStep = (stepId: string, approverId: string) => {
    setFormSteps((prev) =>
      prev.map((s) =>
        s.id === stepId
          ? { ...s, approvers: s.approvers.filter((a) => a.id !== approverId) }
          : s,
      ),
    );
  };

  const updateApprover = (stepId: string, approverId: string, patch: Partial<ApproverConfig>) => {
    setFormSteps((prev) =>
      prev.map((s) =>
        s.id === stepId
          ? {
              ...s,
              approvers: s.approvers.map((a) =>
                a.id === approverId ? { ...a, ...patch } : a,
              ),
            }
          : s,
      ),
    );
  };

  // ============================================================
  // 模块标签切换
  // ============================================================
  const toggleModule = (key: ModuleKey) => {
    setFormModules((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key],
    );
  };

  // ============================================================
  // 渲染
  // ============================================================
  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
            <GitBranch className="h-7 w-7 inline mr-2 text-blue-600" />
            审批流程
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            配置业务审批流程，定义审批步骤和审批人
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          新建流程
        </Button>
      </div>

      {/* 审批流程列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <GitBranch className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>流程列表</CardTitle>
              <CardDescription>已配置的审批流程，支持启用/禁用</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {workflows.length === 0 ? (
            <div className="text-center py-12 text-zinc-400">
              <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">暂无审批流程</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-1" />
                创建第一个流程
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>流程名称</TableHead>
                  <TableHead>编码</TableHead>
                  <TableHead>适用模块</TableHead>
                  <TableHead className="text-center">步骤数</TableHead>
                  <TableHead className="text-center">状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.map((wf) => (
                  <TableRow key={wf.id}>
                    <TableCell className="font-medium">{wf.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                        {wf.code}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {wf.modules.map((m) => (
                          <Badge key={m} variant="secondary" className="text-xs">
                            {moduleOptions.find((mo) => mo.key === m)?.label || m}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs">
                        {wf.steps.length} 步
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Switch
                          checked={wf.enabled}
                          onCheckedChange={(checked) => handleToggleEnabled(wf, checked)}
                        />
                        <span
                          className={`text-xs ${
                            wf.enabled ? 'text-green-600' : 'text-zinc-400'
                          }`}
                        >
                          {wf.enabled ? '启用' : '禁用'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreview(wf)}
                          title="预览流程图"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(wf)}
                          title="编辑"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(wf)}
                          className="text-red-500 hover:text-red-700"
                          title="删除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* 新建 / 编辑 Dialog */}
      {/* ============================================================ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingWorkflow ? `编辑流程 - ${editingWorkflow.name}` : '新建审批流程'}
            </DialogTitle>
            <DialogDescription>
              配置流程基本信息、适用模块和审批步骤
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* 基本信息 */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                基本信息
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="wf-name">流程名称 *</Label>
                  <Input
                    id="wf-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="例如：采购订单审批"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wf-code">流程编码 *</Label>
                  <Input
                    id="wf-code"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="例如：PURCHASE_ORDER_APPROVAL"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wf-desc">说明</Label>
                <Textarea
                  id="wf-desc"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="描述该审批流程的用途和触发条件"
                  rows={2}
                />
              </div>
            </div>

            <Separator />

            {/* 适用模块（多选） */}
            <div className="space-y-2">
              <Label>适用模块</Label>
              <div className="flex flex-wrap gap-2">
                {moduleOptions.map((mo) => {
                  const selected = formModules.includes(mo.key);
                  return (
                    <button
                      key={mo.key}
                      type="button"
                      onClick={() => toggleModule(mo.key)}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                        selected
                          ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                          : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-blue-200'
                      }`}
                    >
                      {selected && <CheckCircle2 className="h-3.5 w-3.5 inline mr-1.5" />}
                      {mo.label}
                    </button>
                  );
                })}
              </div>
              {formModules.length === 0 && (
                <p className="text-xs text-zinc-400">请至少选择一个适用模块</p>
              )}
            </div>

            <Separator />

            {/* 审批步骤 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  审批步骤
                </h4>
                <Button variant="outline" size="sm" onClick={addStep}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  添加步骤
                </Button>
              </div>

              {formSteps.length === 0 ? (
                <div className="text-center py-8 text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
                  <p className="text-sm">暂无审批步骤，请点击「添加步骤」</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {formSteps.map((step, idx) => (
                    <StepCard
                      key={step.id}
                      step={step}
                      index={idx}
                      total={formSteps.length}
                      onToggleExpand={() => toggleStepExpanded(step.id)}
                      onMoveUp={() => moveStep(step.id, 'up')}
                      onMoveDown={() => moveStep(step.id, 'down')}
                      onRemove={() => removeStep(step.id)}
                      onUpdate={(patch) => updateStep(step.id, patch)}
                      onAddApprover={() => addApproverToStep(step.id)}
                      onRemoveApprover={(approverId) =>
                        removeApproverFromStep(step.id, approverId)
                      }
                      onUpdateApprover={(approverId, patch) =>
                        updateApprover(step.id, approverId, patch)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formName.trim() || !formCode.trim()}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* 预览审批流程图 Dialog */}
      {/* ============================================================ */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-[650px]">
          <DialogHeader>
            <DialogTitle>
              {previewWorkflow?.name} - 流程图预览
            </DialogTitle>
            <DialogDescription>横向步骤条展示审批流程</DialogDescription>
          </DialogHeader>

          {previewWorkflow && (
            <div className="py-6">
              <FlowPreview workflow={previewWorkflow} />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// 步骤卡片子组件
// ============================================================

interface StepCardProps {
  step: ApprovalStep;
  index: number;
  total: number;
  onToggleExpand: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<ApprovalStep>) => void;
  onAddApprover: () => void;
  onRemoveApprover: (approverId: string) => void;
  onUpdateApprover: (approverId: string, patch: Partial<ApproverConfig>) => void;
}

function StepCard({
  step,
  index,
  total,
  onToggleExpand,
  onMoveUp,
  onMoveDown,
  onRemove,
  onUpdate,
  onAddApprover,
  onRemoveApprover,
  onUpdateApprover,
}: StepCardProps) {
  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 overflow-hidden">
      {/* 步骤头部 */}
      <div className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/50">
        {/* 拖拽排序图标 */}
        <GripVertical className="h-4 w-4 text-zinc-400 cursor-grab flex-shrink-0" />

        {/* 步骤序号 */}
        <Badge variant="outline" className="text-xs font-mono h-6 w-6 flex items-center justify-center p-0 rounded-full">
          {index + 1}
        </Badge>

        {/* 步骤名称输入 */}
        <Input
          value={step.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder={`步骤 ${index + 1} 名称`}
          className="h-8 text-sm flex-1 border-transparent bg-transparent hover:border-zinc-300 focus:bg-white dark:focus:bg-zinc-800"
        />

        {/* 审批模式 */}
        <Select
          value={step.mode}
          onValueChange={(v) => onUpdate({ mode: v as 'or' | 'and' })}
        >
          <SelectTrigger className="h-8 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="or">任一审批</SelectItem>
            <SelectItem value="and">全部审批</SelectItem>
          </SelectContent>
        </Select>

        {/* 排序按钮 */}
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30"
            title="上移"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30"
            title="下移"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* 展开/折叠 */}
        <button
          type="button"
          onClick={onToggleExpand}
          className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
          title={step.expanded ? '折叠' : '展开'}
        >
          {step.expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {/* 删除步骤 */}
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
          title="删除步骤"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* 步骤展开内容：审批人配置 */}
      {step.expanded && (
        <div className="p-3 space-y-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-zinc-500">审批人</Label>
            <Button variant="ghost" size="sm" onClick={onAddApprover} className="h-7 text-xs">
              <Plus className="h-3 w-3 mr-1" />
              添加审批人
            </Button>
          </div>

          {step.approvers.length === 0 ? (
            <p className="text-xs text-zinc-400 py-2 text-center">
              暂未配置审批人，请点击「添加审批人」
            </p>
          ) : (
            <div className="space-y-2">
              {step.approvers.map((approver) => (
                <div
                  key={approver.id}
                  className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg"
                >
                  {/* 类型切换 */}
                  <Select
                    value={approver.type}
                    onValueChange={(v) => {
                      const newType = v as ApproverType;
                      const defaultTarget =
                        newType === 'user'
                          ? { targetId: mockUsers[0]?.id || '', targetName: mockUsers[0]?.name || '' }
                          : { targetId: mockRoles[0]?.id || '', targetName: mockRoles[0]?.displayName || '' };
                      onUpdateApprover(approver.id, {
                        type: newType,
                        ...defaultTarget,
                      });
                    }}
                  >
                    <SelectTrigger className="h-8 w-20 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">
                        <span className="flex items-center gap-1.5">
                          <UserRound className="h-3 w-3" />
                          用户
                        </span>
                      </SelectItem>
                      <SelectItem value="role">
                        <span className="flex items-center gap-1.5">
                          <Shield className="h-3 w-3" />
                          角色
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {/* 目标选择 */}
                  {approver.type === 'user' ? (
                    <Select
                      value={approver.targetId}
                      onValueChange={(v) => {
                        const user = mockUsers.find((u) => u.id === v);
                        onUpdateApprover(approver.id, {
                          targetId: v,
                          targetName: user?.name || '',
                        });
                      }}
                    >
                      <SelectTrigger className="h-8 flex-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {mockUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name} ({u.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select
                      value={approver.targetId}
                      onValueChange={(v) => {
                        const role = mockRoles.find((r) => r.id === v);
                        onUpdateApprover(approver.id, {
                          targetId: v,
                          targetName: role?.displayName || '',
                        });
                      }}
                    >
                      <SelectTrigger className="h-8 flex-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {mockRoles.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.displayName} ({r.name})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {/* 删除审批人 */}
                  <button
                    type="button"
                    onClick={() => onRemoveApprover(approver.id)}
                    className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 flex-shrink-0"
                    title="删除审批人"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 审批模式说明 */}
          <p className="text-xs text-zinc-400">
            {step.mode === 'or'
              ? '「任一审批」：任意一位审批人通过即可进入下一步'
              : '「全部审批」：所有审批人均需通过才能进入下一步'}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 横向流程图预览组件
// ============================================================

interface FlowPreviewProps {
  workflow: ApprovalWorkflow;
}

function FlowPreview({ workflow }: FlowPreviewProps) {
  const steps = [...workflow.steps].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      {/* 基本信息 */}
      <div className="flex flex-wrap gap-3 text-sm">
        <div className="flex items-center gap-1">
          <span className="text-zinc-500">编码:</span>
          <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
            {workflow.code}
          </code>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-zinc-500">模块:</span>
          <div className="flex gap-1">
            {workflow.modules.map((m) => (
              <Badge key={m} variant="secondary" className="text-xs">
                {moduleOptions.find((mo) => mo.key === m)?.label}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-zinc-500">状态:</span>
          {workflow.enabled ? (
            <Badge className="bg-green-100 text-green-700 text-xs">已启用</Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">已禁用</Badge>
          )}
        </div>
      </div>

      {/* 横向步骤条 */}
      <div className="relative">
        {/* 步骤节点 */}
        <div className="flex items-start justify-between">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex flex-col items-center flex-1 relative z-10">
              {/* 圆形节点 */}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                  idx === 0
                    ? 'bg-blue-500 border-blue-600 text-white'
                    : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {idx + 1}
              </div>

              {/* 步骤名称 */}
              <div className="mt-2 text-center">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {step.name || `步骤 ${idx + 1}`}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {step.mode === 'or' ? '任一审批' : '全部审批'}
                </p>
              </div>

              {/* 审批人列表 */}
              {step.approvers.length > 0 && (
                <div className="mt-2 flex flex-col items-center gap-0.5">
                  {step.approvers.map((approver) => (
                    <div
                      key={approver.id}
                      className="flex items-center gap-1 text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 rounded"
                    >
                      {approver.type === 'user' ? (
                        <UserRound className="h-3 w-3" />
                      ) : (
                        <Shield className="h-3 w-3" />
                      )}
                      {approver.targetName}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 连接线 */}
        {steps.length > 1 && (
          <div className="absolute top-5 left-0 right-0 flex items-start px-[calc(100%/(2*var(--steps-count)))]">
            {/* 连接线通过多个线段拼成 */}
            <svg
              className="absolute top-0 left-0 w-full h-1"
              style={{ marginTop: '1.25rem' }}
            >
              {steps.slice(0, -1).map((_, idx) => {
                const segmentWidth = 100 / (steps.length - 1);
                const x1 = idx * segmentWidth + segmentWidth / 2;
                const x2 = (idx + 1) * segmentWidth - segmentWidth / 2;
                return (
                  <line
                    key={idx}
                    x1={`${x1}%`}
                    y1="0"
                    x2={`${x2}%`}
                    y2="0"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-zinc-300 dark:text-zinc-600"
                  />
                );
              })}
            </svg>

            {/* 箭头 */}
            {steps.slice(0, -1).map((_, idx) => {
              const arrowPos = ((idx + 1) / steps.length) * 100;
              return (
                <div
                  key={idx}
                  className="absolute top-5 -translate-y-1/2 text-zinc-400"
                  style={{ left: `${arrowPos}%`, transform: `translate(-50%, -50%)` }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16">
                    <polygon points="0,0 16,8 0,16" fill="currentColor" />
                  </svg>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 步骤详情表格 */}
      {steps.length > 0 && (
        <div className="mt-8 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 w-16">
                  步骤
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500">
                  名称
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500">
                  审批模式
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500">
                  审批人
                </th>
              </tr>
            </thead>
            <tbody>
              {steps.map((step, idx) => (
                <tr key={step.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2.5 text-center">
                    <Badge variant="outline" className="text-xs font-mono">
                      {idx + 1}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 font-medium">{step.name || '—'}</td>
                  <td className="px-4 py-2.5">
                    <Badge
                      variant="secondary"
                      className="text-xs"
                    >
                      {step.mode === 'or' ? '任一审批' : '全部审批'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {step.approvers.length === 0 ? (
                        <span className="text-xs text-zinc-400">未配置</span>
                      ) : (
                        step.approvers.map((a) => (
                          <Badge key={a.id} variant="outline" className="text-xs">
                            {a.type === 'user' ? (
                              <UserRound className="h-2.5 w-2.5 mr-1" />
                            ) : (
                              <Shield className="h-2.5 w-2.5 mr-1" />
                            )}
                            {a.targetName}
                          </Badge>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
