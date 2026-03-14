# 产品调研模块技术设计文档

**日期:** 2026-03-13  
**版本:** v1.0  
**作者:** Trade ERP 系统架构师  
**模块:** Product Research (产品调研)

---

## 1. 模块概述

### 1.1 功能定位

产品调研模块是 Trade ERP 系统的核心业务模块，为跨境电商选品决策提供完整的数据支撑和分析工具。

**核心价值:**
- 📊 **标准化产品信息**: 统一的产品数据模型，支持多品类差异化属性
- 🔍 **智能对比分析**: 多款产品参数对比，辅助决策
- 📈 **量化评分系统**: 多维度评分模型，客观评估产品潜力
- 📋 **完整调研流程**: 从初步调研到备货计划的全流程管理

### 1.2 技术特点

| 特点 | 说明 |
|------|------|
| EAV 模式 | Entity-Attribute-Value，支持动态属性扩展 |
| 品类模板 | 不同品类有不同的属性模板 |
| 版本化评分 | 支持多次评分，保留历史版本 |
| 对比引擎 | 后端聚合查询，差异高亮 |
| 多格式导出 | PDF/Excel 对比报告 |

---

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js 16)                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │ 品类管理    │  │ 产品调研    │  │ 产品对比    │  │ 评分    │ │
│  │ Category    │  │ Research    │  │ Comparison  │  │ Score   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │ 属性编辑    │  │ 附件管理    │  │ 备货计划    │  │ 导出    │ │
│  │ Attribute   │  │ Attachment  │  │ StockPlan   │  │ Export  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP/REST
┌─────────────────────────────────────────────────────────────────┐
│                      API Layer (Next.js API Routes)              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ /api/categories │  │ /api/product-   │  │ /api/product-   │  │
│  │                 │  │ research        │  │ research/compare│  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Prisma ORM
┌─────────────────────────────────────────────────────────────────┐
│                     Service Layer (Business Logic)               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │CategorySvc  │  │ResearchSvc  │  │CompareSvc   │  │ScoreSvc │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │AttributeSvc │  │ExportSvc    │  │StockPlanSvc │  │FileSvc  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Prisma Client
┌─────────────────────────────────────────────────────────────────┐
│                    Database (PostgreSQL)                         │
├─────────────────────────────────────────────────────────────────┤
│  ProductCategory │ CategoryAttribute │ ProductResearch          │
│  ProductBasicInfo │ MarketAnalysis   │ CompetitionAnalysis      │
│  ProductAttributeValue │ ProductScoreDetail │ ProductAttachment │
│  StockPlan                                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 技术栈

| 层级 | 技术选型 | 版本 |
|------|----------|------|
| 前端框架 | Next.js | 16.x |
| 前端语言 | TypeScript | 5.x |
| UI 组件库 | shadcn/ui | latest |
| 状态管理 | Zustand | 4.x |
| 数据可视化 | Recharts | 2.x |
| 表格对比 | TanStack Table | 8.x |
| 后端框架 | Next.js API Routes | 16.x |
| ORM | Prisma | 6.x |
| 数据库 | PostgreSQL | 15.x |
| 文件存储 | 本地存储 / S3 | - |
| PDF 生成 | pdfkit / puppeteer | - |
| Excel 生成 | exceljs | - |

---

## 3. 核心功能实现

### 3.1 EAV 动态属性系统

#### 3.1.1 数据模型

```
┌─────────────────────┐
│  ProductCategory    │  品类定义
│  - id               │
│  - name             │
│  - level            │
└─────────────────────┘
           │ 1
           │
           │ ∞
           ▼
┌─────────────────────┐
│ CategoryAttribute   │  属性模板定义
│  - id               │
│  - categoryId       │
│  - name             │
│  - code             │
│  - type             │  TEXT/NUMBER/SELECT...
│  - options          │  JSON 存储选项
│  - isRequired       │
│  - isComparable     │
└─────────────────────┘
           │ 1
           │
           │ ∞
           ▼
┌─────────────────────┐
│ProductAttributeValue│  具体属性值
│  - productResearchId│
│  - attributeId      │
│  - valueText        │
│  - valueNumber      │
│  - valueDecimal     │
│  - valueUnified     │  统一字符串表示（搜索用）
└─────────────────────┘
```

#### 3.1.2 属性值存储策略

```typescript
// 根据属性类型，将值存储在不同的字段
interface AttributeValue {
  attributeId: string;
  
  // 根据 type 选择存储字段
  valueText?: string;      // TEXT, URL, RICH_TEXT
  valueNumber?: number;    // NUMBER (整数)
  valueDecimal?: number;   // DECIMAL (小数)
  valueBoolean?: boolean;  // BOOLEAN
  valueDate?: Date;        // DATE
  valueJson?: any;         // SELECT, MULTI_SELECT (存储选中的选项)
  
  // 统一字段：用于搜索和对比
  valueUnified: string;    // 所有类型的字符串表示
}

// 示例：存储一个 SELECT 类型的属性
// 属性定义：{ code: 'color', type: 'SELECT', options: [{value:'black',label:'黑色'}, ...] }
// 属性值：{ attributeId: 'xxx', valueJson: ['black'], valueUnified: '黑色' }
```

#### 3.1.3 属性值验证服务

