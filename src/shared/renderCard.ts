import { BUILTIN_FOOD_ICONS } from './defaults.js';
import { computeCardLayout } from './layout.js';
import type {
  CardOverrides,
  CardSize,
  ComputedCardLayout,
  DesignVariant,
  DividerStyle,
  ExpandedCard,
  ExportOptions,
} from './types.js';

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderDividerHtml(style: DividerStyle): string {
  switch (style) {
    case 'double-blue':
      return `<div class="dp-divider dp-divider-double" style="--d1:#2563EB;--d2:#2563EB"></div>`;
    case 'double-pink':
      return `<div class="dp-divider dp-divider-double" style="--d1:#EC4899;--d2:#EC4899"></div>`;
    case 'red-blue':
      return `<div class="dp-divider dp-divider-double" style="--d1:#EF4444;--d2:#3B82F6"></div>`;
    case 'double-grey':
      return `<div class="dp-divider dp-divider-double" style="--d1:#A3A3A3;--d2:#A3A3A3"></div>`;
    case 'single-black':
    default:
      return `<div class="dp-divider dp-divider-single" style="--d1:#111111"></div>`;
  }
}

function renderPatternLayer(
  layout: ComputedCardLayout,
  variant: DesignVariant,
  customIconsSvg?: string[],
): string {
  if (variant.canvas.mode !== 'pattern') return '';
  const icons =
    customIconsSvg && customIconsSvg.length > 0
      ? customIconsSvg
      : BUILTIN_FOOD_ICONS;
  const stamps = layout.patternStamps
    .map((s) => {
      const inner = icons[s.iconIndex % icons.length];
      const sizePx = Math.round(20 * variant.canvas.patternScale * s.scale);
      return `<svg class="dp-pattern-icon" viewBox="0 0 24 24" style="left:${s.xPct}%;top:${s.yPct}%;width:${sizePx}px;height:${sizePx}px;transform:translate(-50%,-50%) rotate(${s.rotateDeg}deg)">${inner}</svg>`;
    })
    .join('');

  return `<div class="dp-pattern-layer" style="opacity:${variant.canvas.patternOpacity};color:${layout.primaryColor}">${stamps}</div>`;
}

