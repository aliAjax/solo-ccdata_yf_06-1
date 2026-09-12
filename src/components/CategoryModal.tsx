import { useState } from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';

interface CategoryModalProps {
  categories: { name: string; count: number }[];
  onRename: (from: string, to: string) => void;
  onDelete: (name: string) => void;
  onClose: () => void;
}

export function CategoryModal({ categories, onRename, onDelete, onClose }: CategoryModalProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const commitRename = (from: string) => {
    const next = draft.trim();
    if (!next) {
      setError('分类名不能为空');
      return;
    }
    if (next !== from && categories.some(c => c.name === next)) {
      setError(`分类「${next}」已存在`);
      return;
    }
    onRename(from, next);
    setEditing(null);
    setError('');
  };

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="管理分类">
        <h2>管理分类</h2>
        {categories.length === 0 && <p className="modal-empty">暂无分类 —— 新建方案时可直接输入分类名。</p>}
        <ul className="category-list">
          {categories.map(c => (
            <li key={c.name}>
              {editing === c.name ? (
                <>
                  <input
                    autoFocus
                    value={draft}
                    onChange={e => {
                      setDraft(e.target.value);
                      setError('');
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename(c.name);
                      if (e.key === 'Escape') setEditing(null);
                    }}
                  />
                  <button className="icon-btn" aria-label="确认重命名" onClick={() => commitRename(c.name)}>
                    <Check size={14} />
                  </button>
                  <button className="icon-btn" aria-label="取消" onClick={() => setEditing(null)}>
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <span className="category-name">
                    {c.name} <b>{c.count}</b>
                  </span>
                  <button
                    className="icon-btn"
                    aria-label={`重命名分类 ${c.name}`}
                    onClick={() => {
                      setEditing(c.name);
                      setDraft(c.name);
                      setError('');
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="icon-btn danger"
                    aria-label={`删除分类 ${c.name}`}
                    onClick={() => {
                      if (window.confirm(`删除分类「${c.name}」？其中 ${c.count} 个方案将移至「未分类」。`)) onDelete(c.name);
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        {error && <p className="field-error">{error}</p>}
        <div className="modal-actions">
          <button className="primary" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
