import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ConflictResolution, Pair, ToastData, TypeSettings } from '../types';
import { DEFAULT_TYPE, UNCATEGORIZED } from '../types';
import { applyImport, uid } from '../lib/library';
import { loadLibrary, saveLibrary } from '../lib/storage';
import { seedPairs } from '../seed';

interface UndoEntry {
  label: string;
  pairs: Pair[];
}

const UNDO_LIMIT = 20;
const TOAST_DURATION = 5200;

export interface LibraryState {
  pairs: Pair[];
  toast: ToastData | null;
  canUndo: boolean;
  notify: (message: string) => void;
  createPair: (input: { title: string; category: string; heading: string; body: string }) => Pair;
  editPair: (id: string, patch: { title?: string; category?: string; heading?: string; body?: string }) => void;
  updateType: (id: string, patch: Partial<TypeSettings>) => void;
  toggleFavorite: (id: string) => void;
  duplicatePair: (id: string) => Pair | null;
  removePair: (id: string) => void;
  importPairs: (incoming: Pair[], resolutions: Map<string, ConflictResolution>) => void;
  renameCategory: (from: string, to: string) => void;
  deleteCategory: (name: string) => void;
  undo: () => void;
  dismissToast: () => void;
}

/**
 * 方案库状态中枢。
 * 撤销采用快照：移除 / 覆盖 / 批量导入 / 分类删除前先把整库压栈，
 * toast 提供「撤销」入口，恢复时整体回滚。
 * 所有 action 基于当前 pairs 计算后直接 setState，updater 保持纯净（StrictMode 安全）。
 */
