import { hashString, mulberry32, pick, randRange } from './prng.js';
import type {
  CardKind,
  CardOverride,
  ComputedCardLayout,
  DesignVariant,
  DividerStyle,
  ExpandedCard,
  PatternStamp,
} from './types.js';

export function resolveColor(colorKey: string, palette: Record<string, string>): string {
  const key = colorKey.trim().toLowerCase();
  if (!key) return palette.default ?? '#2D2D2D';
  return palette[key] ?? palette[colorKey.trim()] ?? palette.default ?? '#2D2D2D';
}

export function detectCardKind(card: ExpandedCard): CardKind {
  const group = card.type_group.trim().toLowerCase();
  if (group === 'akcia' || card.is_action === '1') return 'action';
  if (group.startsWith('špec') || group.startsWith('spec') || card.is_action === '2') {
    return 'special';
  }
  if (card.color.includes('/') || card.kitchen.includes('~')) {
    return 'ingredient-dual';
  }
  if (card.size.trim().toLowerCase().startsWith('pol')) {
    return 'ingredient-half';
  }
  return 'ingredient-whole';
}

export function computeCardLayout(
  card: ExpandedCard,
  variant: DesignVariant,
  override?: CardOverride,
  iconCount = 8,
): ComputedCardLayout {
  const sheetSeed = card.seed ? Number.parseInt(card.seed, 10) : Number.NaN;
  const baseSeed =
    override?.seed !== undefined
      ? override.seed
      : Number.isFinite(sheetSeed)
        ? sheetSeed
        : variant.globalSeed;

  const effectiveSeed = hashString(`${card._instanceKey}::${baseSeed}`);
  const rng = mulberry32(effectiveSeed);
  const kind = detectCardKind(card);

  const colorParts = card.color.split('/').map((s) => s.trim()).filter(Boolean);
  const primaryColor = resolveColor(colorParts[0] ?? '', variant.palette);
  const secondaryColor =
    colorParts.length > 1 ? resolveColor(colorParts[1], variant.palette) : undefined;

  // Keep long titles from overflowing right edge by capping left offset proportionally.
  const titleLen = card.title.length;
  const maxSafeLeft = Math.max(
    variant.topBlock.minLeftPct,
    Math.min(variant.topBlock.maxLeftPct, titleLen > 10 ? 12 : titleLen > 7 ? 24 : 38),
  );

  const topBlockLeftPct = Math.round(
    randRange(rng, variant.topBlock.minLeftPct, maxSafeLeft),
  );
  const topBlockHeightPct = Math.round(
    randRange(rng, variant.topBlock.minHeightPct, variant.topBlock.maxHeightPct),
  );
  const dualBottomLeftPct = Math.round(
    randRange(rng, variant.topBlock.minLeftPct, Math.min(28, maxSafeLeft)),
  );

  const nonOvalStyles = variant.divider.styles.filter((s) => s !== 'oval-accent');
  const allowOval =
    variant.divider.styles.includes('oval-accent') && kind !== 'ingredient-dual';
  const showOvalAccent =
    allowOval && rng() < variant.divider.ovalProbability;
  const dividerStyle: DividerStyle =
    nonOvalStyles.length > 0 ? pick(rng, nonOvalStyles) : 'single-black';

  const hasMarkText = variant.gameMark.text.trim().length > 0;
  const showMark =
    hasMarkText &&
    !override?.hideMark &&
    (kind === 'ingredient-dual' || rng() < variant.gameMark.probability);

  const markFont =
    variant.gameMark.fonts.length > 0
      ? pick(rng, variant.gameMark.fonts)
      : 'cursive';
  const markColor =
    variant.gameMark.colors.length > 0
      ? pick(rng, variant.gameMark.colors)
      : '#111111';
  const markSizePt = Math.round(
    randRange(rng, variant.gameMark.minSizePt, variant.gameMark.maxSizePt),
  );
  const markText =
    rng() < 0.35
      ? variant.gameMark.text.toUpperCase()
      : variant.gameMark.text.toLowerCase();

  // Safe zone inside middle canvas so mark never overlaps title or subtitle
  const markXPct = Math.round(randRange(rng, 22, 74));
  const markYPct =
    kind === 'ingredient-dual'
      ? Math.round(randRange(rng, 44, 56))
      : Math.round(randRange(rng, Math.max(44, topBlockHeightPct + 12), 76));
  const markRotateDeg = Math.round(randRange(rng, -8, 8));

  // Deterministic jittered grid for subtle food-icon pattern
  const patternStamps: PatternStamp[] = [];
  const density = Math.max(0, Math.min(30, Math.round(variant.canvas.patternDensity)));
  if (density > 0 && iconCount > 0) {
    const cols = Math.max(2, Math.round(Math.sqrt(density * 0.75)));
    const rows = Math.max(2, Math.ceil(density / cols));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (patternStamps.length >= density) break;
        const cellW = 84 / cols;
        const cellH = 44 / rows;
        const xPct = 8 + c * cellW + randRange(rng, 0.15, 0.85) * cellW;
        const yPct = 38 + r * cellH + randRange(rng, 0.15, 0.85) * cellH;
        patternStamps.push({
          xPct: Math.round(xPct * 10) / 10,
          yPct: Math.round(yPct * 10) / 10,
          iconIndex: Math.floor(rng() * iconCount) % iconCount,
          rotateDeg: Math.round(randRange(rng, -28, 28)),
          scale: Math.round(randRange(rng, 0.8, 1.25) * 100) / 100,
        });
      }
    }
  }

  return {
    kind,
    effectiveSeed,
    primaryColor,
    secondaryColor,
    topBlockLeftPct,
    topBlockHeightPct,
    dualBottomLeftPct,
    dividerStyle,
    showOvalAccent,
    showMark,
    markText,
    markFont,
    markColor,
    markSizePt,
    markXPct,
    markYPct,
    markRotateDeg,
    patternStamps,
  };
}
