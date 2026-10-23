/**
 * 仓库标识归一化（Warehouse Resolver）
 *
 * 背景：InventoryItem.warehouse 是裸字符串，历史上被写入过三种东西：
 *   1. Warehouse.id（cuid，前端下拉框 value 直接用 wh.id）
 *   2. Warehouse.code（如 SZ-MAIN / ZS001CN）
 *   3. 字面量 'MAIN'（schema 默认值）
 * 同一物理仓因此被拆成多条库存行，库存校验（getAvailableQty）查 code 查不到 cuid 行 → 恒为 0。
 *
 * 约定（唯一真源）：
 *   - inventory_items.warehouse / inventory_logs.warehouseId 只写 **仓库编码 code**
 *   - outbound_orders.warehouseId 只写 **仓库主键 id**（前端 detail 页按 id 展示 name）
 *
 * 所有写入/查询库存的入口必须先经过本模块归一化，禁止直接把请求体里的 warehouseId 落库。
 */

import { prisma } from '@/lib/prisma';

export interface ResolvedWarehouse {
  id: string;
  code: string;
  name: string;
}

/** 无法识别的仓库标识（调用方应返回 400 而不是静默写入脏值） */
export class WarehouseNotFoundError extends Error {
  constructor(input: string) {
    super(`仓库不存在或编码无法识别：${input}`);
    this.name = 'WarehouseNotFoundError';
  }
}

/** 视为"主仓"的字面量别名（schema 默认值 'MAIN' 是历史遗留） */
const MAIN_ALIASES = new Set(['MAIN', '主仓', 'MAIN-WH', 'DEFAULT']);

const CACHE_TTL_MS = 30_000;
let cache: { at: number; rows: ResolvedWarehouse[] } | null = null;

async function loadWarehouses(): Promise<ResolvedWarehouse[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.rows;

  const rows = await prisma.warehouse.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  cache = { at: Date.now(), rows };
  return rows;
}

/** 清空缓存（新建仓库 / 迁移脚本中调用） */
export function clearWarehouseCache(): void {
  cache = null;
}

/**
 * 把任意形式的仓库标识归一化为 { id, code, name }
 *
 * 识别顺序：主键 id → 编码（大小写不敏感）→ 主仓别名 → 抛 WarehouseNotFoundError
 */
export async function resolveWarehouse(input: string): Promise<ResolvedWarehouse> {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw) throw new WarehouseNotFoundError(String(input));

  const rows = await loadWarehouses();

  // 1) 主键 id
  const byId = rows.find(w => w.id === raw);
  if (byId) return byId;

  // 2) 编码（大小写不敏感，兼容历史小写/前后空格）
  const upper = raw.toUpperCase();
  const byCode = rows.find(w => w.code.toUpperCase() === upper);
  if (byCode) return byCode;

  // 3) 'MAIN' 等字面量别名 → 主仓：优先 code=MAIN 的仓库，否则取最早创建的在用仓库
  if (MAIN_ALIASES.has(upper)) {
    const explicitMain = rows.find(w => w.code.toUpperCase() === 'MAIN');
    const fallback = explicitMain ?? rows[0];
    if (fallback) return fallback;
  }

  throw new WarehouseNotFoundError(raw);
}

/** 归一化为仓库编码（库存表只认 code） */
export async function resolveWarehouseCode(input: string): Promise<string> {
  return (await resolveWarehouse(input)).code;
}

/**
 * 宽容版：无法识别时返回原值（仅用于查询过滤这类"查不到就空列表"的场景）
 */
export async function resolveWarehouseCodeOrRaw(input: string): Promise<string> {
  try {
    return await resolveWarehouseCode(input);
  } catch {
    return input;
  }
}
