import React, { useState } from 'react';
import type {
  AssetList,
  CanvasMode,
  DesignConfig,
  DesignVariant,
  DividerStyle,
  ProjectConfig,
} from '../../shared/types';

interface DesignPanelProps {
  config: ProjectConfig;
  design: DesignConfig;
  customCss: string;
  assets: AssetList;
  onConfigChange: (next: ProjectConfig) => void;
  onDesignChange: (next: DesignConfig) => void;
  onCustomCssChange: (next: string) => void;
  onSyncSheet: () => void;
  onUploadCsv: (file: File) => void;
  onOpenAssets: (tab: 'images' | 'icons' | 'fonts') => void;
}

const FONT_OPTIONS = [
  { label: 'Oswald (Condensed)', value: "'Oswald', 'Arial Narrow', sans-serif" },
  { label: 'Inter (Clean Sans)', value: "'Inter', 'Helvetica Neue', Arial, sans-serif" },
  { label: 'Space Grotesk', value: "'Space Grotesk', sans-serif" },
  { label: 'Caveat (Script)', value: "'Caveat', cursive" },
  { label: 'Pacifico (Brush)', value: "'Pacifico', cursive" },
];

const ALL_DIVIDER_STYLES: { key: DividerStyle; label: string }[] = [
  { key: 'single-black', label: 'Single Black' },
  { key: 'double-blue', label: 'Double Blue' },
  { key: 'double-pink', label: 'Double Pink' },
  { key: 'red-blue', label: 'Red + Blue' },
  { key: 'double-grey', label: 'Double Grey' },
  { key: 'oval-accent', label: 'Red Oval Accent' },
];

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="section">
      <button type="button" className="section-header" onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