function renderImageLayer(
  card: ExpandedCard,
  variant: DesignVariant,
  assetBaseUrl: string,
  overrideImage?: string,
): string {
  if (variant.canvas.mode !== 'image') return '';
  const rawPath = (overrideImage || card.image || '').trim();
  if (!rawPath) return '';
  const filename = rawPath.replace(/^images\//i, '');
  const src = `${assetBaseUrl}/images/${encodeURIComponent(filename)}`;
  return `<div class="dp-image-layer"><img src="${escapeHtml(src)}" alt="" onerror="this.style.display='none'" /></div>`;
}

function renderMarkLayer(layout: ComputedCardLayout): string {
  if (!layout.showMark) return '';
  return `<div class="dp-game-mark" style="left:${layout.markXPct}%;top:${layout.markYPct}%;font-family:${layout.markFont};color:${layout.markColor};font-size:${layout.markSizePt}pt;transform:translate(-50%,-50%) rotate(${layout.markRotateDeg}deg)">${escapeHtml(layout.markText)}</div>`;
}

function renderDualCard(
  card: ExpandedCard,
  layout: ComputedCardLayout,
  variant: DesignVariant,
): string {
  const kitchens = card.kitchen.split('~').map((s) => s.trim());
  const topKitchen = kitchens[1] || kitchens[0] || '';
  const bottomKitchen = kitchens[0] || kitchens[1] || '';
  const isVeg = /\bV\b/.test(card.tags_str);
  const topTags = `${topKitchen}${isVeg ? '  V' : ''}`.trim();
  const bottomTags = `${bottomKitchen}${isVeg ? '  V' : ''}`.trim();
  const topColor = layout.secondaryColor || layout.primaryColor;
  const bottomColor = layout.primaryColor;
  const sub = card.subtitle || card.title;

  return `
    <div class="dp-dual-half dp-dual-top">
      <div class="dp-top-block dp-block-solid" style="left:${layout.topBlockLeftPct}%;height:26%;background:${topColor}">
        <div class="dp-title">${escapeHtml(card.title)}</div>
        <div class="dp-tags" style="margin-left:${layout.tagsLeftPct}%">${escapeHtml(topTags)}</div>
      </div>
      <div class="dp-dual-sub dp-dual-sub-top">${escapeHtml(sub)}</div>
    </div>
    ${renderMarkLayer(layout)}
    <div class="dp-dual-half dp-dual-bottom">
      <div class="dp-top-block dp-block-solid" style="left:${layout.dualBottomLeftPct}%;height:26%;background:${bottomColor}">
        <div class="dp-title">${escapeHtml(card.title)}</div>
        <div class="dp-tags" style="margin-left:${layout.dualBottomTagsLeftPct}%">${escapeHtml(bottomTags)}</div>
      </div>
      <div class="dp-dual-sub dp-dual-sub-top">${escapeHtml(sub)}</div>
    </div>
  `;
}

function renderActionOrSpecial(
  card: ExpandedCard,
  layout: ComputedCardLayout,
  variant: DesignVariant,
): string {
  const isAction = layout.kind === 'action';
  const badge = isAction ? 'AKCIA' : 'ŠPECIÁLNA';
  const staysOnTable = /ostáva na stole/i.test(card.description);

  return `
    <div class="dp-top-block dp-block-solid dp-block-compact" style="left:${Math.min(layout.topBlockLeftPct, 16)}%;height:26%;background:${layout.primaryColor}">
      <div class="dp-title dp-title-action">${escapeHtml(card.title)}</div>
      <div class="dp-tags">${escapeHtml(badge)}</div>
    </div>
    <div class="dp-body-zone">
      <p class="dp-description">${escapeHtml(card.description)}</p>
    </div>
    <div class="dp-bottom-zone">
      ${variant.divider.enabled ? renderDividerHtml(layout.dividerStyle) : ''}
      <div class="dp-subtitle dp-subtitle-muted">${escapeHtml(staysOnTable ? 'OSTÁVA NA STOLE' : badge)}</div>
    </div>
  `;
}

export function renderCardHtml(
  card: ExpandedCard,
  variant: DesignVariant,
  overrides: CardOverrides,
  assetBaseUrl: string,
  customIconsSvg?: string[],
): { html: string; layout: ComputedCardLayout } {
  const override = overrides[card._instanceKey] ?? overrides[card.id];
  const iconCount =
    customIconsSvg && customIconsSvg.length > 0
      ? customIconsSvg.length
      : BUILTIN_FOOD_ICONS.length;
  const layout = computeCardLayout(card, variant, override, iconCount);

  let inner = '';
  if (layout.kind === 'ingredient-dual') {
    inner = renderDualCard(card, layout, variant);
  } else if (layout.kind === 'action' || layout.kind === 'special') {
    inner = renderActionOrSpecial(card, layout, variant);
  } else {
    const isHalf = layout.kind === 'ingredient-half';
    const blockClass = isHalf ? 'dp-block-outline' : 'dp-block-solid';
    const blockStyle = isHalf
      ? `left:${layout.topBlockLeftPct}%;height:${layout.topBlockHeightPct}%;border:${variant.topBlock.halfBorderMm}mm solid ${layout.primaryColor};border-right:${variant.topBlock.bleedRight ? '0' : `${variant.topBlock.halfBorderMm}mm solid ${layout.primaryColor}`};color:${layout.primaryColor};background:transparent`
      : `left:${layout.topBlockLeftPct}%;height:${layout.topBlockHeightPct}%;background:${layout.primaryColor};color:#FFFFFF`;

    const subtitle = card.subtitle || card.title;
    const ovalSvg = layout.showOvalAccent
      ? `<svg class="dp-oval-accent" viewBox="0 0 140 44" preserveAspectRatio="none"><ellipse cx="70" cy="22" rx="64" ry="17" fill="none" stroke="#EF4444" stroke-width="2.2" transform="rotate(-4 70 22)"/></svg>`
      : '';

    inner = `
      <div class="dp-top-block ${blockClass}" style="${blockStyle}">
        <div class="dp-title">${escapeHtml(card.title)}</div>
        <div class="dp-tags" style="margin-left:${layout.tagsLeftPct}%">${escapeHtml(card.tags_str)}</div>
      </div>
      ${renderPatternLayer(layout, variant, customIconsSvg)}
      ${renderImageLayer(card, variant, assetBaseUrl, override?.image)}
      ${renderMarkLayer(layout)}
      <div class="dp-bottom-zone">
        ${variant.divider.enabled ? renderDividerHtml(layout.dividerStyle) : ''}
        <div class="dp-subtitle-wrap">
          ${ovalSvg}
          <div class="dp-subtitle">${escapeHtml(subtitle)}</div>
        </div>
      </div>
    `;
  }

  const html = `
    <div class="dp-card dp-kind-${layout.kind}" data-card-id="${escapeHtml(card._instanceKey)}" style="--dp-bg:${variant.backgroundColor};--dp-fg:${variant.textColor};--dp-title-font:${variant.typography.titleFont};--dp-tags-font:${variant.typography.tagsFont};--dp-sub-font:${variant.typography.subtitleFont};--dp-body-font:${variant.typography.bodyFont};--dp-title-size:${variant.typography.titleSizePt}pt;--dp-tags-size:${variant.typography.tagsSizePt}pt;--dp-sub-size:${variant.typography.subtitleSizePt}pt;--dp-body-size:${variant.typography.bodySizePt}pt;">
      <div class="dp-trim-area">
        ${inner}
      </div>
    </div>
  `;

  return { html, layout };
}

export const GOOGLE_FONTS_LINK =
  'https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Inter:ital,wght@0,400;0,600;1,300;1,400&family=Oswald:wght@500;700&family=Pacifico&family=Space+Grotesk:wght@500;700&display=swap';

export function renderCardsBaseCss(cardSize: CardSize, customCss = ''): string {
  return `
    .dp-card {
      position: relative;
      box-sizing: border-box;
      width: ${cardSize.widthMm + cardSize.bleedMm * 2}mm;
      height: ${cardSize.heightMm + cardSize.bleedMm * 2}mm;
      padding: ${cardSize.bleedMm}mm;
      background: var(--dp-bg, #FFFFFF);
      color: var(--dp-fg, #0F0F0F);
      overflow: hidden;
      font-family: var(--dp-body-font);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .dp-trim-area {
      position: relative;
      width: ${cardSize.widthMm}mm;
      height: ${cardSize.heightMm}mm;
      overflow: hidden;
      background: var(--dp-bg, #FFFFFF);
    }
    .dp-top-block {
      position: absolute;
      top: 2mm;
      right: -${cardSize.bleedMm + 2}mm;
      box-sizing: border-box;
      padding: 1.5mm ${cardSize.bleedMm + 4}mm 2mm 1.5mm;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      z-index: 3;
    }
    .dp-block-solid {
      color: #FFFFFF;
    }
    .dp-title {
      font-family: var(--dp-title-font);
      font-size: var(--dp-title-size);
      font-weight: 700;
      line-height: 0.94;
      letter-spacing: -0.02em;
      text-transform: uppercase;
      margin-left: -1mm;
      white-space: nowrap;
    }
    .dp-title-action {
      font-size: calc(var(--dp-title-size) * 0.68);
      white-space: normal;
      line-height: 1.05;
      margin-left: 0;
    }
    .dp-tags {
      font-family: var(--dp-tags-font);
      font-size: var(--dp-tags-size);
      font-style: italic;
      font-weight: 300;
      letter-spacing: 0.08em;
      margin-top: 1.2mm;
      align-self: flex-start;
      white-space: nowrap;
    }
    .dp-pattern-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 1;
    }
    .dp-pattern-icon {
      position: absolute;
    }
    .dp-image-layer {
      position: absolute;
      top: 34%;
      left: 8%;
      right: 8%;
      bottom: 18%;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
    }
    .dp-image-layer img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .dp-game-mark {
      position: absolute;
      z-index: 4;
      white-space: nowrap;
      line-height: 1;
      pointer-events: none;
    }
    .dp-body-zone {
      position: absolute;
      top: 33%;
      left: 7%;
      right: 7%;
      bottom: 18%;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      z-index: 3;
    }
    .dp-description {
      margin: 0;
      font-family: var(--dp-body-font);
      font-size: var(--dp-body-size);
      line-height: 1.45;
      font-weight: 400;
    }
    .dp-bottom-zone {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 14%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      z-index: 4;
    }
    .dp-divider {
      width: 100%;
      margin-bottom: 2.2mm;
    }
    .dp-divider-single {
      border-top: 0.45mm solid var(--d1, #111111);
    }
    .dp-divider-double {
      border-top: 0.35mm solid var(--d1, #2563EB);
      border-bottom: 0.35mm solid var(--d2, #2563EB);
      height: 1.1mm;
      box-sizing: border-box;
    }
    .dp-subtitle-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 3mm;
    }
    .dp-subtitle {
      font-family: var(--dp-sub-font);
      font-size: var(--dp-sub-size);
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      text-align: center;
      line-height: 1.05;
      position: relative;
      z-index: 2;
    }
    .dp-subtitle-muted {
      font-size: calc(var(--dp-sub-size) * 0.72);
      letter-spacing: 0.1em;
      opacity: 0.65;
    }
    .dp-oval-accent {
      position: absolute;
      inset: -3mm -4mm;
      width: calc(100% + 8mm);
      height: calc(100% + 6mm);
      z-index: 1;
      pointer-events: none;
    }
    /* Dual-cuisine 180-degree reversible card */
    .dp-dual-half {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .dp-dual-bottom {
      transform: rotate(180deg);
    }
    .dp-dual-sub-top {
      position: absolute;
      top: 30%;
      left: 0;
      right: 0;
      text-align: center;
      font-family: var(--dp-sub-font);
      font-size: calc(var(--dp-sub-size) * 0.85);
      font-weight: 700;
      text-transform: uppercase;
      transform: rotate(180deg);
    }
    ${customCss}
  `;
}

export function getSheetDimensionsMm(options: ExportOptions): {
  widthMm: number;
  heightMm: number;
} {
  switch (options.sheetFormat) {
    case 'a3':
      return { widthMm: 297, heightMm: 420 };
    case 'letter':
      return { widthMm: 215.9, heightMm: 279.4 };
    case 'custom':
      return {
        widthMm: Math.max(50, options.sheetWidthMm ?? 210),
        heightMm: Math.max(50, options.sheetHeightMm ?? 297),
      };
    case 'a4':
    default:
      return { widthMm: 210, heightMm: 297 };
  }
}

function renderGuidelinesSvg(
  sheetW: number,
  sheetH: number,
  cols: number,
  rows: number,
  cardFullW: number,
  cardFullH: number,
  bleedMm: number,
  gapMm: number,
  originX: number,
  originY: number,
  guidelines: ExportOptions['guidelines'],
): string {
  if (guidelines === 'none') return '';
  const lines: string[] = [];

  if (guidelines === 'cut-grid') {
    // Draw full-page dashed cut lines along every card trim edge
    for (let c = 0; c < cols; c++) {
      const leftTrim = originX + c * (cardFullW + gapMm) + bleedMm;
      const rightTrim = leftTrim + (cardFullW - bleedMm * 2);
      lines.push(
        `<line x1="${leftTrim}" y1="0" x2="${leftTrim}" y2="${sheetH}" />`,
        `<line x1="${rightTrim}" y1="0" x2="${rightTrim}" y2="${sheetH}" />`,
      );
    }
    for (let r = 0; r < rows; r++) {
      const topTrim = originY + r * (cardFullH + gapMm) + bleedMm;
      const bottomTrim = topTrim + (cardFullH - bleedMm * 2);
      lines.push(
        `<line x1="0" y1="${topTrim}" x2="${sheetW}" y2="${topTrim}" />`,
        `<line x1="0" y1="${bottomTrim}" x2="${sheetW}" y2="${bottomTrim}" />`,
      );
    }
    return `<svg class="dp-guidelines dp-cut-grid" viewBox="0 0 ${sheetW} ${sheetH}" width="${sheetW}mm" height="${sheetH}mm">${lines.join('')}</svg>`;
  }

  // Corner crop marks (3mm ticks outside each trim corner)
  const tick = 3;
  const offset = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x1 = originX + c * (cardFullW + gapMm) + bleedMm;
      const x2 = x1 + (cardFullW - bleedMm * 2);
      const y1 = originY + r * (cardFullH + gapMm) + bleedMm;
      const y2 = y1 + (cardFullH - bleedMm * 2);
      lines.push(
        // Top-left
        `<line x1="${x1 - offset - tick}" y1="${y1}" x2="${x1 - offset}" y2="${y1}" />`,
        `<line x1="${x1}" y1="${y1 - offset - tick}" x2="${x1}" y2="${y1 - offset}" />`,
        // Top-right
        `<line x1="${x2 + offset}" y1="${y1}" x2="${x2 + offset + tick}" y2="${y1}" />`,
        `<line x1="${x2}" y1="${y1 - offset - tick}" x2="${x2}" y2="${y1 - offset}" />`,
        // Bottom-left
        `<line x1="${x1 - offset - tick}" y1="${y2}" x2="${x1 - offset}" y2="${y2}" />`,
        `<line x1="${x1}" y1="${y2 + offset}" x2="${x1}" y2="${y2 + offset + tick}" />`,
        // Bottom-right
        `<line x1="${x2 + offset}" y1="${y2}" x2="${x2 + offset + tick}" y2="${y2}" />`,
        `<line x1="${x2}" y1="${y2 + offset}" x2="${x2}" y2="${y2 + offset + tick}" />`,
      );
    }
  }
  return `<svg class="dp-guidelines dp-crop-marks" viewBox="0 0 ${sheetW} ${sheetH}" width="${sheetW}mm" height="${sheetH}mm">${lines.join('')}</svg>`;
}

