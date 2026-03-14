/**
 * 产品录入页面 - Product Creation Page (Sprint 2.1)
 * 
 * 功能：多步骤表单（4 步）
 * - 步骤 1：基本信息（产品名称、品类、品牌、平台）
 * - 步骤 2：属性录入（动态加载品类属性模板）
 * - 步骤 3：市场分析（价格、销量、利润）
 * - 步骤 4：调研结论（推荐/备选/淘汰）
 * 
 * 技术栈：
 * - Next.js 16 App Router
 * - TypeScript
 * - TailwindCSS
 * - shadcn/ui 组件
 * - React Hook Form
 * 
 * @module app/product-research/products/new/page
 * @author Trade ERP Development Team
 * @date 2026-03-14
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// shadcn/ui 组件
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// 图标
import { ChevronLeft, ChevronRight, Save, Check, AlertCircle, TrendingUp, DollarSign, Target } from 'lucide-react';

// ============================================
// 类型定义
// ============================================

/**
 * 平台选项类型
 */
type Platform = 'Amazon' | 'TikTok' | '独立站' | 'eBay' | 'Shopee' | 'Lazada' | '其他';

/**
 * 调研结论类型
 */
type Conclusion = '推荐' | '备选' | '淘汰';

/**
 * 属性类型（与 Prisma schema 保持一致）
 */
type AttributeType = 'TEXT' | 'NUMBER' | 'DECIMAL' | 'BOOLEAN' | 'DATE' | 'SELECT' | 'MULTI_SELECT' | 'LONG_TEXT';

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
  type: AttributeType;
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
}

/**
 * 属性值类型（用于步骤 2）
 */
interface AttributeValue {
  attributeId: string;
  value: any;
}

// ============================================
// 表单验证 Schema
// ============================================

/**
 * 步骤 1：基本信息验证
 */
const basicInfoSchema = z.object({
  name: z.string().min(1, '产品名称不能为空'),
  brand: z.string().min(1, '品牌不能为空'),
  platform: z.enum(['Amazon', 'TikTok', '独立站', 'eBay', 'Shopee', 'Lazada', '其他']),
  categoryId: z.string().min(1, '请选择品类'),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  sourceUrl: z.string().url('请输入有效的 URL').or(z.literal('')).optional(),
  sourcePlatform: z.string().optional(),
  remarks: z.string().optional(),
});

/**
 * 步骤 3：市场分析验证
 */
const marketAnalysisSchema = z.object({
  costPrice: z.string().min(1, '采购成本不能为空'),
  salePrice: z.string().min(1, '预期售价不能为空'),
  monthlySales: z.string().min(1, '预估月销量不能为空'),
  platformFee: z.string().default('15'),
  shippingCost: z.string().default('0'),
  otherCost: z.string().default('0'),
}).refine((data) => {
  if (parseFloat(data.salePrice) <= parseFloat(data.costPrice)) {
    return {
      message: '预期售价必须大于采购成本',
      path: ['salePrice'],
    };
  }
  return true;
});

/**
 * 步骤 4：调研结论验证
 */
const conclusionSchema = z.object({
  conclusion: z.enum(['推荐', '备选', '淘汰']),
  rating: z.string().min(1, '请评分'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  tags: z.string().optional(),
  conclusionNotes: z.string().optional(),
});

// ============================================
// 平台选项列表
// ============================================

const PLATFORM_OPTIONS: Platform[] = [
  'Amazon',
  'TikTok',
  '独立站',
  'eBay',
  'Shopee',
  'Lazada',
  '其他',
];

// ============================================
// 优先级选项
// ============================================

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: '低优先级', color: 'bg-gray-500' },
  { value: 'MEDIUM', label: '中优先级', color: 'bg-blue-500' },
  { value: 'HIGH', label: '高优先级', color: 'bg-orange-500' },
  { value: 'URGENT', label: '紧急', color: 'bg-red-500' },
];

// ============================================
// 主组件
// ============================================