```typescript
// services/attribute-validator.ts

import { AttributeType, CategoryAttribute } from '@prisma/client';

interface ValidateOptions {
  attribute: CategoryAttribute;
  value: any;
}

export class AttributeValidator {
  static validate(options: ValidateOptions): { valid: boolean; error?: string } {
    const { attribute, value } = options;
    
    // 必填检查
    if (attribute.isRequired && (value === null || value === undefined || value === '')) {
      return { valid: false, error: `${attribute.name} 是必填项` };
    }
    
    // 空值跳过类型验证
    if (value === null || value === undefined || value === '') {
      return { valid: true };
    }
    
    // 类型验证
    switch (attribute.type) {
      case 'TEXT':
      case 'RICH_TEXT':
        return this.validateText(value, attribute);
      
      case 'NUMBER':
        return this.validateNumber(value, attribute);
      
      case 'DECIMAL':
        return this.validateDecimal(value, attribute);
      
      case 'BOOLEAN':
        return this.validateBoolean(value);
      
      case 'SELECT':
      case 'MULTI_SELECT':
        return this.validateSelect(value, attribute);
      
      case 'DATE':
        return this.validateDate(value);
      
      case 'URL':
        return this.validateUrl(value);
      
      default:
        return { valid: true };
    }
  }
  
  private static validateText(value: any, attr: CategoryAttribute): any {
    if (typeof value !== 'string') {
      return { valid: false, error: `${attr.name} 必须是文本` };
    }
    if (value.length > 1000) {
      return { valid: false, error: `${attr.name} 不能超过 1000 字符` };
    }
    return { valid: true };
  }
  
  private static validateNumber(value: any, attr: CategoryAttribute): any {
    const num = Number(value);
    if (isNaN(num)) {
      return { valid: false, error: `${attr.name} 必须是数字` };
    }
    if (attr.minValue !== null && num < attr.minValue) {
      return { valid: false, error: `${attr.name} 不能小于 ${attr.minValue}` };
    }
    if (attr.maxValue !== null && num > attr.maxValue) {
      return { valid: false, error: `${attr.name} 不能大于 ${attr.maxValue}` };
    }
    return { valid: true };
  }
  
  private static validateDecimal(value: any, attr: CategoryAttribute): any {
    const num = Number(value);
    if (isNaN(num)) {
      return { valid: false, error: `${attr.name} 必须是数字` };
    }
    // 同 Number 验证...
    return { valid: true };
  }
  
  private static validateSelect(value: any, attr: CategoryAttribute): any {
    const options = attr.options as any[];
    if (!options || options.length === 0) {
      return { valid: true }; // 无选项定义，跳过验证
    }
    
    const validValues = options.map(o => o.value);
    
    if (attr.type === 'MULTI_SELECT') {
      if (!Array.isArray(value)) {
        return { valid: false, error: `${attr.name} 必须是数组` };
      }
      const invalid = value.filter((v: any) => !validValues.includes(v));
      if (invalid.length > 0) {
        return { valid: false, error: `${attr.name} 包含无效选项` };
      }
    } else {
      if (!validValues.includes(value)) {
        return { valid: false, error: `${attr.name} 选项无效` };
      }
    }
    
    return { valid: true };
  }
  
  // ... 其他验证方法
}
```

### 3.2 产品对比引擎

#### 3.2.1 对比流程

```
1. 用户勾选产品 (前端)
   ↓
2. 发送对比请求 GET /api/product-research/compare?ids=id1,id2,id3
   ↓
3. 后端聚合查询
   ├─ 查询产品基本信息
   ├─ 查询可对比属性模板
   ├─ 批量加载属性值
   ├─ 查询评分数据
   └─ 查询市场分析数据
   ↓
4. 数据对齐与差异计算
   ├─ 按属性代码对齐
   ├─ 计算数值差异
   └─ 标记差异字段
   ↓
5. 返回对比数据结构
   ↓
6. 前端渲染对比表格
```

#### 3.2.2 对比服务实现

