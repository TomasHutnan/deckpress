import { escapeHtml } from './renderCard.js';
import type { ProjectRenderer } from './runtime.js';
import type {
  CardOverrides,
  CardSize,
  DesignVariant,
  DocOrientation,
  DocPageSize,
  ExpandedCard,
  ProjectDoc,
} from './types.js';

export interface DocPageDims {
  widthMm: number;
  heightMm: number;
}

export function getDocPageDims(
  pageSize: DocPageSize = 'A4',
  orientation: DocOrientation = 'portrait',
): DocPageDims {
  const base: Record<DocPageSize, DocPageDims> = {
    A4: { widthMm: 210, heightMm: 297 },
    A3: { widthMm: 297, heightMm: 420 },
    Letter: { widthMm: 215.9, heightMm: 279.4 },
  };
  const d = base[pageSize] || base.A4;
  return orientation === 'landscape'
    ? { widthMm: d.heightMm, heightMm: d.widthMm }
    : d;
}

export interface RenderDocContext {
  doc: ProjectDoc;
  cards: ExpandedCard[];
  variant: DesignVariant;
  cardSize: CardSize;
  overrides: CardOverrides;
  renderer: ProjectRenderer;
  assetBaseUrl: string;
  customIconsSvg?: string[];
}

function resolvePaletteColor(token: string, palette: Record<string, string>): string {
  const clean = token.trim().replace(/^c(?=[A-Z]{2,})/, '');
  if (/^#[0-9a-fA-F]{3,8}$/.test(clean)) return clean;
  if (clean.toLowerCase() === 'ink') return '#141414';
  if (clean.toLowerCase() === 'muted') return '#555555';
  return palette[clean] || palette[clean.toUpperCase()] || palette.default || '#141414';
}

function isOverviewCard(card: ExpandedCard): boolean {
  const g = (card.type_group || '').trim().toLowerCase();
  return g === 'prehľad' || g === 'prehlad' || g === 'overview';
}

function renderCardThumbnail(
  cardId: string,
  widthMm: number,
  caption: string | undefined,
  ctx: RenderDocContext,
): string {
  const idx = ctx.cards.findIndex(
    (c) => c.id === cardId || c._instanceKey === cardId,
  );
  if (idx === -1) {
    return `<span class="dp-doc-missing">[Missing card: ${escapeHtml(cardId)}]</span>`;
  }
  const card = ctx.cards[idx];
  const zeroBleedSize: CardSize = {
    widthMm: ctx.cardSize.widthMm,
    heightMm: ctx.cardSize.heightMm,
    bleedMm: 0,
  };
  const scale = widthMm / zeroBleedSize.widthMm;
  const heightMm = +(zeroBleedSize.heightMm * scale).toFixed(2);
  const rawHtml = ctx.renderer.renderCard({
    card,
    variant: ctx.variant,
    overrides: ctx.overrides,
    assetBaseUrl: ctx.assetBaseUrl,
    customIconsSvg: ctx.customIconsSvg,
    cardIndex: idx,
    cardSize: zeroBleedSize,
  });

  const captionHtml = caption
    ? `<div class="dp-doc-card-caption">${escapeHtml(caption)}</div>`
    : '';
  return `<figure class="dp-doc-card-fig"><div class="dp-doc-card-frame" style="width:${widthMm}mm;height:${heightMm}mm"><div class="dp-doc-card-scaler" style="width:${zeroBleedSize.widthMm}mm;height:${zeroBleedSize.heightMm}mm;transform:scale(${scale.toFixed(5)})">${rawHtml}</div></div>${captionHtml}</figure>`;
}

function computeCount(spec: string, cards: ExpandedCard[]): number {
  const s = spec.trim();
  const playable = cards.filter((c) => !isOverviewCard(c));
  if (s === 'total' || s === 'playable') return playable.length;
  if (s === 'all') return cards.length;
  if (s.startsWith('kitchen:')) {
    const k = s.slice('kitchen:'.length).trim().toUpperCase();
    if (k === 'DUAL') {
      return playable.filter(
        (c) =>
          c.type_group === 'Surovina' &&
          (c.kitchen.includes(',') || c.kitchen.includes('~')),
      ).length;
    }
    return playable.filter(
      (c) => c.type_group === 'Surovina' && c.kitchen.trim().toUpperCase() === k,
    ).length;
  }
  const target = s.toLowerCase();
  return playable.filter((c) => (c.type_group || '').trim().toLowerCase() === target).length;
}

function expandDirectives(
  input: string,
  ctx: RenderDocContext,
  depth = 0,
): string {
  if (depth > 4) return input;
  return input.replace(/\{\{([a-z-]+)(?::([\s\S]*?))?\}\}/gi, (_match, rawName, rawArg = '') => {
    const name = String(rawName).toLowerCase();
    const arg = String(rawArg).trim();

    if (name === 'pill') {
      const m = arg.match(/^(\S+)(?:\s+"([^"]*)")?$/);
      const key = m ? m[1] : arg;
      const label = m && m[2] ? m[2] : key;
      const color = resolvePaletteColor(key, ctx.variant.palette);
      return `<span class="dp-doc-pill" style="background:${escapeHtml(color)}">${escapeHtml(label)}</span>`;
    }

    if (name === 'color') {
      const m = arg.match(/^(\S+)\s+"([^"]*)"$/);
      if (!m) return escapeHtml(arg);
      const color = resolvePaletteColor(m[1], ctx.variant.palette);
      return `<strong style="color:${escapeHtml(color)}">${escapeHtml(m[2])}</strong>`;
    }

    if (name === 'count') {
      return String(computeCount(arg || 'playable', ctx.cards));
    }

    if (name === 'card') {
      const idMatch = arg.match(/^(\S+)/);
      if (!idMatch) return '';
      const cardId = idMatch[1];
      const wMatch = arg.match(/width=([\d.]+)(?:mm)?/i);
      const capMatch = arg.match(/caption="([^"]*)"/i);
      const widthMm = wMatch ? Number.parseFloat(wMatch[1]) : 19;
      return renderCardThumbnail(cardId, widthMm, capMatch?.[1], ctx);
    }

    if (name === 'card-row') {
      let widthMm = 18.5;
      let rest = arg;
      const wMatch = rest.match(/^width=([\d.]+)(?:mm)?\s+/i);
      if (wMatch) {
        widthMm = Number.parseFloat(wMatch[1]);
        rest = rest.slice(wMatch[0].length);
      }
      const parts = rest.split('|').map((p) => p.trim()).filter(Boolean);
      const itemsHtml = parts
        .map((part) => {
          if (part === '+') {
            return `<span class="dp-doc-row-op">+</span>`;
          }
          const arrowMatch = part.match(/^(?:->|→)(?:\s+"([^"]*)")?$/);
          if (arrowMatch) {
            return `<span class="dp-doc-row-op">→${arrowMatch[1] ? ` <span class="dp-doc-row-label">${escapeHtml(arrowMatch[1])}</span>` : ''}</span>`;
          }
          const cardMatch = part.match(/^(\S+)(?:\s+"([^"]*)")?$/);
          if (!cardMatch) return '';
          return renderCardThumbnail(cardMatch[1], widthMm, cardMatch[2], ctx);
        })
        .join('');
      return `<div class="dp-doc-card-row">${itemsHtml}</div>`;
    }

    if (name === 'diagram') {
      const key = arg.endsWith('.html') ? arg : `${arg}.html`;
      const html = ctx.doc.diagrams[key] ?? ctx.doc.diagrams[arg];
      if (!html) {
        return `<div class="dp-doc-missing">[Missing diagram: ${escapeHtml(arg)}]</div>`;
      }
      return `<div class="dp-doc-diagram">${expandDirectives(html, ctx, depth + 1)}</div>`;
    }

    return _match;
  });
}

