/**
 * 属性模板管理页面 - Product Attribute Template Management
 * 
 * 功能：
 * - 左侧品类树形选择器
 * - 右侧属性模板列表 + 编辑表单
 * - 可添加/编辑/删除属性
 * - 支持拖拽排序属性
 * - 支持属性类型：TEXT、NUMBER、DATE、SELECT、MULTI、BOOLEAN
 * 
 * @module app/product-research/templates/page
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

// ============================================
// 类型定义
// ============================================

/**
 * 品类类型
 */
interface ProductCategory {
  id: string;
  name: string;
  nameEn?: string;
  code: string;
  parentId?: string;
  level: number;
  path?: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    templates: number;
    products: number;
  };
  children?: ProductCategory[];
  parent?: {
    id: string;
    name: string;
    code: string;
  };
}

/**
 * 属性模板类型
 */
interface AttributeTemplate {
  id: string;
  name: string;
  nameEn?: string;
  code: string;
  categoryId: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'MULTI' | 'BOOLEAN';
  unit?: string;
  options: string[];
  isRequired: boolean;
  isComparable: boolean;
  sortOrder: number;
  description?: string;
  validationRule?: string;
  defaultValue?: string;
  placeholder?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category?: {
    id: string;
    name: string;
    code: string;
  };
  _count?: {
    values: number;
  };
}

/**
 * 属性类型选项
 */
const ATTRIBUTE_TYPES = [
  { value: 'TEXT', label: '文本', color: 'bg-blue-100 text-blue-800' },
  { value: 'NUMBER', label: '数字', color: 'bg-green-100 text-green-800' },
  { value: 'DATE', label: '日期', color: 'bg-purple-100 text-purple-800' },
  { value: 'SELECT', label: '单选', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'MULTI', label: '多选', color: 'bg-orange-100 text-orange-800' },
  { value: 'BOOLEAN', label: '布尔', color: 'bg-gray-100 text-gray-800' },
];

/**
 * 表单数据类型
 */
interface TemplateFormData {
  name: string;
  nameEn: string;
  code: string;
  categoryId: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'MULTI' | 'BOOLEAN';
  unit: string;
  options: string[];
  isRequired: boolean;
  isComparable: boolean;
  sortOrder: number;
  description: string;
  validationRule: string;
  defaultValue: string;
  placeholder: string;
  isActive: boolean;
}

// ============================================
// 主组件
// ============================================