```typescript
// services/compare-service.ts

import { prisma } from '@/lib/prisma';

interface CompareOptions {
  productIds: string[];
  includeAttributes?: string[]; // 指定属性代码
}

interface ComparisonResult {
  products: Array<{
    id: string;
    title: string;
    brand: string | null;
    category: { name: string };
    basicInfo: any;
    latestScore: any;
    marketAnalysis: any;
  }>;
  comparison: {
    attributes: Array<{
      code: string;
      name: string;
      type: string;
      unit?: string;
      values: any[];
      isDifferent: boolean;
      min?: number;
      max?: number;
      diff?: number;
    }>;
    scores: {
      marketScore: number[];
      competitionScore: number[];
      profitScore: number[];
      supplyScore: number[];
      riskScore: number[];
      totalScore: number[];
    };
    priceComparison: {
      suggestedPrice: number[];
      min: number;
      max: number;
      diff: number;
    };
  };
  summary: {
    bestScore: { productId: string; title: string; totalScore: number };
    lowestPrice: { productId: string; title: string; price: number };
    commonAttributes: number;
    differentAttributes: number;
  };
}

export class CompareService {
  async compare(options: CompareOptions): Promise<ComparisonResult> {
    const { productIds, includeAttributes } = options;
    
    // 验证
    if (productIds.length < 2) {
      throw new Error('至少需要 2 个产品进行对比');
    }
    if (productIds.length > 10) {
      throw new Error('最多支持 10 个产品对比');
    }
    
    // 1. 查询产品基本信息（批量加载）
    const products = await prisma.productResearch.findMany({
      where: { id: { in: productIds } },
      include: {
        category: { select: { name: true } },
        basicInfo: true,
        attributeValues: {
          include: {
            attribute: {
              where: { isComparable: true },
              select: { code: true, name: true, type: true, unit: true },
            },
          },
        },
        scoreDetails: {
          where: { isLatest: true },
          select: {
            marketScore: true,
            competitionScore: true,
            profitScore: true,
            supplyScore: true,
            riskScore: true,
            totalScore: true,
          },
        },
        marketAnalysis: {
          select: { suggestedPrice: true, demandLevel: true },
        },
      },
    });
    
    // 2. 收集所有可对比属性
    const attributeMap = new Map<string, { code: string; name: string; type: string; unit?: string }>();
    products.forEach(product => {
      product.attributeValues.forEach(av => {
        if (!attributeMap.has(av.attribute.code)) {
          attributeMap.set(av.attribute.code, {
            code: av.attribute.code,
            name: av.attribute.name,
            type: av.attribute.type,
            unit: av.attribute.unit || undefined,
          });
        }
      });
    });
    
    // 3. 过滤指定属性（如有）
    let attributes = Array.from(attributeMap.values());
    if (includeAttributes && includeAttributes.length > 0) {
      attributes = attributes.filter(attr => includeAttributes.includes(attr.code));
    }
    
    // 4. 构建属性值矩阵
    const comparisonAttributes = attributes.map(attr => {
      const values = products.map(product => {
        const av = product.attributeValues.find(
          v => v.attribute.code === attr.code
        );
        if (!av) return null;
        
        // 返回统一值或具体类型值
        return av.valueUnified || 
               av.valueText || 
               av.valueNumber?.toString() || 
               av.valueDecimal?.toString() ||
               '';
      });
      
      // 计算差异
      const uniqueValues = new Set(values.filter(v => v !== null && v !== ''));
      const isDifferent = uniqueValues.size > 1;
      
      // 数值类型计算统计
      let stats: any = {};
      if (attr.type === 'NUMBER' || attr.type === 'DECIMAL') {
        const nums = values.map(v => Number(v)).filter(n => !isNaN(n));
        if (nums.length > 0) {
          stats = {
            min: Math.min(...nums),
            max: Math.max(...nums),
            diff: Math.max(...nums) - Math.min(...nums),
          };
        }
      }
      
      return {
        ...attr,
        values,
        isDifferent,
        ...stats,
      };
    });
    
    // 5. 构建评分对比
    const scores = {
      marketScore: products.map(p => p.scoreDetails[0]?.marketScore || 0),
      competitionScore: products.map(p => p.scoreDetails[0]?.competitionScore || 0),
      profitScore: products.map(p => p.scoreDetails[0]?.profitScore || 0),
      supplyScore: products.map(p => p.scoreDetails[0]?.supplyScore || 0),
      riskScore: products.map(p => p.scoreDetails[0]?.riskScore || 0),
      totalScore: products.map(p => p.scoreDetails[0]?.totalScore || 0),
    };
    
    // 6. 价格对比
    const prices = products.map(p => p.marketAnalysis?.suggestedPrice || 0).filter(p => p > 0);
    const priceComparison = {
      suggestedPrice: products.map(p => p.marketAnalysis?.suggestedPrice || 0),
      min: prices.length > 0 ? Math.min(...prices) : 0,
      max: prices.length > 0 ? Math.max(...prices) : 0,
      diff: prices.length > 0 ? Math.max(...prices) - Math.min(...prices) : 0,
    };
    
    // 7. 构建摘要
    const maxScore = Math.max(...scores.totalScore);
    const bestProduct = products.find((p, i) => scores.totalScore[i] === maxScore)!;
    const minPrice = priceComparison.min > 0 ? priceComparison.min : Infinity;
    const lowestPriceProduct = products.find((p, i) => 
      priceComparison.suggestedPrice[i] === minPrice
    )!;
    
    const differentCount = comparisonAttributes.filter(a => a.isDifferent).length;
    
    return {
      products: products.map(p => ({
        id: p.id,
        title: p.title,
        brand: p.brand,
        category: p.category,
        basicInfo: p.basicInfo,
        latestScore: p.scoreDetails[0] || null,
        marketAnalysis: p.marketAnalysis,
      })),
      comparison: {
        attributes: comparisonAttributes,
        scores,
        priceComparison,
      },
      summary: {
        bestScore: {
          productId: bestProduct.id,
          title: bestProduct.title,
          totalScore: maxScore,
        },
        lowestPrice: {
          productId: lowestPriceProduct?.id || '',
          title: lowestPriceProduct?.title || '',
          price: minPrice === Infinity ? 0 : minPrice,
        },
        commonAttributes: comparisonAttributes.length - differentCount,
        differentAttributes: differentCount,
      },
    };
  }
}
```

#### 3.2.3 前端对比表格组件

