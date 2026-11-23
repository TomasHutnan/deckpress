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
  /** When true (Studio preview), highlight commented lines and render hover comment markers. Defaults to false (export-safe). */
  includeComments?: boolean;
  /** When true (Studio preview), attach data-dp-section / data-dp-line attributes for click-to-focus navigation. Defaults to false. */
  includeSourceMap?: boolean;
}

export interface DocCommentRange {
  from: number;
  to: number;
  innerFrom: number;
  innerTo: number;
  text: string;
}

export function isLayoutDirectiveComment(body: string): boolean {
  return /^(?:colbreak|pagebreak)$/i.test(body.trim());
}

/**
 * Finds all playtest HTML comments (`<!-- ... -->`) in Markdown text,
 * ignoring DeckPress layout directives (`<!-- colbreak -->`, `<!-- pagebreak -->`).
 */
export function findDocCommentRanges(text: string): DocCommentRange[] {
  const ranges: DocCommentRange[] = [];
  const re = /<!--([\s\S]*?)-->/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (isLayoutDirectiveComment(m[1])) continue;
    ranges.push({
      from: m.index,
      to: m.index + m[0].length,
      innerFrom: m.index + 4,
      innerTo: m.index + m[0].length - 3,
      text: m[1].trim(),
    });
  }
  return ranges;
}

export function countSectionComments(md: string): number {
  return findDocCommentRanges(md).length;
}

export function countDocComments(doc: ProjectDoc): number {
  return Object.values(doc.sections || {}).reduce(
    (sum, md) => sum + countSectionComments(md || ''),
    0,
  );
}

interface SourceLine {
  text: string;
  section: string;
  line: number;
}

function stripInlineCommentsFromLine(line: string): { text: string; hadComment: boolean } {
  const ranges = findDocCommentRanges(line);
  if (ranges.length === 0) return { text: line, hadComment: false };
  let out = '';
  let cursor = 0;
  for (const r of ranges) {
    out += line.slice(cursor, r.from);
    cursor = r.to;
  }
  out += line.slice(cursor);
  // Collapse double spaces left by removing an inline comment while preserving leading indentation
  const indentMatch = out.match(/^(\s*)(.*)$/);
  const indent = indentMatch ? indentMatch[1] : '';
  const body = (indentMatch ? indentMatch[2] : out).replace(/ {2,}/g, ' ').trimEnd();
  return { text: `${indent}${body}`, hadComment: true };
}

function normalizeSectionLines(
  sectionName: string,
  md: string,
  includeComments: boolean,
): SourceLine[] {
  const rawLines = md.replace(/\r\n/g, '\n').split('\n');
  // First pass: fold multi-line non-layout `<!-- ... -->` comments onto their starting line
  // while preserving original 1-based line numbers for all subsequent lines.
  const folded: SourceLine[] = [];
  let i = 0;
  while (i < rawLines.length) {
    let lineText = rawLines[i];
    const startLine = i + 1;
    i++;
    // Check if an unclosed `<!--` remains at the end of this line
    while (true) {
      const lastOpen = lineText.lastIndexOf('<!--');
      const lastClose = lineText.lastIndexOf('-->');
      if (lastOpen !== -1 && lastOpen > lastClose && i < rawLines.length) {
        lineText = `${lineText} ${rawLines[i].trim()}`;
        i++;
      } else {
        break;
      }
    }

    if (includeComments) {
      folded.push({ text: lineText, section: sectionName, line: startLine });
    } else {
      const stripped = stripInlineCommentsFromLine(lineText);
      // Drop lines that contained only playtest comments so export has zero blank-line artifacts
      if (stripped.hadComment && stripped.text.trim() === '') {
        continue;
      }
      folded.push({ text: stripped.text, section: sectionName, line: startLine });
    }
  }
  return folded;
}

