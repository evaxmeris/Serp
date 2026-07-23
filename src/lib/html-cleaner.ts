/**
 * HTML 清洗工具
 * 
 * 用于清洗从阿里国际站、1688 等平台采集的产品描述 HTML，
 * 去除平台痕迹（推荐位、追踪代码、内链等），保留核心产品描述内容。
 */

/**
 * 清洗产品描述 HTML
 * @param html 原始 HTML 字符串
 * @param source 来源平台（"alibaba" | "1688" | "unknown"）
 * @returns 清洗后的 HTML
 */
export function cleanProductHtml(html: string, source: string = 'unknown'): string {
  if (!html) return '';

  let cleaned = html;

  // 1. 移除 <script> 标签及内容
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, '');

  // 2. 移除 <iframe> 标签
  cleaned = cleaned.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');

  // 3. 移除所有行内事件处理器
  cleaned = cleaned.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  cleaned = cleaned.replace(/\s+on\w+\s*=\s*\S+/gi, '');

  // 4. 移除 style 标签（但保留行内 style 属性）
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, '');

  // 5. 移除 noscript 标签
  cleaned = cleaned.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // 6. 移除注释
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // 7. 移除 link 标签
  cleaned = cleaned.replace(/<link[^>]*>/gi, '');

  // 8. 移除 meta 标签
  cleaned = cleaned.replace(/<meta[^>]*>/gi, '');

  // 平台特定清洗
  if (source === '1688' || source === 'alibaba') {
    cleaned = cleanAlibabaGroup(cleaned);
  }

  // 通用清洗
  cleaned = cleanGeneral(cleaned);

  // 清理多余空行
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');

  return cleaned.trim();
}

/**
 * 阿里系平台专用清洗
 */
function cleanAlibabaGroup(html: string): string {
  let cleaned = html;

  // 移除阿里/1688 的推荐模块（根据常见 class/id 特征）
  const alibabaPatterns = [
    // 阿里国际站常见的推荐区域
    /<div[^>]*class=["'][^"']*?(?:recommend|recommended|relate|similar|also-view|also-bought|hot-sale|promotion|advert)[^"']*?["'][\s\S]*?<\/div>/gi,
    // 1688 常见的推荐区域
    /<div[^>]*class=["'][^"']*?(?:guess|like|fav|tj|rcmd|hot-item|sale-box|module-recommend)[^"']*?["'][\s\S]*?<\/div>/gi,
    // 通用推荐标题
    /<h[1-6][^>]*>[\s]*(?:猜你喜欢|推荐产品|相关产品|你可能还喜欢|同类推荐|人气推荐|您可能还喜欢|看了又看|Recommend|Related Products|You May Also Like|Similar Products)[\s]*<\/h[1-6]>/gi,
    // 联系信息区域
    /<div[^>]*class=["'][^"']*?(?:contact|supplier|seller-info|store-info|chat|message-box)[^"']*?["'][\s\S]*?<\/div>/gi,
    // 分享按钮区域
    /<div[^>]*class=["'][^"']*?(?:share|social-share)[^"']*?["'][\s\S]*?<\/div>/gi,
    // 二维码区域
    /<div[^>]*class=["'][^"']*?(?:qrcode|qr-code|erweima|wechat-qr)[^"']*?["'][\s\S]*?<\/div>/gi,
    // 阿里 tracking pixel / 统计图片
    /<img[^>]*(?:trace|track|pixel|analytics|log\.)?(?:alicdn|mmbiz|cookie|beacon)[^>]*>/gi,
    // 阿里 1688 的水印图片特征
    /<img[^>]*class=["'][^"']*?watermark[^"']*?["'][^>]*>/gi,
  ];

  for (const pattern of alibabaPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // 移除指向阿里系站点的外链，但保留文字内容
  cleaned = cleaned.replace(/<a\s[^>]*href=["']https?:\/\/(?:[^"']*\.)?(?:alibaba|1688|taobao|tmall|alipay)\.[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi, '$1');

  // 移除站外图片（阿里 CDN 图片但在清洗后的描述中不应保留）
  // 注意：保留 img 标签本身，只移除指向阿里 CDN 且可能带追踪参数的图片
  // 但保留实际产品图片，这个需要谨慎
  cleaned = cleaned.replace(/<img[^>]*src=["']https?:\/\/[^"']*?(?:trace|log|pixel|beacon)[^"']*?["'][^>]*>/gi, '');

  return cleaned;
}

/**
 * 通用清洗规则
 */
function cleanGeneral(html: string): string {
  let cleaned = html;

  // 移除空白/空的 div 和 p 标签
  cleaned = cleaned.replace(/<div[^>]*>\s*<\/div>/gi, '');
  cleaned = cleaned.replace(/<p[^>]*>\s*<\/p>/gi, '');
  cleaned = cleaned.replace(/<span[^>]*>\s*<\/span>/gi, '');

  // 移除只有空格的标签
  cleaned = cleaned.replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '<br>');

  // 移除多余的 &nbsp;
  cleaned = cleaned.replace(/&nbsp;/g, ' ');

  // 合并连续的空白
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');

  // 移除 data-* 属性（保留标准属性）
  cleaned = cleaned.replace(/\s+data-[a-zA-Z0-9_-]+=["'][^"']*["']/gi, '');
  cleaned = cleaned.replace(/\s+ng-[a-zA-Z0-9_-]+=["'][^"']*["']/gi, '');
  cleaned = cleaned.replace(/\s+v-[a-zA-Z0-9_-]+=["'][^"']*["']/gi, '');
  cleaned = cleaned.replace(/\s*vue-\w+/gi, '');

  // 移除 class 和 id 中明显的追踪标识
  cleaned = cleaned.replace(/\s+class=["'][^"']*?(?:track|pixel|analytics|ga|utm)[^"']*?["']/gi, '');

  return cleaned;
}

/**
 * 从 HTML 中提取纯文本（用于 AI 翻译等场景）
 */
export function extractTextFromHtml(html: string): string {
  if (!html) return '';
  let text = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

/**
 * 判断 HTML 是否包含有效内容（非空、非纯空白标签）
 */
export function hasContent(html: string): boolean {
  if (!html) return false;
  const text = extractTextFromHtml(html);
  return text.length > 10;
}
