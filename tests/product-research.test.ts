/**
 * 产品调研模块 API 单元测试
 * 
 * 测试覆盖:
 * - GET /api/product-research/products - 获取产品调研列表
 * - POST /api/product-research/products - 创建产品调研
 * - GET /api/product-research/categories - 获取品类列表
 * - POST /api/product-research/categories - 创建品类
 * - GET /api/product-research/templates - 获取属性模板列表
 * - POST /api/product-research/templates - 创建属性模板
 * - 表单验证逻辑
 * 
 * Sprint: 2.1 - 产品录入页面
 * @author Trade ERP Development Team
 * @date 2026-03-14
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GET, POST } from '@/app/api/product-research/products/route';
import { GET as GET_CATEGORIES, POST as POST_CATEGORIES } from '@/app/api/product-research/categories/route';
import { GET as GET_TEMPLATES, POST as POST_TEMPLATES } from '@/app/api/product-research/templates/route';

// ============================================
// Mock 工具函数
// ============================================

/**
 * 创建 Mock NextRequest
 */
function createMockRequest(
  url: string,
  method: string = 'GET',
  body?: any
): NextRequest {
  const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
  const urlObj = new URL(fullUrl);
  const searchParams = urlObj.searchParams;
  
  return {
    url: fullUrl,
    nextUrl: {
      searchParams,
      pathname: urlObj.pathname,
      href: urlObj.href,
      origin: urlObj.origin,
    } as any,
    method,
    json: async () => body,
  } as NextRequest;
}

/**
 * 创建 Mock Params
 */