/**
 * Strips all playtest HTML comments from Markdown while preserving layout directives
 * (`<!-- colbreak -->`, `<!-- pagebreak -->`) and avoiding extra blank lines.
 */
export function stripDocComments(md: string): string {
  return normalizeSectionLines('', md, false)
    .map((l) => l.text)
    .join('\n');
}

/**
 * Updates the Nth (0-based) playtest comment in a Markdown section.
 * If `nextText` is blank, deletes the comment cleanly.
 */
export function updateDocComment(md: string, commentIdx: number, nextText: string): string {
  const trimmed = nextText.trim();
  if (!trimmed) return deleteDocComment(md, commentIdx);
  const ranges = findDocCommentRanges(md);
  const target = ranges[commentIdx];
  if (!target) return md;
  return `${md.slice(0, target.from)}<!-- ${trimmed} -->${md.slice(target.to)}`;
}

/**
 * Deletes the Nth (0-based) playtest comment in a Markdown section,
 * removing the entire line if the comment stood alone or collapsing a single leading space if inline.
 */
export function deleteDocComment(md: string, commentIdx: number): string {
  const ranges = findDocCommentRanges(md);
  const target = ranges[commentIdx];
  if (!target) return md;

  const lineStart = md.lastIndexOf('\n', target.from - 1) + 1;
  const nextNl = md.indexOf('\n', target.to);
  const lineEnd = nextNl === -1 ? md.length : nextNl;
  const beforeOnLine = md.slice(lineStart, target.from);
  const afterOnLine = md.slice(target.to, lineEnd);

  // If the comment was the only content on its line, drop the whole line
  if (beforeOnLine.trim() === '' && afterOnLine.trim() === '') {
    if (nextNl !== -1) {
      return md.slice(0, lineStart) + md.slice(nextNl + 1);
    }
    if (lineStart > 0) {
      return md.slice(0, lineStart - 1);
    }
    return '';
  }

  let delFrom = target.from;
  let delTo = target.to;
  if (delFrom > lineStart && md[delFrom - 1] === ' ') {
    delFrom -= 1;
  } else if (delTo < lineEnd && md[delTo] === ' ') {
    delTo += 1;
  }
  return md.slice(0, delFrom) + md.slice(delTo);
}

/**
 * Appends a new playtest comment (`<!-- text -->`) to the end of a 1-based line in a Markdown section.
 */
export function appendCommentToLine(md: string, lineNumber: number, commentText: string): string {
  const trimmed = commentText.trim();
  if (!trimmed) return md;
  const eol = md.includes('\r\n') ? '\r\n' : '\n';
  const lines = md.split(/\r?\n/);
  const idx = Math.max(0, Math.min(lines.length - 1, lineNumber - 1));
  const cur = lines[idx] ?? '';
  lines[idx] = cur.trim() === '' ? `<!-- ${trimmed} -->` : `${cur.trimEnd()} <!-- ${trimmed} -->`;
  return lines.join(eol);
}

function resolvePaletteColor(token: string, palette: Record<string, string>): string {
  const clean = token.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(clean)) return clean;
  if (clean.toLowerCase() === 'ink') return '#141414';
  if (clean.toLowerCase() === 'muted') return '#555555';
  return palette[clean] || palette[clean.toUpperCase()] || palette[clean.toLowerCase()] || palette.default || '#141414';
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

/**
 * Generic CSV filter counter for `{{count:...}}` directives:
 * - `all` -> total expanded cards
 * - `field=value` (exact, case-insensitive)
 * - `field!=value` (not equal)
 * - `field~substr` (contains substring, case-insensitive)
 * - Combine multiple clauses with `&`, e.g. `type_group=Surovina & kitchen=TAL`
 */
