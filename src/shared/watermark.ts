import { hashString, mulberry32, randRange } from './prng.js';
import type { CardSize, DesignVariant } from './types.js';

export interface WatermarkWord {
  x: number;
  y: number;
  sizeMm: number;
  angleDeg: number;
  halfW: number;
  halfH: number;
  /** Axis-aligned bounding radius for fast broad-phase culling */
  boundR: number;
}

interface Vec2 {
  x: number;
  y: number;
}

function getObbCorners(w: WatermarkWord, pad = 1.5): [Vec2, Vec2, Vec2, Vec2] {
  const rad = (w.angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = w.halfW + pad;
  const hh = w.halfH + pad;

  const dx1 = hw * cos;
  const dy1 = hw * sin;
  const dx2 = -hh * sin;
  const dy2 = hh * cos;

  return [
    { x: w.x - dx1 - dx2, y: w.y - dy1 - dy2 },
    { x: w.x + dx1 - dx2, y: w.y + dy1 - dy2 },
    { x: w.x + dx1 + dx2, y: w.y + dy1 + dy2 },
    { x: w.x - dx1 + dx2, y: w.y - dy1 + dy2 },
  ];
}

function projectCorners(corners: readonly Vec2[], axis: Vec2): [number, number] {
  let min = corners[0].x * axis.x + corners[0].y * axis.y;
  let max = min;
  for (let i = 1; i < corners.length; i++) {
    const p = corners[i].x * axis.x + corners[i].y * axis.y;
    if (p < min) min = p;
    if (p > max) max = p;
  }
  return [min, max];
}

/**
 * Exact 2D Separating Axis Theorem (SAT) overlap check for rotated watermark boxes.
 */
export function watermarksOverlap(a: WatermarkWord, b: WatermarkWord, pad = 1.5): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const maxDist = a.boundR + b.boundR + pad * 2;
  if (dx * dx + dy * dy > maxDist * maxDist) return false;

  const ca = getObbCorners(a, pad);
  const cb = getObbCorners(b, pad);

  const axes: Vec2[] = [
    { x: ca[1].x - ca[0].x, y: ca[1].y - ca[0].y },
    { x: ca[3].x - ca[0].x, y: ca[3].y - ca[0].y },
    { x: cb[1].x - cb[0].x, y: cb[1].y - cb[0].y },
    { x: cb[3].x - cb[0].x, y: cb[3].y - cb[0].y },
  ];

  for (const axis of axes) {
    const [minA, maxA] = projectCorners(ca, axis);
    const [minB, maxB] = projectCorners(cb, axis);
    if (maxA < minB || maxB < minA) return false;
  }
  return true;
}

const sheetCache = new Map<string, WatermarkWord[]>();

export interface ResolvedWatermarkParams {
  text: string;
  opacity: number;
  color: string;
  sizeMinMm: number;
  sizeMaxMm: number;
  angleMinDeg: number;
  angleMaxDeg: number;
  density: number;
  allowOverlap: boolean;
  cols: number;
}

export function resolveWatermarkParams(variant: DesignVariant): ResolvedWatermarkParams {
  const c = variant.canvas;
  const fallbackSize = c.watermarkSizeMm ?? 32;
  const fallbackAngle = c.watermarkAngleDeg ?? -18;
  const rawMinSize = c.watermarkSizeMinMm ?? Math.max(10, Math.round(fallbackSize * 0.6));
  const rawMaxSize = c.watermarkSizeMaxMm ?? Math.round(fallbackSize * 1.25);
  const rawMinAngle = c.watermarkAngleMinDeg ?? fallbackAngle;
  const rawMaxAngle = c.watermarkAngleMaxDeg ?? fallbackAngle;

  return {
    text: (c.watermarkText || variant.gameMark.text || 'MENU').trim().toUpperCase(),
    opacity: c.watermarkOpacity ?? 0.06,
    color: c.watermarkColor || '#000000',
    sizeMinMm: Math.max(8, Math.min(rawMinSize, rawMaxSize)),
    sizeMaxMm: Math.max(8, Math.max(rawMinSize, rawMaxSize)),
    angleMinDeg: Math.min(rawMinAngle, rawMaxAngle),
    angleMaxDeg: Math.max(rawMinAngle, rawMaxAngle),
    density: Math.max(0.2, Math.min(8, c.watermarkDensity ?? 1.8)),
    allowOverlap: c.watermarkAllowOverlap ?? false,
    cols: Math.max(1, Math.round(c.watermarkCols ?? 3)),
  };
}