```typescript
// components/product-comparison-table.tsx

'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ComparisonTableProps {
  data: ComparisonResult;
}

export function ProductComparisonTable({ data }: ComparisonTableProps) {
  const [highlightDiff, setHighlightDiff] = useState(true);
  
  return (
    <div className="w-full overflow-auto">
      <div className="mb-4 flex items-center gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={highlightDiff}
            onChange={(e) => setHighlightDiff(e.target.checked)}
          />
          高亮差异
        </label>
        <Button onClick={() => handleExport('pdf')}>导出 PDF</Button>
        <Button onClick={() => handleExport('excel')}>导出 Excel</Button>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px] sticky left-0 bg-background z-10">
              属性
            </TableHead>
            {data.products.map((product) => (
              <TableHead key={product.id} className="min-w-[150px]">
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">{product.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {product.brand}
                  </span>
                  {data.summary.bestScore.productId === product.id && (
                    <Badge variant="default">评分最高</Badge>
                  )}
                  {data.summary.lowestPrice.productId === product.id && (
                    <Badge variant="secondary">价格最低</Badge>
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        
        <TableBody>
          {/* 基础信息 */}
          <TableRow>
            <TableCell className="font-medium">品类</TableCell>
            {data.products.map((p) => (
              <TableCell key={p.id}>{p.category.name}</TableCell>
            ))}
          </TableRow>
          
          <TableRow>
            <TableCell className="font-medium">品牌</TableCell>
            {data.products.map((p) => (
              <TableCell key={p.id}>{p.brand || '-'}</TableCell>
            ))}
          </TableRow>
          
          {/* 动态属性 */}
          {data.comparison.attributes.map((attr) => (
            <TableRow
              key={attr.code}
              className={highlightDiff && attr.isDifferent ? 'bg-yellow-50' : ''}
            >
              <TableCell className="font-medium">
                {attr.name}
                {attr.unit && <span className="text-muted-foreground ml-1">({attr.unit})</span>}
              </TableCell>
              {attr.values.map((value, idx) => (
                <TableCell key={idx}>
                  {value || '-'}
                </TableCell>
              ))}
            </TableRow>
          ))}
          
          {/* 评分 */}
          <TableRow className="bg-muted/50">
            <TableCell colSpan={data.products.length + 1} className="font-semibold">
              评分详情
            </TableCell>
          </TableRow>
          
          <TableRow>
            <TableCell className="font-medium">市场评分</TableCell>
            {data.comparison.scores.marketScore.map((score, idx) => (
              <TableCell key={idx}>
                {score}
                {idx === data.comparison.scores.marketScore.indexOf(Math.max(...data.comparison.scores.marketScore)) && ' ⭐'}
              </TableCell>
            ))}
          </TableRow>
          
          <TableRow>
            <TableCell className="font-medium">综合评分</TableCell>
            {data.comparison.scores.totalScore.map((score, idx) => (
              <TableCell key={idx} className="font-semibold">
                {score}
                {score === Math.max(...data.comparison.scores.totalScore) && ' 🏆'}
              </TableCell>
            ))}
          </TableRow>
          
          {/* 价格 */}
          <TableRow className="bg-muted/50">
            <TableCell colSpan={data.products.length + 1} className="font-semibold">
              价格对比
            </TableCell>
          </TableRow>
          
          <TableRow>
            <TableCell className="font-medium">建议售价</TableCell>
            {data.comparison.priceComparison.suggestedPrice.map((price, idx) => (
              <TableCell key={idx}>
                ${price.toFixed(2)}
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
      
      {/* 摘要 */}
      <div className="mt-6 p-4 border rounded-lg bg-muted/30">
        <h3 className="font-semibold mb-2">对比摘要</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-muted-foreground">评分最高:</span>
            <span className="ml-2 font-medium">{data.summary.bestScore.title}</span>
            <span className="ml-2">({data.summary.bestScore.totalScore}分)</span>
          </div>
          <div>
            <span className="text-muted-foreground">价格最低:</span>
            <span className="ml-2 font-medium">{data.summary.lowestPrice.title}</span>
            <span className="ml-2">(${data.summary.lowestPrice.price.toFixed(2)})</span>
          </div>
          <div>
            <span className="text-muted-foreground">相同属性:</span>
            <span className="ml-2">{data.summary.commonAttributes}</span>
          </div>
          <div>
            <span className="text-muted-foreground">差异属性:</span>
            <span className="ml-2">{data.summary.differentAttributes}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 3.3 评分系统

#### 3.3.1 评分计算逻辑

```typescript
// services/score-calculator.ts

interface ScoreDimensions {
  marketScore: number;      // 市场评分 0-100
  competitionScore: number; // 竞争评分 0-100
  profitScore: number;      // 利润评分 0-100
  supplyScore: number;      // 供应链评分 0-100
  riskScore: number;        // 风险评分 0-100（越低越好）
}

interface ScoreWeights {
  marketWeight: number;      // 默认 0.25
  competitionWeight: number; // 默认 0.20
  profitWeight: number;      // 默认 0.25
  supplyWeight: number;      // 默认 0.15
  riskWeight: number;        // 默认 0.15
}

interface ScoreResult {
  totalScore: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'CAUTION' | 'AVOID';
}