function formatInlineMarkdown(text: string, ctx: RenderDocContext): string {
  // Extract directives first so HTML produced by directives isn't escaped
  const tokens: string[] = [];
  const withPlaceholders = text.replace(/\{\{[a-z-]+(?::[\s\S]*?)?\}\}/gi, (m) => {
    const idx = tokens.length;
    tokens.push(expandDirectives(m, ctx));
    return `\u0000DIR${idx}\u0000`;
  });

  let out = escapeHtml(withPlaceholders);
  // Inline code
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold + italic
  out = out.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Restore directive HTML
  out = out.replace(/\u0000DIR(\d+)\u0000/g, (_m, i) => tokens[Number(i)] ?? '');
  return out;
}

/**
 * Lightweight Markdown-to-HTML parser for DeckPress rulebooks & docs.
 * Supports headings (with optional `[COLOR]` accent tag), lists (with 1-level nesting),
 * callouts (`>`), tables, `---col---` column breaks, and `{{directive:...}}` embeds.
 */
export function parseMarkdownBlock(md: string, ctx: RenderDocContext): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let i = 0;

  const isBlank = (l: string) => l.trim() === '';
  const isBlockDirective = (l: string) => /^\{\{(card-row|diagram|card)(?::[\s\S]*)?\}\}$/i.test(l.trim());

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (isBlank(line)) {
      i++;
      continue;
    }

    // Column break
    if (/^---\s*col\s*---$/i.test(trimmed) || /^<!--\s*colbreak\s*-->$/i.test(trimmed)) {
      html.push('<div class="dp-doc-col-break"></div>');
      i++;
      continue;
    }

    // Standalone block directive
    if (isBlockDirective(line)) {
      html.push(expandDirectives(trimmed, ctx));
      i++;
      continue;
    }

    // Headings (#, ##, ###) with optional [COLOR] tag e.g. `## [TAL] Cieľ hry`
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      let titleText = headingMatch[2].trim();
      let colorStyle = '';
      const colorTag = titleText.match(/^\[([^\]]+)\]\s+(.*)$/);
      if (colorTag) {
        const color = resolvePaletteColor(colorTag[1], ctx.variant.palette);
        colorStyle = ` style="--sec-color:${escapeHtml(color)}"`;
        titleText = colorTag[2];
      }
      html.push(
        `<h${level} class="dp-doc-h${level}"${colorStyle}>${formatInlineMarkdown(titleText, ctx)}</h${level}>`,
      );
      i++;
      continue;
    }

    // Callout / blockquote (`> ...`)
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      html.push(
        `<div class="dp-doc-callout">${quoteLines.map((l) => formatInlineMarkdown(l, ctx)).join('<br />')}</div>`,
      );
      continue;
    }

    // Markdown table
    if (
      trimmed.startsWith('|') &&
      i + 1 < lines.length &&
      /^\|[\s:|-]+\|$/.test(lines[i + 1].trim())
    ) {
      const parseRow = (r: string) =>
        r
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());
      const headerCells = parseRow(trimmed);
      const alignCells = parseRow(lines[i + 1]);
      const aligns = alignCells.map((a) =>
        a.startsWith(':') && a.endsWith(':')
          ? 'center'
          : a.endsWith(':')
            ? 'right'
            : 'left',
      );
      i += 2;
      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        bodyRows.push(parseRow(lines[i]));
        i++;
      }
      const hasHeader = headerCells.some((c) => c !== '');
      const thead = hasHeader
        ? `<thead><tr>${headerCells.map((c, idx) => `<th style="text-align:${aligns[idx] || 'left'}">${formatInlineMarkdown(c, ctx)}</th>`).join('')}</tr></thead>`
        : '';
      const tbody = `<tbody>${bodyRows
        .map(
          (r) =>
            `<tr>${r.map((c, idx) => `<td style="text-align:${aligns[idx] || 'left'}">${formatInlineMarkdown(c, ctx)}</td>`).join('')}</tr>`,
        )
        .join('')}</tbody>`;
      html.push(`<table class="dp-doc-table">${thead}${tbody}</table>`);
      continue;
    }

    // Ordered or Unordered list (supports 1 level of nested sub-list)
    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      const isOrdered = /^\d+\.$/.test(listMatch[2]);
      const tag = isOrdered ? 'ol' : 'ul';
      const items: string[] = [];

      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        if (!m) break;
        const indent = m[1].length;
        const itemOrdered = /^\d+\.$/.test(m[2]);
        if (indent === 0 && itemOrdered !== isOrdered) break;

        let itemHtml = formatInlineMarkdown(m[3], ctx);
        i++;

        // Collect nested sub-list items (indented >= 2 spaces)
        const subItems: string[] = [];
        let subOrdered = false;
        while (i < lines.length) {
          const sm = lines[i].match(/^(\s{2,})([-*]|\d+\.)\s+(.*)$/);
          if (!sm) break;
          if (subItems.length === 0) subOrdered = /^\d+\.$/.test(sm[2]);
          subItems.push(`<li>${formatInlineMarkdown(sm[3], ctx)}</li>`);
          i++;
        }
        if (subItems.length > 0) {
          const subTag = subOrdered ? 'ol' : 'ul';
          itemHtml += `<${subTag}>${subItems.join('')}</${subTag}>`;
        }
        items.push(`<li>${itemHtml}</li>`);
      }

      html.push(`<${tag} class="dp-doc-list">${items.join('')}</${tag}>`);
      continue;
    }

    // Muted note line (`~ text`)
    if (trimmed.startsWith('~ ')) {
      html.push(`<p class="dp-doc-note">${formatInlineMarkdown(trimmed.slice(2), ctx)}</p>`);
      i++;
      continue;
    }

    // Regular paragraph (merge consecutive plain lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      !isBlank(lines[i]) &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].trim().startsWith('~ ') &&
      !lines[i].trim().startsWith('|') &&
      !/^(\s*)([-*]|\d+\.)\s+/.test(lines[i]) &&
      !/^---\s*(col|page)\s*---$/i.test(lines[i].trim()) &&
      !isBlockDirective(lines[i])
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    html.push(`<p class="dp-doc-p">${formatInlineMarkdown(paraLines.join(' '), ctx)}</p>`);
  }

  return html.join('\n');
}