function computeCount(spec: string, cards: ExpandedCard[]): number {
  const s = spec.trim();
  if (!s || s === 'all') return cards.length;

  const clauses = s.split('&').map((c) => c.trim()).filter(Boolean);
  return cards.filter((card) =>
    clauses.every((clause) => {
      const m = clause.match(/^([a-zA-Z0-9_]+)\s*(!=|=|~)\s*(.*)$/);
      if (!m) {
        // Bare value matches `type_group` for convenience
        return String(card.type_group || '').trim().toLowerCase() === clause.toLowerCase();
      }
      const [, field, op, rawVal] = m;
      const expected = rawVal.trim().replace(/^["']|["']$/g, '').toLowerCase();
      const actual = String(card[field] ?? '').trim().toLowerCase();
      if (op === '=') return actual === expected;
      if (op === '!=') return actual !== expected;
      if (op === '~') return actual.includes(expected);
      return false;
    }),
  ).length;
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
      return String(computeCount(arg || 'all', ctx.cards));
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

function renderCommentMarker(
  commentText: string,
  section?: string,
  line?: number,
  commentIdx?: number,
): string {
  const label = commentText.trim() || '(empty comment)';
  const metaAttrs =
    section && commentIdx !== undefined
      ? ` data-dp-comment-section="${escapeHtml(section)}" data-dp-comment-line="${line ?? 1}" data-dp-comment-idx="${commentIdx}"`
      : '';
  return `<span class="dp-doc-comment-marker" tabindex="0"${metaAttrs}><span class="dp-doc-comment-dot" aria-label="Playtest comment">💬</span><span class="dp-doc-comment-tip">${escapeHtml(label)}</span></span>`;
}

function isStandaloneCommentLine(line: string): boolean {
  const ranges = findDocCommentRanges(line);
  if (ranges.length === 0) return false;
  return stripInlineCommentsFromLine(line).text.trim() === '';
}

function sourceAttrs(sl: SourceLine | undefined, ctx: RenderDocContext): string {
  if (!ctx.includeSourceMap || !sl || !sl.section) return '';
  return ` data-dp-section="${escapeHtml(sl.section)}" data-dp-line="${sl.line}"`;
}

function formatInlineMarkdown(
  text: string,
  ctx: RenderDocContext,
  sl?: SourceLine,
  commentCounters?: Map<string, number>,
): string {
  // Extract directives and (when previewing) playtest comments first so their HTML isn't escaped
  const tokens: string[] = [];
  let withPlaceholders = text.replace(/\{\{[a-z-]+(?::[\s\S]*?)?\}\}/gi, (m) => {
    const idx = tokens.length;
    tokens.push(expandDirectives(m, ctx));
    return `\u0000DIR${idx}\u0000`;
  });

  if (ctx.includeComments) {
    const ranges = findDocCommentRanges(withPlaceholders);
    if (ranges.length > 0) {
      let replaced = '';
      let cursor = 0;
      for (const r of ranges) {
        replaced += withPlaceholders.slice(cursor, r.from);
        const idx = tokens.length;
        let cIdx: number | undefined;
        if (sl?.section && commentCounters) {
          cIdx = commentCounters.get(sl.section) ?? 0;
          commentCounters.set(sl.section, cIdx + 1);
        }
        tokens.push(renderCommentMarker(r.text, sl?.section, sl?.line, cIdx));
        replaced += `\u0000DIR${idx}\u0000`;
        cursor = r.to;
      }
      replaced += withPlaceholders.slice(cursor);
      withPlaceholders = replaced;
    }
  }

  let out = escapeHtml(withPlaceholders);
  // Inline code
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold + italic
  out = out.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Restore directive & comment HTML
  out = out.replace(/\u0000DIR(\d+)\u0000/g, (_m, i) => tokens[Number(i)] ?? '');
  return out;
}

function parseMarkdownLines(
  sourceLines: SourceLine[],
  ctx: RenderDocContext,
  commentCounters: Map<string, number> = new Map(),
): string {
  const html: string[] = [];
  let i = 0;

  const isBlank = (l: string) => l.trim() === '';
  const isBlockDirective = (l: string) => /^\{\{(card-row|diagram|card)(?::[\s\S]*)?\}\}$/i.test(l.trim());
  const commentClass = (text: string) =>
    ctx.includeComments && findDocCommentRanges(text).length > 0 ? ' dp-doc-has-comment' : '';

  while (i < sourceLines.length) {
    const sl = sourceLines[i];
    const line = sl.text;
    const trimmed = line.trim();
    const attrs = sourceAttrs(sl, ctx);

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

    // Standalone playtest comment line (only present when ctx.includeComments is true)
    if (ctx.includeComments && isStandaloneCommentLine(line)) {
      const ranges = findDocCommentRanges(line);
      const markers = ranges
        .map((r) => {
          let cIdx: number | undefined;
          if (sl.section) {
            cIdx = commentCounters.get(sl.section) ?? 0;
            commentCounters.set(sl.section, cIdx + 1);
          }
          return renderCommentMarker(r.text, sl.section, sl.line, cIdx);
        })
        .join(' ');
      html.push(`<div class="dp-doc-comment-standalone dp-doc-has-comment"${attrs}>${markers}</div>`);
      i++;
      continue;
    }

    // Standalone block directive
    if (isBlockDirective(line)) {
      const expanded = expandDirectives(trimmed, ctx);
      html.push(attrs ? `<div class="dp-doc-block-wrap"${attrs}>${expanded}</div>` : expanded);
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
        `<h${level} class="dp-doc-h${level}${commentClass(titleText)}"${colorStyle}${attrs}>${formatInlineMarkdown(titleText, ctx, sl, commentCounters)}</h${level}>`,
      );
      i++;
      continue;
    }

    // Callout / blockquote (`> ...`)
    if (trimmed.startsWith('>')) {
      const quoteLines: SourceLine[] = [];
      while (i < sourceLines.length && sourceLines[i].text.trim().startsWith('>')) {
        quoteLines.push({
          ...sourceLines[i],
          text: sourceLines[i].text.trim().replace(/^>\s?/, ''),
        });
        i++;
      }
      const hasAnyComment =
        ctx.includeComments && quoteLines.some((q) => findDocCommentRanges(q.text).length > 0);
      html.push(
        `<div class="dp-doc-callout${hasAnyComment ? ' dp-doc-has-comment' : ''}"${attrs}>${quoteLines
          .map((q) => {
            const qAttrs = sourceAttrs(q, ctx);
            const inner = formatInlineMarkdown(q.text, ctx, q, commentCounters);
            return qAttrs ? `<span${qAttrs}>${inner}</span>` : inner;
          })
          .join('<br />')}</div>`,
      );
      continue;
    }

    // Markdown table
    if (
      trimmed.startsWith('|') &&
      i + 1 < sourceLines.length &&
      /^\|[\s:|-]+\|$/.test(sourceLines[i + 1].text.trim())
    ) {
      const parseRow = (r: string) =>
        r
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());
      const headerSl = sl;
      const headerCells = parseRow(trimmed);
      const alignCells = parseRow(sourceLines[i + 1].text);
      const aligns = alignCells.map((a) =>
        a.startsWith(':') && a.endsWith(':')
          ? 'center'
          : a.endsWith(':')
            ? 'right'
            : 'left',
      );
      i += 2;
      const bodyRows: Array<{ sl: SourceLine; cells: string[] }> = [];
      while (i < sourceLines.length && sourceLines[i].text.trim().startsWith('|')) {
        bodyRows.push({ sl: sourceLines[i], cells: parseRow(sourceLines[i].text) });
        i++;
      }
      const hasHeader = headerCells.some((c) => c !== '');
      const thead = hasHeader
        ? `<thead><tr class="${commentClass(headerSl.text).trim()}"${sourceAttrs(headerSl, ctx)}>${headerCells.map((c, idx) => `<th style="text-align:${aligns[idx] || 'left'}">${formatInlineMarkdown(c, ctx, headerSl, commentCounters)}</th>`).join('')}</tr></thead>`
        : '';
      const tbody = `<tbody>${bodyRows
        .map(
          (r) =>
            `<tr${commentClass(r.sl.text) ? ' class="dp-doc-has-comment"' : ''}${sourceAttrs(r.sl, ctx)}>${r.cells.map((c, idx) => `<td style="text-align:${aligns[idx] || 'left'}">${formatInlineMarkdown(c, ctx, r.sl, commentCounters)}</td>`).join('')}</tr>`,
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

      while (i < sourceLines.length) {
        const curSl = sourceLines[i];
        const m = curSl.text.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        if (!m) break;
        const indent = m[1].length;
        const itemOrdered = /^\d+\.$/.test(m[2]);
        if (indent === 0 && itemOrdered !== isOrdered) break;

        let itemHtml = formatInlineMarkdown(m[3], ctx, curSl, commentCounters);
        const itemCommentCls = commentClass(m[3]);
        const itemAttrs = sourceAttrs(curSl, ctx);
        i++;

        // Collect nested sub-list items (indented >= 2 spaces)
        const subItems: string[] = [];
        let subOrdered = false;
        while (i < sourceLines.length) {
          const subSl = sourceLines[i];
          const sm = subSl.text.match(/^(\s{2,})([-*]|\d+\.)\s+(.*)$/);
          if (!sm) break;
          if (subItems.length === 0) subOrdered = /^\d+\.$/.test(sm[2]);
          const subCls = commentClass(sm[3]) ? ' class="dp-doc-has-comment"' : '';
          subItems.push(
            `<li${subCls}${sourceAttrs(subSl, ctx)}>${formatInlineMarkdown(sm[3], ctx, subSl, commentCounters)}</li>`,
          );
          i++;
        }
        if (subItems.length > 0) {
          const subTag = subOrdered ? 'ol' : 'ul';
          itemHtml += `<${subTag}>${subItems.join('')}</${subTag}>`;
        }
        items.push(
          `<li${itemCommentCls ? ' class="dp-doc-has-comment"' : ''}${itemAttrs}>${itemHtml}</li>`,
        );
      }

      html.push(`<${tag} class="dp-doc-list">${items.join('')}</${tag}>`);
      continue;
    }

    // Muted note line (`~ text`)
    if (trimmed.startsWith('~ ')) {
      const noteText = trimmed.slice(2);
      html.push(
        `<p class="dp-doc-note${commentClass(noteText)}"${attrs}>${formatInlineMarkdown(noteText, ctx, sl, commentCounters)}</p>`,
      );
      i++;
      continue;
    }

    // Regular paragraph (merge consecutive plain lines)
    const paraLines: SourceLine[] = [];
    while (
      i < sourceLines.length &&
      !isBlank(sourceLines[i].text) &&
      !sourceLines[i].text.trim().startsWith('#') &&
      !sourceLines[i].text.trim().startsWith('>') &&
      !sourceLines[i].text.trim().startsWith('~ ') &&
      !sourceLines[i].text.trim().startsWith('|') &&
      !/^(\s*)([-*]|\d+\.)\s+/.test(sourceLines[i].text) &&
      !/^---\s*(col|page)\s*---$/i.test(sourceLines[i].text.trim()) &&
      !/^<!--\s*(?:colbreak|pagebreak)\s*-->$/i.test(sourceLines[i].text.trim()) &&
      !(ctx.includeComments && isStandaloneCommentLine(sourceLines[i].text)) &&
      !isBlockDirective(sourceLines[i].text)
    ) {
      paraLines.push({ ...sourceLines[i], text: sourceLines[i].text.trim() });
      i++;
    }
    const mergedText = paraLines.map((p) => p.text).join(' ');
    const paraHtml = paraLines
      .map((p) => formatInlineMarkdown(p.text, ctx, p, commentCounters))
      .join(' ');
    html.push(`<p class="dp-doc-p${commentClass(mergedText)}"${attrs}>${paraHtml}</p>`);
  }

  return html.join('\n');
}

/**
 * Lightweight Markdown-to-HTML parser for DeckPress rulebooks & docs.
 * Supports headings (with optional `[COLOR]` accent tag), lists (with 1-level nesting),
 * callouts (`>`), tables, `---col---` column breaks, and `{{directive:...}}` embeds.
 */
export function parseMarkdownBlock(md: string, ctx: RenderDocContext): string {
  const lines = normalizeSectionLines('', md, Boolean(ctx.includeComments));
  return parseMarkdownLines(lines, ctx);
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

export function isNotesDoc(doc: ProjectDoc | undefined): boolean {
  return doc?.meta?.kind === 'notes';
}

export function getDocBaseCss(doc: ProjectDoc, variant: DesignVariant): string {
  const dims = getDocPageDims(doc.meta.pageSize, doc.meta.orientation);
  const marginMm = doc.meta.marginMm ?? 9.5;
  const cols = doc.meta.columns ?? 1;
  const notes = isNotesDoc(doc);

  return `
${buildDocPaletteVarsCss(variant)}

@page {
  size: ${dims.widthMm}mm ${dims.heightMm}mm;
  margin: 0;
}

.dp-doc-root {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  color: var(--dp-doc-ink, #141414);
  font-size: ${notes ? '13.5px' : '9pt'};
  line-height: ${notes ? '1.55' : '1.35'};
}

.dp-doc-notes-root {
  width: 100%;
}

.dp-doc-notes-sheet {
  width: 100%;
  max-width: 740px;
  margin: 0 auto;
  padding: 24px 30px;
  box-sizing: border-box;
  background: #FFFFFF;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.dp-doc-notes-sheet .dp-doc-h1 {
  margin: 0 0 14px 0;
  padding: 0 0 8px 0;
  background: transparent;
  color: var(--dp-doc-ink, #141414);
  border-bottom: 2px solid rgba(0, 0, 0, 0.14);
  font-size: 20px;
  text-transform: none;
  letter-spacing: -0.01em;
}

.dp-doc-notes-sheet .dp-doc-h2 {
  margin: 22px 0 8px 0;
  padding: 0 0 4px 0;
  background: transparent;
  color: var(--sec-color, #141414);
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  font-size: 15px;
  text-transform: none;
  letter-spacing: 0;
}

.dp-doc-notes-sheet .dp-doc-h3 {
  margin: 14px 0 4px 0;
  font-size: 13.5px;
}

.dp-doc-notes-sheet .dp-doc-p {
  margin: 0 0 8px 0;
}

.dp-doc-notes-sheet .dp-doc-list {
  margin: 0 0 10px 0;
  padding-left: 20px;
}

.dp-doc-notes-sheet .dp-doc-list li {
  margin-bottom: 4px;
}

.dp-doc-notes-sheet .dp-doc-note {
  font-size: 12.5px;
  margin: 0 0 8px 0;
}

.dp-doc-notes-sheet .dp-doc-callout {
  padding: 10px 14px;
  border-radius: 6px;
  margin: 10px 0 12px 0;
  font-size: 13px;
}

.dp-doc-notes-sheet .dp-doc-table {
  font-size: 12.5px;
  margin: 10px 0 14px 0;
}

.dp-doc-notes-sheet .dp-doc-table th,
.dp-doc-notes-sheet .dp-doc-table td {
  padding: 6px 10px;
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
  padding: 0.3mm 1.3mm;
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

/* Preview-only playtest comment highlights & hover tooltips (stripped on PDF export) */
.dp-doc-has-comment {
  background: rgba(254, 243, 199, 0.78) !important;
  box-shadow: inset 2px 0 0 #f59e0b;
  border-radius: 0.6mm;
}

.dp-doc-h1.dp-doc-has-comment,
.dp-doc-h2.dp-doc-has-comment {
  background: var(--sec-color, #141414) !important;
  box-shadow: 0 0 0 1.5px #f59e0b;
}

.dp-doc-comment-standalone {
  display: inline-flex;
  align-items: center;
  gap: 1mm;
  padding: 0.2mm 1.2mm;
  margin: 0.3mm 0;
  line-height: 1;
}

.dp-doc-comment-marker {
  position: relative;
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  margin-left: 0.8mm;
  cursor: pointer;
  outline: none;
}

.dp-doc-comment-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 7pt;
  line-height: 1;
  padding: 0.3mm 0.8mm;
  border-radius: 999px;
  background: #fef3c7;
  border: 0.3mm solid #f59e0b;
  color: #92400e;
}

.dp-doc-comment-tip {
  display: none;
  position: absolute;
  left: 0;
  bottom: calc(100% + 1.2mm);
  z-index: 40;
  min-width: 32mm;
  max-width: 68mm;
  padding: 1.6mm 2.2mm;
  border-radius: 1.2mm;
  background: #1f2937;
  color: #fef3c7;
  font-size: 7.4pt;
  font-weight: 500;
  font-style: normal;
  line-height: 1.3;
  text-transform: none;
  letter-spacing: normal;
  white-space: normal;
  box-shadow: 0 2mm 5mm rgba(0, 0, 0, 0.28);
  pointer-events: none;
}

.dp-doc-comment-marker:hover .dp-doc-comment-tip,
.dp-doc-comment-marker:focus .dp-doc-comment-tip {
  display: block;
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
      // eslint-disable-next-line no-new-func
      const fn = new Function('ctx', 'helpers', ctx.doc.renderJs) as (
        renderCtx: {
          cards: ExpandedCard[];
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
  const allLines: SourceLine[] = [];
  for (let sIdx = 0; sIdx < sectionNames.length; sIdx++) {
    const name = sectionNames[sIdx];
    const sectionLines = normalizeSectionLines(
      name,
      ctx.doc.sections[name] || '',
      Boolean(ctx.includeComments),
    );
    if (sIdx > 0) {
      allLines.push({ text: '', section: name, line: 1 });
    }
    allLines.push(...sectionLines);
  }

  const commentCounters = new Map<string, number>();

  // Flowing non-print notes document (no fixed A4 page breaks or multi-column boxes)
  if (isNotesDoc(ctx.doc)) {
    const filtered = allLines.filter(
      (sl) =>
        !/^\s*(?:---\s*(?:page|col)\s*---|<!--\s*(?:pagebreak|colbreak)\s*-->)\s*$/i.test(
          sl.text,
        ),
    );
    const inner = parseMarkdownLines(filtered, ctx, commentCounters);
    return {
      bodyHtml: `<div class="dp-doc-root dp-doc-notes-root"><article class="dp-doc-notes-sheet">${inner}</article></div>`,
      css: fullCss,
      error: null,
    };
  }

  // Split into pages on `---page---` or `<!-- pagebreak -->` while keeping section/line metadata
  const rawPages: SourceLine[][] = [];
  let currentPage: SourceLine[] = [];
  for (const sl of allLines) {
    if (/^\s*(?:---\s*page\s*---|<!--\s*pagebreak\s*-->)\s*$/i.test(sl.text)) {
      if (currentPage.some((l) => l.text.trim() !== '')) {
        rawPages.push(currentPage);
      }
      currentPage = [];
    } else {
      currentPage.push(sl);
    }
  }
  if (currentPage.some((l) => l.text.trim() !== '')) {
    rawPages.push(currentPage);
  }

  const pagesHtml = rawPages
    .map((pageLines) => {
      const inner = parseMarkdownLines(pageLines, ctx, commentCounters);
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