const DEFAULT_WEIGHTS: ScoreWeights = {
  marketWeight: 0.25,
  competitionWeight: 0.20,
  profitWeight: 0.25,
  supplyWeight: 0.15,
  riskWeight: 0.15,
};

export class ScoreCalculator {
  /**
   * 计算综合评分
   * 注意：riskScore 是反向指标（越低越好），需要转换
   */
  static calculate(
    dimensions: ScoreDimensions,
    weights: ScoreWeights = DEFAULT_WEIGHTS
  ): ScoreResult {
    // 风险评分转换：100 - riskScore（转为正向指标）
    const adjustedRiskScore = 100 - dimensions.riskScore;
    
    // 加权平均
    const totalScore = 
      dimensions.marketScore * weights.marketWeight +
      dimensions.competitionScore * weights.competitionWeight +
      dimensions.profitScore * weights.profitWeight +
      dimensions.supplyScore * weights.supplyWeight +
      adjustedRiskScore * weights.riskWeight;
    
    // 四舍五入保留 2 位小数
    const roundedScore = Math.round(totalScore * 100) / 100;
    
    // 确定等级
    const grade = this.calculateGrade(roundedScore);
    
    // 确定推荐意见
    const recommendation = this.calculateRecommendation(roundedScore);
    
    return {
      totalScore: roundedScore,
      grade,
      recommendation,
    };
  }
  
  private static calculateGrade(score: number): ScoreResult['grade'] {
    if (score >= 90) return 'S';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    return 'D';
  }
  
  private static calculateRecommendation(score: number): ScoreResult['recommendation'] {
    if (score >= 85) return 'STRONG_BUY';
    if (score >= 75) return 'BUY';
    if (score >= 65) return 'HOLD';
    if (score >= 55) return 'CAUTION';
    return 'AVOID';
  }
  
  /**
   * 根据市场分析数据自动计算市场评分
   */
  static calculateMarketScore(market: {
    marketGrowth?: number | null;
    demandLevel?: string;
    marketTrend?: string;
  }): number {
    let score = 50; // 基础分
    
    // 市场增长率评分
    if (market.marketGrowth !== null && market.marketGrowth !== undefined) {
      const growth = market.marketGrowth;
      if (growth >= 20) score += 25;
      else if (growth >= 15) score += 20;
      else if (growth >= 10) score += 15;
      else if (growth >= 5) score += 10;
      else if (growth > 0) score += 5;
      else score -= 10;
    }
    
    // 需求等级评分
    const demandScores: Record<string, number> = {
      'VERY_HIGH': 25,
      'HIGH': 20,
      'MEDIUM': 10,
      'LOW': -10,
      'VERY_LOW': -20,
    };
    if (market.demandLevel && demandScores[market.demandLevel]) {
      score += demandScores[market.demandLevel];
    }
    
    // 市场趋势评分
    const trendScores: Record<string, number> = {
      'GROWING': 15,
      'STABLE': 5,
      'VOLATILE': -5,
      'DECLINING': -15,
    };
    if (market.marketTrend && trendScores[market.marketTrend]) {
      score += trendScores[market.marketTrend];
    }
    
    // 限制在 0-100 范围
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * 根据竞品分析数据自动计算竞争评分
   */
  static calculateCompetitionScore(competition: {
    competitionLevel?: string;
    pricePosition?: string;
  }): number {
    let score = 50;
    
    const levelScores: Record<string, number> = {
      'VERY_LOW': 25,
      'LOW': 15,
      'MEDIUM': 0,
      'HIGH': -15,
      'VERY_HIGH': -25,
    };
    if (competition.competitionLevel && levelScores[competition.competitionLevel]) {
      score += levelScores[competition.competitionLevel];
    }
    
    return Math.max(0, Math.min(100, score));
  }
}
```

### 3.4 导出功能

#### 3.4.1 PDF 导出服务

```typescript
// services/export/pdf-exporter.ts

import PDFDocument from 'pdfkit';
import { Response } from 'express';

interface ExportOptions {
  products: any[];
  comparison: any;
  includeImages: boolean;
  includeScores: boolean;
  includeMarketAnalysis: boolean;
}

export class PdfExporter {
  async generate(options: ExportOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });
      
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      // 标题
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('产品对比报告', { align: 'center' })
        .moveDown(0.5);
      
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`生成时间：${new Date().toLocaleString('zh-CN')}`, { align: 'center' })
        .moveDown(1);
      
      // 产品列表
      doc.fontSize(14).font('Helvetica-Bold').text('对比产品');
      options.products.forEach((product, idx) => {
        doc
          .fontSize(11)
          .font('Helvetica')
          .text(`${idx + 1}. ${product.title} (${product.brand || '无品牌'})`, { indent: 20 });
      });
      doc.moveDown(0.5);
      
      // 对比表格
      doc.fontSize(14).font('Helvetica-Bold').text('属性对比');
      doc.moveDown(0.5);
      
      // 表格头
      const tableTop = doc.y;
      const pageWidth = doc.page.width - 100;
      const colWidth = pageWidth / (options.products.length + 1);
      
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('属性', 50, tableTop, { width: colWidth });
      options.products.forEach((p, idx) => {
        doc.text(p.title, 50 + colWidth * (idx + 1), tableTop, { width: colWidth });
      });
      
      // 表格内容
      let y = tableTop + 20;
      doc.font('Helvetica');
      
      options.comparison.attributes.slice(0, 20).forEach((attr: any) => {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        
        doc.text(attr.name, 50, y, { width: colWidth });
        attr.values.forEach((value: any, idx: number) => {
          doc.text(value || '-', 50 + colWidth * (idx + 1), y, { width: colWidth });
        });
        y += 20;
      });
      
      // 评分对比
      if (options.includeScores) {
        doc.addPage();
        doc.fontSize(14).font('Helvetica-Bold').text('评分对比').moveDown(0.5);
        
        const scoreLabels = [
          { key: 'marketScore', label: '市场评分' },
          { key: 'competitionScore', label: '竞争评分' },
          { key: 'profitScore', label: '利润评分' },
          { key: 'supplyScore', label: '供应链评分' },
          { key: 'riskScore', label: '风险评分' },
          { key: 'totalScore', label: '综合评分' },
        ];
        
        scoreLabels.forEach((item) => {
          doc.fontSize(11).font('Helvetica-Bold').text(`${item.label}:`, { indent: 20 });
          options.products.forEach((p, idx) => {
            const score = options.comparison.scores[item.key][idx];
            doc.fontSize(11).font('Helvetica').text(`${score}分`, { indent: 40 });
          });
          doc.moveDown(0.3);
        });
      }
      
      // 摘要
      doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').text('对比摘要').moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(`评分最高：${options.summary.bestScore.title} (${options.summary.bestScore.totalScore}分)`, { indent: 20 });
      doc.text(`价格最低：${options.summary.lowestPrice.title} ($${options.summary.lowestPrice.price.toFixed(2)})`, { indent: 20 });
      doc.text(`相同属性：${options.summary.commonAttributes}`, { indent: 20 });
      doc.text(`差异属性：${options.summary.differentAttributes}`, { indent: 20 });
      
      doc.end();
    });
  }
}
```

#### 3.4.2 Excel 导出服务

```typescript
// services/export/excel-exporter.ts