export default function TemplatesPage() {
  // 状态管理
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [templates, setTemplates] = useState<AttributeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AttributeTemplate | null>(null);
  const [draggedTemplateId, setDraggedTemplateId] = useState<string | null>(null);
  const [newOption, setNewOption] = useState('');

  // 表单数据
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    nameEn: '',
    code: '',
    categoryId: '',
    type: 'TEXT',
    unit: '',
    options: [],
    isRequired: false,
    isComparable: true,
    sortOrder: 0,
    description: '',
    validationRule: '',
    defaultValue: '',
    placeholder: '',
    isActive: true,
  });

  // 加载品类列表
  useEffect(() => {
    loadCategories();
  }, []);

  // 加载品类列表函数
  const loadCategories = async () => {
    try {
      const response = await fetch('/api/product-research/categories?includeChildren=true');
      const result = await response.json();
      
      if (result.success) {
        const tree = buildCategoryTree(result.data);
        setCategories(tree);
      }
    } catch (error) {
      console.error('加载品类失败:', error);
    }
  };

  // 加载属性模板列表
  const loadTemplates = async (categoryId: string) => {
    if (!categoryId) {
      setTemplates([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/product-research/templates?categoryId=${categoryId}`);
      const result = await response.json();
      
      if (result.success) {
        setTemplates(result.data);
      }
    } catch (error) {
      console.error('加载属性模板失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 品类树构建函数
  const buildCategoryTree = (flatCategories: ProductCategory[]) => {
    const categoryMap = new Map<string, ProductCategory>();
    const rootCategories: ProductCategory[] = [];

    flatCategories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    flatCategories.forEach(cat => {
      const category = categoryMap.get(cat.id)!;
      if (category.parentId) {
        const parent = categoryMap.get(category.parentId);
        if (parent) {
          parent.children?.push(category);
        }
      } else {
        rootCategories.push(category);
      }
    });

    return rootCategories;
  };

  // 处理品类选择
  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    loadTemplates(categoryId);
  };

  // 打开创建/编辑对话框
  const openModal = (template?: AttributeTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        nameEn: template.nameEn || '',
        code: template.code,
        categoryId: template.categoryId,
        type: template.type,
        unit: template.unit || '',
        options: template.options || [],
        isRequired: template.isRequired,
        isComparable: template.isComparable,
        sortOrder: template.sortOrder,
        description: template.description || '',
        validationRule: template.validationRule || '',
        defaultValue: template.defaultValue || '',
        placeholder: template.placeholder || '',
        isActive: template.isActive,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        nameEn: '',
        code: '',
        categoryId: selectedCategoryId,
        type: 'TEXT',
        unit: '',
        options: [],
        isRequired: false,
        isComparable: true,
        sortOrder: templates.length,
        description: '',
        validationRule: '',
        defaultValue: '',
        placeholder: '',
        isActive: true,
      });
    }
    setShowModal(true);
  };

  // 保存属性模板
  const handleSave = async () => {
    // 验证必填字段
    if (!formData.name || !formData.code) {
      alert('属性名称和编码为必填项');
      return;
    }

    // 验证选择类型必须有选项
    const selectTypes = ['SELECT', 'MULTI'];
    if (selectTypes.includes(formData.type) && formData.options.length === 0) {
      alert('选择类型属性必须提供选项');
      return;
    }

    try {
      const url = editingTemplate
        ? `/api/product-research/templates/${editingTemplate.id}`
        : '/api/product-research/templates';
      
      const method = editingTemplate ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        alert(editingTemplate ? '属性更新成功' : '属性创建成功');
        setShowModal(false);
        if (selectedCategoryId) {
          loadTemplates(selectedCategoryId);
        }
      } else {
        alert(result.error || '操作失败');
      }
    } catch (error) {
      console.error('保存属性模板失败:', error);
      alert('保存失败');
    }
  };

  // 删除属性模板
  const handleDelete = async (template: AttributeTemplate) => {
    if (!confirm(`确定要删除属性"${template.name}"吗？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/product-research/templates/${template.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        alert('属性删除成功');
        loadTemplates(selectedCategoryId);
      } else {
        alert(result.error || '删除失败');
      }
    } catch (error) {
      console.error('删除属性模板失败:', error);
      alert('删除失败');
    }
  };

  // 拖拽开始
  const handleDragStart = (e: React.DragEvent, templateId: string) => {
    setDraggedTemplateId(templateId);
    e.dataTransfer.effectAllowed = 'move';
  };

  // 拖拽结束
  const handleDragEnd = () => {
    setDraggedTemplateId(null);
  };

  // 拖拽悬停
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // 拖拽放下
  const handleDrop = async (e: React.DragEvent, targetTemplate: AttributeTemplate) => {
    e.preventDefault();
    
    if (!draggedTemplateId || draggedTemplateId === targetTemplate.id) {
      return;
    }

    // 更新排序
    const updatedTemplates = templates.map(t => {
      if (t.id === draggedTemplateId) {
        return { ...t, sortOrder: targetTemplate.sortOrder };
      }
      return t;
    });

    setTemplates(updatedTemplates);

    // 调用 API 更新排序
    try {
      await fetch(`/api/product-research/templates/${draggedTemplateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sortOrder: targetTemplate.sortOrder,
        }),
      });
    } catch (error) {
      console.error('更新排序失败:', error);
    }

    setDraggedTemplateId(null);
  };

  // 添加选项
  const handleAddOption = () => {
    if (newOption.trim() && !formData.options.includes(newOption.trim())) {
      setFormData({
        ...formData,
        options: [...formData.options, newOption.trim()],
      });
      setNewOption('');
    }
  };

  // 删除选项
  const handleRemoveOption = (option: string) => {
    setFormData({
      ...formData,
      options: formData.options.filter(o => o !== option),
    });
  };

  // 获取属性类型样式
  const getTypeBadgeStyle = (type: string) => {
    const typeInfo = ATTRIBUTE_TYPES.find(t => t.value === type);
    return typeInfo?.color || 'bg-gray-100 text-gray-800';
  };

  // 获取属性类型标签
  const getTypeLabel = (type: string) => {
    const typeInfo = ATTRIBUTE_TYPES.find(t => t.value === type);
    return typeInfo?.label || type;
  };

  // 渲染品类树
  const renderCategoryTree = (categoryList: ProductCategory[], level: number = 0) => {
    return categoryList.map((category) => (
      <div key={category.id}>
        <div
          className={`flex items-center justify-between p-3 mb-2 rounded-lg cursor-pointer transition-colors ${
            selectedCategoryId === category.id
              ? 'bg-blue-100 border-blue-300'
              : 'bg-white border-gray-200 hover:bg-gray-50'
          } border`}
          style={{ marginLeft: level * 24 }}
          onClick={() => handleCategorySelect(category.id)}
        >
          <div className="flex items-center gap-3">
            {category.icon && <span className="text-xl">{category.icon}</span>}
            <div>
              <div className="font-medium">{category.name}</div>
              {category.nameEn && (
                <div className="text-sm text-gray-500">{category.nameEn}</div>
              )}
            </div>
          </div>
          <Badge variant="secondary">
            {category._count?.templates || 0} 属性
          </Badge>
        </div>
        {category.children && category.children.length > 0 && (
          <div>{renderCategoryTree(category.children, level + 1)}</div>
        )}
      </div>
    ));
  };

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">属性模板管理</h1>
        <p className="text-gray-600">管理产品调研的属性模板，支持多种属性类型和拖拽排序</p>
      </div>

      {/* 主内容区域：左右分栏布局 */}
      <div className="grid grid-cols-12 gap-6">
        {/* 左侧：品类树 */}
        <div className="col-span-4">
          <Card>
            <CardContent className="p-4">
              <h2 className="text-lg font-semibold mb-4">品类选择</h2>
              {categories.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  暂无品类，请先创建品类
                </div>
              ) : (
                <div className="max-h-[600px] overflow-y-auto">
                  {renderCategoryTree(categories)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右侧：属性模板列表 */}
        <div className="col-span-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {selectedCategoryId ? '属性模板列表' : '请选择品类'}
                </h2>
                <Button
                  onClick={() => openModal()}
                  disabled={!selectedCategoryId}
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  + 新建属性
                </Button>
              </div>

              {!selectedCategoryId ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-4xl mb-2">📂</div>
                  <p>请从左侧选择一个品类</p>
                </div>
              ) : loading ? (
                <div className="text-center py-8">加载中...</div>
              ) : templates.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-4xl mb-2">📋</div>
                  <p>该品类暂无属性模板</p>
                  <Button
                    onClick={() => openModal()}
                    className="mt-4 bg-blue-500 hover:bg-blue-600"
                  >
                    + 新建属性
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">排序</TableHead>
                      <TableHead>属性名称</TableHead>
                      <TableHead>编码</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>必填</TableHead>
                      <TableHead>可对比</TableHead>
                      <TableHead>使用次数</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template) => (
                      <TableRow
                        key={template.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, template.id)}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, template)}
                        className={`cursor-move ${
                          draggedTemplateId === template.id ? 'opacity-50' : ''
                        }`}
                      >
                        <TableCell className="text-gray-400">⋮⋮</TableCell>
                        <TableCell>
                          <div className="font-medium">{template.name}</div>
                          {template.nameEn && (
                            <div className="text-sm text-gray-500">{template.nameEn}</div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{template.code}</TableCell>
                        <TableCell>
                          <Badge className={getTypeBadgeStyle(template.type)}>
                            {getTypeLabel(template.type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {template.isRequired ? (
                            <Badge variant="destructive">必填</Badge>
                          ) : (
                            <Badge variant="outline">可选</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {template.isComparable ? (
                            <Badge variant="default">是</Badge>
                          ) : (
                            <Badge variant="outline">否</Badge>
                          )}
                        </TableCell>
                        <TableCell>{template._count?.values || 0}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openModal(template)}
                            >
                              编辑
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(template)}
                              disabled={(template._count?.values || 0) > 0}
                            >
                              删除
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
        </div>
      </div>

      {/* 创建/编辑对话框 */}
      {showModal && (
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? '编辑属性模板' : '新建属性模板'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>属性名称 *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="如：颜色、尺寸、材质"
                  />
                </div>
                <div>
                  <Label>英文名称</Label>
                  <Input
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    placeholder="如：Color, Size, Material"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>属性编码 *</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="如：COLOR, SIZE, MATERIAL"
                  />
                </div>
                <div>
                  <Label>属性类型</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value as TemplateFormData['type'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ATTRIBUTE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>描述</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="属性的详细描述或说明"
                  rows={2}
                />
              </div>

              {/* 选项设置（仅选择类型显示） */}
              {(formData.type === 'SELECT' || formData.type === 'MULTI') && (
                <div>
                  <Label>选项设置</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={newOption}
                      onChange={(e) => setNewOption(e.target.value)}
                      placeholder="输入选项值"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption())}
                    />
                    <Button onClick={handleAddOption} type="button">
                      添加
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.options.map((option) => (
                      <Badge
                        key={option}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => handleRemoveOption(option)}
                      >
                        {option} ×
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 高级设置 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>单位</Label>
                  <Input
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="如：cm, kg, USD"
                  />
                </div>
                <div>
                  <Label>默认值</Label>
                  <Input
                    value={formData.defaultValue}
                    onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
                    placeholder="属性的默认值"
                  />
                </div>
              </div>

              <div>
                <Label>输入提示</Label>
                <Input
                  value={formData.placeholder}
                  onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                  placeholder="输入框的提示文字"
                />
              </div>

              <div>
                <Label>验证规则（正则表达式）</Label>
                <Input
                  value={formData.validationRule}
                  onChange={(e) => setFormData({ ...formData, validationRule: e.target.value })}
                  placeholder="如：^[0-9]+$"
                />
              </div>

              {/* 复选框选项 - 使用按钮切换 */}
              <div className="space-y-3">
                <Label>属性设置</Label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isRequired: !formData.isRequired })}
                    className={`px-4 py-2 rounded border ${
                      formData.isRequired
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    {formData.isRequired ? '✓ 必填' : '○ 可选'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isComparable: !formData.isComparable })}
                    className={`px-4 py-2 rounded border ${
                      formData.isComparable
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    {formData.isComparable ? '✓ 可对比' : '○ 不可对比'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`px-4 py-2 rounded border ${
                      formData.isActive
                        ? 'bg-green-500 text-white border-green-500'
                        : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    {formData.isActive ? '✓ 启用' : '○ 禁用'}
                  </button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowModal(false)}
              >
                取消
              </Button>
              <Button
                onClick={handleSave}
                className="bg-blue-500 hover:bg-blue-600"
              >
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
