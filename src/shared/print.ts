import { resolveColor } from './layout.js';
import type {
  CardOverrides,
  CardSize,
  DesignVariant,
  ExpandedCard,
  ExportOptions,
} from './types.js';

export function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Minimal, game-agnostic fallback card renderer used when a project does not define `template/index.js`.
 */
export function renderDefaultCardHtml(
  card: ExpandedCard,
  variant: DesignVariant,
  cardSize: CardSize = { widthMm: 63, heightMm: 88, bleedMm: 0 },
): string {
  const colorKey = String(card.color || card.type_group || 'default');
  const accent = resolveColor(colorKey, variant.palette);
  const title = escapeHtml(String(card.title || card.id));
  const subtitle = escapeHtml(String(card.subtitle || card.type_group || ''));
  const desc = escapeHtml(String(card.description || ''));

  return `
    <div class="dp-card" data-card-id="${escapeHtml(card._instanceKey)}" style="--dp-w:${cardSize.widthMm}mm;--dp-h:${cardSize.heightMm}mm;--dp-bleed:${cardSize.bleedMm}mm;--dp-bg:${variant.backgroundColor};--dp-fg:${variant.textColor};--dp-title-font:${variant.typography.titleFont};--dp-body-font:${variant.typography.bodyFont};">
      <div class="dp-trim-area">
        <div class="dp-starter-header" style="background:${escapeHtml(accent)}">
          <div class="dp-starter-title">${title}</div>
          ${subtitle ? `<div class="dp-starter-sub">${subtitle}</div>` : ''}
        </div>
        <div class="dp-starter-body">${desc}</div>
        <div class="dp-starter-footer">${escapeHtml(card.id)}</div>
      </div>
    </div>
  `;
}

export function renderDefaultCardsBaseCss(
  cardSize: CardSize,
  customCss = '',
): string {
  return `
    .dp-card {
      position: relative;
      box-sizing: border-box;
      width: ${cardSize.widthMm + cardSize.bleedMm * 2}mm;
      height: ${cardSize.heightMm + cardSize.bleedMm * 2}mm;
      padding: ${cardSize.bleedMm}mm;
      background: var(--dp-bg, #FFFFFF);
      color: var(--dp-fg, #111111);
      overflow: hidden;
      font-family: var(--dp-body-font, 'Inter', sans-serif);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .dp-trim-area {
      position: relative;
      width: ${cardSize.widthMm}mm;
      height: ${cardSize.heightMm}mm;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: var(--dp-bg, #FFFFFF);
    }
    .dp-starter-header {
      padding: 4mm 3.5mm;
      color: #FFFFFF;
    }
    .dp-starter-title {
      font-family: var(--dp-title-font, sans-serif);
      font-size: 18pt;
      font-weight: 800;
      line-height: 1.05;
    }
    .dp-starter-sub {
      font-size: 8pt;
      opacity: 0.85;
      margin-top: 1mm;
    }
    .dp-starter-body {
      flex: 1;
      padding: 4mm 3.5mm;
      font-size: 9.5pt;
      line-height: 1.35;
    }
    .dp-starter-footer {
      padding: 2mm 3.5mm;
      border-top: 0.3mm solid rgba(0,0,0,0.12);
      font-size: 7.5pt;
      color: #6b7280;
    }
    ${customCss}
  `;
}

function getSheetDimensionsMm(options: ExportOptions): {
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

  const tick = 3;
  const offset = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x1 = originX + c * (cardFullW + gapMm) + bleedMm;
      const x2 = x1 + (cardFullW - bleedMm * 2);
      const y1 = originY + r * (cardFullH + gapMm) + bleedMm;
      const y2 = y1 + (cardFullH - bleedMm * 2);
      lines.push(
        `<line x1="${x1 - offset - tick}" y1="${y1}" x2="${x1 - offset}" y2="${y1}" />`,
        `<line x1="${x1}" y1="${y1 - offset - tick}" x2="${x1}" y2="${y1 - offset}" />`,
        `<line x1="${x2 + offset}" y1="${y1}" x2="${x2 + offset + tick}" y2="${y1}" />`,
        `<line x1="${x2}" y1="${y1 - offset - tick}" x2="${x2}" y2="${y1 - offset}" />`,
        `<line x1="${x1 - offset - tick}" y1="${y2}" x2="${x1 - offset}" y2="${y2}" />`,
        `<line x1="${x1}" y1="${y2 + offset}" x2="${x1}" y2="${y2 + offset + tick}" />`,
        `<line x1="${x2 + offset}" y1="${y2}" x2="${x2 + offset + tick}" y2="${y2}" />`,
        `<line x1="${x2}" y1="${y2 + offset}" x2="${x2}" y2="${y2 + offset + tick}" />`,
      );
    }
  }
  return `<svg class="dp-guidelines dp-crop-marks" viewBox="0 0 ${sheetW} ${sheetH}" width="${sheetW}mm" height="${sheetH}mm">${lines.join('')}</svg>`;
}

