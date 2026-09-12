import { ArrowUpDown, Search, X } from 'lucide-react';
import type { FilterState, SortKey } from '../types';
import { SORT_LABELS } from '../types';

interface ToolbarProps {
  filter: FilterState;
  resultCount: number;
  totalCount: number;
  categories: string[];
  onFilterChange: (patch: Partial<FilterState>) => void;
  onClearFilters: () => void;
}

export function Toolbar({ filter, resultCount, totalCount, categories, onFilterChange, onClearFilters }: ToolbarProps) {
  const hasActiveFilter = filter.tab !== 'all' || filter.category !== null || filter.query.trim() !== '';
  return (
    <div className="toolbar">
      <label className="search-box">
        <Search size={14} />
        <input
          type="search"
          value={filter.query}
          placeholder="搜索名称、标题、正文或分类…"
          aria-label="搜索方案"
          onChange={e => onFilterChange({ query: e.target.value })}
        />
        {filter.query && (
          <button className="clear-search" aria-label="清空搜索" onClick={() => onFilterChange({ query: '' })}>
            <X size={13} />
          </button>
        )}
      </label>

      <label className="sort-box">
        <ArrowUpDown size={13} />
        <select
          value={filter.sort}
          aria-label="排序方式"
          onChange={e => onFilterChange({ sort: e.target.value as SortKey })}
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
            <option key={key} value={key}>
              {SORT_LABELS[key]}
            </option>
          ))}
        </select>
      </label>

      {/* 移动端筛选（侧边栏在窄屏隐藏） */}
      <div className="mobile-filters">
        <select
          value={filter.tab}
          aria-label="筛选收藏"
          onChange={e => onFilterChange({ tab: e.target.value as FilterState['tab'] })}
        >
          <option value="all">全部方案</option>
          <option value="favorites">我的收藏</option>
        </select>
        <select
          value={filter.category ?? ''}
          aria-label="筛选分类"
          onChange={e => onFilterChange({ category: e.target.value || null })}
        >
          <option value="">全部分类</option>
          {categories.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <span className="result-count">
        {hasActiveFilter ? `${resultCount} / ${totalCount} 个方案` : `${totalCount} 个方案`}
        {hasActiveFilter && (
          <button className="clear-filters" onClick={onClearFilters}>
            清除筛选
          </button>
        )}
      </span>
    </div>
  );
}
