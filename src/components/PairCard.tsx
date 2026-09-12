import { Copy, Heart, Pencil, Trash2 } from 'lucide-react';
import type { Pair } from '../types';

interface PairCardProps {
  pair: Pair;
  selected: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

/** 列表卡片直接消费方案的字体参数 —— 工作台里调整字体/字号/行高/字距时此处同步变化 */
export function PairCard({ pair, selected, onSelect, onToggleFavorite, onRename, onDuplicate, onRemove }: PairCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={selected ? 'pair selected' : 'pair'}
      onClick={onSelect}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="pair-top">
        <span>{pair.category}</span>
        <button
          className="icon-btn"
          aria-label={pair.favorite ? '取消收藏' : '收藏'}
          title={pair.favorite ? '取消收藏' : '收藏'}
          onClick={e => {
            e.stopPropagation();
            onToggleFavorite();
          }}
        >
          <Heart size={15} fill={pair.favorite ? '#e88769' : 'none'} color={pair.favorite ? '#e88769' : '#aeb5b7'} />
        </button>
      </div>
      <strong
        style={{
          fontFamily: `'${pair.headingFont}', serif`,
          fontWeight: pair.weight,
          letterSpacing: `${pair.tracking}px`,
          fontSize: `${Math.round(pair.size * 0.48)}px`,
        }}
      >
        {pair.heading || '（无标题）'}
      </strong>
      <p style={{ fontFamily: `'${pair.bodyFont}', sans-serif`, lineHeight: pair.leading }}>{pair.body || '（无正文）'}</p>
      <div className="pair-foot">
        <span>{pair.title}</span>
        <span className="pair-actions" onClick={e => e.stopPropagation()}>
          <button className="icon-btn" aria-label="重命名 / 编辑" title="重命名 / 编辑" onClick={onRename}>
            <Pencil size={13} />
          </button>
          <button className="icon-btn" aria-label="复制方案" title="复制方案" onClick={onDuplicate}>
            <Copy size={13} />
          </button>
          <button className="icon-btn danger" aria-label="移除方案" title="移除方案" onClick={onRemove}>
            <Trash2 size={13} />
          </button>
        </span>
      </div>
    </div>
  );
}
