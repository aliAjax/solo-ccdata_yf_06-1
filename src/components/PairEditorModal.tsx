import { useEffect, useState } from 'react';
import type { Pair } from '../types';

interface PairEditorModalProps {
  /** null 表示新建；传入方案则为重命名 / 编辑 */
  pair: Pair | null;
  categories: string[];
  onSubmit: (values: { title: string; category: string; heading: string; body: string }) => void;
  onClose: () => void;
}

export function PairEditorModal({ pair, categories, onSubmit, onClose }: PairEditorModalProps) {
  const [title, setTitle] = useState(pair?.title ?? '');
  const [category, setCategory] = useState(pair?.category ?? '');
  const [heading, setHeading] = useState(pair?.heading ?? '');
  const [body, setBody] = useState(pair?.body ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = () => {
    if (!title.trim()) {
      setError('方案名称不能为空');
      return;
    }
    onSubmit({ title: title.trim(), category: category.trim(), heading, body });
  };

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={pair ? '重命名方案' : '新建方案'}>
        <h2>{pair ? '重命名 / 编辑方案' : '新建方案'}</h2>
        <label>
          方案名称 <em>*</em>
          <input
            autoFocus
            value={title}
            placeholder="例如：Quiet confidence"
            onChange={e => {
              setTitle(e.target.value);
              setError('');
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') submit();
            }}
          />
        </label>
        {error && <p className="field-error">{error}</p>}
        <label>
          分类
          <input
            value={category}
            placeholder="选择或输入新分类"
            list="category-options"
            onChange={e => setCategory(e.target.value)}
          />
          <datalist id="category-options">
            {categories.map(c => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label>
          标题文案
          <input value={heading} placeholder="展示在画布上的大标题" onChange={e => setHeading(e.target.value)} />
        </label>
        <label>
          正文文案
          <textarea value={body} rows={3} placeholder="一段能体现字体性格的文字" onChange={e => setBody(e.target.value)} />
        </label>
        <div className="modal-actions">
          <button className="outline" onClick={onClose}>
            取消
          </button>
          <button className="primary" onClick={submit}>
            {pair ? '保存修改' : '创建方案'}
          </button>
        </div>
      </div>
    </div>
  );
}