import ExcelJS from 'exceljs';

interface ExportOptions {
  products: any[];
  comparison: any;
}

export class ExcelExporter {
  async generate(options: ExportOptions): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Trade ERP';
    workbook.created = new Date();
    
    // 工作表 1：对比总览
    const overviewSheet = workbook.addWorksheet('对比总览');
    
    // 表头
    const headers = ['属性', ...options.products.map(p => p.title)];
    overviewSheet.addRow(headers);
    
    // 基础信息行
    overviewSheet.addRow(['品类', ...options.products.map(p => p.category.name)]);
    overviewSheet.addRow(['品牌', ...options.products.map(p => p.brand || '-')]);
    overviewSheet.addRow(['状态', ...options.products.map(p => p.status)]);
    
    // 动态属性
    options.comparison.attributes.forEach((attr: any) => {
      overviewSheet.addRow([attr.name, ...attr.values.map((v: any) => v || '-')]);
    });
    
    // 评分
    overviewSheet.addRow([]);
    overviewSheet.addRow(['市场评分', ...options.comparison.scores.marketScore]);
    overviewSheet.addRow(['竞争评分', ...options.comparison.scores.competitionScore]);
    overviewSheet.addRow(['利润评分', ...options.comparison.scores.profitScore]);
    overviewSheet.addRow(['供应链评分', ...options.comparison.scores.supplyScore]);
    overviewSheet.addRow(['风险评分', ...options.comparison.scores.riskScore]);
    overviewSheet.addRow(['综合评分', ...options.comparison.scores.totalScore]);
    
    // 工作表 2：市场分析
    const marketSheet = workbook.addWorksheet('市场分析');
    marketSheet.addRow(['产品', '市场规模', '增长率', '趋势', '需求等级', '建议售价']);
    options.products.forEach(p => {
      marketSheet.addRow([
        p.title,
        p.marketAnalysis?.marketSize || '-',
        p.marketAnalysis?.marketGrowth || '-',
        p.marketAnalysis?.marketTrend || '-',
        p.marketAnalysis?.demandLevel || '-',
        p.marketAnalysis?.suggestedPrice || '-',
      ]);
    });
    
    // 样式设置
    overviewSheet.getRow(1).font = { bold: true };
    overviewSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    
    // 列宽
    overviewSheet.columns.forEach(col => {
      col.width = 20;
    });
    
