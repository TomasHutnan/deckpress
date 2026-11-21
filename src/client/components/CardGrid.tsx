import React, { useMemo, useState } from 'react';
import { compileTemplateFiles } from '../../shared/runtime';
import type {
  CardOverrides,
  CardSize,
  DesignVariant,
  ExpandedCard,
  ProjectDocsMap,
} from '../../shared/types';

interface CardGridProps {
  slug: string;
  cards: ExpandedCard[];
  cardSize: CardSize;
  variant: DesignVariant;
  templateFiles: Record<string, string>;
  docs: ProjectDocsMap;
  overrides: CardOverrides;
  customCss: string;
  customFontFacesCss: string;
  onRerollCard: (key: string) => void;
  onToggleMark: (key: string) => void;
  onResetCard: (key: string) => void;
}

export function CardGrid({
  slug,
  cards,
  cardSize,
  variant,
  templateFiles,
  docs,
  overrides,
  customCss,
  customFontFacesCss,
  onRerollCard,
  onToggleMark,
  onResetCard,
}: CardGridProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [zoom, setZoom] = useState(0.85);
  const [showAllBacks, setShowAllBacks] = useState(false);
  const [flippedKeys, setFlippedKeys] = useState<Record<string, boolean>>({});

  const toggleFlipCard = (key: string) => {
    setFlippedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const typeGroups = useMemo(() => {
    const set = new Set<string>();
    for (const c of cards) {
      if (c.type_group) set.add(c.type_group);
    }
    return ['all', ...Array.from(set)];
  }, [cards]);

  const visibleCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((c) => {
      if (filterType !== 'all' && c.type_group !== filterType) return false;
      if (!q) return true;
      return Object.values(c).some((v) =>
        v !== undefined && v !== null && String(v).toLowerCase().includes(q),
      );
    });
  }, [cards, filterType, search]);

  const compiled = useMemo(
    () => compileTemplateFiles(templateFiles),
    [templateFiles],
  );

  const assetBaseUrl = `/api/projects/${encodeURIComponent(slug)}/assets`;
  // Show trim size cleanly in preview (bleed is applied automatically during PDF export)
  const previewCardSize: CardSize = {
    widthMm: cardSize.widthMm,
    heightMm: cardSize.heightMm,
    bleedMm: 0,
  };
  const { baseCss, cssError } = useMemo(() => {
    try {
      return {
        baseCss: `${customFontFacesCss}\n${compiled.renderer.getBaseCss(previewCardSize, customCss)}`,
        cssError: null as string | null,
      };
    } catch (err: unknown) {
      return {
        baseCss: customFontFacesCss,
        cssError: err instanceof Error ? err.message : String(err),
      };
    }
  }, [
    compiled,
    customFontFacesCss,
    previewCardSize.widthMm,
    previewCardSize.heightMm,
    customCss,
  ]);

  // Convert mm to CSS px at 96dpi (1mm ≈ 3.7795px) for exact scaled preview frame
  const pxW = Math.round(cardSize.widthMm * 3.779527559 * zoom);
  const pxH = Math.round(cardSize.heightMm * 3.779527559 * zoom);
  const renderError = compiled.error || cssError;

  return (
    <div className="canvas-pane">
      <style>{baseCss}</style>
      {renderError && (
        <div className="banner">
          <strong>renderer.js error:</strong> {renderError}
        </div>
      )}
      <div className="canvas-toolbar">
        <div className="pill-group">
          {typeGroups.map((t) => (
            <button
              key={t}
              type="button"
              className={`pill ${filterType === t ? 'active' : ''}`}
              onClick={() => setFilterType(t)}
            >
              {t === 'all' ? `All (${cards.length})` : t}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="pill-group">
            <button
              type="button"
              className={`pill ${!showAllBacks ? 'active' : ''}`}
              onClick={() => {
                setShowAllBacks(false);
                setFlippedKeys({});
              }}
            >
              Fronts
            </button>
            <button
              type="button"
              className={`pill ${showAllBacks ? 'active' : ''}`}
              onClick={() => {
                setShowAllBacks(true);
                setFlippedKeys({});
              }}
            >
              Backs
            </button>
          </div>
          <input
            type="text"
            placeholder="Search cards..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 180 }}
          />
          <label style={{ gap: 6, whiteSpace: 'nowrap' }}>
            Zoom {Math.round(zoom * 100)}%
            <input
              type="range"
              min={0.5}
              max={1.4}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              style={{ width: 90 }}
            />
          </label>
        </div>
      </div>

      <div className="canvas-scroll">
        <div className="card-grid">
          {visibleCards.map((card, idx) => {
            const isBack = showAllBacks !== Boolean(flippedKeys[card._instanceKey]);
            let html = '';
            try {
              const renderCtx = {
                card,
                variant,
                overrides,
                assetBaseUrl,
                cardIndex: idx,
                cardSize: previewCardSize,
                docs,
              };
              html = isBack
                ? compiled.renderer.renderCardBack(renderCtx)
                : compiled.renderer.renderCard(renderCtx);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              html = `<div style="padding:12px;color:#dc2626;font-size:12px">Render error: ${msg}</div>`;
            }
            const hasOverride = Boolean(overrides[card._instanceKey]);
            return (
              <div key={card._instanceKey} className="card-tile">
                <div className="card-frame" style={{ width: pxW, height: pxH }}>
                  <div
                    className="card-frame-inner"
                    style={{ transform: `scale(${zoom})` }}
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                </div>
                <div className="card-tile-bar" style={{ width: pxW }}>
                  <span title={card._instanceKey}>
                    {card.id}
                    {card._totalCopies > 1 ? ` #${card._copyIndex}` : ''}
                    {isBack ? ' [B]' : ''}
                    {hasOverride ? ' •' : ''}
                  </span>
                  <div className="card-tile-actions">
                    <button
                      type="button"
                      className={`btn btn-xs ${isBack ? 'btn-dark' : ''}`}
                      title="Flip this card (Front / Back)"
                      onClick={() => toggleFlipCard(card._instanceKey)}
                    >
                      ⇄
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs"
                      title="Re-roll randomized layout for this card"
                      onClick={() => onRerollCard(card._instanceKey)}
                    >
                      🎲
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs"
                      title="Toggle game mark on this card"
                      onClick={() => onToggleMark(card._instanceKey)}
                    >
                      M
                    </button>
                    {hasOverride && (
                      <button
                        type="button"
                        className="btn btn-xs"
                        title="Reset card override"
                        onClick={() => onResetCard(card._instanceKey)}
                      >
                        ↺
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
