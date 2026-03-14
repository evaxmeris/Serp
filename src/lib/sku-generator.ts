/**
 * SKU 生成器
 * 格式：{品类代码}-{年份}{月份}-{序号}
 * 示例：EL-2603-001
 */

import { prisma } from './prisma';

/**
 * 生成产品 SKU
 * @param categoryCode 品类代码（可选）
 */
export async function generateProductSku(categoryCode?: string | null): Promise<string> {
  const now = new Date();
  const yearMonth = now.getFullYear().toString().slice(-2) + (now.getMonth() + 1).toString().padStart(2, '0');
  
  // 获取品类代码（默认使用通用代码）
  const prefix = categoryCode ? categoryCode.toUpperCase().slice(0, 4) : 'GEN';
  
  // 查询本月该品类已生成的 SKU 数量
  const count = await prisma.product.count({
    where: {
      sku: {
        startsWith: `${prefix}-${yearMonth}-`,
      },
    },
  });

  // 生成序号（3 位数字）
  const sequence = (count + 1).toString().padStart(3, '0');
  
  return `${prefix}-${yearMonth}-${sequence}`;
}

/**
 * 验证 SKU 格式
 */
export function validateSku(sku: string): boolean {
  const pattern = /^[A-Z0-9]{2,6}-\d{4}-\d{3,}$/;
  return pattern.test(sku);
}
