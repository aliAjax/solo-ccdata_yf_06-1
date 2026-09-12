import { useMemo, useState } from 'react';
import { AlertTriangle, FileWarning } from 'lucide-react';
import type { ConflictResolution, ImportParseResult, Pair } from '../types';

interface ImportDialogProps {
  result: ImportParseResult;
  existing: Pair[];
  onConfirm: (resolutions: Map<string, ConflictResolution>) => void;
  onClose: () => void;
}

const RESOLUTION_LABELS: { value: ConflictResolution; label: string }[] = [
  { value: 'overwrite', label: '覆盖' },
  { value: 'skip', label: '跳过' },
  { value: 'keepBoth', label: '保留两份' },
];

export function ImportDialog({ result, existing, onConfirm, onClose }: ImportDialogProps) {
  const conflictPairs = useMemo(
    () => result.valid.filter(p => result.conflicts.includes(p.id)),
    [result],
  );
  const freshCount = result.valid.length - conflictPairs.length;
  const [resolutions, setResolutions] = useState<Map<string, ConflictResolution>>(
    () => new Map(conflictPairs.map(p => [p.id, 'skip' as ConflictResolution])),
  );

  const setAll = (resolution: ConflictResolution) => {
    setResolutions(new Map(conflictPairs.map(p => [p.id, resolution])));
  };
  const setOne = (id: string, resolution: ConflictResolution) => {
    setResolutions(prev => new Map(prev).set(id, resolution));
  };

  const existingTitle = (id: string) => existing.find(p => p.id === id)?.title ?? '';

  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="modal import-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="导入方案"
      >
        <h2>导入方案</h2>

        <div className="import-summary">
          <span>
            有效 <b>{result.valid.length}</b>
          </span>
          <span className={result.invalid.length ? 'warn' : ''}>
            无效 <b>{result.invalid.length}</b>
          </span>
          <span className={conflictPairs.length ? 'warn' : ''}>
            冲突 <b>{conflictPairs.length}</b>
          </span>
        </div>

        {result.invalid.length > 0 && (
          <div className="import-section">
            <h3>
              <FileWarning size={14} /> 无效条目（将被跳过）
            </h3>
            <ul className="import-errors">
              {result.invalid.map(err => (
                <li key={err.index}>
                  第 {err.index} 条：{err.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {conflictPairs.length > 0 && (
          <div className="import-section">
            <h3>
              <AlertTriangle size={14} /> 与现有方案 id 相同，请逐项选择处理方式
            </h3>
            <div className="bulk-actions">
              <span>全部：</span>
              {RESOLUTION_LABELS.map(r => (
                <button key={r.value} className="chip" onClick={() => setAll(r.value)}>
                  {r.label}
                </button>
              ))}
            </div>
            <ul className="conflict-list">
              {conflictPairs.map(p => (
                <li key={p.id}>
                  <div className="conflict-info">
                    <b>{p.title}</b>
                    <small>现有：「{existingTitle(p.id)}」 · 分类 {p.category}</small>
                  </div>
                  <div className="conflict-options" role="radiogroup" aria-label={`冲突处理：${p.title}`}>
                    {RESOLUTION_LABELS.map(r => (
                      <label key={r.value} className={resolutions.get(p.id) === r.value ? 'radio on' : 'radio'}>
                        <input
                          type="radio"
                          name={`conflict-${p.id}`}
                          checked={resolutions.get(p.id) === r.value}
                          onChange={() => setOne(p.id, r.value)}
                        />
                        {r.label}
                      </label>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.valid.length === 0 ? (
          <p className="modal-empty">没有可导入的有效方案。</p>
        ) : (
          <p className="import-note">
            将新增 {freshCount + [...resolutions.values()].filter(r => r === 'keepBoth').length} 条
            {conflictPairs.length > 0 &&
              `，覆盖 ${[...resolutions.values()].filter(r => r === 'overwrite').length} 条，跳过 ${
                [...resolutions.values()].filter(r => r === 'skip').length
              } 条`}
            。导入后可撤销。
          </p>
        )}

        <div className="modal-actions">
          <button className="outline" onClick={onClose}>
            取消
          </button>
          <button className="primary" disabled={result.valid.length === 0} onClick={() => onConfirm(resolutions)}>
            确认导入 {result.valid.length > 0 ? `（${result.valid.length} 条）` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
