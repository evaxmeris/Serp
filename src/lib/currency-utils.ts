/**
 * 多币种汇率转换工具
 * 提供精度保证的货币金额换算功能
 */

/**
 * 货币转换函数
 * 使用 Math.round 保证两位小数精度，避免浮点数误差
 *
 * @param amount - 原始金额
 * @param from - 原始币种代码（如 'USD'、'CNY'）
 * @param to - 目标币种代码（如 'USD'、'CNY'）
 * @param rate - 汇率（from → to 的换算比率）
 * @returns 转换后的金额，保留两位小数
 *
 * @example
 * // USD → CNY 按汇率 7.25
 * convertCurrency(100, 'USD', 'CNY', 7.25);
 * // => 725.00
 *
 * @example
 * // CNY → USD 按汇率 0.138
 * convertCurrency(725, 'CNY', 'USD', 0.138);
 * // => 100.05
 */
export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rate: number
): number {
  if (from === to) {
    return Math.round(amount * 100) / 100;
  }
  // 使用 Math.round(amount * rate * 100) / 100 保证两位小数精度
  return Math.round(amount * rate * 100) / 100;
}
