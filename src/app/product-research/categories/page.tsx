/**
 * 品类管理页面 - Product Category Management
 * 
 * 功能：
 * - 树形结构展示品类列表
 * - 创建/编辑/删除品类
 * - 支持多级分类
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 品类类型定义
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

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<string>('');

  // 表单数据
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    code: '',
    parentId: '',
    description: '',
    icon: '',
    sortOrder: 0,
    isActive: true,
  });

  // 加载品类列表
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/product-research/categories?includeChildren=true');
      const result = await response.json();
      
      if (result.success) {
        // 构建树形结构
        const tree = buildCategoryTree(result.data);
        setCategories(tree);
      }
    } catch (error) {
      console.error('加载品类失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 构建树形结构
  const buildCategoryTree = (flatCategories: ProductCategory[]) => {
    const categoryMap = new Map<string, ProductCategory>();
    const rootCategories: ProductCategory[] = [];

    // 创建映射
    flatCategories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    // 构建树
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

  // 打开创建/编辑对话框
  const openModal = (category?: ProductCategory, parentId?: string) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        nameEn: category.nameEn || '',
        code: category.code,
        parentId: category.parentId || '',
        description: category.description || '',
        icon: category.icon || '',
        sortOrder: category.sortOrder,
        isActive: category.isActive,
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        nameEn: '',
        code: '',
        parentId: parentId || selectedParentId || '',
        description: '',
        icon: '',
        sortOrder: 0,
        isActive: true,
      });
    }
    setShowModal(true);
  };

  // 保存品类
  const handleSave = async () => {
    try {
      const url = editingCategory
        ? `/api/product-research/categories/${editingCategory.id}`
        : '/api/product-research/categories';
      
      const method = editingCategory ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        alert(editingCategory ? '品类更新成功' : '品类创建成功');
        setShowModal(false);
        loadCategories();
      } else {
        alert(result.error || '操作失败');
      }
    } catch (error) {
      console.error('保存品类失败:', error);
      alert('保存失败');
    }
  };

  // 删除品类
  const handleDelete = async (category: ProductCategory) => {
    if (!confirm(`确定要删除品类"${category.name}"吗？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/product-research/categories/${category.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        alert('品类删除成功');
        loadCategories();
      } else {
        alert(result.error || '删除失败');
      }
    } catch (error) {
      console.error('删除品类失败:', error);
      alert('删除失败');
    }
  };

  // 渲染品类树
  const renderCategoryTree = (categoryList: ProductCategory[], level: number = 0) => {
    return categoryList.map((category) => (
      <div key={category.id} style={{ marginLeft: level * 24 }}>
        <div className="flex items-center justify-between p-3 bg-white border rounded-lg mb-2 hover:shadow-sm">
          <div className="flex items-center gap-3">
            {category.icon && <span className="text-xl">{category.icon}</span>}
            <div>
              <div className="font-medium">{category.name}</div>
              {category.nameEn && (
                <div className="text-sm text-gray-500">{category.nameEn}</div>
              )}
              <div className="text-xs text-gray-400 mt-1">
                编码：{category.code} | 
                模板：{category._count?.templates || 0} | 
                产品：{category._count?.products || 0}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => openModal(category)}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              编辑
            </button>
            <button
              onClick={() => openModal(undefined, category.id)}
              className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
            >
              添加子品类
            </button>
            <button
              onClick={() => handleDelete(category)}
              className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
              disabled={category._count && (category._count.templates > 0 || category._count.products > 0)}
            >
              删除
            </button>
          </div>
        </div>
        {category.children && category.children.length > 0 && (
          <div>{renderCategoryTree(category.children, level + 1)}</div>
        )}
      </div>
    ));
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">品类管理</h1>
        <p className="text-gray-600">管理产品调研的品类分类体系</p>
      </div>

      <div className="mb-4">
        <button
          onClick={() => openModal()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          + 新建品类
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">加载中...</div>
      ) : categories.length === 0 ? (
        <div className="text-center py-8 text-gray-500">暂无品类</div>
      ) : (
        <div>{renderCategoryTree(categories)}</div>
      )}

      {/* 创建/编辑对话框 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center" style={{ zIndex: 1000 }}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto relative mx-4">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4">
              {editingCategory ? '编辑品类' : '新建品类'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">品类名称 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="如：电子产品"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">英文名称</label>
                <input
                  type="text"
                  value={formData.nameEn}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="如：Electronic Products"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">品类编码 *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="如：ELECTRONICS"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">父品类</label>
                <select
                  value={formData.parentId}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">无（作为顶级品类）</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id} disabled={editingCategory?.id === cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">图标</label>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="如：📱"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">排序</label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                <label htmlFor="isActive" className="text-sm">启用</label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                保存
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
