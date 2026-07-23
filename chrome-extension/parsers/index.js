/**
 * 平台检测工具
 */

export function detectPlatform(url) {
  if (!url) return 'unknown';
  if (url.includes('alibaba.com')) return 'alibaba';
  if (url.includes('1688.com')) return '1688';
  return 'unknown';
}

export function getPlatformName(platform) {
  const names = {
    alibaba: '阿里国际站',
    '1688': '1688',
    unknown: '未知平台',
  };
  return names[platform] || platform;
}