export function renderPrintDocumentHtml(params: {
  cards: ExpandedCard[];
  variant: DesignVariant;
  overrides: CardOverrides;
  options: ExportOptions;
  assetBaseUrl: string;
  customCss?: string;
  customFontFacesCss?: string;
  customIconsSvg?: string[];
}): string {
  const { cards, variant, overrides, options, assetBaseUrl, customCss = '', customFontFacesCss = '', customIconsSvg } = params;
  const cardSize: CardSize = {
    widthMm: options.cardWidthMm,
    heightMm: options.cardHeightMm,
    bleedMm: options.bleedMm,
  };
  const cardFullW = cardSize.widthMm + cardSize.bleedMm * 2;
  const cardFullH = cardSize.heightMm + cardSize.bleedMm * 2;

  const renderedCards = cards.map(
    (card) => renderCardHtml(card, variant, overrides, assetBaseUrl, customIconsSvg).html,
  );

  let bodyHtml = '';
  let pageCss = '';

  if (options.mode === 'individual') {
    pageCss = `
      @page { size: ${cardFullW}mm ${cardFullH}mm; margin: 0; }
      .dp-page-individual {
        width: ${cardFullW}mm;
        height: ${cardFullH}mm;
        page-break-after: always;
        break-after: page;
        position: relative;
        overflow: hidden;
      }
      .dp-page-individual:last-child { page-break-after: auto; break-after: auto; }
    `;
    bodyHtml = renderedCards
      .map((html) => `<div class="dp-page-individual">${html}</div>`)
      .join('\n');
  } else {
    const { widthMm: sheetW, heightMm: sheetH } = getSheetDimensionsMm(options);
    const gapMm = Math.max(0, options.gapMm);
    const marginMinMm = options.guidelines === 'none' ? 4 : 6;
    const cols = Math.max(1, Math.floor((sheetW - marginMinMm * 2 + gapMm) / (cardFullW + gapMm)));
    const rows = Math.max(1, Math.floor((sheetH - marginMinMm * 2 + gapMm) / (cardFullH + gapMm)));
    const perPage = cols * rows;
    const gridW = cols * cardFullW + (cols - 1) * gapMm;
    const gridH = rows * cardFullH + (rows - 1) * gapMm;
    const originX = (sheetW - gridW) / 2;
    const originY = (sheetH - gridH) / 2;

    pageCss = `
      @page { size: ${sheetW}mm ${sheetH}mm; margin: 0; }
      .dp-sheet {
        position: relative;
        width: ${sheetW}mm;
        height: ${sheetH}mm;
        page-break-after: always;
        break-after: page;
        overflow: hidden;
        background: #FFFFFF;
      }
      .dp-sheet:last-child { page-break-after: auto; break-after: auto; }
      .dp-sheet-grid {
        position: absolute;
        left: ${originX}mm;
        top: ${originY}mm;
        display: grid;
        grid-template-columns: repeat(${cols}, ${cardFullW}mm);
        grid-template-rows: repeat(${rows}, ${cardFullH}mm);
        gap: ${gapMm}mm;
      }
      .dp-guidelines {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 20;
      }
      .dp-cut-grid line {
        stroke: rgba(0, 0, 0, 0.35);
        stroke-width: 0.2;
        stroke-dasharray: 1.5 1.5;
      }
      .dp-crop-marks line {
        stroke: rgba(0, 0, 0, 0.75);
        stroke-width: 0.25;
      }
    `;

    const pages: string[] = [];
    for (let i = 0; i < renderedCards.length; i += perPage) {
      const slice = renderedCards.slice(i, i + perPage);
      const guideSvg = renderGuidelinesSvg(
        sheetW,
        sheetH,
        cols,
        rows,
        cardFullW,
        cardFullH,
        cardSize.bleedMm,
        gapMm,
        originX,
        originY,
        options.guidelines,
      );
      pages.push(
        `<div class="dp-sheet"><div class="dp-sheet-grid">${slice.join('')}</div>${guideSvg}</div>`,
      );
    }
    bodyHtml = pages.join('\n');
  }

  return `<!doctype html>
<html lang="sk">
<head>
  <meta charset="utf-8" />
  <title>DeckPress Print</title>
  <link rel="stylesheet" href="${GOOGLE_FONTS_LINK}" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #FFFFFF; }
    ${customFontFacesCss}
    ${renderCardsBaseCss(cardSize, customCss)}
    ${pageCss}
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}