    // 生成 Buffer
    return await workbook.xlsx.writeBuffer();
  }
}
```

---

## 4. 目录结构

```
trade-erp/
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   └── product-research/
│   │   │       ├── page.tsx                    # 产品列表页
│   │   │       ├── [id]/
│   │   │       │   ├── page.tsx                # 产品详情页
│   │   │       │   ├── edit/
│   │   │       │   │   └── page.tsx            # 编辑页
│   │   │       │   └── score/
│   │   │       │       └── page.tsx            # 评分页
│   │   │       ├── create/
│   │   │       │   └── page.tsx                # 创建页
│   │   │       └── compare/
│   │   │           └── page.tsx                # 对比页
│   │   └── api/
│   │       └── v1/
│   │           ├── categories/
│   │           │   ├── route.ts
│   │           │   └── [id]/
│   │           │       ├── route.ts
│   │           │       └── attributes/
│   │           │           └── route.ts
│   │           ├── product-research/
│   │           │   ├── route.ts
│   │           │   ├── [id]/
│   │           │   │   ├── route.ts
│   │           │   │   ├── attributes/
│   │           │   │   │   └── route.ts
│   │           │   │   ├── scores/
│   │           │   │   │   └── route.ts
│   │           │   │   └── attachments/
│   │           │   │       └── route.ts
│   │           │   └── compare/
│   │           │       ├── route.ts
│   │           │       └── export/
│   │           │           └── route.ts
│   │           └── stock-plans/
│   │               └── route.ts
│   ├── components/
│   │   └── product-research/
│   │       ├── product-list.tsx
│   │       ├── product-form.tsx
│   │       ├── product-detail.tsx
│   │       ├── attribute-editor.tsx
│   │       ├── comparison-table.tsx
│   │       ├── score-form.tsx
│   │       └── attachment-uploader.tsx
│   ├── services/
│   │   └── product-research/
│   │       ├── category-service.ts
│   │       ├── research-service.ts
│   │       ├── compare-service.ts
│   │       ├── score-service.ts
│   │       ├── attribute-validator.ts
│   │       └── export/
│   │           ├── pdf-exporter.ts
│   │           └── excel-exporter.ts
│   └── lib/
│       └── prisma.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
└── docs/
    └── architecture/
        ├── PRODUCT_RESEARCH_DATABASE.md
        ├── PRODUCT_RESEARCH_API.md
        └── PRODUCT_RESEARCH_TECHNICAL.md
```

---

## 5. 开发计划

### 5.1 阶段划分

| 阶段 | 内容 | 工期 | 优先级 |
|------|------|------|--------|
| Phase 1 | 数据库设计与迁移 | 2 天 | P0 |
| Phase 2 | 品类管理 API | 2 天 | P0 |
| Phase 3 | 产品调研 CRUD API | 3 天 | P0 |
| Phase 4 | 属性值管理 API | 2 天 | P0 |
| Phase 5 | 产品对比 API | 2 天 | P1 |
| Phase 6 | 评分系统 API | 2 天 | P1 |
| Phase 7 | 前端 - 品类管理 | 2 天 | P0 |
| Phase 8 | 前端 - 产品调研列表/详情 | 3 天 | P0 |
| Phase 9 | 前端 - 产品创建/编辑 | 3 天 | P0 |
| Phase 10 | 前端 - 产品对比 | 3 天 | P1 |
| Phase 11 | 前端 - 评分管理 | 2 天 | P1 |
| Phase 12 | 导出功能 | 2 天 | P2 |
| Phase 13 | 测试与优化 | 3 天 | P0 |

**总工期:** 约 31 个工作日

### 5.2 里程碑

| 里程碑 | 交付内容 | 时间 |
|--------|----------|------|
| M1 | 数据库 Schema 完成，API 基础框架 | Week 1 |
| M2 | 核心 API 完成（品类 + 产品 CRUD） | Week 2 |
| M3 | 对比 + 评分 API 完成 | Week 3 |
| M4 | 前端核心功能完成 | Week 5 |
| M5 | 导出功能 + 测试完成 | Week 6 |

---

## 6. 测试策略

### 6.1 单元测试

```typescript
// __tests__/services/compare-service.test.ts

import { CompareService } from '@/services/product-research/compare-service';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma');

describe('CompareService', () => {
  let compareService: CompareService;
  
  beforeEach(() => {
    compareService = new CompareService();
  });
  
  describe('compare', () => {
    it('should throw error when less than 2 products', async () => {
      await expect(compareService.compare({ productIds: ['id1'] }))
        .rejects.toThrow('至少需要 2 个产品进行对比');
    });
    
    it('should throw error when more than 10 products', async () => {
      const ids = Array(11).fill('id');
      await expect(compareService.compare({ productIds: ids }))
        .rejects.toThrow('最多支持 10 个产品对比');
    });
    
    it('should return comparison result with 2 products', async () => {
      // Mock prisma query
      (prisma.productResearch.findMany as jest.Mock).mockResolvedValue([
        { /* product 1 */ },
        { /* product 2 */ },
      ]);
      
      const result = await compareService.compare({
        productIds: ['id1', 'id2'],
      });
      
      expect(result.products).toHaveLength(2);
      expect(result.comparison.attributes).toBeDefined();
      expect(result.summary).toBeDefined();
    });
  });
});
```

### 6.2 集成测试

```typescript
// __tests__/api/product-research.test.ts

import { createTestClient } from '@/test/utils';
import { prisma } from '@/lib/prisma';

