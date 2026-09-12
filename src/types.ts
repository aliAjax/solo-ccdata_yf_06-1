/** 单个方案的字体外貌设置 —— 列表卡片与预览画布共用同一份数据，调整即同步。 */
export interface TypeSettings {
  headingFont: string;
  bodyFont: string;
  /** 标题字号 px */
  size: number;
  /** 标题字重 */
  weight: number;
  /** 正文行高 */
  leading: number;
  /** 标题字距 px */
  tracking: number;
}

export interface Pair extends TypeSettings {
  id: string;
  title: string;
  heading: string;
  body: string;
  category: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

export type SortKey = 'updated' | 'created' | 'title' | 'size';

export interface FilterState {
  tab: 'all' | 'favorites';
  /** null 表示不限制分类 */
  category: string | null;
  query: string;
  sort: SortKey;
}

/** 导入时单条冲突的处理方式 */
export type ConflictResolution = 'overwrite' | 'skip' | 'keepBoth';

export interface ImportItemError {
  index: number;
  reason: string;
}

export interface ImportParseResult {
  valid: Pair[];
  invalid: ImportItemError[];
  /** 与现有库 id 冲突的条目 id */
  conflicts: string[];
  fatal: string | null;
}

export interface ToastData {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
}

export const FONTS = [
  'Fraunces',
  'DM Sans',
  'Space Grotesk',
  'Newsreader',
  'IBM Plex Sans',
  'Playfair Display',
] as const;

export const UNCATEGORIZED = '未分类';

export const SORT_LABELS: Record<SortKey, string> = {
  updated: '最近更新',
  created: '最近创建',
  title: '名称 A–Z',
  size: '标题字号',
};

/** 各字体参数的合法范围，导入校验与滑杆共用 */
export const LIMITS = {
  size: { min: 28, max: 76 },
  weight: { min: 300, max: 800, step: 100 },
  leading: { min: 1, max: 1.8 },
  tracking: { min: -1, max: 3 },
} as const;

export const DEFAULT_TYPE: TypeSettings = {
  headingFont: 'Fraunces',
  bodyFont: 'DM Sans',
  size: 46,
  weight: 600,
  leading: 1.25,
  tracking: 0,
};