/**
 * Generates a deterministic sheet-wide scatter of watermark words so adjacent cards
 * on the virtual grid connect seamlessly across edges.
 */
export function getSheetWatermarks(
  variant: DesignVariant,
  cardSize: CardSize,
  minRows = 12,
): WatermarkWord[] {
  const params = resolveWatermarkParams(variant);
  if (!params.text) return [];

  // Allocate enough rows in chunks of 12 so the cache stays stable across deck sizes
  const rows = Math.max(12, Math.ceil(minRows / 12) * 12);
  const cacheKey = [
    variant.globalSeed,
    params.text,
    params.sizeMinMm,
    params.sizeMaxMm,
    params.angleMinDeg,
    params.angleMaxDeg,
    params.density,
    params.allowOverlap ? '1' : '0',
    params.cols,
    rows,
    cardSize.widthMm,
    cardSize.heightMm,
  ].join('|');

  const cached = sheetCache.get(cacheKey);
  if (cached) return cached;

  const sheetW = params.cols * cardSize.widthMm;
  const sheetH = rows * cardSize.heightMm;
  const targetCount = Math.round(params.cols * rows * params.density);
  const rng = mulberry32(hashString(`dp-wm-sheet::${variant.globalSeed}::${params.text}`));

  const placed: WatermarkWord[] = [];
  const maxAttempts = params.allowOverlap ? 1 : 22;

  for (let i = 0; i < targetCount; i++) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const sizeMm = Math.round(randRange(rng, params.sizeMinMm, params.sizeMaxMm) * 10) / 10;
      const angleDeg =
        Math.round(randRange(rng, params.angleMinDeg, params.angleMaxDeg) * 10) / 10;
      // Condensed uppercase Oswald character aspect ratio ~ 0.52 of font-size
      const halfW = (params.text.length * sizeMm * 0.54) / 2;
      const halfH = (sizeMm * 0.82) / 2;
      const boundR = Math.hypot(halfW, halfH);

      const x = Math.round(randRange(rng, -halfW * 0.35, sheetW + halfW * 0.35) * 10) / 10;
      const y = Math.round(randRange(rng, -halfH * 0.35, sheetH + halfH * 0.35) * 10) / 10;

      const candidate: WatermarkWord = { x, y, sizeMm, angleDeg, halfW, halfH, boundR };

      if (params.allowOverlap) {
        placed.push(candidate);
        break;
      }

      let collides = false;
      for (let j = 0; j < placed.length; j++) {
        if (watermarksOverlap(candidate, placed[j])) {
          collides = true;
          break;
        }
      }
      if (!collides) {
        placed.push(candidate);
        break;
      }
    }
  }

  if (sheetCache.size >= 16) sheetCache.clear();
  sheetCache.set(cacheKey, placed);
  return placed;
}

export function getCardWatermarks(
  variant: DesignVariant,
  cardIndex: number,
  cardSize: CardSize,
): { sheetX: number; sheetY: number; words: WatermarkWord[]; params: ResolvedWatermarkParams } {
  const params = resolveWatermarkParams(variant);
  const col = cardIndex % params.cols;
  const row = Math.floor(cardIndex / params.cols);
  const sheetX = col * cardSize.widthMm;
  const sheetY = row * cardSize.heightMm;

  const all = getSheetWatermarks(variant, cardSize, row + 2);
  const words = all.filter(
    (w) =>
      w.x + w.boundR >= sheetX &&
      w.x - w.boundR <= sheetX + cardSize.widthMm &&
      w.y + w.boundR >= sheetY &&
      w.y - w.boundR <= sheetY + cardSize.heightMm,
  );

  return { sheetX, sheetY, words, params };
}