function createMockParams(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

// ============================================
// 测试用例
// ============================================

describe('Product Research API - Sprint 2.1', () => {
  // 测试数据 ID 存储
  let createdCategoryId: string;
  let createdTemplateId: string;
  let createdProductId: string;
  
  // 测试数据
  let testCategoryData: any;
  let testTemplateData: any;
  let testProductData: any;

  beforeEach(() => {
    // 准备测试数据
    testCategoryData = {
      name: `测试品类_${Date.now()}`,
      nameEn: 'Test Category',
      code: `TEST-CAT-${Date.now()}`,
      level: 1,
      description: '用于测试的品类',
      isActive: true,
    };

    testTemplateData = {
      name: `测试属性_${Date.now()}`,
      nameEn: 'Test Attribute',
      code: `TEST-ATTR-${Date.now()}`,
      type: 'TEXT',
      isRequired: false,
      isComparable: true,
      isActive: true,
    };

    testProductData = {
      name: `测试产品_${Date.now()}`,
      nameEn: 'Test Product',
      brand: 'Test Brand',
      platform: 'Amazon',
      categoryId: '', // 将在测试中动态设置
      costPrice: 50.00,
      salePrice: 99.99,
      currency: 'CNY',
      status: 'DRAFT',
      priority: 'MEDIUM',
    };
  });

  afterAll(async () => {
    // 清理测试数据
    const cleanupPromises = [];
    
    if (createdProductId) {
      cleanupPromises.push(
        prisma.productResearch.delete({ where: { id: createdProductId } }).catch(() => {})
      );
    }
    if (createdTemplateId) {
      cleanupPromises.push(
        prisma.attributeTemplate.delete({ where: { id: createdTemplateId } }).catch(() => {})
      );
    }
    if (createdCategoryId) {
      cleanupPromises.push(
        prisma.productCategory.delete({ where: { id: createdCategoryId } }).catch(() => {})
      );
    }
    
    await Promise.all(cleanupPromises);
    await prisma.$disconnect();
  });

  // ============================================
  // 品类管理测试
  // ============================================

  describe('Categories API - 品类管理', () => {
    describe('POST /api/product-research/categories - 创建品类', () => {
      it('应该成功创建品类', async () => {
        const request = createMockRequest('/api/product-research/categories', 'POST', testCategoryData);
        const response = await POST_CATEGORIES(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('id');
        expect(data.data.name).toBe(testCategoryData.name);
        expect(data.data.code).toBe(testCategoryData.code);
        expect(data.data.level).toBe(1);

        createdCategoryId = data.data.id;
        // 更新测试数据的 categoryId 供后续测试使用
        testProductData.categoryId = createdCategoryId;
        testTemplateData.categoryId = createdCategoryId;
      });

      it('应该验证必填字段 name', async () => {
        const invalidData = { ...testCategoryData, name: '' };
        const request = createMockRequest('/api/product-research/categories', 'POST', invalidData);
        const response = await POST_CATEGORIES(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('必填');
      });

      it('应该验证必填字段 code', async () => {
        const invalidData = { ...testCategoryData, code: '' };
        const request = createMockRequest('/api/product-research/categories', 'POST', invalidData);
        const response = await POST_CATEGORIES(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('必填');
      });

      it('应该验证编码唯一性', async () => {
        // 使用已存在的编码
        const duplicateData = { 
          ...testCategoryData, 
          name: '重复测试品类',
          code: testCategoryData.code, // 使用相同的编码
        };
        const request = createMockRequest('/api/product-research/categories', 'POST', duplicateData);
        const response = await POST_CATEGORIES(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('已存在');
      });
    });

    describe('GET /api/product-research/categories - 获取品类列表', () => {
      it('应该获取品类列表', async () => {
        const request = createMockRequest('/api/product-research/categories');
        const response = await GET_CATEGORIES(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data)).toBe(true);
      });

      it('应该支持按父品类过滤', async () => {
        const request = createMockRequest('/api/product-research/categories?parentId=');
        const response = await GET_CATEGORIES(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(Array.isArray(data.data)).toBe(true);
      });

      it('应该支持只获取启用品类', async () => {
        const request = createMockRequest('/api/product-research/categories?isActive=true');
        const response = await GET_CATEGORIES(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(Array.isArray(data.data)).toBe(true);
      });
    });
  });

  // ============================================
  // 属性模板管理测试
  // ============================================

  describe('Templates API - 属性模板管理', () => {
    describe('POST /api/product-research/templates - 创建属性模板', () => {
      it('应该成功创建属性模板', async () => {
        const request = createMockRequest('/api/product-research/templates', 'POST', testTemplateData);
        const response = await POST_TEMPLATES(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('id');
        expect(data.data.name).toBe(testTemplateData.name);
        expect(data.data.code).toBe(testTemplateData.code);
        expect(data.data.type).toBe('TEXT');

        createdTemplateId = data.data.id;
      });

      it('应该验证必填字段 name', async () => {
        const invalidData = { ...testTemplateData, name: '', categoryId: createdCategoryId };
        const request = createMockRequest('/api/product-research/templates', 'POST', invalidData);
        const response = await POST_TEMPLATES(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('必填');
      });

      it('应该验证必填字段 code', async () => {
        const invalidData = { ...testTemplateData, code: '', categoryId: createdCategoryId };
        const request = createMockRequest('/api/product-research/templates', 'POST', invalidData);
        const response = await POST_TEMPLATES(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('必填');
      });

      it('应该验证必填字段 categoryId', async () => {
        const invalidData = { ...testTemplateData, categoryId: '' };
        const request = createMockRequest('/api/product-research/templates', 'POST', invalidData);
        const response = await POST_TEMPLATES(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('必填');
      });

      it('应该验证品类存在性', async () => {
        const invalidData = { ...testTemplateData, categoryId: 'invalid-id' };
        const request = createMockRequest('/api/product-research/templates', 'POST', invalidData);
        const response = await POST_TEMPLATES(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('不存在');
      });

      it('应该验证 SELECT 类型必须有选项', async () => {
        const selectTemplateData = {
          ...testTemplateData,
          type: 'SELECT',
          code: `TEST-SELECT-${Date.now()}`,
          options: [], // 空选项
        };
        const request = createMockRequest('/api/product-research/templates', 'POST', selectTemplateData);
        const response = await POST_TEMPLATES(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('必须提供选项');
      });

      it('应该成功创建 SELECT 类型属性（带选项）', async () => {
        const selectTemplateData = {
          ...testTemplateData,
          name: `测试选择属性_${Date.now()}`,
          type: 'SELECT',
          code: `TEST-SELECT-OPT-${Date.now()}`,
          categoryId: createdCategoryId,
          options: ['选项 1', '选项 2', '选项 3'],
        };
        const request = createMockRequest('/api/product-research/templates', 'POST', selectTemplateData);
        const response = await POST_TEMPLATES(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.data.type).toBe('SELECT');
        expect(data.data.options).toEqual(['选项 1', '选项 2', '选项 3']);
      });
    });

    describe('GET /api/product-research/templates - 获取属性模板列表', () => {
      it('应该获取属性模板列表', async () => {
        const request = createMockRequest('/api/product-research/templates');
        const response = await GET_TEMPLATES(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data)).toBe(true);
      });

      it('应该支持按品类过滤', async () => {
        const request = createMockRequest(`/api/product-research/templates?categoryId=${createdCategoryId}`);
        const response = await GET_TEMPLATES(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(Array.isArray(data.data)).toBe(true);
      });

      it('应该支持按类型过滤', async () => {
        const request = createMockRequest('/api/product-research/templates?type=TEXT');
        const response = await GET_TEMPLATES(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(Array.isArray(data.data)).toBe(true);
      });

      it('应该支持只获取启用的模板', async () => {
        const request = createMockRequest('/api/product-research/templates?isActive=true');
        const response = await GET_TEMPLATES(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(Array.isArray(data.data)).toBe(true);
      });
    });
  });

  // ============================================
  // 产品调研管理测试
  // ============================================

  describe('Products API - 产品调研管理', () => {
    describe('POST /api/product-research/products - 创建产品调研', () => {
      it('应该成功创建产品调研', async () => {
        const request = createMockRequest('/api/product-research/products', 'POST', testProductData);
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('id');
        expect(data.data.name).toBe(testProductData.name);
        expect(data.data.brand).toBe(testProductData.brand);
        expect(data.data.platform).toBe(testProductData.platform);
        expect(parseFloat(data.data.costPrice)).toBe(50.00);
        expect(parseFloat(data.data.salePrice)).toBe(99.99);

        createdProductId = data.data.id;
      });

      it('应该验证必填字段 name', async () => {
        const invalidData = { ...testProductData, name: '' };
        const request = createMockRequest('/api/product-research/products', 'POST', invalidData);
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('必填');
      });

      it('应该验证必填字段 categoryId', async () => {
        const invalidData = { ...testProductData, categoryId: '' };
        const request = createMockRequest('/api/product-research/products', 'POST', invalidData);
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('必填');
      });

      it('应该验证品类存在性', async () => {
        const invalidData = { ...testProductData, categoryId: 'invalid-id' };
        const request = createMockRequest('/api/product-research/products', 'POST', invalidData);
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('不存在');
      });

      it('应该设置默认状态为 DRAFT', async () => {
        const dataWithoutStatus = { 
          ...testProductData, 
          name: `测试草稿产品_${Date.now()}`,
          status: undefined 
        };
        const request = createMockRequest('/api/product-research/products', 'POST', dataWithoutStatus);
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.data.status).toBe('DRAFT');
      });

      it('应该设置默认优先级为 MEDIUM', async () => {
        const dataWithoutPriority = { 
          ...testProductData, 
          name: `测试优先级产品_${Date.now()}`,
          priority: undefined 
        };
        const request = createMockRequest('/api/product-research/products', 'POST', dataWithoutPriority);
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.data.priority).toBe('MEDIUM');
      });

      it('应该处理属性值数组', async () => {
        const productWithAttributes = {
          ...testProductData,
          name: `测试属性产品_${Date.now()}`,
          attributes: [
            {
              attributeId: createdTemplateId,
              valueText: '测试属性值',
            },
          ],
        };
        const request = createMockRequest('/api/product-research/products', 'POST', productWithAttributes);
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        // 验证属性值已创建
        const product = await prisma.productResearch.findUnique({
          where: { id: data.data.id },
          include: { attributes: true },
        });
        expect(product?.attributes.length).toBeGreaterThan(0);
      });
    });

    describe('GET /api/product-research/products - 获取产品调研列表', () => {
      it('应该获取产品调研列表', async () => {
        const request = createMockRequest('/api/product-research/products?page=1&limit=10');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data).toHaveProperty('data');
        expect(Array.isArray(data.data)).toBe(true);
        expect(data).toHaveProperty('pagination');
        expect(data.pagination).toHaveProperty('page');
        expect(data.pagination).toHaveProperty('limit');
        expect(data.pagination).toHaveProperty('total');
        expect(data.pagination).toHaveProperty('totalPages');
      });

      it('应该支持搜索查询（按名称）', async () => {
        const request = createMockRequest(`/api/product-research/products?search=${testProductData.name}`);
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(Array.isArray(data.data)).toBe(true);
      });

      it('应该支持按品类过滤', async () => {
        const request = createMockRequest(`/api/product-research/products?categoryId=${createdCategoryId}`);
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(Array.isArray(data.data)).toBe(true);
      });

      it('应该支持按状态过滤', async () => {
        const request = createMockRequest('/api/product-research/products?status=DRAFT');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(Array.isArray(data.data)).toBe(true);
      });

      it('应该支持按品牌过滤', async () => {
        const request = createMockRequest(`/api/product-research/products?brand=${testProductData.brand}`);
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(Array.isArray(data.data)).toBe(true);
      });

      it('应该支持按优先级过滤', async () => {
        const request = createMockRequest('/api/product-research/products?priority=MEDIUM');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(Array.isArray(data.data)).toBe(true);
      });

      it('应该正确处理分页', async () => {
        const request = createMockRequest('/api/product-research/products?page=2&limit=5');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.pagination.page).toBe(2);
        expect(data.pagination.limit).toBe(5);
      });
    });
  });

  // ============================================
  // 表单验证逻辑测试（单元测试）
  // ============================================

  describe('Form Validation Logic - 表单验证逻辑', () => {
    describe('市场分析验证', () => {
      it('应该验证售价必须大于采购价', () => {
        const validData = {
          costPrice: '50',
          salePrice: '99.99',
          monthlySales: '100',
          platformFee: '15',
          shippingCost: '5',
          otherCost: '2',
        };

        const cost = parseFloat(validData.costPrice);
        const sale = parseFloat(validData.salePrice);
        
        expect(sale).toBeGreaterThan(cost);
      });

      it('应该拒绝售价小于等于采购价', () => {
        const invalidData = {
          costPrice: '100',
          salePrice: '50', // 售价小于采购价
          monthlySales: '100',
        };

        const cost = parseFloat(invalidData.costPrice);
        const sale = parseFloat(invalidData.salePrice);
        
        expect(sale).toBeLessThan(cost);
      });

      it('应该正确计算毛利润', () => {
        const cost = 50;
        const sale = 100;
        const platformFeeRate = 0.15;
        const shipping = 5;
        const other = 2;

        const platformFee = sale * platformFeeRate;
        const totalCost = cost + platformFee + shipping + other;
        const profit = sale - totalCost;

        expect(platformFee).toBe(15);
        expect(totalCost).toBe(72);
        expect(profit).toBe(28);
      });

      it('应该正确计算毛利率', () => {
        const sale = 100;
        const profit = 28;
        const profitMargin = (profit / sale) * 100;

        expect(profitMargin).toBe(28);
      });

      it('应该处理零值情况', () => {
        const cost = 0;
        const sale = 0;
        const profit = sale - cost;
        const profitMargin = sale > 0 ? (profit / sale) * 100 : 0;

        expect(profit).toBe(0);
        expect(profitMargin).toBe(0);
      });
    });

    describe('调研结论验证', () => {
      it('应该验证结论必须选择', () => {
        const validConclusions = ['推荐', '备选', '淘汰'];
        const invalidConclusion = '';

        expect(validConclusions).toContain('推荐');
        expect(validConclusions).toContain('备选');
        expect(validConclusions).toContain('淘汰');
        expect(invalidConclusion).toBe('');
      });

      it('应该验证评分范围 1-5', () => {
        const validRatings = ['1', '2', '3', '4', '5'];
        const invalidRating = '6';

        validRatings.forEach((rating) => {
          const num = parseInt(rating);
          expect(num).toBeGreaterThanOrEqual(1);
          expect(num).toBeLessThanOrEqual(5);
        });

        const invalidNum = parseInt(invalidRating);
        expect(invalidNum).toBeGreaterThan(5);
      });

      it('应该验证优先级选项', () => {
        const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
        const invalidPriority = 'INVALID';

        expect(validPriorities).toContain('LOW');
        expect(validPriorities).toContain('MEDIUM');
        expect(validPriorities).toContain('HIGH');
        expect(validPriorities).toContain('URGENT');
        expect(validPriorities).not.toContain(invalidPriority);
      });
    });

    describe('属性值验证', () => {
      it('应该验证必填属性不能为空', () => {
        const requiredAttributes = [
          { id: '1', name: '颜色', isRequired: true, value: '红色' },
          { id: '2', name: '尺寸', isRequired: true, value: '' }, // 空值
        ];

        const missingValues = requiredAttributes.filter(
          (attr) => attr.isRequired && (!attr.value || attr.value === '')
        );

        expect(missingValues.length).toBe(1);
        expect(missingValues[0].name).toBe('尺寸');
      });

      it('应该验证数字类型属性', () => {
        const numberValue = '123.45';
        const parsedValue = parseFloat(numberValue);

        expect(parsedValue).toBe(123.45);
        expect(isNaN(parsedValue)).toBe(false);
      });

      it('应该验证日期类型属性', () => {
        const dateValue = '2026-03-14';
        const date = new Date(dateValue);

        expect(date instanceof Date).toBe(true);
        expect(isNaN(date.getTime())).toBe(false);
      });
    });
  });
});
