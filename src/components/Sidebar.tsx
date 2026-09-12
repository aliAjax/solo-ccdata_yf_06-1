import { FolderOpen, Grid3X3, Heart, Settings2, Type } from 'lucide-react';
import type { FilterState } from '../types';

interface SidebarProps {
  filter: FilterState;
  totalCount: number;
  favoriteCount: number;
  categories: { name: string; count: number }[];
  onFilterChange: (patch: Partial<FilterState>) => void;
  onManageCategories: () => void;
}

const CATEGORY_COLORS = ['#e8b7a0', '#9fc9be', '#b4add8', '#e5c98f', '#a8c6e8', '#d9a8b6', '#b8cfa0'];

export function categoryColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
}

export function Sidebar({ filter, totalCount, favoriteCount, categories, onFilterChange, onManageCategories }: SidebarProps) {
  const navClass = (active: boolean) => (active ? 'nav active' : 'nav');
  return (
    <aside>
      <div className="brand">
        <div className="brand-mark">
          <Type size={18} />
        </div>
        <div>
          <b>Type Pairer</b>
          <small>本地方案库</small>
        </div>
      </div>

      <div className="nav-section">
        <span>方案库</span>
        <button
          className={navClass(filter.tab === 'all' && !filter.category)}
          onClick={() => onFilterChange({ tab: 'all', category: null })}
        >
          <Grid3X3 size={16} />
          全部方案 <b>{totalCount}</b>
        </button>
        <button className={navClass(filter.tab === 'favorites')} onClick={() => onFilterChange({ tab: 'favorites', category: null })}>
          <Heart size={16} />
          我的收藏 <b>{favoriteCount}</b>
        </button>
      </div>

      <div className="saved">
        <div className="saved-head">
          <span>分类</span>
          <button aria-label="管理分类" title="管理分类" onClick={onManageCategories}>
            <Settings2 size={14} />
          </button>
        </div>
        {categories.length === 0 && <p className="aside-empty">暂无分类</p>}
        {categories.map(c => (
          <button
            key={c.name}
            className={filter.category === c.name ? 'collection active' : 'collection'}
            onClick={() => onFilterChange({ tab: 'all', category: filter.category === c.name ? null : c.name })}
          >
            <i style={{ background: categoryColor(c.name) }} />
            {c.name} <b>{c.count}</b>
          </button>
        ))}
      </div>

      <div className="aside-foot">
        <button className="nav" onClick={onManageCategories}>
          <FolderOpen size={16} />
          管理分类
        </button>
        <div className="profile">
          <div className="avatar">YL</div>
          <div>
            <b>Yuki Lin</b>
            <small>设计工作台</small>
          </div>
        </div>
      </div>
    </aside>
  );
}
