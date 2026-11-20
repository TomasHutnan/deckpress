export interface CardSize {
  widthMm: number;
  heightMm: number;
  bleedMm: number;
}

export interface ProjectConfig {
  name: string;
  slug: string;
  description?: string;
  googleSheetUrl?: string;
  localCsv: string;
  cardSize: CardSize;
}

export type DividerStyle =
  | 'single-black'
  | 'double-blue'
  | 'double-pink'
  | 'red-blue'
  | 'double-grey'
  | 'oval-accent';

export type CanvasMode = 'empty' | 'pattern' | 'image';

export interface DesignVariant {
  label: string;
  globalSeed: number;
  backgroundColor: string;
  textColor: string;
  palette: Record<string, string>;
  typography: {
    titleFont: string;
    tagsFont: string;
    subtitleFont: string;
    bodyFont: string;
    titleSizePt: number;
    tagsSizePt: number;
    subtitleSizePt: number;
    bodySizePt: number;
  };
  topBlock: {
    minLeftPct: number;
    maxLeftPct: number;
    minHeightPct: number;
    maxHeightPct: number;
    tagsMinLeftPct?: number;
    tagsMaxLeftPct?: number;
    halfBorderMm: number;
    bleedRight: boolean;
  };
  divider: {
    enabled: boolean;
    styles: DividerStyle[];
    ovalProbability: number;
  };
  gameMark: {
    text: string;
    probability: number;
    fonts: string[];
    colors: string[];
    minSizePt: number;
    maxSizePt: number;
  };
  canvas: {
    mode: CanvasMode;
    patternOpacity: number;
    patternDensity: number;
    patternScale: number;
  };
}

export interface DesignConfig {
  activeVariant: string;
  variants: Record<string, DesignVariant>;
}

export interface CardOverride {
  seed?: number;
  locked?: boolean;
  hideMark?: boolean;
  image?: string;
}

export type CardOverrides = Record<string, CardOverride>;

export interface CardRow {
  id: string;
  type_group: string;
  kitchen: string;
  color: string;
  size: string;
  title: string;
  subtitle: string;
  tags_str: string;
  count: number;
  image: string;
  is_action: string;
  description: string;
  recipe_change?: string;
  seed?: string;
  [key: string]: string | number | undefined;
}

export interface ExpandedCard extends CardRow {
  _copyIndex: number;
  _totalCopies: number;
  _instanceKey: string;
}

export type CardKind =
  | 'ingredient-whole'
  | 'ingredient-half'
  | 'ingredient-dual'
  | 'action'
  | 'special';

export interface PatternStamp {
  xPct: number;
  yPct: number;
  iconIndex: number;
  rotateDeg: number;
  scale: number;
}

export interface ComputedCardLayout {
  kind: CardKind;
  effectiveSeed: number;
  primaryColor: string;
  secondaryColor?: string;
  topBlockLeftPct: number;
  topBlockHeightPct: number;
  tagsLeftPct: number;
  dualBottomLeftPct: number;
  dualBottomTagsLeftPct: number;
  dividerStyle: DividerStyle;
  showOvalAccent: boolean;
  showMark: boolean;
  markText: string;
  markFont: string;
  markColor: string;
  markSizePt: number;
  markXPct: number;
  markYPct: number;
  markRotateDeg: number;
  patternStamps: PatternStamp[];
}

export type ExportMode = 'individual' | 'sheet';
export type SheetFormat = 'a4' | 'a3' | 'letter' | 'custom';
export type CutGuidelines = 'none' | 'crop-marks' | 'cut-grid';

export interface ExportOptions {
  cardWidthMm: number;
  cardHeightMm: number;
  bleedMm: number;
  mode: ExportMode;
  sheetFormat: SheetFormat;
  sheetWidthMm?: number;
  sheetHeightMm?: number;
  gapMm: number;
  guidelines: CutGuidelines;
  variantKey?: string;
  filterType?: string;
}

export interface GitCommitInfo {
  hash: string;
  shortHash: string;
  date: string;
  message: string;
}

export interface GitStatusInfo {
  isRepo: boolean;
  branch: string;
  dirty: boolean;
  remoteUrl: string | null;
  hasSavedToken: boolean;
}

export interface AssetList {
  fonts: string[];
  icons: string[];
  images: string[];
}
