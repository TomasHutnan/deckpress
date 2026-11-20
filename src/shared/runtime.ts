import { BUILTIN_FOOD_ICONS } from './defaults.js';
import { computeCardLayout, detectCardKind, resolveColor } from './layout.js';
import { hashString, mulberry32, pick, randRange } from './prng.js';
import { escapeHtml, renderCardHtml, renderCardsBaseCss } from './renderCard.js';
import type {
  CardOverrides,
  CardSize,
  DesignVariant,
  ExpandedCard,
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
}

export interface ProjectRenderer {
  renderCard: (ctx: RenderCardContext) => string;
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

export const DEFAULT_RENDERER_JS = `// Project-owned card renderer (runs in browser preview & Chromium PDF export).
// Edit freely — changes preview live with zero Docker rebuilds!
//
// Available on \`helpers\`:
//   escapeHtml, hashString, mulberry32, randRange, pick,
//   detectCardKind, resolveColor, computeCardLayout,
//   getCardWatermarks, getSheetWatermarks, watermarksOverlap,
//   BUILTIN_FOOD_ICONS, defaultRenderCard, defaultGetBaseCss

return {
  renderCard(ctx) {
    // Customize HTML/SVG per card here, or wrap/replace helpers.defaultRenderCard(ctx).
    return helpers.defaultRenderCard(ctx);
  },

  getBaseCss(cardSize, customCss) {
    return helpers.defaultGetBaseCss(cardSize, customCss);
  },
};
`;

/**
 * Compiles a project's `renderer.js` in the browser (never called on the Node server).
 * Falls back cleanly to the built-in renderer and reports any compile/runtime error.
 */
export function compileProjectRenderer(code: string | undefined): {
  renderer: ProjectRenderer;
  error: string | null;
} {
  const fallback: ProjectRenderer = {
    renderCard: DECKPRESS_HELPERS.defaultRenderCard,
    getBaseCss: DECKPRESS_HELPERS.defaultGetBaseCss,
  };

  const trimmed = (code || '').trim();
  if (!trimmed) return { renderer: fallback, error: null };

  try {
    // eslint-disable-next-line no-new-func
    const factory = new Function('helpers', trimmed) as (
      helpers: typeof DECKPRESS_HELPERS,
    ) => Partial<ProjectRenderer> | undefined;
    const mod = factory(DECKPRESS_HELPERS);
    if (!mod || typeof mod.renderCard !== 'function') {
      return {
        renderer: fallback,
        error: 'renderer.js must return an object with a renderCard(ctx) function.',
      };
    }
    return {
      renderer: {
        renderCard: (ctx) => String(mod.renderCard!(ctx)),
        getBaseCss:
          typeof mod.getBaseCss === 'function'
            ? (cardSize, customCss) => String(mod.getBaseCss!(cardSize, customCss))
            : fallback.getBaseCss,
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
