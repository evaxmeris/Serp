/**
 * 广告域凭据脱敏工具
 *
 * 依据：docs/advertising-domain-m1-be-design.md §9.2
 *  - 所有账户响应（GET /accounts、POST/PUT /accounts）凭据字段一律过 maskCredential()
 *  - 空值返回 ''（不显示 **** 前缀）
 *  - 写入后不可回读明文：接口层永不调用 decrypt()（解密仅 M2 ApiFetcher 内部使用）
 */

/**
 * 凭据脱敏：`****后4位`；空值/短值返回 '' 或整体打码
 * @param value 原始凭据（密文或明文，仅用于取后 4 位，不回显原文）
 */
export function maskCredential(value: string | null | undefined): string {
  if (!value) return '';
  const v = value.length > 4 ? value.slice(-4) : value;
  return `****${v}`;
}
