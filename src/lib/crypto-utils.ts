/**
 * AES-256-GCM 加密工具
 * 
 * 用于 PlatformSyncConfig.credentials 的加密存储。
 * 密钥从 process.env.ENCRYPTION_KEY 获取（32字节 hex 字符串）。
 * 
 * 加密格式: hex(iv:12字节 + ciphertext + authTag:16字节)
 * - 每次加密使用随机 IV，相同明文产生不同密文
 * - GCM 模式提供认证加密，可检测篡改
 * 
 * 降级策略: 如果未设置 ENCRYPTION_KEY，降级为 base64 编码
 * （明文但非裸存），并输出 console.warn 警告。
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM 推荐 12 字节（96 位）
const TAG_LENGTH = 16; // GCM 认证标签 16 字节（128 位）
const KEY_LENGTH = 32; // AES-256 密钥 32 字节

/**
 * 获取加密密钥
 * 从环境变量 ENCRYPTION_KEY 读取，期望 32 字节 hex 字符串（64个hex字符）
 */
function getEncryptionKey(): Buffer | null {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    return null;
  }
  try {
    return Buffer.from(keyHex, 'hex');
  } catch {
    return null;
  }
}

/**
 * 加密文本（AES-256-GCM）
 * 
 * @param text - 要加密的明文
 * @returns hex 编码的加密数据（iv + ciphertext + authTag）
 * 
 * 如果未设置 ENCRYPTION_KEY，降级为 base64 编码 + 警告
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();

  if (!key) {
    // 降级：base64 编码（明文但非裸存）
    console.warn(
      '[CryptoUtils] ENCRYPTION_KEY 未设置或格式不正确，降级为 base64 编码（非加密）'
    );
    return `base64:${Buffer.from(text, 'utf-8').toString('base64')}`;
  }

  // 生成随机 IV
  const iv = crypto.randomBytes(IV_LENGTH);

  // 创建加密器
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // 加密
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf-8'),
    cipher.final(),
  ]);

  // 获取认证标签
  const authTag = cipher.getAuthTag();

  // 返回 hex 编码: iv + ciphertext + authTag
  const result = Buffer.concat([iv, encrypted, authTag]);
  return result.toString('hex');
}

/**
 * 解密文本（AES-256-GCM）
 * 
 * @param encryptedHex - hex 编码的加密数据，或 base64: 前缀的降级数据
 * @returns 解密后的明文
 * 
 * 兼容处理:
 * - 如果以 "base64:" 开头，执行 base64 解码
 * - 如果是纯 hex 字符串，执行 AES-256-GCM 解密
 * - 如果解密失败且看起来像 JSON 对象（遗留明文数据），直接返回
 */
export function decrypt(encryptedHex: string): string {
  // 处理降级的 base64 编码数据
  if (encryptedHex.startsWith('base64:')) {
    try {
      return Buffer.from(encryptedHex.slice(7), 'base64').toString('utf-8');
    } catch {
      console.error('[CryptoUtils] base64 解码失败，返回原始数据');
      return encryptedHex;
    }
  }

  const key = getEncryptionKey();

  if (!key) {
    // 未设置密钥时尝试 base64 解码（兼容旧降级数据）
    // 如果不是 base64: 前缀且没有密钥，可能是遗留明文 JSON，直接返回
    console.warn(
      '[CryptoUtils] ENCRYPTION_KEY 未设置，尝试直接返回数据（假设为明文）'
    );
    return encryptedHex;
  }

  try {
    // 解析 hex 编码的数据
    const data = Buffer.from(encryptedHex, 'hex');

    // 提取 IV、密文、认证标签
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(data.length - TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH, data.length - TAG_LENGTH);

    // 创建解密器
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // 解密
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf-8');
  } catch (error) {
    // 解密失败，可能是遗留明文数据（如 JSON 对象字符串）
    console.error(
      '[CryptoUtils] AES 解密失败，可能是遗留明文数据:',
      (error as Error).message
    );
    return encryptedHex;
  }
}

/**
 * 加密 credentials 对象，返回适合存入数据库的值
 * 
 * @param credentials - 凭据对象（如 {appKey: "xxx", appSecret: "yyy"}）
 * @returns 加密后的 hex 字符串（可直接存入 Json 字段）
 */
export function encryptCredentials(
  credentials: Record<string, any> | null | undefined
): string | object {
  if (!credentials || Object.keys(credentials).length === 0) {
    return {};
  }
  const json = JSON.stringify(credentials);
  const encrypted = encrypt(json);
  // 返回字符串本身（Prisma Json 字段可以存储字符串）
  return encrypted;
}

/**
 * 解密从数据库读取的 credentials 值，返回凭据对象
 * 
 * @param storedValue - 从数据库读取的值（可能是加密字符串或遗留的 JSON 对象）
 * @returns 凭据对象
 */
export function decryptCredentials(
  storedValue: any
): Record<string, any> {
  if (!storedValue) {
    return {};
  }

  // 如果已经是对象（遗留明文 JSON 对象），直接返回
  if (typeof storedValue === 'object' && !Array.isArray(storedValue)) {
    // 遗留明文数据，返回时发出警告
    if (Object.keys(storedValue).length > 0) {
      console.warn(
        '[CryptoUtils] 检测到未加密的 credentials 数据，建议重新保存以触发加密'
      );
    }
    return storedValue as Record<string, any>;
  }

  // 如果是字符串，尝试解密
  if (typeof storedValue === 'string') {
    try {
      const decrypted = decrypt(storedValue);
      return JSON.parse(decrypted);
    } catch {
      console.error('[CryptoUtils] credentials 解密或 JSON 解析失败');
      return {};
    }
  }

  return {};
}