export function DesignPanel({
  config,
  design,
  customCss,
  assets,
  onConfigChange,
  onDesignChange,
  onCustomCssChange,
  onSyncSheet,
  onUploadCsv,
  onOpenAssets,
}: DesignPanelProps) {
  const activeKey = design.activeVariant;
  const variant = design.variants[activeKey] || Object.values(design.variants)[0];

  const updateVariant = (updater: (v: DesignVariant) => DesignVariant) => {
    onDesignChange({
      ...design,
      variants: {
        ...design.variants,
        [activeKey]: updater(variant),
      },
    });
  };

  const duplicateVariant = () => {
    const label = prompt('Name for the new design variant:', `${variant.label} Copy`);
    if (!label?.trim()) return;
    const key =
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || `variant-${Date.now()}`;
    const uniqueKey = design.variants[key] ? `${key}-${Date.now().toString().slice(-3)}` : key;
    onDesignChange({
      activeVariant: uniqueKey,
      variants: {
        ...design.variants,
        [uniqueKey]: structuredClone({ ...variant, label: label.trim() }),
      },
    });
  };

  const deleteVariant = () => {
    const keys = Object.keys(design.variants);
    if (keys.length <= 1) return;
    if (!confirm(`Delete variant "${variant.label}"?`)) return;
    const nextVariants = { ...design.variants };
    delete nextVariants[activeKey];
    const fallbackKey = Object.keys(nextVariants)[0];
    onDesignChange({
      activeVariant: fallbackKey,
      variants: nextVariants,
    });
  };

  const uploadedFontOptions = assets.fonts.map((f) => {
    const name = f.replace(/\.[^.]+$/, '');
    return { label: `${name} (Uploaded)`, value: `'${name}', sans-serif` };
  });
  const fontChoices = [...FONT_OPTIONS, ...uploadedFontOptions];

  return (
    <aside className="sidebar">
      <Section title="Design Variants" defaultOpen>
        <div className="field">
          <label>Active Variant</label>
          <select
            value={activeKey}
            onChange={(e) => onDesignChange({ ...design, activeVariant: e.target.value })}
          >
            {Object.entries(design.variants).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field-row">
          <button type="button" className="btn" onClick={duplicateVariant}>
            + Duplicate Variant
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={Object.keys(design.variants).length <= 1}
            onClick={deleteVariant}
          >
            Delete
          </button>
        </div>
      </Section>

      <Section title="Data Source & Card Size" defaultOpen>
        <div className="field">
          <label>Google Sheet Published CSV URL</label>
          <input
            type="text"
            placeholder="https://docs.google.com/spreadsheets/.../pub?output=csv"
            value={config.googleSheetUrl || ''}
            onChange={(e) =>
              onConfigChange({ ...config, googleSheetUrl: e.target.value })
            }
          />
        </div>
        <div className="field-row">
          <button type="button" className="btn" onClick={onSyncSheet}>
            ↻ Sync Sheet
          </button>
          <label className="btn" style={{ justifyContent: 'center', cursor: 'pointer' }}>
            Upload CSV
            <input
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadCsv(file);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        <div className="field-row-3">
          <div className="field">
            <label>Width (mm)</label>
            <input
              type="number"
              min={20}
              max={200}
              value={config.cardSize.widthMm}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  cardSize: { ...config.cardSize, widthMm: Number(e.target.value) || 63 },
                })
              }
            />
          </div>
          <div className="field">
            <label>Height (mm)</label>
            <input
              type="number"
              min={20}
              max={250}
              value={config.cardSize.heightMm}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  cardSize: { ...config.cardSize, heightMm: Number(e.target.value) || 88 },
                })
              }
            />
          </div>
          <div className="field">
            <label>Bleed (mm)</label>
            <input
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={config.cardSize.bleedMm}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  cardSize: { ...config.cardSize, bleedMm: Number(e.target.value) || 0 },
                })
              }
            />
          </div>
        </div>
        <div className="pill-group">
          {[
            { name: 'Poker 63×88', w: 63, h: 88 },
            { name: 'Bridge 56×87', w: 56, h: 87 },
            { name: 'Tarot 70×120', w: 70, h: 120 },
          ].map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="pill"
              onClick={() =>
                onConfigChange({
                  ...config,
                  cardSize: { ...config.cardSize, widthMm: preset.w, heightMm: preset.h },
                })
              }
            >
              {preset.name}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Middle Canvas (Empty / Pattern / Watermark / Art)" defaultOpen>
        <div className="pill-group">
          {(['empty', 'pattern', 'watermark', 'image'] as CanvasMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`pill ${variant.canvas.mode === mode ? 'active' : ''}`}
              onClick={() =>
                updateVariant((v) => ({ ...v, canvas: { ...v.canvas, mode } }))
              }
            >
              {mode === 'empty'
                ? 'Empty'
                : mode === 'pattern'
                  ? 'Food Pattern'
                  : mode === 'watermark'
                    ? 'Watermark'
                    : 'Card Art'}
            </button>
          ))}
        </div>
        {variant.canvas.mode === 'pattern' && (
          <>
            <div className="field">
              <label>
                Pattern Opacity <span>{Math.round(variant.canvas.patternOpacity * 100)}%</span>
              </label>
              <input
                type="range"
                min={0.03}
                max={0.4}
                step={0.01}
                value={variant.canvas.patternOpacity}
                onChange={(e) =>
                  updateVariant((v) => ({
                    ...v,
                    canvas: { ...v.canvas, patternOpacity: Number(e.target.value) },
                  }))
                }
              />
            </div>
            <div className="field">
              <label>
                Icon Count <span>{variant.canvas.patternDensity}</span>
              </label>
              <input
                type="range"
                min={4}
                max={24}
                step={1}
                value={variant.canvas.patternDensity}
                onChange={(e) =>
                  updateVariant((v) => ({
                    ...v,
                    canvas: { ...v.canvas, patternDensity: Number(e.target.value) },
                  }))
                }
              />
            </div>
            <div className="field">
              <label>
                Icon Scale <span>{variant.canvas.patternScale.toFixed(1)}×</span>
              </label>
              <input
                type="range"
                min={0.6}
                max={2}
                step={0.1}
                value={variant.canvas.patternScale}
                onChange={(e) =>
                  updateVariant((v) => ({
                    ...v,
                    canvas: { ...v.canvas, patternScale: Number(e.target.value) },
                  }))
                }
              />
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => onOpenAssets('icons')}
            >
              + Upload Custom Pattern SVGs ({assets.icons.length})
            </button>
          </>
        )}
        {variant.canvas.mode === 'watermark' && (
          <>
            <div className="field">
              <label>Watermark Text</label>
              <input
                type="text"
                value={variant.canvas.watermarkText ?? 'MENU'}
                onChange={(e) =>
                  updateVariant((v) => ({
                    ...v,
                    canvas: { ...v.canvas, watermarkText: e.target.value },
                  }))
                }
              />
            </div>
            <div className="field">
              <label>
                Opacity{' '}
                <span>{Math.round((variant.canvas.watermarkOpacity ?? 0.06) * 100)}%</span>
              </label>
              <input
                type="range"
                min={0.02}
                max={0.25}
                step={0.01}
                value={variant.canvas.watermarkOpacity ?? 0.06}
                onChange={(e) =>
                  updateVariant((v) => ({
                    ...v,
                    canvas: { ...v.canvas, watermarkOpacity: Number(e.target.value) },
                  }))
                }
              />
            </div>
            <div className="field">
              <label>
                Text Size <span>{variant.canvas.watermarkSizeMm ?? 34} mm</span>
              </label>
              <input
                type="range"
                min={14}
                max={64}
                step={1}
                value={variant.canvas.watermarkSizeMm ?? 34}
                onChange={(e) =>
                  updateVariant((v) => ({
                    ...v,
                    canvas: { ...v.canvas, watermarkSizeMm: Number(e.target.value) },
                  }))
                }
              />
            </div>
            <div className="field">
              <label>
                Angle <span>{variant.canvas.watermarkAngleDeg ?? -18}°</span>
              </label>
              <input
                type="range"
                min={-45}
                max={45}
                step={1}
                value={variant.canvas.watermarkAngleDeg ?? -18}
                onChange={(e) =>
                  updateVariant((v) => ({
                    ...v,
                    canvas: { ...v.canvas, watermarkAngleDeg: Number(e.target.value) },
                  }))
                }
              />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Sheet Columns</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={variant.canvas.watermarkCols ?? 3}
                  onChange={(e) =>
                    updateVariant((v) => ({
                      ...v,
                      canvas: { ...v.canvas, watermarkCols: Number(e.target.value) || 3 },
                    }))
                  }
                />
              </div>
              <div className="field">
                <label>Color</label>
                <div className="color-item" style={{ paddingTop: 2 }}>
                  <input
                    type="color"
                    value={variant.canvas.watermarkColor ?? '#000000'}
                    onChange={(e) =>
                      updateVariant((v) => ({
                        ...v,
                        canvas: { ...v.canvas, watermarkColor: e.target.value },
                      }))
                    }
                  />
                  <span>{variant.canvas.watermarkColor ?? '#000000'}</span>
                </div>
              </div>
            </div>
          </>
        )}
        {variant.canvas.mode === 'image' && (
          <>
            <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>
              Images are matched by filename from the <code>image</code> column in your
              Google Sheet / CSV (e.g. <code>images/pesto.jpg</code> → upload{' '}
              <code>pesto.jpg</code>).
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => onOpenAssets('images')}
            >
              + Upload / Manage Card Art ({assets.images.length})
            </button>
          </>
        )}
      </Section>

      <Section title="Semi-Randomization Rules">
        <div className="field-row">
          <div className="field">
            <label>Global Seed</label>
            <input
              type="number"
              value={variant.globalSeed}
              onChange={(e) =>
                updateVariant((v) => ({
                  ...v,
                  globalSeed: Number.parseInt(e.target.value, 10) || 0,
                }))
              }
            />
          </div>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn"
              onClick={() =>
                updateVariant((v) => ({
                  ...v,
                  globalSeed: Math.floor(Math.random() * 100000),
                }))
              }
            >
              🎲 Shuffle All
            </button>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Top Box Min Left %</label>
            <input
              type="number"
              min={0}
              max={45}
              value={variant.topBlock.minLeftPct}
              onChange={(e) =>
                updateVariant((v) => ({
                  ...v,
                  topBlock: { ...v.topBlock, minLeftPct: Number(e.target.value) },
                }))
              }
            />
          </div>
          <div className="field">
            <label>Top Box Max Left %</label>
            <input
              type="number"
              min={0}
              max={55}
              value={variant.topBlock.maxLeftPct}
              onChange={(e) =>
                updateVariant((v) => ({
                  ...v,
                  topBlock: { ...v.topBlock, maxLeftPct: Number(e.target.value) },
                }))
              }
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Top Box Min Height %</label>
            <input
              type="number"
              min={15}
              max={45}
              value={variant.topBlock.minHeightPct}
              onChange={(e) =>
                updateVariant((v) => ({
                  ...v,
                  topBlock: { ...v.topBlock, minHeightPct: Number(e.target.value) },
                }))
              }
            />
          </div>
          <div className="field">
            <label>Top Box Max Height %</label>
            <input
              type="number"
              min={18}
              max={50}
              value={variant.topBlock.maxHeightPct}
              onChange={(e) =>
                updateVariant((v) => ({
                  ...v,
                  topBlock: { ...v.topBlock, maxHeightPct: Number(e.target.value) },
                }))
              }
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Tags Min Left %</label>
            <input
              type="number"
              min={0}
              max={75}
              value={variant.topBlock.tagsMinLeftPct ?? 4}
              onChange={(e) =>
                updateVariant((v) => ({
                  ...v,
                  topBlock: { ...v.topBlock, tagsMinLeftPct: Number(e.target.value) },
                }))
              }
            />
          </div>
          <div className="field">
            <label>Tags Max Left %</label>
            <input
              type="number"
              min={0}
              max={80}
              value={variant.topBlock.tagsMaxLeftPct ?? 58}
              onChange={(e) =>
                updateVariant((v) => ({
                  ...v,
                  topBlock: { ...v.topBlock, tagsMaxLeftPct: Number(e.target.value) },
                }))
              }
            />
          </div>
        </div>
        <div className="field">
          <label>Game Mark Text (e.g. &quot;menu&quot;)</label>
          <input
            type="text"
            value={variant.gameMark.text}
            onChange={(e) =>
              updateVariant((v) => ({
                ...v,
                gameMark: { ...v.gameMark, text: e.target.value },
              }))
            }
          />
        </div>
        <div className="field">
          <label>
            Game Mark Frequency{' '}
            <span>{Math.round(variant.gameMark.probability * 100)}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={variant.gameMark.probability}
            onChange={(e) =>
              updateVariant((v) => ({
                ...v,
                gameMark: { ...v.gameMark, probability: Number(e.target.value) },
              }))
            }
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Mark Min Size (pt)</label>
            <input
              type="number"
              min={6}
              max={36}
              value={variant.gameMark.minSizePt}
              onChange={(e) =>
                updateVariant((v) => ({
                  ...v,
                  gameMark: { ...v.gameMark, minSizePt: Number(e.target.value) },
                }))
              }
            />
          </div>
          <div className="field">
            <label>Mark Max Size (pt)</label>
            <input
              type="number"
              min={8}
              max={48}
              value={variant.gameMark.maxSizePt}
              onChange={(e) =>
                updateVariant((v) => ({
                  ...v,
                  gameMark: { ...v.gameMark, maxSizePt: Number(e.target.value) },
                }))
              }
            />
          </div>
        </div>
        <div className="field">
          <label>Game Mark Font Pool (randomly picked per card)</label>
          <div className="pill-group">
            {fontChoices.map((f) => {
              const active = variant.gameMark.fonts.some(
                (existing) =>
                  existing === f.value ||
                  existing.split(',')[0].trim() === f.value.split(',')[0].trim(),
              );
              return (
                <button
                  key={f.value}
                  type="button"
                  className={`pill ${active ? 'active' : ''}`}
                  onClick={() =>
                    updateVariant((v) => {
                      const fam = f.value.split(',')[0].trim();
                      const next = active
                        ? v.gameMark.fonts.filter(
                            (existing) =>
                              existing !== f.value &&
                              existing.split(',')[0].trim() !== fam,
                          )
                        : [...v.gameMark.fonts, f.value];
                      return {
                        ...v,
                        gameMark: {
                          ...v.gameMark,
                          fonts: next.length > 0 ? next : [f.value],
                        },
                      };
                    })
                  }
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="field">
          <label>
            Game Mark Color Pool
            <button
              type="button"
              className="btn btn-xs"
              onClick={() =>
                updateVariant((v) => ({
                  ...v,
                  gameMark: {
                    ...v.gameMark,
                    colors: [...v.gameMark.colors, '#111111'],
                  },
                }))
              }
            >
              + Color
            </button>
          </label>
          <div className="pill-group">
            {variant.gameMark.colors.map((hex, idx) => (
              <div key={`${hex}-${idx}`} className="color-item">
                <input
                  type="color"
                  value={hex}
                  onChange={(e) =>
                    updateVariant((v) => {
                      const next = [...v.gameMark.colors];
                      next[idx] = e.target.value;
                      return { ...v, gameMark: { ...v.gameMark, colors: next } };
                    })
                  }
                />
                {variant.gameMark.colors.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-xs"
                    title="Remove color"
                    onClick={() =>
                      updateVariant((v) => ({
                        ...v,
                        gameMark: {
                          ...v.gameMark,
                          colors: v.gameMark.colors.filter((_, i) => i !== idx),
                        },
                      }))
                    }
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="field">
          <label>
            Subtitle Oval Accent Chance{' '}
            <span>{Math.round(variant.divider.ovalProbability * 100)}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={0.5}
            step={0.02}
            value={variant.divider.ovalProbability}
            onChange={(e) =>
              updateVariant((v) => ({
                ...v,
                divider: { ...v.divider, ovalProbability: Number(e.target.value) },
              }))
            }
          />
        </div>
        <div className="field">
          <label>Bottom Divider Styles</label>
          <div className="pill-group">
            {ALL_DIVIDER_STYLES.map((st) => {
              const active = variant.divider.styles.includes(st.key);
              return (
                <button
                  key={st.key}
                  type="button"
                  className={`pill ${active ? 'active' : ''}`}
                  onClick={() =>
                    updateVariant((v) => ({
                      ...v,
                      divider: {
                        ...v.divider,
                        styles: active
                          ? v.divider.styles.filter((s) => s !== st.key)
                          : [...v.divider.styles, st.key],
                      },
                    }))
                  }
                >
                  {st.label}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      <Section title="Colors & Kitchen Palette">
        <div className="color-grid">
          <div className="color-item">
            <input
              type="color"
              value={variant.backgroundColor}
              onChange={(e) =>
                updateVariant((v) => ({ ...v, backgroundColor: e.target.value }))
              }
            />
            <span>Card BG</span>
          </div>
          <div className="color-item">
            <input
              type="color"
              value={variant.textColor}
              onChange={(e) =>
                updateVariant((v) => ({ ...v, textColor: e.target.value }))
              }
            />
            <span>Text</span>
          </div>
          {Object.entries(variant.palette).map(([key, hex]) => (
            <div key={key} className="color-item">
              <input
                type="color"
                value={hex}
                onChange={(e) =>
                  updateVariant((v) => ({
                    ...v,
                    palette: { ...v.palette, [key]: e.target.value },
                  }))
                }
              />
              <span>{key}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <div className="field">
          <label>Title Font</label>
          <select
            value={variant.typography.titleFont}
            onChange={(e) =>
              updateVariant((v) => ({
                ...v,
                typography: { ...v.typography, titleFont: e.target.value },
              }))
            }
          >
            {fontChoices.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Tags Font</label>
          <select
            value={variant.typography.tagsFont}
            onChange={(e) =>
              updateVariant((v) => ({
                ...v,
                typography: { ...v.typography, tagsFont: e.target.value },
              }))
            }
          >
            {fontChoices.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Subtitle Font</label>
          <select
            value={variant.typography.subtitleFont}
            onChange={(e) =>
              updateVariant((v) => ({
                ...v,
                typography: { ...v.typography, subtitleFont: e.target.value },
              }))
            }
          >
            {fontChoices.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Body / Action Text Font</label>
          <select
            value={variant.typography.bodyFont}
            onChange={(e) =>
              updateVariant((v) => ({
                ...v,
                typography: { ...v.typography, bodyFont: e.target.value },
              }))
            }
          >
            {fontChoices.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Title (pt)</label>
            <input
              type="number"
              min={12}
              max={48}
              value={variant.typography.titleSizePt}
              onChange={(e) =>
                updateVariant((v) => ({
                  ...v,
                  typography: { ...v.typography, titleSizePt: Number(e.target.value) },
                }))
              }
            />
          </div>
          <div className="field">
            <label>Subtitle (pt)</label>
            <input
              type="number"
              min={8}
              max={28}
              value={variant.typography.subtitleSizePt}
              onChange={(e) =>
                updateVariant((v) => ({
                  ...v,
                  typography: { ...v.typography, subtitleSizePt: Number(e.target.value) },
                }))
              }
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Tags (pt)</label>
            <input
              type="number"
              min={6}
              max={22}
              value={variant.typography.tagsSizePt}
              onChange={(e) =>
                updateVariant((v) => ({
                  ...v,
                  typography: { ...v.typography, tagsSizePt: Number(e.target.value) },
                }))
              }
            />
          </div>
          <div className="field">
            <label>Body (pt)</label>
            <input
              type="number"
              min={7}
              max={20}
              step={0.5}
              value={variant.typography.bodySizePt}
              onChange={(e) =>
                updateVariant((v) => ({
                  ...v,
                  typography: { ...v.typography, bodySizePt: Number(e.target.value) },
                }))
              }
            />
          </div>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => onOpenAssets('fonts')}
        >
          + Upload Custom Fonts (.woff2 / .ttf) ({assets.fonts.length})
        </button>
      </Section>

      <Section title="Custom CSS (Advanced)">
        <textarea
          className="code-area"
          value={customCss}
          onChange={(e) => onCustomCssChange(e.target.value)}
          placeholder="/* Live CSS overrides */"
        />
      </Section>
    </aside>
  );
}