export default function ProductNewPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [attributeTemplates, setAttributeTemplates] = useState<AttributeTemplate[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [attributeValues, setAttributeValues] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [marketData, setMarketData] = useState({
    costPrice: '',
    salePrice: '',
    monthlySales: '',
    platformFee: '15',
    shippingCost: '0',
    otherCost: '0',
  });
  const [conclusionData, setConclusionData] = useState({
    conclusion: '' as Conclusion | '',
    rating: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
    tags: '',
    conclusionNotes: '',
  });

  // 计算毛利和毛利率
  const calculateProfit = useCallback(() => {
    const cost = parseFloat(marketData.costPrice) || 0;
    const sale = parseFloat(marketData.salePrice) || 0;
    const platformFeeRate = parseFloat(marketData.platformFee) / 100 || 0;
    const shipping = parseFloat(marketData.shippingCost) || 0;
    const other = parseFloat(marketData.otherCost) || 0;

    const platformFee = sale * platformFeeRate;
    const totalCost = cost + platformFee + shipping + other;
    const profit = sale - totalCost;
    const profitMargin = sale > 0 ? (profit / sale) * 100 : 0;

    return {
      platformFee,
      totalCost,
      profit,
      profitMargin,
    };
  }, [marketData]);

  const profitData = calculateProfit();

  // ============================================
  // React Hook Form 配置（步骤 1）
  // ============================================

  const form = useForm<z.infer<typeof basicInfoSchema>>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      name: '',
      brand: '',
      platform: 'Amazon',
      categoryId: '',
      model: '',
      manufacturer: '',
      sourceUrl: '',
      sourcePlatform: '',
      remarks: '',
    },
  });

  const { watch, setValue, getValues } = form;
  const watchedCategory = watch('categoryId');
  const watchedPlatform = watch('platform');

  // ============================================
  // 加载品类列表
  // ============================================

  useEffect(() => {
    loadCategories();
  }, []);

  /**
   * 加载品类列表
   */
  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const res = await fetch('/api/product-research/categories?isActive=true');
      const data = await res.json();
      if (data.success) {
        setCategories(data.data || []);
      }
    } catch (error) {
      console.error('加载品类失败:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  // ============================================
  // 监听品类变化，加载属性模板
  // ============================================

  useEffect(() => {
    if (watchedCategory && watchedCategory !== selectedCategory) {
      setSelectedCategory(watchedCategory);
      loadAttributeTemplates(watchedCategory);
    }
  }, [watchedCategory]);

  /**
   * 加载属性模板
   */
  const loadAttributeTemplates = async (categoryId: string) => {
    setLoadingTemplates(true);
    setAttributeValues({});
    try {
      const res = await fetch(`/api/product-research/templates?categoryId=${categoryId}&isActive=true`);
      const data = await res.json();
      if (data.success) {
        setAttributeTemplates(data.data || []);
      }
    } catch (error) {
      console.error('加载属性模板失败:', error);
      setAttributeTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // ============================================
  // 表单导航
  // ============================================

  /**
   * 验证当前步骤
   */
  const validateCurrentStep = async (): Promise<boolean> => {
    if (currentStep === 1) {
      const isValid = await form.trigger();
      return isValid;
    }
    
    if (currentStep === 2) {
      const requiredTemplates = attributeTemplates.filter((t) => t.isRequired);
      for (const template of requiredTemplates) {
        const value = attributeValues[template.id];
        if (!value || value === '') {
          alert(`请填写必填属性：${template.name}`);
          return false;
        }
      }
      return true;
    }

    if (currentStep === 3) {
      try {
        marketAnalysisSchema.parse(marketData);
        return true;
      } catch (error: any) {
        if (error.errors) {
          alert(error.errors[0].message);
        }
        return false;
      }
    }

    if (currentStep === 4) {
      if (!conclusionData.conclusion) {
        alert('请选择调研结论');
        return false;
      }
      if (!conclusionData.rating) {
        alert('请评分');
        return false;
      }
      return true;
    }

    return true;
  };

  /**
   * 下一步
   */
  const handleNext = async () => {
    const isValid = await validateCurrentStep();
    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  /**
   * 上一步
   */
  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ============================================
  // 保存草稿
  // ============================================

  /**
   * 保存草稿
   */
  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const basicInfo = getValues();
      const draftData = {
        ...basicInfo,
        attributes: attributeValues,
        marketAnalysis: marketData,
        conclusion: conclusionData,
        status: 'DRAFT',
      };

      console.log('保存草稿:', draftData);

      const res = await fetch('/api/product-research/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draftData,
          costPrice: parseFloat(marketData.costPrice) || null,
          salePrice: parseFloat(marketData.salePrice) || null,
          priority: conclusionData.priority || 'MEDIUM',
          tags: conclusionData.tags ? conclusionData.tags.split(',').map((t: string) => t.trim()) : [],
          notes: conclusionData.conclusionNotes,
          conclusion: conclusionData.conclusion || null,
          rating: parseFloat(conclusionData.rating) || null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        alert('草稿已保存！');
      } else {
        alert(`保存失败：${data.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('保存草稿失败:', error);
      alert('保存草稿失败，请重试');
    } finally {
      setSavingDraft(false);
    }
  };

  // ============================================
  // 提交表单
  // ============================================

  /**
   * 提交表单
   */
  const handleSubmit = async () => {
    for (let step = 1; step <= 4; step++) {
      setCurrentStep(step);
      const isValid = await validateCurrentStep();
      if (!isValid) {
        return;
      }
    }

    setSubmitting(true);
    
    try {
      const basicInfo = getValues();
      
      const attributes = Object.entries(attributeValues).map(([attributeId, value]) => {
        const template = attributeTemplates.find((t) => t.id === attributeId);
        return {
          attributeId,
          valueText: template?.type === 'TEXT' || template?.type === 'LONG_TEXT' ? value : null,
          valueNumber: template?.type === 'NUMBER' || template?.type === 'DECIMAL' ? parseFloat(value) : null,
          valueBoolean: template?.type === 'BOOLEAN' ? value === 'true' : null,
          valueDate: template?.type === 'DATE' ? new Date(value) : null,
          valueOptions: template?.type === 'MULTI_SELECT' ? value : null,
        };
      });

      const submitData = {
        ...basicInfo,
        costPrice: parseFloat(marketData.costPrice),
        salePrice: parseFloat(marketData.salePrice),
        moq: null,
        leadTime: null,
        specification: null,
        weight: null,
        volume: null,
        status: 'IN_PROGRESS',
        priority: conclusionData.priority,
        tags: conclusionData.tags ? conclusionData.tags.split(',').map((t: string) => t.trim()) : [],
        notes: conclusionData.conclusionNotes,
        conclusion: conclusionData.conclusion,
        rating: parseFloat(conclusionData.rating),
        attributes,
      };

      console.log('提交数据:', submitData);

      const res = await fetch('/api/product-research/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      const data = await res.json();

      if (data.success) {
        alert('产品创建成功！');
        router.push('/product-research/products');
      } else {
        alert(`创建失败：${data.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('提交失败:', error);
      alert('提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================
  // 渲染步骤指示器
  // ============================================

  const renderStepIndicator = () => {
    const steps = [
      { num: 1, title: '基本信息', icon: '📋' },
      { num: 2, title: '属性录入', icon: '📝' },
      { num: 3, title: '市场分析', icon: '📊' },
      { num: 4, title: '调研结论', icon: '✅' },
    ];

    return (
      <div className="w-full mb-8">
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, index) => (
            <div key={step.num} className="flex items-center">
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-full border-2 ${
                  currentStep >= step.num
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted bg-muted text-muted-foreground'
                }`}
              >
                {currentStep > step.num ? <Check className="w-6 h-6" /> : <span className="text-lg">{step.icon}</span>}
              </div>
              <span
                className={`ml-2 text-sm font-medium ${
                  currentStep >= step.num ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {step.title}
              </span>
              {index < steps.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-2 ${
                    currentStep > step.num ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <Progress value={(currentStep / 4) * 100} className="h-2 mt-4" />
      </div>
    );
  };

  // ============================================
  // 渲染步骤 1：基本信息
  // ============================================

  const renderStep1 = () => (
    <Card>
      <CardHeader>
        <CardTitle>📋 基本信息</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...form}>
          <form className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>产品名称 *</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入产品名称" {...field} />
                  </FormControl>
                  <FormDescription>
                    产品的中文名称，用于内部识别
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="brand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>品牌 *</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入品牌名称" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="platform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>平台 *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择平台" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PLATFORM_OPTIONS.map((platform) => (
                          <SelectItem key={platform} value={platform}>
                            {platform}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>品类 *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择品类" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {loadingCategories ? (
                          <SelectItem value="loading" disabled>
                            加载中...
                          </SelectItem>
                        ) : (
                          categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>型号</FormLabel>
                    <FormControl>
                      <Input placeholder="产品型号（可选）" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="manufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>生产厂家</FormLabel>
                    <FormControl>
                      <Input placeholder="生产厂家名称（可选）" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sourceUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>来源链接</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://..."
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      1688、淘宝等平台的商品链接
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sourcePlatform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>来源平台</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择来源平台" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1688">1688</SelectItem>
                        <SelectItem value="淘宝">淘宝</SelectItem>
                        <SelectItem value="拼多多">拼多多</SelectItem>
                        <SelectItem value="京东">京东</SelectItem>
                        <SelectItem value="其他">其他</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>备注</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="其他需要说明的信息"
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={handleSaveDraft} disabled={savingDraft}>
          <Save className="w-4 h-4 mr-2" />
          {savingDraft ? '保存中...' : '保存草稿'}
        </Button>
        <Button onClick={handleNext}>
          下一步
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );

  // ============================================
  // 渲染步骤 2：属性录入
  // ============================================

  const renderStep2 = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>📝 属性录入</CardTitle>
          <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={savingDraft}>
            <Save className="w-4 h-4 mr-2" />
            {savingDraft ? '保存中...' : '保存草稿'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadingTemplates ? (
          <div className="text-center py-8 text-muted-foreground">
            加载属性模板中...
          </div>
        ) : attributeTemplates.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              该品类暂无属性模板，请先在品类管理中配置属性。
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {attributeTemplates.map((template) => (
              <div
                key={template.id}
                className="p-4 border rounded-lg space-y-2"
              >
                <div className="flex items-center justify-between">
                  <Label className="font-medium">
                    {template.name}
                    {template.isRequired && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <Badge variant="outline">{template.type}</Badge>
                </div>

                {template.description && (
                  <p className="text-sm text-muted-foreground">
                    {template.description}
                  </p>
                )}

                {renderAttributeInput(template)}
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={handlePrevious}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          上一步
        </Button>
        <Button onClick={handleNext}>
          下一步
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );

  /**
   * 根据属性类型渲染输入框
   */
  const renderAttributeInput = (template: AttributeTemplate) => {
    const value = attributeValues[template.id] || template.defaultValue || '';

    const handleChange = (newValue: any) => {
      setAttributeValues((prev) => ({
        ...prev,
        [template.id]: newValue,
      }));
    };

    // 文本类型判断
    const isTextType = template.type === 'TEXT' || template.type === 'LONG_TEXT';
    // 数字类型判断
    const isNumberType = template.type === 'NUMBER' || template.type === 'DECIMAL';
    // 多选类型判断
    const isMultiType = template.type === 'MULTI_SELECT';

    switch (template.type) {
      case 'TEXT':
      case 'LONG_TEXT':
        return (
          <Input
            placeholder={template.placeholder || '请输入'}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
          />
        );

      case 'NUMBER':
      case 'DECIMAL':
        return (
          <Input
            type="number"
            placeholder={template.placeholder || '请输入数字'}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            step="0.01"
          />
        );

      case 'DATE':
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
          />
        );

      case 'SELECT':
        return (
          <Select value={value} onValueChange={handleChange}>
            <SelectTrigger>
              <SelectValue placeholder="请选择" />
            </SelectTrigger>
            <SelectContent>
              {template.options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'MULTI_SELECT':
        return (
          <div className="flex flex-wrap gap-2">
            {template.options.map((option) => {
              const selected = (value as string[])?.includes(option);
              return (
                <Badge
                  key={option}
                  variant={selected ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => {
                    const current = (value as string[]) || [];
                    if (selected) {
                      handleChange(current.filter((o) => o !== option));
                    } else {
                      handleChange([...current, option]);
                    }
                  }}
                >
                  {option}
                </Badge>
              );
            })}
          </div>
        );

      case 'BOOLEAN':
        return (
          <RadioGroup
            value={value || 'false'}
            onValueChange={handleChange}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="true" id={`${template.id}-true`} />
              <Label htmlFor={`${template.id}-true`}>是</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="false" id={`${template.id}-false`} />
              <Label htmlFor={`${template.id}-false`}>否</Label>
            </div>
          </RadioGroup>
        );

      default:
        return <Input placeholder="暂不支持的类型" disabled />;
    }
  };

  // ============================================
  // 渲染步骤 3：市场分析
  // ============================================

  const renderStep3 = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>📊 市场分析</CardTitle>
          <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={savingDraft}>
            <Save className="w-4 h-4 mr-2" />
            {savingDraft ? '保存中...' : '保存草稿'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="costPrice">采购成本 *</Label>
            <Input
              id="costPrice"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={marketData.costPrice}
              onChange={(e) => setMarketData({ ...marketData, costPrice: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">单件采购成本（元）</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="salePrice">预期售价 *</Label>
            <Input
              id="salePrice"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={marketData.salePrice}
              onChange={(e) => setMarketData({ ...marketData, salePrice: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">单件销售价格（元）</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="monthlySales">预估月销量 *</Label>
          <Input
            id="monthlySales"
            type="number"
            min="0"
            placeholder="0"
            value={marketData.monthlySales}
            onChange={(e) => setMarketData({ ...marketData, monthlySales: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">预计每月销售数量（件）</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="platformFee">平台佣金 (%)</Label>
            <Input
              id="platformFee"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={marketData.platformFee}
              onChange={(e) => setMarketData({ ...marketData, platformFee: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">平台扣点比例</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shippingCost">头程运费 (元)</Label>
            <Input
              id="shippingCost"
              type="number"
              step="0.01"
              min="0"
              value={marketData.shippingCost}
              onChange={(e) => setMarketData({ ...marketData, shippingCost: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">单件头程运费</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="otherCost">其他成本 (元)</Label>
            <Input
              id="otherCost"
              type="number"
              step="0.01"
              min="0"
              value={marketData.otherCost}
              onChange={(e) => setMarketData({ ...marketData, otherCost: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">包装、认证等</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-green-50 dark:bg-green-950">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-xs text-muted-foreground">毛利润</p>
                  <p className={`text-2xl font-bold ${profitData.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ¥{profitData.profit.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 dark:bg-blue-950">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-xs text-muted-foreground">毛利率</p>
                  <p className={`text-2xl font-bold ${profitData.profitMargin >= 20 ? 'text-green-600' : profitData.profitMargin >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {profitData.profitMargin.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-purple-50 dark:bg-purple-950">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-xs text-muted-foreground">月毛利</p>
                  <p className="text-2xl font-bold text-purple-600">
                    ¥{(profitData.profit * (parseFloat(marketData.monthlySales) || 0)).toFixed(0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="p-4 bg-muted rounded-lg space-y-2">
          <h4 className="font-medium">成本明细</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">采购成本:</span>
              <span>¥{parseFloat(marketData.costPrice || '0').toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">平台佣金:</span>
              <span>¥{profitData.platformFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">头程运费:</span>
              <span>¥{parseFloat(marketData.shippingCost || '0').toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">其他成本:</span>
              <span>¥{parseFloat(marketData.otherCost || '0').toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-medium border-t pt-2 mt-2">
              <span>总成本:</span>
              <span>¥{profitData.totalCost.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={handlePrevious}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          上一步
        </Button>
        <Button onClick={handleNext}>
          下一步
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );

  // ============================================
  // 渲染步骤 4：调研结论
  // ============================================

  const renderStep4 = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>✅ 调研结论</CardTitle>
          <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={savingDraft}>
            <Save className="w-4 h-4 mr-2" />
            {savingDraft ? '保存中...' : '保存草稿'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>调研结论 *</Label>
          <div className="grid grid-cols-3 gap-4">
            <Button
              type="button"
              variant={conclusionData.conclusion === '推荐' ? 'default' : 'outline'}
              className={`h-20 ${conclusionData.conclusion === '推荐' ? 'bg-green-600 hover:bg-green-700' : ''}`}
              onClick={() => setConclusionData({ ...conclusionData, conclusion: '推荐' })}
            >
              <div className="flex flex-col items-center">
                <span className="text-2xl mb-1">👍</span>
                <span>推荐</span>
              </div>
            </Button>
            <Button
              type="button"
              variant={conclusionData.conclusion === '备选' ? 'default' : 'outline'}
              className={`h-20 ${conclusionData.conclusion === '备选' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}`}
              onClick={() => setConclusionData({ ...conclusionData, conclusion: '备选' })}
            >
              <div className="flex flex-col items-center">
                <span className="text-2xl mb-1">🤔</span>
                <span>备选</span>
              </div>
            </Button>
            <Button
              type="button"
              variant={conclusionData.conclusion === '淘汰' ? 'default' : 'outline'}
              className={`h-20 ${conclusionData.conclusion === '淘汰' ? 'bg-red-600 hover:bg-red-700' : ''}`}
              onClick={() => setConclusionData({ ...conclusionData, conclusion: '淘汰' })}
            >
              <div className="flex flex-col items-center">
                <span className="text-2xl mb-1">👎</span>
                <span>淘汰</span>
              </div>
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>综合评分 *</Label>
          <RadioGroup
            value={conclusionData.rating}
            onValueChange={(value) => setConclusionData({ ...conclusionData, rating: value })}
            className="flex gap-2"
          >
            {[1, 2, 3, 4, 5].map((star) => (
              <Button
                key={star}
                type="button"
                variant={conclusionData.rating === star.toString() ? 'default' : 'outline'}
                className="w-12 h-12 p-0"
                onClick={() => setConclusionData({ ...conclusionData, rating: star.toString() })}
              >
                <span className="text-2xl">{'⭐'.repeat(star)}</span>
              </Button>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>优先级</Label>
          <div className="grid grid-cols-4 gap-2">
            {PRIORITY_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={conclusionData.priority === option.value ? 'default' : 'outline'}
                className={conclusionData.priority === option.value ? option.color : ''}
                onClick={() => setConclusionData({ ...conclusionData, priority: option.value as any })}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">标签</Label>
          <Input
            id="tags"
            placeholder="用逗号分隔，如：爆款，新品，季节性"
            value={conclusionData.tags}
            onChange={(e) => setConclusionData({ ...conclusionData, tags: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="conclusionNotes">结论文案</Label>
          <Textarea
            id="conclusionNotes"
            placeholder="详细说明推荐理由、风险提示或淘汰原因..."
            className="min-h-[120px]"
            value={conclusionData.conclusionNotes}
            onChange={(e) => setConclusionData({ ...conclusionData, conclusionNotes: e.target.value })}
          />
        </div>

        <div className="p-4 bg-muted rounded-lg space-y-2">
          <h4 className="font-medium">信息摘要</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">产品名称:</span>
              <span className="font-medium">{getValues('name') || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">品牌:</span>
              <span className="font-medium">{getValues('brand') || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">平台:</span>
              <span className="font-medium">{getValues('platform') || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">采购价:</span>
              <span className="font-medium">¥{marketData.costPrice || '0'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">售价:</span>
              <span className="font-medium">¥{marketData.salePrice || '0'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">毛利率:</span>
              <span className={`font-medium ${profitData.profitMargin >= 20 ? 'text-green-600' : 'text-yellow-600'}`}>
                {profitData.profitMargin.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={handlePrevious}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          上一步
        </Button>
        <Button onClick={handleSubmit} disabled={submitting} className="min-w-[120px]">
          {submitting ? '提交中...' : '提交'}
        </Button>
      </CardFooter>
    </Card>
  );

  // ============================================
  // 主渲染
  // ============================================

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">产品录入</h1>
        <p className="text-muted-foreground">
          创建新产品调研记录，填写完整信息以便后续跟踪
        </p>
      </div>

      {renderStepIndicator()}

      <div className="max-w-4xl mx-auto">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </div>
    </div>
  );
}
