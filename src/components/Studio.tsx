import { useState } from 'react';
import { AlertTriangle, Copy, Loader2, SlidersHorizontal, Star, Trash2 } from 'lucide-react';
import type { Pair, TypeSettings } from '../types';
import type { SaveState } from '../hooks/useLibrary';
import { FONTS, LIMITS } from '../types';

type Device = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTHS: Record<Device, string> = {
  desktop: '100%',
  tablet: '520px',
  mobile: '340px',
};

interface StudioProps {
  pair: Pair;
  saveState: SaveState;
  onUpdateType: (patch: Partial<TypeSettings>) => void;
  onToggleFavorite: () => void;
  onRemove: () => void;
  onCopyCss: () => void;
  onRetrySave: () => void;
}

export function Studio({ pair, saveState, onUpdateType, onToggleFavorite, onRemove, onCopyCss, onRetrySave }: StudioProps) {
  const [device, setDevice] = useState<Device>('desktop');
  return (
    <section className="studio">
      <div className="studio-head">
        <div>
          <span>配对画布</span>
          <h2>{pair.title}</h2>
        </div>
        <button
          className="favorite"
          aria-label={pair.favorite ? '取消收藏' : '收藏'}
          onClick={onToggleFavorite}
        >
          <Star size={16} fill={pair.favorite ? '#e5a35e' : 'none'} color={pair.favorite ? '#e5a35e' : '#98a4a7'} />
        </button>
      </div>

      <div className="canvas">
        <div className="canvas-bar">
          <span>预览</span>
          <div>
            {(['desktop', 'tablet', 'mobile'] as Device[]).map(d => (
              <button key={d} className={device === d ? 'on' : ''} onClick={() => setDevice(d)}>
                {d === 'desktop' ? '桌面' : d === 'tablet' ? '平板' : '手机'}
              </button>
            ))}
          </div>
        </div>
        <div className="preview-wrap">
          <div className="preview" style={{ maxWidth: DEVICE_WIDTHS[device] }}>
            <span className="preview-kicker">{pair.category.toUpperCase()}</span>
            <h3
              style={{
                fontFamily: `'${pair.headingFont}', serif`,
                fontSize: `${pair.size}px`,
                fontWeight: pair.weight,
                letterSpacing: `${pair.tracking}px`,
              }}
            >
              {pair.heading || '（无标题）'}
            </h3>
            <p style={{ fontFamily: `'${pair.bodyFont}', sans-serif`, lineHeight: pair.leading }}>{pair.body || '（无正文）'}</p>
            <div className="preview-rule" />
            <span className="preview-meta">
              {pair.headingFont} · {pair.bodyFont} — {pair.size}px / {pair.weight}
            </span>
          </div>
        </div>
      </div>

      <div className="controls">
        <div className="control-head">
          <div>
            <span>字体控制</span>
            <h3>微调你的配对</h3>
          </div>
          <SlidersHorizontal size={17} />
        </div>
        <div className="font-row">
          <label>
            标题字体
            <select value={pair.headingFont} onChange={e => onUpdateType({ headingFont: e.target.value })}>
              {FONTS.map(f => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label>
            正文字体
            <select value={pair.bodyFont} onChange={e => onUpdateType({ bodyFont: e.target.value })}>
              {FONTS.map(f => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="range-row">
          <label>
            标题字号 <b>{pair.size}px</b>
            <input
              type="range"
              min={LIMITS.size.min}
              max={LIMITS.size.max}
              value={pair.size}
              aria-label="标题字号"
              onChange={e => onUpdateType({ size: Number(e.target.value) })}
            />
          </label>
          <label>
            标题字重 <b>{pair.weight}</b>
            <input
              type="range"
              min={LIMITS.weight.min}
              max={LIMITS.weight.max}
              step={LIMITS.weight.step}
              value={pair.weight}
              aria-label="标题字重"
              onChange={e => onUpdateType({ weight: Number(e.target.value) })}
            />
          </label>
        </div>
        <div className="range-row">
          <label>
            正文行高 <b>{pair.leading.toFixed(2)}</b>
            <input
              type="range"
              min={LIMITS.leading.min}
              max={LIMITS.leading.max}
              step={0.05}
              value={pair.leading}
              aria-label="正文行高"
              onChange={e => onUpdateType({ leading: Number(e.target.value) })}
            />
          </label>
          <label>
            标题字距 <b>{pair.tracking}px</b>
            <input
              type="range"
              min={LIMITS.tracking.min}
              max={LIMITS.tracking.max}
              step={0.5}
              value={pair.tracking}
              aria-label="标题字距"
              onChange={e => onUpdateType({ tracking: Number(e.target.value) })}
            />
          </label>
        </div>
      </div>

      <div className="studio-foot">
        <button className="delete" onClick={onRemove}>
          <Trash2 size={15} />
          移除方案
        </button>
        <div className="foot-actions">
          <button className="outline" onClick={onCopyCss}>
            <Copy size={14} />
            复制 CSS
          </button>
          {saveState === 'error' ? (
            <button className="save save-error" onClick={onRetrySave}>
              <AlertTriangle size={12} />
              未保存 · 点击重试
            </button>
          ) : saveState === 'retrying' ? (
            <span className="save save-pending">
              <Loader2 size={12} className="spin" />
              正在重试…
            </span>
          ) : (
            <span className="save">
              <span className="check">✓</span> 已自动保存
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