export function getOrderedSectionNames(doc: ProjectDoc): string[] {
  const keys = Object.keys(doc.sections);
  if (doc.meta.sections && doc.meta.sections.length > 0) {
    const ordered = doc.meta.sections.filter((s) => doc.sections[s] !== undefined);
    const rest = keys.filter((k) => !ordered.includes(k)).sort();
    return [...ordered, ...rest];
  }
  return keys.sort();
}

export function buildDocPaletteVarsCss(variant: DesignVariant): string {
  const entries = Object.entries(variant.palette || {}).map(
    ([k, v]) => `--dp-pal-${k}: ${v};`,
  );
  return `:root {\n  --dp-doc-bg: ${variant.backgroundColor || '#FFFFFF'};\n  --dp-doc-ink: ${variant.textColor || '#141414'};\n  ${entries.join('\n  ')}\n}`;
}

export function getDocBaseCss(doc: ProjectDoc, variant: DesignVariant): string {
  const dims = getDocPageDims(doc.meta.pageSize, doc.meta.orientation);
  const marginMm = doc.meta.marginMm ?? 9.5;
  const cols = doc.meta.columns ?? 1;

  return `
${buildDocPaletteVarsCss(variant)}

@page {
  size: ${dims.widthMm}mm ${dims.heightMm}mm;
  margin: 0;
}

.dp-doc-root {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  color: var(--dp-doc-ink, #141414);
  font-size: 9pt;
  line-height: 1.35;
}

.dp-doc-page {
  width: ${dims.widthMm}mm;
  height: ${dims.heightMm}mm;
  padding: ${marginMm}mm;
  box-sizing: border-box;
  background: #FFFFFF;
  overflow: hidden;
  page-break-after: always;
  break-after: page;
  position: relative;
}

.dp-doc-page:last-child {
  page-break-after: auto;
  break-after: auto;
}

.dp-doc-cols {
  height: 100%;
  column-count: ${cols};
  column-gap: 6.5mm;
  column-fill: auto;
  column-rule: ${cols > 1 ? '0.4pt solid rgba(0, 0, 0, 0.14)' : 'none'};
}

.dp-doc-col-break {
  break-after: column;
  page-break-after: always;
  height: 0;
}

.dp-doc-h1 {
  margin: 0 0 2.5mm 0;
  padding: 2.5mm 3mm;
  background: var(--sec-color, #141414);
  color: #FFFFFF;
  font-size: 15pt;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  line-height: 1.1;
}

.dp-doc-h2 {
  margin: 2.8mm 0 1.4mm 0;
  padding: 1.1mm 2.2mm;
  background: var(--sec-color, #141414);
  color: #FFFFFF;
  font-size: 9pt;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  line-height: 1.15;
  break-after: avoid;
}

.dp-doc-h2:first-child {
  margin-top: 0;
}

.dp-doc-h3 {
  margin: 2mm 0 0.8mm 0;
  font-size: 8.8pt;
  font-weight: 700;
  color: var(--sec-color, #141414);
  break-after: avoid;
}

.dp-doc-p {
  margin: 0 0 1.6mm 0;
}

.dp-doc-note {
  margin: 0 0 1.6mm 0;
  font-size: 7.8pt;
  color: #555555;
  font-style: italic;
}

.dp-doc-list {
  margin: 0 0 1.6mm 0;
  padding-left: 4.2mm;
}

.dp-doc-list li {
  margin-bottom: 0.8mm;
}

.dp-doc-list ul,
.dp-doc-list ol {
  margin: 0.6mm 0 0.4mm 0;
  padding-left: 4mm;
}

.dp-doc-callout {
  background: #F4F5F6;
  padding: 1.8mm 2.4mm;
  border-radius: 1mm;
  margin: 1.4mm 0 2mm 0;
  font-size: 8.4pt;
  break-inside: avoid;
}

.dp-doc-table {
  width: 100%;
  border-collapse: collapse;
  background: #F4F5F6;
  border-radius: 1mm;
  margin: 1.4mm 0 2mm 0;
  font-size: 8pt;
  break-inside: avoid;
}

.dp-doc-table th,
.dp-doc-table td {
  padding: 1.1mm 2mm;
}

.dp-doc-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 7.5mm;
  padding: 0.3mm 1.2mm;
  border-radius: 0.8mm;
  color: #FFFFFF;
  font-size: 7pt;
  font-weight: 800;
  line-height: 1.15;
  text-align: center;
  vertical-align: middle;
  box-sizing: border-box;
}

.dp-doc-card-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2mm;
  margin: 1.8mm 0 2.4mm 0;
  break-inside: avoid;
}

.dp-doc-card-fig {
  margin: 0;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8mm;
}

.dp-doc-card-frame {
  position: relative;
  overflow: hidden;
  border-radius: 1.2mm;
  box-shadow: 0 0 0 0.25mm rgba(0, 0, 0, 0.16);
  background: #FFFFFF;
  flex-shrink: 0;
}

.dp-doc-card-scaler {
  transform-origin: top left;
  pointer-events: none;
}

.dp-doc-card-caption {
  font-size: 6.8pt;
  color: #555555;
  text-align: center;
  line-height: 1.1;
}

.dp-doc-row-op {
  font-size: 11pt;
  font-weight: 800;
  color: #141414;
  display: inline-flex;
  align-items: center;
  gap: 1mm;
  white-space: nowrap;
}

.dp-doc-row-label {
  font-size: 8pt;
  font-weight: 700;
}

.dp-doc-diagram {
  margin: 1.5mm 0 2mm 0;
  break-inside: avoid;
}

.dp-doc-missing {
  display: inline-block;
  padding: 1mm 2mm;
  background: #FEE2E2;
  color: #991B1B;
  font-size: 7.5pt;
  font-weight: 700;
  border-radius: 1mm;
}
`;
}

