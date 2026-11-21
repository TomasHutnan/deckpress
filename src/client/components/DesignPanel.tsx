import React, { useState } from 'react';
import {
  getByPath,
  setByPath,
  type ControlItem,
  type ControlsSchema,
} from '../../shared/controls';
import type {
  AssetList,
  DesignConfig,
  DesignVariant,
  ProjectConfig,
} from '../../shared/types';
import { ColorAlphaInput } from './ColorAlphaInput';

interface DesignPanelProps {
  config: ProjectConfig;
  design: DesignConfig;
  controls: ControlsSchema;
  assets: AssetList;
  onConfigChange: (next: ProjectConfig) => void;
  onDesignChange: (next: DesignConfig) => void;
  onSyncSheet: () => void;
  onUploadCsv: (file: File) => void;
  onOpenAssets: (tab: 'images' | 'icons' | 'fonts') => void;
}

const FONT_OPTIONS = [
  { label: 'Barlow Condensed', value: "'Barlow Condensed', 'Oswald', sans-serif" },
  { label: 'Oswald', value: "'Oswald', 'Arial Narrow', sans-serif" },
  { label: 'Inter', value: "'Inter', 'Helvetica Neue', Arial, sans-serif" },
  { label: 'Space Grotesk', value: "'Space Grotesk', sans-serif" },
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
  controls,
  assets,
  onConfigChange,
  onDesignChange,
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

  const setField = (path: string, value: unknown) => {
    updateVariant((v) => setByPath(v, path, value));
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

  const isVisible = (item: ControlItem): boolean => {
    if (!item.showWhen) return true;
    return getByPath(variant, item.showWhen.path) === item.showWhen.equals;
  };

  const renderControl = (item: ControlItem, idx: number): React.ReactNode => {
    if (!isVisible(item)) return null;
    const key = `${item.type}-${item.path || item.label || idx}`;

    if (item.type === 'row') {
      return (
        <div key={key} className="field-row">
          {(item.items || []).map((child, ci) => renderControl(child, ci))}
        </div>
      );
    }

    if (item.type === 'note') {
      return (
        <div key={key} style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>
          {item.text}
        </div>
      );
    }

    if (item.type === 'asset-button' && item.assetKind) {
      const kind = item.assetKind;
      return (
        <button
          key={key}
          type="button"
          className="btn"
          onClick={() => onOpenAssets(kind)}
        >
          {item.label} ({assets[kind].length})
        </button>
      );
    }

    const path = item.path || '';
    const val = getByPath(variant, path) ?? item.defaultValue;

    switch (item.type) {
      case 'text':
        return (
          <div key={key} className="field">
            {item.label && <label>{item.label}</label>}
            <input
              type="text"
              value={String(val ?? '')}
              onChange={(e) => setField(path, e.target.value)}
            />
          </div>
        );

      case 'number':
        return (
          <div key={key} className="field">
            {item.label && <label>{item.label}</label>}
            <input
              type="number"
              min={item.min}
              max={item.max}
              step={item.step}
              value={Number(val ?? 0)}
              onChange={(e) => setField(path, Number(e.target.value))}
            />
          </div>
        );

      case 'range': {
        const num = Number(val ?? item.min ?? 0);
        const display = item.percent
          ? `${Math.round(num * 100)}%`
          : `${Number.isInteger(item.step ?? 1) ? Math.round(num) : num.toFixed(1)}${item.unit || ''}`;
        return (
          <div key={key} className="field">
            <label>
              {item.label} <span>{display}</span>
            </label>
            <input
              type="range"
              min={item.min ?? 0}
              max={item.max ?? 100}
              step={item.step ?? 1}
              value={num}
              onChange={(e) => setField(path, Number(e.target.value))}
            />
          </div>
        );
      }

      case 'checkbox':
        return (
          <label key={key} style={{ justifyContent: 'flex-start', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(val)}
              onChange={(e) => setField(path, e.target.checked)}
            />
            <span>{item.label}</span>
          </label>
        );

      case 'seed':
        return (
          <div key={key} className="field-row">
            <div className="field">
              <label>{item.label || 'Global Seed'}</label>
              <input
                type="number"
                value={Number(val ?? 0)}
                onChange={(e) => setField(path, Number.parseInt(e.target.value, 10) || 0)}
              />
            </div>
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setField(path, Math.floor(Math.random() * 100000))}
              >
                🎲 Shuffle All
              </button>
            </div>
          </div>
        );

      case 'select': {
        const opts = item.preset === 'fonts' ? fontChoices : item.options || [];
        return (
          <div key={key} className="field">
            {item.label && <label>{item.label}</label>}
            <select
              value={String(val ?? '')}
              onChange={(e) => setField(path, e.target.value)}
            >
              {opts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        );
      }

      case 'pills': {
        const opts = item.options || [];
        return (
          <div key={key} className="field">
            {item.label && <label>{item.label}</label>}
            <div className="pill-group">
              {opts.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`pill ${val === o.value ? 'active' : ''}`}
                  onClick={() => setField(path, o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        );
      }

      case 'multi-pills': {
        const opts = item.preset === 'fonts' ? fontChoices : item.options || [];
        const current = Array.isArray(val) ? (val as string[]) : [];
        return (
          <div key={key} className="field">
            {item.label && <label>{item.label}</label>}
            <div className="pill-group">
              {opts.map((o) => {
                const fam = o.value.split(',')[0].trim();
                const active = current.some(
                  (existing) =>
                    existing === o.value ||
                    (item.preset === 'fonts' && existing.split(',')[0].trim() === fam),
                );
                return (
                  <button
                    key={o.value}
                    type="button"
                    className={`pill ${active ? 'active' : ''}`}
                    onClick={() => {
                      const next = active
                        ? current.filter(
                            (existing) =>
                              existing !== o.value &&
                              !(item.preset === 'fonts' && existing.split(',')[0].trim() === fam),
                          )
                        : [...current, o.value];
                      setField(
                        path,
                        item.preset === 'fonts' && next.length === 0 ? [o.value] : next,
                      );
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      }

      case 'color':
        return (
          <ColorAlphaInput
            key={key}
            label={item.label}
            value={String(val ?? '#000000')}
            onChange={(hex) => setField(path, hex)}
          />
        );

      case 'color-map': {
        const map =
          val && typeof val === 'object' ? (val as Record<string, string>) : {};
        return (
          <div key={key} className="color-grid">
            {Object.entries(map).map(([k, hex]) => (
              <ColorAlphaInput
                key={k}
                label={k}
                value={hex}
                onChange={(nextHex) => setField(path, { ...map, [k]: nextHex })}
              />
            ))}
          </div>
        );
      }

      case 'color-list': {
        const list = Array.isArray(val) ? (val as string[]) : [];
        return (
          <div key={key} className="field">
            <label>
              {item.label}
              <button
                type="button"
                className="btn btn-xs"
                onClick={() => setField(path, [...list, '#111111'])}
              >
                + Color
              </button>
            </label>
            <div className="color-grid">
              {list.map((hex, i) => (
                <ColorAlphaInput
                  key={i}
                  value={hex}
                  onChange={(nextHex) => {
                    const next = [...list];
                    next[i] = nextHex;
                    setField(path, next);
                  }}
                  onRemove={
                    list.length > 1
                      ? () =>
                          setField(
                            path,
                            list.filter((_, idx2) => idx2 !== i),
                          )
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

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

      {controls.map((section) => (
        <Section
          key={section.title}
          title={section.title}
          defaultOpen={section.defaultOpen}
        >
          {section.items.map((item, idx) => renderControl(item, idx))}
        </Section>
      ))}
    </aside>
  );
}
