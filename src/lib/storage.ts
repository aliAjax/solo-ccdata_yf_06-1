import type { Pair } from '../types';
import { normalizePair } from './library';

const STORAGE_KEY = 'type-pairer:library:v1';
const LEGACY_KEY = 'type-pairs';
const CORRUPT_BACKUP_KEY = 'type-pairer:library:corrupt-backup';

export interface LoadResult {
  pairs: Pair[];
  /** 本地数据无法解析或结构非法，已备份并回退 */
  corrupted: boolean;
  /** 结构可解析但部分条目被丢弃的数量 */
  dropped: number;
  /** 从旧版本键迁移而来 */
  migrated: boolean;
  /** 存储中没有任何记录（首次启动）——只有这时调用方才应放入示例方案 */
  firstRun: boolean;
}

function result(pairs: Pair[], extra: Partial<LoadResult> = {}): LoadResult {
  return { pairs, corrupted: false, dropped: 0, migrated: false, firstRun: false, ...extra };
}

/** 把无法使用的原始数据整体备份到 corrupt-backup 键，并移除坏键避免重复触发 */
function backupCorrupt(raw: string): void {
  try {
    localStorage.setItem(CORRUPT_BACKUP_KEY, raw);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* 存储不可用时静默继续 */
  }
}

function sanitizeList(list: unknown[], now: number): { pairs: Pair[]; dropped: number } {
  const pairs: Pair[] = [];
  const seen = new Set<string>();
  let dropped = 0;
  for (const item of list) {
    const itemResult = normalizePair(item, now);
    if ('error' in itemResult) {
      dropped += 1;
      continue;
    }
    if (seen.has(itemResult.pair.id)) {
      dropped += 1;
      continue;
    }
    seen.add(itemResult.pair.id);
    pairs.push(itemResult.pair);
  }
  return { pairs, dropped };
}

/**
 * 读取本地方案库。
 * - 存储中没有任何记录 → firstRun（由调用方决定是否放入示例）；
 * - JSON 无法解析、外层结构不符、pairs 非数组、或列表非空但全部条目非法
 *   → 原始数据备份到 corrupt-backup 键，回退为空库并标记 corrupted；
 * - 部分条目非法 → 保留合法条目、备份原始数据、报告 dropped；
 * - 旧版 `type-pairs` 键：自动迁移到新格式；
 * - 任何异常都不会抛出，保证界面总能渲染。
 */
export function loadLibrary(now: number): LoadResult {
  let raw: string | null = null;
  let migrated = false;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy !== null) {
        raw = legacy;
        migrated = true;
      }
    }
  } catch {
    return result([], { firstRun: true });
  }

  // 没有任何记录 → 首次启动
  if (raw === null || raw.trim() === '') return result([], { firstRun: true });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    backupCorrupt(raw);
    return result([], { corrupted: true });
  }

  // 外层结构必须是方案数组或含 pairs 数组的信封，否则视为结构损坏
  const list = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { pairs?: unknown }).pairs)
      ? (parsed as { pairs: unknown[] }).pairs
      : null;
  if (list === null) {
    backupCorrupt(raw);
    return result([], { corrupted: true });
  }

  const { pairs, dropped } = sanitizeList(list, now);
  if (list.length > 0 && pairs.length === 0) {
    // 列表非空但全部条目字段非法 → 整体不可用，按损坏处理（备份 + 提示）。
    // 注意 dropped 置 0：corrupted 与 dropped 互斥，保证只弹出「已损坏」一种提示。
    backupCorrupt(raw);
    return result([], { corrupted: true });
  }
  if (dropped > 0) {
    // 部分条目被丢弃：备份原始数据，避免静默丢失
    backupCorrupt(raw);
    return result(pairs, { dropped, migrated });
  }
  return result(pairs, { migrated });
}

export function saveLibrary(pairs: Pair[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, pairs }));
    localStorage.removeItem(LEGACY_KEY);
    return true;
  } catch {
    return false;
  }
}