/**
 * Renders a project document (either section-split Markdown or programmatic `render.js`)
 * into HTML pages ready for live preview or Chromium PDF export.
 */
export function renderProjectDocHtml(ctx: RenderDocContext): {
  bodyHtml: string;
  css: string;
  error: string | null;
} {
  const baseCss = getDocBaseCss(ctx.doc, ctx.variant);
  const fullCss = `${baseCss}\n${ctx.doc.stylesCss || ''}`;

  // Programmatic doc (`render.js`), e.g. auto-generated Card List
  if (ctx.doc.renderJs && ctx.doc.renderJs.trim()) {
    try {
      const playableCards = ctx.cards.filter((c) => !isOverviewCard(c));
      // eslint-disable-next-line no-new-func
      const fn = new Function('ctx', 'helpers', ctx.doc.renderJs) as (
        renderCtx: {
          cards: ExpandedCard[];
          playableCards: ExpandedCard[];
          variant: DesignVariant;
          cardSize: CardSize;
          meta: ProjectDoc['meta'];
          palette: Record<string, string>;
        },
        helpers: {
          escapeHtml: typeof escapeHtml;
          renderCard: (id: string, widthMm?: number, caption?: string) => string;
          pill: (key: string, label?: string) => string;
        },
      ) => string;
      const bodyHtml = String(
        fn(
          {
            cards: ctx.cards,
            playableCards,
            variant: ctx.variant,
            cardSize: ctx.cardSize,
            meta: ctx.doc.meta,
            palette: ctx.variant.palette,
          },
          {
            escapeHtml,
            renderCard: (id, widthMm = 18, caption) =>
              renderCardThumbnail(id, widthMm, caption, ctx),
            pill: (key, label) => {
              const color = resolvePaletteColor(key, ctx.variant.palette);
              return `<span class="dp-doc-pill" style="background:${escapeHtml(color)}">${escapeHtml(label || key)}</span>`;
            },
          },
        ),
      );
      return { bodyHtml: `<div class="dp-doc-root">${bodyHtml}</div>`, css: fullCss, error: null };
    } catch (err: unknown) {
      return {
        bodyHtml: '',
        css: fullCss,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // Section-split Markdown doc
  const sectionNames = getOrderedSectionNames(ctx.doc);
  const combinedMd = sectionNames.map((name) => ctx.doc.sections[name] || '').join('\n\n');
  const rawPages = combinedMd
    .split(/^\s*(?:---\s*page\s*---|<!--\s*pagebreak\s*-->)\s*$/im)
    .map((p) => p.trim())
    .filter(Boolean);

  const pagesHtml = rawPages
    .map((pageMd) => {
      const inner = parseMarkdownBlock(pageMd, ctx);
      return `<section class="dp-doc-page"><div class="dp-doc-cols">${inner}</div></section>`;
    })
    .join('\n');

  return {
    bodyHtml: `<div class="dp-doc-root">${pagesHtml}</div>`,
    css: fullCss,
    error: null,
  };
}

/**
 * Wraps pre-rendered document HTML and CSS into a full standalone HTML page for Chromium PDF export.
 */
export function wrapDocPrintHtml(params: {
  title: string;
  bodyHtml: string;
  docCss: string;
  cardBaseCss: string;
  fontFacesCss: string;
  baseHref?: string;
}): string {
  const baseTag = params.baseHref ? `<base href="${escapeHtml(params.baseHref)}" />` : '';
  return `<!doctype html>
<html lang="sk">
<head>
  <meta charset="utf-8" />
  ${baseTag}
  <title>${escapeHtml(params.title)}</title>
  <style>
    ${params.fontFacesCss}
    html, body {
      margin: 0;
      padding: 0;
      background: #FFFFFF;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    ${params.cardBaseCss}
    ${params.docCss}
  </style>
</head>
<body>
  ${params.bodyHtml}
</body>
</html>`;
}
