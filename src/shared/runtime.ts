import { BUILTIN_FOOD_ICONS } from './defaults.js';
import { computeCardLayout, detectCardKind, resolveColor } from './layout.js';
import { hashString, mulberry32, pick, randRange } from './prng.js';
import { escapeHtml, renderCardHtml, renderCardsBaseCss } from './renderCard.js';
import type {
  CardOverrides,
  CardSize,
  DesignVariant,
  ExpandedCard,
  ProjectDocsMap,
} from './types.js';
import { getCardWatermarks, getSheetWatermarks, watermarksOverlap } from './watermark.js';

export interface RenderCardContext {
  card: ExpandedCard;
  variant: DesignVariant;
  overrides: CardOverrides;
  assetBaseUrl: string;
  customIconsSvg?: string[];
  cardIndex: number;
  cardSize: CardSize;
  docs?: ProjectDocsMap;
}

export interface ProjectRenderer {
  renderCard: (ctx: RenderCardContext) => string;
  renderCardBack: (ctx: RenderCardContext) => string;
  getBaseCss: (cardSize: CardSize, customCss: string) => string;
}

export const DECKPRESS_HELPERS = {
  escapeHtml,
  hashString,
  mulberry32,
  randRange,
  pick,
  detectCardKind,
  resolveColor,
  computeCardLayout,
  getCardWatermarks,
  getSheetWatermarks,
  watermarksOverlap,
  BUILTIN_FOOD_ICONS,
  defaultRenderCard: (ctx: RenderCardContext) =>
    renderCardHtml(
      ctx.card,
      ctx.variant,
      ctx.overrides,
      ctx.assetBaseUrl,
      ctx.customIconsSvg,
      ctx.cardIndex,
      ctx.cardSize,
    ).html,
  defaultGetBaseCss: (cardSize: CardSize, customCss = '') =>
    renderCardsBaseCss(cardSize, customCss),
};

export const DEFAULT_RENDERER_JS = `// Entry point for project template (template/index.js).
// You can split logic across multiple .js/.css files in template/ and load them
// via require('./other.js'). Changes preview live with zero Docker rebuilds!

return {
  renderCard(ctx) {
    return helpers.defaultRenderCard(ctx);
  },

  getBaseCss(cardSize, customCss) {
    return helpers.defaultGetBaseCss(cardSize, customCss);
  },
};
`;

function normalizeModuleName(name: string): string {
  const clean = name.replace(/^\.\//, '').trim();
  return clean.endsWith('.js') ? clean : `${clean}.js`;
}

function defaultRenderCardBack(ctx: RenderCardContext): string {
  const { card, variant, cardSize } = ctx;
  const label = escapeHtml((variant.gameMark?.text || 'MENU').toUpperCase());
  return `
    <div class="dp-card" data-card-id="${escapeHtml(card._instanceKey)}" style="--tm-w:${cardSize.widthMm}mm;--tm-h:${cardSize.heightMm}mm;--tm-bleed:${cardSize.bleedMm}mm;--dp-bg:${variant.backgroundColor};--dp-fg:${variant.textColor};">
      <div class="dp-trim-area" style="display:flex;align-items:center;justify-content:center;background:${variant.backgroundColor};color:${variant.textColor};">
        <div style="font-family:${variant.typography.titleFont};font-size:22pt;font-weight:900;letter-spacing:0.08em;opacity:0.18">${label}</div>
      </div>
    </div>
  `;
}

/**
 * Compiles a project's `template/` folder (multiple .js and .css files) in the browser.
 * Entry point is `index.js` (or legacy `renderer.js`). Sibling `.js` files can be loaded
 * with `require('./filename.js')`, and all `.css` files are concatenated automatically.
 */
export function compileTemplateFiles(files: Record<string, string> | undefined): {
  renderer: ProjectRenderer;
  error: string | null;
} {
  const fallback: ProjectRenderer = {
    renderCard: DECKPRESS_HELPERS.defaultRenderCard,
    renderCardBack: defaultRenderCardBack,
    getBaseCss: DECKPRESS_HELPERS.defaultGetBaseCss,
  };

  if (!files || Object.keys(files).length === 0) {
    return { renderer: fallback, error: null };
  }

  const entryKey =
    files['index.js'] !== undefined
      ? 'index.js'
      : files['renderer.js'] !== undefined
        ? 'renderer.js'
        : Object.keys(files).find((k) => k.endsWith('.js'));

  const templateCss = Object.keys(files)
    .filter((k) => k.endsWith('.css'))
    .sort((a, b) => (a === 'styles.css' ? -1 : b === 'styles.css' ? 1 : a.localeCompare(b)))
    .map((k) => files[k])
    .join('\n\n');

  if (!entryKey || !files[entryKey].trim()) {
    return {
      renderer: {
        renderCard: fallback.renderCard,
        renderCardBack: fallback.renderCardBack,
        getBaseCss: (cardSize, customCss) =>
          `${fallback.getBaseCss(cardSize, '')}\n${templateCss}\n${customCss}`,
      },
      error: null,
    };
  }

  const moduleCache = new Map<string, unknown>();
  const loading = new Set<string>();

  const requireModule = (specifier: string): unknown => {
    const key = normalizeModuleName(specifier);
    if (moduleCache.has(key)) return moduleCache.get(key);
    if (loading.has(key)) {
      throw new Error(`Circular template require detected: ${key}`);
    }
    const source = files[key];
    if (source === undefined) {
      throw new Error(`Template module not found: ${key}`);
    }
    loading.add(key);
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('helpers', 'require', source) as (
        helpers: typeof DECKPRESS_HELPERS,
        req: (s: string) => unknown,
      ) => unknown;
      const exported = fn(DECKPRESS_HELPERS, requireModule);
      moduleCache.set(key, exported);
      return exported;
    } finally {
      loading.delete(key);
    }
  };

  try {
    const mod = requireModule(entryKey) as Partial<ProjectRenderer> | undefined;
    if (!mod || typeof mod.renderCard !== 'function') {
      return {
        renderer: fallback,
        error: `${entryKey} must return an object with a renderCard(ctx) function.`,
      };
    }

    return {
      renderer: {
        renderCard: (ctx) => String(mod.renderCard!(ctx)),
        renderCardBack: (ctx) =>
          typeof mod.renderCardBack === 'function'
            ? String(mod.renderCardBack(ctx))
            : defaultRenderCardBack(ctx),
        getBaseCss: (cardSize, customCss) => {
          const base =
            typeof mod.getBaseCss === 'function'
              ? String(mod.getBaseCss(cardSize, ''))
              : '';
          return `${base}\n${templateCss}\n${customCss}`;
        },
      },
      error: null,
    };
  } catch (err: unknown) {
    return {
      renderer: fallback,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Backwards-compatible single-file wrapper */
export function compileProjectRenderer(code: string | undefined): {
  renderer: ProjectRenderer;
  error: string | null;
} {
  if (!code?.trim()) return compileTemplateFiles(undefined);
  return compileTemplateFiles({ 'index.js': code });
}
