'use client';

/**
 * 权限树形选择器组件
 * 支持菜单权限、操作权限、数据权限的层级选择
 */

import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Folder, Lock, Settings, Eye, Edit, Trash2, Plus } from 'lucide-react';

export interface PermissionNode {
  id: string;
  name: string;
  displayName: string;
  module: string;
  description?: string;
  children?: PermissionNode[];
  type: 'module' | 'menu' | 'action' | 'data';
}

interface PermissionTreeProps {
  permissions: Permission[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  className?: string;
}

export type Permission = {
  id: string;
  name: string;
  displayName: string;
  module: string;
  description?: string;
};

// 将扁平权限数据转换为树形结构
function buildPermissionTree(permissions: Permission[]): PermissionNode[] {
  const tree: PermissionNode[] = [];
  const moduleMap = new Map<string, PermissionNode[]>();

  // 按模块分组
  permissions.forEach(perm => {
    const parts = perm.name.split(':');
    const module = perm.module;
    const type = parts.length > 1 ? parts[1] : 'action';
    
    if (!moduleMap.has(module)) {
      moduleMap.set(module, []);
    }

    moduleMap.get(module)!.push({
      id: perm.id,
      name: perm.name,
      displayName: perm.displayName,
      module: perm.module,
      description: perm.description,
      type: getPermissionType(type),
      children: [],
    });
  });

  // 构建树形
  moduleMap.forEach((children, module) => {
    const moduleName = getModuleDisplayName(module);
    tree.push({
      id: `module:${module}`,
      name: module,
      displayName: moduleName,
      module,
      type: 'module',
      children,
    });
  });

  return tree;
}

function getPermissionType(typeStr: string): PermissionNode['type'] {
  switch (typeStr) {
    case 'menu':
      return 'menu';
    case 'action':
      return 'action';
    case 'data':
      return 'data';
    default:
      return 'action';
  }
}

function getModuleDisplayName(module: string): string {
  const map: Record<string, string> = {
    // 基础资料
    customer: '客户管理',
    supplier: '供应商管理',
    // 产品管理
    product: '产品管理',
    category: '品类管理',
    attribute_template: '属性模板',
    // 销售订单
    order: '订单管理',
    quotation: '报价管理',
    // 采购供应链
    purchase: '采购管理',
    purchase_receipt: '采购收货',
    inbound_order: '采购入库',
    logistics_provider: '物流服务商',
    logistics_order: '物流订单',
    // 仓储物流
    inventory: '库存管理',
    outbound_order: '出库管理',
    warehouse: '仓库管理',
    shipment: '发货管理',
    // 报表分析
    dashboard: '数据仪表盘',
    report: '报表分析',
    // 系统管理
    user: '用户管理',
    role: '角色权限',
    approval: '审批管理',
    settings: '系统设置',
    platform: '平台账号',
    sync: '数据同步',
    // 产品开发
    research: '产品调研',
    competitor: '竞品分析',
    comparison: '产品对比',
    research_import: '数据导入',
  };
  return map[module] || module;
}

function getPermissionIcon(type: PermissionNode['type']) {
  switch (type) {
    case 'module':
      return <Folder className="h-4 w-4" />;
    case 'menu':
      return <Settings className="h-4 w-4" />;
    case 'action':
      return <Lock className="h-4 w-4" />;
    case 'data':
      return <Eye className="h-4 w-4" />;
    default:
      return <Lock className="h-4 w-4" />;
  }
}

function getPermissionBadgeColor(type: PermissionNode['type']) {
  switch (type) {
    case 'module':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    case 'menu':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'action':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'data':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function getActionIcon(actionName: string) {
  if (actionName.includes('create') || actionName.includes('add')) {
    return <Plus className="h-3 w-3" />;
  }
  if (actionName.includes('edit') || actionName.includes('update')) {
    return <Edit className="h-3 w-3" />;
  }
  if (actionName.includes('delete') || actionName.includes('remove')) {
    return <Trash2 className="h-3 w-3" />;
  }
  if (actionName.includes('view') || actionName.includes('read')) {
    return <Eye className="h-3 w-3" />;
  }
  return null;
}

export default function PermissionTree({
  permissions,
  selectedIds,
  onChange,
  className,
}: PermissionTreeProps) {
  const [tree, setTree] = useState<PermissionNode[]>([]);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  useEffect(() => {
    const permissionTree = buildPermissionTree(permissions);
    setTree(permissionTree);
    // 默认展开第一个模块
    if (permissionTree.length > 0) {
      setExpandedModules(new Set([permissionTree[0].id]));
    }
  }, [permissions]);

  const toggleModule = (moduleId: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  const isChecked = (node: PermissionNode): boolean => {
    if (node.type !== 'module' && node.type !== 'menu') {
      return selectedIds.includes(node.id);
    }
    // 对于模块/菜单，如果所有子节点都被选中，则返回 true
    if (!node.children || node.children.length === 0) {
      return selectedIds.includes(node.id);
    }
    return node.children.every(child => isChecked(child));
  };

  const isIndeterminate = (node: PermissionNode): boolean => {
    if (node.type !== 'module' && node.type !== 'menu') {
      return false;
    }
    if (!node.children || node.children.length === 0) {
      return false;
    }
    const checkedCount = node.children.filter(child => 
      isChecked(child) || isIndeterminate(child)
    ).length;
    return checkedCount > 0 && checkedCount < node.children.length;
  };

  const handleCheck = (node: PermissionNode, checked: boolean) => {
    let newSelected = [...selectedIds];

    // 递归收集所有子节点 ID
    const collectChildIds = (n: PermissionNode, ids: string[]) => {
      if (n.type !== 'module' && n.type !== 'menu') {
        if (checked) {
          if (!ids.includes(n.id)) ids.push(n.id);
        } else {
          ids = ids.filter(id => id !== n.id);
        }
      }
      if (n.children) {
        n.children.forEach(child => collectChildIds(child, ids));
      }
      return ids;
    };

    newSelected = collectChildIds(node, newSelected);
    onChange(newSelected);
  };

  // 键盘导航处理
  const handleKeyDown = (e: React.KeyboardEvent, node: PermissionNode) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (node.children && node.children.length > 0) {
          toggleModule(node.id);
        } else {
          handleCheck(node, !isChecked(node));
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        focusNextNode(node);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusPreviousNode(node);
        break;
      case 'ArrowRight':
        if (node.children && node.children.length > 0 && !expandedModules.has(node.id)) {
          e.preventDefault();
          toggleModule(node.id);
        }
        break;
      case 'ArrowLeft':
        if (node.children && node.children.length > 0 && expandedModules.has(node.id)) {
          e.preventDefault();
          toggleModule(node.id);
        }
        break;
    }
  };

  // 辅助函数：获取所有节点 ID 列表
  const getAllNodeIds = () => {
    const ids: string[] = [];
    const collect = (nodes: PermissionNode[]) => {
      nodes.forEach(node => {
        ids.push(node.id);
        if (node.children) collect(node.children);
      });
    };
    collect(tree);
    return ids;
  };

  // 辅助函数：聚焦下一个节点
  const focusNextNode = (currentNode: PermissionNode) => {
    const allIds = getAllNodeIds();
    const currentIndex = allIds.indexOf(currentNode.id);
    if (currentIndex < allIds.length - 1) {
      setFocusedNodeId(allIds[currentIndex + 1]);
    }
  };

  // 辅助函数：聚焦上一个节点
  const focusPreviousNode = (currentNode: PermissionNode) => {
    const allIds = getAllNodeIds();
    const currentIndex = allIds.indexOf(currentNode.id);
    if (currentIndex > 0) {
      setFocusedNodeId(allIds[currentIndex - 1]);
    }
  };

  const renderNode = (node: PermissionNode, depth: number = 0): React.ReactNode => {
    const checked = isChecked(node);
    const indeterminate = isIndeterminate(node);
    const isExpanded = expandedModules.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isFocused = focusedNodeId === node.id;

    return (
      <Collapsible
        key={node.id}
        open={isExpanded}
        className="w-full"
      >
        <div
          className={`
            flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors
            ${depth > 0 ? `ml-${depth * 4}` : ''}
            ${isFocused ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}
          `}
          role="treeitem"
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-selected={checked}
          tabIndex={isFocused ? 0 : -1}
          onKeyDown={(e) => handleKeyDown(e, node)}
          onFocus={() => setFocusedNodeId(node.id)}
        >
          <div className="flex items-center">
            <Checkbox
              checked={checked}
              data-state={indeterminate ? 'indeterminate' : checked ? 'checked' : 'unchecked'}
              onCheckedChange={(checked) => handleCheck(node, checked as boolean)}
              className="mr-2"
              aria-label={`选择 ${node.displayName}`}
            />
          </div>

          {hasChildren && (
            <CollapsibleTrigger asChild>
              <button
                onClick={() => toggleModule(node.id)}
                className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                aria-label={isExpanded ? '收起' : '展开'}
                tabIndex={-1}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-zinc-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-zinc-500" />
                )}
              </button>
            </CollapsibleTrigger>
          )}

          {!hasChildren && (
            <span className="w-6"></span>
          )}

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-zinc-500 dark:text-zinc-400">
              {getPermissionIcon(node.type)}
            </span>
            <span className="font-medium text-sm truncate">
              {node.displayName}
            </span>
            <Badge className={`${getPermissionBadgeColor(node.type)} text-xs`}>
              {node.type}
            </Badge>
            {node.type === 'action' && getActionIcon(node.name)}
          </div>
        </div>

        {hasChildren && (
          <CollapsibleContent>
            {node.children!.map(child => renderNode(child, depth + 1))}
          </CollapsibleContent>
        )}
      </Collapsible>
    );
  };

  return (
    <div className={`border rounded-lg p-3 bg-white dark:bg-zinc-950 ${className || ''}`}>
      <div className="mb-3 px-2">
        <div className="flex items-center gap-4 text-sm text-zinc-500" role="legend" aria-label="权限类型图例">
          <div className="flex items-center gap-1">
            <Badge className="bg-blue-100 text-blue-700">menu</Badge>
            <span>页面访问</span>
          </div>
          <div className="flex items-center gap-1">
            <Badge className="bg-green-100 text-green-700">action</Badge>
            <span>操作权限</span>
          </div>
          <div className="flex items-center gap-1">
            <Badge className="bg-purple-100 text-purple-700">data</Badge>
            <span>数据范围</span>
          </div>
        </div>
      </div>
      <div className="space-y-1" role="tree" aria-label="权限树" tabIndex={0}>
        {tree.map(node => renderNode(node))}
      </div>
      <div className="mt-4 px-2">
        <div className="text-sm text-zinc-500">
          已选择 {selectedIds.length} 项权限
        </div>
      </div>
    </div>
  );
}