describe('Product Research API', () => {
  let client: ReturnType<typeof createTestClient>;
  
  beforeEach(async () => {
    client = createTestClient();
    // Seed test data
    await prisma.productCategory.create({ /* ... */ });
  });
  
  afterEach(async () => {
    // Cleanup
    await prisma.productResearch.deleteMany();
  });
  
  describe('GET /api/v1/product-research', () => {
    it('should return paginated list', async () => {
      const response = await client.get('/api/v1/product-research');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();
      expect(response.body.data.pagination).toBeDefined();
    });
    
    it('should filter by category', async () => {
      const response = await client.get('/api/v1/product-research?categoryId=xxx');
      
      expect(response.status).toBe(200);
      response.body.data.items.forEach((item: any) => {
        expect(item.categoryId).toBe('xxx');
      });
    });
  });
  
  describe('GET /api/v1/product-research/compare', () => {
    it('should return comparison result', async () => {
      const response = await client.get('/api/v1/product-research/compare?ids=id1,id2');
      
      expect(response.status).toBe(200);
      expect(response.body.data.products).toHaveLength(2);
      expect(response.body.data.comparison).toBeDefined();
    });
  });
});
```

---

## 7. 性能优化

### 7.1 数据库查询优化

```typescript
// ❌ 低效：N+1 查询
const products = await prisma.productResearch.findMany({ where: { ... } });
for (const product of products) {
  const attributes = await prisma.productAttributeValue.findMany({
    where: { productResearchId: product.id },
  });
}

// ✅ 高效：批量加载
const products = await prisma.productResearch.findMany({
  where: { ... },
  include: {
    attributeValues: {
      include: { attribute: true },
    },
  },
});
```

### 7.2 缓存策略

```typescript
// 品类树缓存（Redis）
async function getCategoryTree(): Promise<CategoryNode[]> {
  const cached = await redis.get('category_tree');
  if (cached) {
    return JSON.parse(cached);
  }
  
  const tree = await buildCategoryTree();
  await redis.setex('category_tree', 3600, JSON.stringify(tree));
  return tree;
}

// 产品详情缓存
async function getProductDetail(id: string): Promise<ProductDetail> {
  const cached = await redis.get(`product:${id}`);
  if (cached) {
    return JSON.parse(cached);
  }
  
  const detail = await prisma.productResearch.findUnique({
    where: { id },
    include: { /* ... */ },
  });
  
  await redis.setex(`product:${id}`, 300, JSON.stringify(detail));
  return detail;
}
```

---

## 8. 安全考虑

### 8.1 权限控制

```typescript
// middleware/auth.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getUserPermissions } from '@/services/user-service';

export async function authMiddleware(
  request: NextRequest,
  handler: (req: NextRequest, user: any) => Promise<Response>
) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: '未认证' },
      { status: 401 }
    );
  }
  
  const user = await verifyToken(token);
  if (!user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Token 无效' },
      { status: 401 }
    );
  }
  
  // 获取用户权限
  const permissions = await getUserPermissions(user.id);
  
  // 检查资源权限
  const resource = getResourceFromPath(request.nextUrl.pathname);
  const action = getActionFromMethod(request.method);
  
  if (!permissions.has(`${resource}:${action}`)) {
    return NextResponse.json(
      { success: false, code: 'FORBIDDEN', message: '无权限' },
      { status: 403 }
    );
  }
  
  return handler(request, user);
}
```

### 8.2 数据验证

```typescript
// middleware/validation.ts

import { z } from 'zod';

const createProductSchema = z.object({
  categoryId: z.string().cuid(),
  title: z.string().min(2).max(200),
  titleEn: z.string().max(200).optional(),
  sku: z.string().max(50).optional(),
  brand: z.string().max(100).optional(),
  status: z.enum(['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED']).optional(),
  basicInfo: z.object({
    description: z.string().max(5000).optional(),
    specification: z.string().max(1000).optional(),
    weight: z.number().positive().optional(),
    // ...
  }).optional(),
});

export async function validationMiddleware(
  request: NextRequest,
  schema: z.ZodSchema,
  handler: (req: NextRequest, data: any) => Promise<Response>
) {
  try {
    const body = await request.json();
    const validatedData = schema.parse(body);
    return handler(request, validatedData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          code: 'VALIDATION_ERROR',
          message: '请求参数验证失败',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 422 }
      );
    }
    throw error;
  }
}
```

---

## 9. 监控与日志

### 9.1 关键指标

| 指标 | 说明 | 告警阈值 |
|------|------|----------|
| API 响应时间 | P95 < 500ms | > 1000ms |
| 对比接口响应时间 | P95 < 2000ms | > 5000ms |
| 数据库查询时间 | P95 < 100ms | > 500ms |
| 错误率 | < 1% | > 5% |
| 导出任务成功率 | > 95% | < 90% |

### 9.2 日志记录

```typescript
// lib/logger.ts

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
    },
  },
});

// 使用示例
logger.info({
  event: 'PRODUCT_CREATED',
  productId: product.id,
  userId: user.id,
  title: product.title,
}, '产品创建成功');

logger.error({
  event: 'COMPARE_FAILED',
  productIds,
  error: error.message,
  stack: error.stack,
}, '产品对比失败');
```

---

## 10. 总结

产品调研模块是 Trade ERP 系统的核心业务模块，技术实现的关键点：

1. **EAV 动态属性系统**: 支持不同品类的差异化属性，是模块的核心技术
2. **产品对比引擎**: 后端聚合查询 + 前端差异高亮，提供直观的对比体验
3. **量化评分系统**: 多维度评分模型，支持版本化管理
4. **多格式导出**: PDF/Excel对比报告，便于分享和存档

模块采用 Next.js 16 + Prisma + PostgreSQL 技术栈，遵循 RESTful API 设计规范，预计 6 周完成全部开发和测试。

---

*文档结束*
