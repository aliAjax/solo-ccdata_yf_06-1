import type { Pair } from '../types';
import { normalizePair } from './library';

const STORAGE_KEY = 'type-pairer:library:v1';
const LEGACY_KEY = 'type-pairs';
const CORRUPT_BACKUP_KEY = 'type-pairer:library:corrupt-backup';

export interface LoadResult {
  pairs: Pair[];
  /** 本地数据无法解析（JSON 损坏或结构不符），已回退 */
  corrupted: boolean;
  /** 结构可解析但部分条目被丢弃的数量 */
  dropped: number;
  /** 从旧版本键迁移而来 */
  migrated: boolean;
}

function sanitize(raw: unknown, now: number): { pairs: Pair[]; dropped: number } {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && raw !== null && Array.isArray((raw as { pairs?: unknown }).pairs)
      ? (raw as { pairs: unknown[] }).pairs
      : null;
  if (!list) return { pairs: [], dropped: 0 };
  const pairs: Pair[] = [];
  const seen = new Set<string>();
  let dropped = 0;
  for (const item of list) {
    const result = normalizePair(item, now);
    if ('error' in result) {
      dropped += 1;
      continue;
    }
    if (seen.has(result.pair.id)) {
      dropped += 1;
      continue;
    }
    seen.add(result.pair.id);
    pairs.push(result.pair);
  }
  return { pairs, dropped };
}

/**
 * 读取本地方案库。
 * - JSON 损坏：原始内容备份到 corrupt-backup 键，回退为空库并标记 corrupted；
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
    return { pairs: [], corrupted: false, dropped: 0, migrated: false };
  }
  if (raw === null || raw.trim() === '') {
    return { pairs: [], corrupted: false, dropped: 0, migrated: false };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    try {
      localStorage.setItem(CORRUPT_BACKUP_KEY, raw);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* 存储不可用时静默继续 */
    }
    return { pairs: [], corrupted: true, dropped: 0, migrated: false };
  }

  const { pairs, dropped } = sanitize(parsed, now);
  const looksValid = Array.isArray(parsed) || (typeof parsed === 'object' && parsed !== null && 'pairs' in parsed);
  return { pairs, corrupted: !looksValid, dropped, migrated };
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