export function useLibrary(): LibraryState {
  const [initial] = useState(() => {
    const now = Date.now();
    const loaded = loadLibrary(now);
    return { now, loaded };
  });
  const [pairs, setPairs] = useState<Pair[]>(() => {
    const { loaded, now } = initial;
    if (loaded.pairs.length > 0 || loaded.corrupted) return loaded.pairs;
    return seedPairs(now);
  });
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  // ref 镜像：toast 里的「撤销」闭包可能跨多次渲染被点击，必须读到最新栈
  const undoStackRef = useRef<UndoEntry[]>([]);
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const corruptedRef = useRef(initial.loaded.corrupted);
  const droppedRef = useRef(initial.loaded.dropped);

  const showToast = useCallback((message: string, action?: ToastData['action']) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, action });
    toastTimer.current = setTimeout(() => setToast(null), TOAST_DURATION);
  }, []);

  // 启动提示：损坏恢复 / 部分条目被丢弃
  useEffect(() => {
    if (corruptedRef.current) {
      showToast('本地数据已损坏，已恢复为可用状态（原数据已备份）');
      corruptedRef.current = false;
    } else if (droppedRef.current > 0) {
      showToast(`有 ${droppedRef.current} 条本地记录格式异常，已被忽略`);
      droppedRef.current = 0;
    }
  }, [showToast]);

  // 持久化：任何变更都写回 localStorage
  useEffect(() => {
    saveLibrary(pairs);
  }, [pairs]);

  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  const pushUndo = useCallback((label: string, snapshot: Pair[]) => {
    undoStackRef.current = [...undoStackRef.current.slice(-(UNDO_LIMIT - 1)), { label, pairs: snapshot }];
    setUndoStack(undoStackRef.current);
  }, []);

  const undo = useCallback(() => {
    const stack = undoStackRef.current;
    const last = stack[stack.length - 1];
    if (!last) return;
    undoStackRef.current = stack.slice(0, -1);
    setUndoStack(undoStackRef.current);
    setPairs(last.pairs);
    showToast(`已撤销：${last.label}`);
  }, [showToast]);

  const createPair: LibraryState['createPair'] = useCallback(
    input => {
      const now = Date.now();
      const pair: Pair = {
        id: uid(),
        title: input.title.trim(),
        heading: input.heading.trim() || 'Your new headline',
        body: input.body.trim() || 'Start with a sentence that lets your type pairing show its character.',
        category: input.category.trim() || UNCATEGORIZED,
        favorite: false,
        ...DEFAULT_TYPE,
        createdAt: now,
        updatedAt: now,
      };
      setPairs([...pairs, pair]);
      showToast(`已创建「${pair.title}」`);
      return pair;
    },
    [pairs, showToast],
  );

  const editPair: LibraryState['editPair'] = useCallback(
    (id, patch) => {
      setPairs(
        pairs.map(p =>
          p.id === id
            ? {
                ...p,
                title: patch.title !== undefined ? patch.title.trim() || p.title : p.title,
                category: patch.category !== undefined ? patch.category.trim() || UNCATEGORIZED : p.category,
                heading: patch.heading !== undefined ? patch.heading : p.heading,
                body: patch.body !== undefined ? patch.body : p.body,
                updatedAt: Date.now(),
              }
            : p,
        ),
      );
    },
    [pairs],
  );

  // 字体 / 字号 / 行高 / 字距：写入方案数据，列表卡片与预览同步刷新。
  // 不触碰 updatedAt，避免拖动滑杆时「最近更新」排序把卡片顶走。
  const updateType: LibraryState['updateType'] = useCallback(
    (id, patch) => {
      setPairs(pairs.map(p => (p.id === id ? { ...p, ...patch } : p)));
    },
    [pairs],
  );

  const toggleFavorite: LibraryState['toggleFavorite'] = useCallback(
    id => {
      setPairs(pairs.map(p => (p.id === id ? { ...p, favorite: !p.favorite } : p)));
    },
    [pairs],
  );

  const duplicatePair: LibraryState['duplicatePair'] = useCallback(
    id => {
      const index = pairs.findIndex(p => p.id === id);
      if (index === -1) return null;
      const source = pairs[index];
      const now = Date.now();
      const copy: Pair = {
        ...source,
        id: uid(),
        title: `${source.title} 副本`,
        favorite: false,
        createdAt: now,
        updatedAt: now,
      };
      setPairs([...pairs.slice(0, index + 1), copy, ...pairs.slice(index + 1)]);
      showToast(`已复制为「${copy.title}」`);
      return copy;
    },
    [pairs, showToast],
  );

  const removePair: LibraryState['removePair'] = useCallback(
    id => {
      const target = pairs.find(p => p.id === id);
      if (!target) return;
      pushUndo(`移除「${target.title}」`, pairs);
      setPairs(pairs.filter(p => p.id !== id));
      showToast(`已移除「${target.title}」`, { label: '撤销', onClick: undo });
    },
    [pairs, pushUndo, showToast, undo],
  );

  const importPairs: LibraryState['importPairs'] = useCallback(
    (incoming, resolutions) => {
      const outcome = applyImport(pairs, incoming, resolutions);
      if (outcome.added + outcome.overwritten === 0) {
        showToast(`已跳过全部 ${outcome.skipped} 条冲突方案，库未变化`);
        return;
      }
      pushUndo(`导入 ${outcome.added + outcome.overwritten} 条方案`, pairs);
      setPairs(outcome.pairs);
      const parts = [`新增 ${outcome.added}`];
      if (outcome.overwritten) parts.push(`覆盖 ${outcome.overwritten}`);
      if (outcome.skipped) parts.push(`跳过 ${outcome.skipped}`);
      showToast(`导入完成：${parts.join(' · ')}`, { label: '撤销', onClick: undo });
    },
    [pairs, pushUndo, showToast, undo],
  );

  const renameCategory: LibraryState['renameCategory'] = useCallback(
    (from, to) => {
      const next = to.trim();
      if (!next || next === from) return;
      pushUndo(`重命名分类「${from}」`, pairs);
      setPairs(pairs.map(p => (p.category === from ? { ...p, category: next, updatedAt: Date.now() } : p)));
      showToast(`分类「${from}」已改为「${next}」`, { label: '撤销', onClick: undo });
    },
    [pairs, pushUndo, showToast, undo],
  );

  const deleteCategory: LibraryState['deleteCategory'] = useCallback(
    name => {
      pushUndo(`删除分类「${name}」`, pairs);
      setPairs(pairs.map(p => (p.category === name ? { ...p, category: UNCATEGORIZED, updatedAt: Date.now() } : p)));
      showToast(`分类「${name}」已删除，方案移至「${UNCATEGORIZED}」`, { label: '撤销', onClick: undo });
    },
    [pairs, pushUndo, showToast, undo],
  );

  return useMemo(
    () => ({
      pairs,
      toast,
      canUndo: undoStack.length > 0,
      notify: showToast,
      createPair,
      editPair,
      updateType,
      toggleFavorite,
      duplicatePair,
      removePair,
      importPairs,
      renameCategory,
      deleteCategory,
      undo,
      dismissToast,
    }),
    [
      pairs,
      toast,
      undoStack.length,
      showToast,
      createPair,
      editPair,
      updateType,
      toggleFavorite,
      duplicatePair,
      removePair,
      importPairs,
      renameCategory,
      deleteCategory,
      undo,
      dismissToast,
    ],
  );
}
