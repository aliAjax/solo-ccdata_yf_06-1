import type {
  ConflictResolution,
  FilterState,
  ImportItemError,
  ImportParseResult,
  Pair,
  TypeSettings,
} from '../types';
import { DEFAULT_TYPE, FONTS, LIMITS, UNCATEGORIZED } from '../types';

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clampType(value: unknown, min: number, max: number, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return clamp(value, min, max);
}

/**
 * 把任意来源的数据规整成合法 Pair。
 * 字段缺失/类型错误时返回 null 并给出原因；数值越界则收敛到合法范围。
 */
export function normalizePair(raw: unknown, now: number): { pair: Pair } | { error: string } {
  if (!isRecord(raw)) return { error: '条目不是对象' };
  if (typeof raw.title !== 'string' || !raw.title.trim()) return { error: '缺少有效的 title（方案名称）' };
  if (raw.heading !== undefined && typeof raw.heading !== 'string') return { error: 'heading 必须是字符串' };
  if (raw.body !== undefined && typeof raw.body !== 'string') return { error: 'body 必须是字符串' };
  if (raw.category !== undefined && typeof raw.category !== 'string') return { error: 'category 必须是字符串' };
  if (raw.favorite !== undefined && typeof raw.favorite !== 'boolean') return { error: 'favorite 必须是布尔值' };

  const numericFields: (keyof TypeSettings)[] = ['size', 'weight', 'leading', 'tracking'];
  for (const key of numericFields) {
    const v = raw[key];
    if (v !== undefined && (typeof v !== 'number' || !Number.isFinite(v))) {
      return { error: `${key} 必须是有限数字` };
    }
  }
  for (const key of ['headingFont', 'bodyFont'] as const) {
    if (raw[key] !== undefined && typeof raw[key] !== 'string') return { error: `${key} 必须是字符串` };
  }

  const createdAt = typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : now;
  const updatedAt = typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : createdAt;
  const headingFont = typeof raw.headingFont === 'string' && (FONTS as readonly string[]).includes(raw.headingFont)
    ? raw.headingFont
    : DEFAULT_TYPE.headingFont;
  const bodyFont = typeof raw.bodyFont === 'string' && (FONTS as readonly string[]).includes(raw.bodyFont)
    ? raw.bodyFont
    : DEFAULT_TYPE.bodyFont;

  return {
    pair: {
      id: typeof raw.id === 'string' && raw.id ? raw.id : typeof raw.id === 'number' ? String(raw.id) : uid(),
      title: raw.title.trim(),
      heading: typeof raw.heading === 'string' ? raw.heading : '',
      body: typeof raw.body === 'string' ? raw.body : '',
      category: typeof raw.category === 'string' && raw.category.trim() ? raw.category.trim() : UNCATEGORIZED,
      favorite: raw.favorite === true,
      headingFont,
      bodyFont,
      size: clampType(raw.size, LIMITS.size.min, LIMITS.size.max, DEFAULT_TYPE.size),
      weight: clampType(raw.weight, LIMITS.weight.min, LIMITS.weight.max, DEFAULT_TYPE.weight),
      leading: clampType(raw.leading, LIMITS.leading.min, LIMITS.leading.max, DEFAULT_TYPE.leading),
      tracking: clampType(raw.tracking, LIMITS.tracking.min, LIMITS.tracking.max, DEFAULT_TYPE.tracking),
      createdAt,
      updatedAt,
    },
  };
}

/** 解析导入文件：支持 { pairs: [...] } 信封或裸数组，逐条校验并检测文件内重复 id。 */
export function parseImport(text: string, existing: Pair[], now: number): ImportParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { valid: [], invalid: [], conflicts: [], fatal: '文件不是有效的 JSON' };
  }
  const list = Array.isArray(data) ? data : isRecord(data) && Array.isArray(data.pairs) ? data.pairs : null;
  if (!list) return { valid: [], invalid: [], conflicts: [], fatal: '未找到方案数组（应为数组或含 pairs 字段的对象）' };
  if (list.length === 0) return { valid: [], invalid: [], conflicts: [], fatal: '文件中没有可导入的方案' };

  const valid: Pair[] = [];
  const invalid: ImportItemError[] = [];
  const seenIds = new Set<string>();
  list.forEach((raw, i) => {
    const result = normalizePair(raw, now);
    if ('error' in result) {
      invalid.push({ index: i + 1, reason: result.error });
      return;
    }
    if (seenIds.has(result.pair.id)) {
      invalid.push({ index: i + 1, reason: `id "${result.pair.id}" 在文件内重复` });
      return;
    }
    seenIds.add(result.pair.id);
    valid.push(result.pair);
  });

  const existingIds = new Set(existing.map(p => p.id));
  const conflicts = valid.filter(p => existingIds.has(p.id)).map(p => p.id);
  return { valid, invalid, conflicts, fatal: null };
}

export interface ImportOutcome {
  pairs: Pair[];
  added: number;
  overwritten: number;
  skipped: number;
}

/** 应用导入：冲突项按 resolutions 逐项处理，整体作为一个可撤销事务。 */
export function applyImport(
  existing: Pair[],
  incoming: Pair[],
  resolutions: Map<string, ConflictResolution>,
): ImportOutcome {
  const pairs = [...existing];
  const indexById = new Map(pairs.map((p, i) => [p.id, i]));
  let added = 0;
  let overwritten = 0;
  let skipped = 0;

  for (const item of incoming) {
    const at = indexById.get(item.id);
    if (at === undefined) {
      pairs.push(item);
      indexById.set(item.id, pairs.length - 1);
      added += 1;
      continue;
    }
    const resolution = resolutions.get(item.id) ?? 'skip';
    if (resolution === 'overwrite') {
      pairs[at] = { ...item, updatedAt: item.updatedAt };
      overwritten += 1;
    } else if (resolution === 'keepBoth') {
      pairs.push({ ...item, id: uid() });
      added += 1;
    } else {
      skipped += 1;
    }
  }
  return { pairs, added, overwritten, skipped };
}

export function filterPairs(pairs: Pair[], filter: FilterState): Pair[] {
  const query = filter.query.trim().toLowerCase();
  const filtered = pairs.filter(p => {
    if (filter.tab === 'favorites' && !p.favorite) return false;
    if (filter.category && p.category !== filter.category) return false;
    if (!query) return true;
    return [p.title, p.heading, p.body, p.category].some(field => field.toLowerCase().includes(query));
  });
  const sorted = [...filtered];
  switch (filter.sort) {
    case 'updated':
      sorted.sort((a, b) => b.updatedAt - a.updatedAt);
      break;
    case 'created':
      sorted.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case 'title':
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'));
      break;
    case 'size':
      sorted.sort((a, b) => b.size - a.size);
      break;
  }
  return sorted;
}

export function categoriesOf(pairs: Pair[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of pairs) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

export function exportJson(pairs: Pair[]): string {
  return JSON.stringify({ app: 'type-pairer', version: 1, exportedAt: new Date().toISOString(), pairs }, null, 2);
}
