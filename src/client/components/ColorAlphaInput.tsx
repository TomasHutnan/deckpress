import React from 'react';

export function parseHexWithAlpha(value: string): { rgb: string; alphaPct: number } {
  const raw = (value || '').trim();
  const hex = raw.startsWith('#') ? raw.slice(1) : raw;

  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return { rgb: `#${hex.toUpperCase()}`, alphaPct: 100 };
  }
  if (/^[0-9a-fA-F]{8}$/.test(hex)) {
    const rgb = `#${hex.slice(0, 6).toUpperCase()}`;
    const alphaByte = Number.parseInt(hex.slice(6, 8), 16);
    return { rgb, alphaPct: Math.round((alphaByte / 255) * 100) };
  }
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const r = hex[0] + hex[0];
    const g = hex[1] + hex[1];
    const b = hex[2] + hex[2];
    return { rgb: `#${(r + g + b).toUpperCase()}`, alphaPct: 100 };
  }
  if (/^[0-9a-fA-F]{4}$/.test(hex)) {
    const r = hex[0] + hex[0];
    const g = hex[1] + hex[1];
    const b = hex[2] + hex[2];
    const a = Number.parseInt(hex[3] + hex[3], 16);
    return {
      rgb: `#${(r + g + b).toUpperCase()}`,
      alphaPct: Math.round((a / 255) * 100),
    };
  }
  return { rgb: '#000000', alphaPct: 100 };
}

export function formatHexWithAlpha(rgb: string, alphaPct: number): string {
  const cleanRgb = /^#[0-9a-fA-F]{6}$/.test(rgb) ? rgb.toUpperCase() : '#000000';
  const clamped = Math.max(0, Math.min(100, Math.round(alphaPct)));
  if (clamped >= 100) return cleanRgb;
  const alphaHex = Math.round((clamped / 100) * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  return `${cleanRgb}${alphaHex}`;
}

interface ColorAlphaInputProps {
  value: string;
  label?: string;
  onChange: (nextHex: string) => void;
  onRemove?: () => void;
}

export function ColorAlphaInput({
  value,
  label,
  onChange,
  onRemove,
}: ColorAlphaInputProps) {
  const { rgb, alphaPct } = parseHexWithAlpha(value);

  return (
    <div className="color-alpha">
      <input
        type="color"
        value={rgb}
        title={formatHexWithAlpha(rgb, alphaPct)}
        onChange={(e) => onChange(formatHexWithAlpha(e.target.value, alphaPct))}
      />
      {label && <span className="color-alpha-label">{label}</span>}
      <input
        type="range"
        className="color-alpha-slider"
        min={0}
        max={100}
        step={1}
        value={alphaPct}
        title={`Opacity: ${alphaPct}%`}
        onChange={(e) => onChange(formatHexWithAlpha(rgb, Number(e.target.value)))}
      />
      <span className="color-alpha-pct">{alphaPct}%</span>
      {onRemove && (
        <button
          type="button"
          className="btn btn-xs"
          title="Remove color"
          onClick={onRemove}
        >
          ×
        </button>
      )}
    </div>
  );
}
