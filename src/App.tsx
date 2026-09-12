import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Download, Grid3X3, LibraryBig, Plus, SearchX, Upload } from 'lucide-react';
import type { ConflictResolution, FilterState, ImportParseResult, Pair } from './types';
import { categoriesOf, exportJson, filterPairs, parseImport } from './lib/library';
import { useLibrary } from './hooks/useLibrary';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { PairCard } from './components/PairCard';
import { Studio } from './components/Studio';
import { PairEditorModal } from './components/PairEditorModal';
import { CategoryModal } from './components/CategoryModal';
import { ImportDialog } from './components/ImportDialog';
import { Toast } from './components/Toast';

const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

const DEFAULT_FILTER: FilterState = { tab: 'all', category: null, query: '', sort: 'updated' };

export default function App() {
  const library = useLibrary();
  const { pairs, toast } = library;
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ open: boolean; pair: Pair | null }>({ open: false, pair: null });
  const [showCategories, setShowCategories] = useState(false);
  const [importResult, setImportResult] = useState<ImportParseResult | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => categoriesOf(pairs), [pairs]);
  const visible = useMemo(() => filterPairs(pairs, filter), [pairs, filter]);
  const current = pairs.find(p => p.id === selectedId) ?? pairs[0] ?? null;

  const patchFilter = (patch: Partial<FilterState>) => setFilter(f => ({ ...f, ...patch }));

  const handleExport = () => {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportJson(pairs)], { type: 'application/json' }));
    a.download = `type-pairer-library-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    library.notify(`已导出 ${pairs.length} 个方案`);
  };

  const handleImportFile = async (file: File) => {
    if (file.size > MAX_IMPORT_BYTES) {
      library.notify('文件超过 2MB，请拆分后再导入');
      return;
    }
    const text = await file.text();
    const result = parseImport(text, pairs, Date.now());
    if (result.fatal) {
      library.notify(`导入失败：${result.fatal}`);
      return;
    }
    setImportResult(result);
  };

  const handleImportConfirm = (resolutions: Map<string, ConflictResolution>) => {
    if (!importResult) return;
    library.importPairs(importResult.valid, resolutions);
    setImportResult(null);
  };

  const handleCopyCss = () => {
    if (!current) return;
    const css = [
      `/* ${current.title} */`,
      `.heading { font-family: '${current.headingFont}'; font-size: ${current.size}px; font-weight: ${current.weight}; letter-spacing: ${current.tracking}px; }`,
      `.body { font-family: '${current.bodyFont}'; line-height: ${current.leading}; }`,
    ].join('\n');
    const done = () => library.notify('CSS 已复制到剪贴板');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(css).then(done, () => library.notify('复制失败，请检查浏览器权限'));
    } else {
      const ta = document.createElement('textarea');
      ta.value = css;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      done();
    }
  };

  return (
    <div className="app">
      <Sidebar
        filter={filter}
        totalCount={pairs.length}
        favoriteCount={pairs.filter(p => p.favorite).length}
        categories={categories}
        onFilterChange={patchFilter}
        onManageCategories={() => setShowCategories(true)}
      />

      <main>
        <header>
          <div>
            <div className="crumb">
              字体方案库 / <b>配对工作台</b>
            </div>
            <h1>找到对的对话。</h1>
            <p>探索组合、微调细节，把有感觉的配对存进本地方案库。</p>
          </div>
          <div className="actions">
            <button className="outline" onClick={() => fileInput.current?.click()}>
              <Upload size={15} />
              导入
            </button>
            <button className="outline" onClick={handleExport} disabled={pairs.length === 0}>
              <Download size={15} />
              导出
            </button>
            <button className="primary" onClick={() => setEditor({ open: true, pair: null })}>
              <Plus size={16} />
              新建方案
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              hidden
              data-testid="import-input"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) void handleImportFile(file);
                e.target.value = '';
              }}
            />
          </div>
        </header>

        <div className="layout">
          <section className="gallery">
            <div className="gallery-head">
              <div>
                <h2>已存方案</h2>
                <span>{filter.tab === 'favorites' ? '收藏夹' : (filter.category ?? '全部分类')}</span>
              </div>
              <Grid3X3 size={16} color="#9da5a3" />
            </div>

            <Toolbar
              filter={filter}
              resultCount={visible.length}
              totalCount={pairs.length}
              categories={categories.map(c => c.name)}
              onFilterChange={patchFilter}
              onClearFilters={() => setFilter(DEFAULT_FILTER)}
            />

            {pairs.length === 0 ? (
              <div className="empty-state">
                <LibraryBig size={30} strokeWidth={1.4} />
                <h3>方案库还是空的</h3>
                <p>新建第一个字体配对，或从 JSON 文件批量导入。</p>
                <div className="empty-actions">
                  <button className="primary" onClick={() => setEditor({ open: true, pair: null })}>
                    <Plus size={15} />
                    新建方案
                  </button>
                  <button className="outline" onClick={() => fileInput.current?.click()}>
                    <Upload size={14} />
                    导入方案
                  </button>
                </div>
              </div>
            ) : visible.length === 0 ? (
              <div className="empty-state">
                <SearchX size={30} strokeWidth={1.4} />
                <h3>没有匹配的方案</h3>
                <p>换个关键词试试，或清除当前筛选条件。</p>
                <div className="empty-actions">
                  <button className="outline" onClick={() => setFilter(DEFAULT_FILTER)}>
                    清除筛选
                  </button>
                </div>
              </div>
            ) : (
              <div className="pair-list">
                {visible.map(p => (
                  <PairCard
                    key={p.id}
                    pair={p}
                    selected={current?.id === p.id}
                    onSelect={() => setSelectedId(p.id)}
                    onToggleFavorite={() => library.toggleFavorite(p.id)}
                    onRename={() => setEditor({ open: true, pair: p })}
                    onDuplicate={() => {
                      const copy = library.duplicatePair(p.id);
                      if (copy) setSelectedId(copy.id);
                    }}
                    onRemove={() => library.removePair(p.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {current ? (
            <Studio
              pair={current}
              saveState={library.saveState}
              onUpdateType={patch => library.updateType(current.id, patch)}
              onToggleFavorite={() => library.toggleFavorite(current.id)}
              onRemove={() => library.removePair(current.id)}
              onCopyCss={handleCopyCss}
              onRetrySave={library.retrySave}
            />
          ) : (
            <section className="studio studio-empty">
              <div className="empty-state">
                <Grid3X3 size={28} strokeWidth={1.4} />
                <h3>没有可预览的方案</h3>
                <p>新建或导入方案后，即可在这里微调字体细节。</p>
              </div>
            </section>
          )}
        </div>
      </main>

      {editor.open && (
        <PairEditorModal
          pair={editor.pair}
          categories={categories.map(c => c.name)}
          onClose={() => setEditor({ open: false, pair: null })}
          onSubmit={values => {
            if (editor.pair) {
              library.editPair(editor.pair.id, values);
              library.notify('已更新方案');
            } else {
              const created = library.createPair(values);
              setSelectedId(created.id);
            }
            setEditor({ open: false, pair: null });
          }}
        />
      )}

      {showCategories && (
        <CategoryModal
          categories={categories}
          onRename={library.renameCategory}
          onDelete={library.deleteCategory}
          onClose={() => setShowCategories(false)}
        />
      )}

      {importResult && (
        <ImportDialog
          result={importResult}
          existing={pairs}
          onConfirm={handleImportConfirm}
          onClose={() => setImportResult(null)}
        />
      )}

      {/* 通知栈：toast（ transient ）在上，保存失败/重试常驻提示在下，
          纵向排列保证任何尺寸下都不重叠 */}
      {(toast || library.saveState !== 'saved') && (
        <div className="notify-stack">
          {toast && <Toast toast={toast} onDismiss={library.dismissToast} />}
          {library.saveState !== 'saved' && (
            <div className="save-alert" role="alert">
              <AlertTriangle size={14} />
              <span>{library.saveState === 'retrying' ? '正在重试保存…' : '有改动未保存到本地'}</span>
              {library.saveState === 'error' && (
                <button className="save-alert-retry" onClick={library.retrySave}>
                  重试
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