/**
 * Pure, game-agnostic print imposition engine: individual cards, packed sheets,
 * long-edge duplex row mirroring, bleed, and crop marks / cut grid.
 */
export function renderPrintDocumentHtml(params: {
  cards: ExpandedCard[];
  variant: DesignVariant;
  overrides: CardOverrides;
  options: ExportOptions;
  assetBaseUrl: string;
  customCss?: string;
  customFontFacesCss?: string;
  customIconsSvg?: string[];
  preRenderedCardsHtml?: string[];
  preRenderedBacksHtml?: string[];
  preRenderedBaseCss?: string;
  baseHref?: string;
}): string {
  const {
    cards,
    variant,
    options,
    customCss = '',
    customFontFacesCss = '',
    preRenderedCardsHtml,
    preRenderedBacksHtml,
    preRenderedBaseCss,
    baseHref,
  } = params;
  const sides = options.sides || 'front';
  const cardSize: CardSize = {
    widthMm: options.cardWidthMm,
    heightMm: options.cardHeightMm,
    bleedMm: options.bleedMm,
  };
  const cardFullW = cardSize.widthMm + cardSize.bleedMm * 2;
  const cardFullH = cardSize.heightMm + cardSize.bleedMm * 2;

  const renderedFronts =
    preRenderedCardsHtml && preRenderedCardsHtml.length > 0
      ? preRenderedCardsHtml
      : cards.map((card) => renderDefaultCardHtml(card, variant, cardSize));

  const renderedBacks =
    preRenderedBacksHtml && preRenderedBacksHtml.length > 0
      ? preRenderedBacksHtml
      : renderedFronts;

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
    const pages: string[] = [];
    if (sides === 'back') {
      for (const html of renderedBacks) {
        pages.push(`<div class="dp-page-individual">${html}</div>`);
      }
    } else if (sides === 'duplex') {
      for (let i = 0; i < renderedFronts.length; i++) {
        pages.push(`<div class="dp-page-individual">${renderedFronts[i]}</div>`);
        pages.push(`<div class="dp-page-individual">${renderedBacks[i] ?? ''}</div>`);
      }
    } else {
      for (const html of renderedFronts) {
        pages.push(`<div class="dp-page-individual">${html}</div>`);
      }
    }
    bodyHtml = pages.join('\n');
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
      .dp-empty-slot {
        width: ${cardFullW}mm;
        height: ${cardFullH}mm;
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

    const mirrorRowsForDuplex = (slice: string[]): string[] => {
      const padded = [...slice];
      while (padded.length < perPage) padded.push('<div class="dp-empty-slot"></div>');
      const mirrored: string[] = [];
      for (let r = 0; r < rows; r++) {
        const rowCells = padded.slice(r * cols, (r + 1) * cols).reverse();
        mirrored.push(...rowCells);
      }
      return mirrored;
    };

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

    const pages: string[] = [];
    const totalCount = sides === 'back' ? renderedBacks.length : renderedFronts.length;
    for (let i = 0; i < totalCount; i += perPage) {
      if (sides === 'back') {
        const backSlice = renderedBacks.slice(i, i + perPage);
        pages.push(
          `<div class="dp-sheet"><div class="dp-sheet-grid">${backSlice.join('')}</div>${guideSvg}</div>`,
        );
      } else if (sides === 'duplex') {
        const frontSlice = renderedFronts.slice(i, i + perPage);
        const backSlice = mirrorRowsForDuplex(renderedBacks.slice(i, i + perPage));
        pages.push(
          `<div class="dp-sheet"><div class="dp-sheet-grid">${frontSlice.join('')}</div>${guideSvg}</div>`,
        );
        pages.push(
          `<div class="dp-sheet"><div class="dp-sheet-grid">${backSlice.join('')}</div>${guideSvg}</div>`,
        );
      } else {
        const frontSlice = renderedFronts.slice(i, i + perPage);
        pages.push(
          `<div class="dp-sheet"><div class="dp-sheet-grid">${frontSlice.join('')}</div>${guideSvg}</div>`,
        );
      }
    }
    bodyHtml = pages.join('\n');
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  ${baseHref ? `<base href="${escapeHtml(baseHref)}" />` : ''}
  <title>DeckPress Print</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #FFFFFF; }
    ${customFontFacesCss}
    ${preRenderedBaseCss ?? renderDefaultCardsBaseCss(cardSize, customCss)}
    ${pageCss}
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}
