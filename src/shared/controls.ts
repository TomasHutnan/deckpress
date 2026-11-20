export interface ControlCondition {
  path: string;
  equals: string | number | boolean;
}

export interface ControlOption {
  value: string;
  label: string;
}

export interface ControlItem {
  type:
    | 'text'
    | 'number'
    | 'range'
    | 'checkbox'
    | 'select'
    | 'pills'
    | 'multi-pills'
    | 'color'
    | 'color-map'
    | 'color-list'
    | 'seed'
    | 'asset-button'
    | 'note'
    | 'row';
  label?: string;
  path?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  percent?: boolean;
  defaultValue?: unknown;
  options?: ControlOption[];
  preset?: 'fonts';
  assetKind?: 'images' | 'icons' | 'fonts';
  text?: string;
  showWhen?: ControlCondition;
  items?: ControlItem[];
}

export interface ControlSection {
  title: string;
  defaultOpen?: boolean;
  items: ControlItem[];
}

export type ControlsSchema = ControlSection[];

export function getByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function setByPath<T>(obj: T, path: string, value: unknown): T {
  const clone = structuredClone(obj);
  const parts = path.split('.');
  let cur: Record<string, unknown> = clone as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (cur[key] == null || typeof cur[key] !== 'object') {
      cur[key] = {};
    }
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
  return clone;
}

export function createDefaultControlsSchema(): ControlsSchema {
  return [
    {
      title: 'Middle Canvas (Empty / Pattern / Watermark / Art)',
      defaultOpen: true,
      items: [
        {
          type: 'pills',
          path: 'canvas.mode',
          defaultValue: 'empty',
          options: [
            { value: 'empty', label: 'Empty' },
            { value: 'pattern', label: 'Food Pattern' },
            { value: 'watermark', label: 'Watermark' },
            { value: 'image', label: 'Card Art' },
          ],
        },
        {
          type: 'range',
          label: 'Pattern Opacity',
          path: 'canvas.patternOpacity',
          min: 0.02,
          max: 1,
          step: 0.01,
          percent: true,
          defaultValue: 0.1,
          showWhen: { path: 'canvas.mode', equals: 'pattern' },
        },
        {
          type: 'range',
          label: 'Icon Count',
          path: 'canvas.patternDensity',
          min: 4,
          max: 24,
          step: 1,
          defaultValue: 10,
          showWhen: { path: 'canvas.mode', equals: 'pattern' },
        },
        {
          type: 'range',
          label: 'Icon Scale',
          path: 'canvas.patternScale',
          min: 0.6,
          max: 2,
          step: 0.1,
          unit: '×',
          defaultValue: 1,
          showWhen: { path: 'canvas.mode', equals: 'pattern' },
        },
        {
          type: 'asset-button',
          label: '+ Upload Custom Pattern SVGs',
          assetKind: 'icons',
          showWhen: { path: 'canvas.mode', equals: 'pattern' },
        },
        {
          type: 'text',
          label: 'Watermark Text',
          path: 'canvas.watermarkText',
          defaultValue: 'MENU',
          showWhen: { path: 'canvas.mode', equals: 'watermark' },
        },
        {
          type: 'range',
          label: 'Watermark Opacity',
          path: 'canvas.watermarkOpacity',
          min: 0.02,
          max: 1,
          step: 0.01,
          percent: true,
          defaultValue: 0.06,
          showWhen: { path: 'canvas.mode', equals: 'watermark' },
        },
        {
          type: 'row',
          showWhen: { path: 'canvas.mode', equals: 'watermark' },
          items: [
            {
              type: 'number',
              label: 'Min Size (mm)',
              path: 'canvas.watermarkSizeMinMm',
              min: 8,
              max: 80,
              defaultValue: 18,
            },
            {
              type: 'number',
              label: 'Max Size (mm)',
              path: 'canvas.watermarkSizeMaxMm',
              min: 8,
              max: 90,
              defaultValue: 44,
            },
          ],
        },
        {
          type: 'row',
          showWhen: { path: 'canvas.mode', equals: 'watermark' },
          items: [
            {
              type: 'number',
              label: 'Min Angle (°)',
              path: 'canvas.watermarkAngleMinDeg',
              min: -180,
              max: 180,
              defaultValue: -35,
            },
            {
              type: 'number',
              label: 'Max Angle (°)',
              path: 'canvas.watermarkAngleMaxDeg',
              min: -180,
              max: 180,
              defaultValue: 35,
            },
          ],
        },
        {
          type: 'range',
          label: 'Density (per card)',
          path: 'canvas.watermarkDensity',
          min: 0.4,
          max: 6,
          step: 0.2,
          defaultValue: 1.8,
          showWhen: { path: 'canvas.mode', equals: 'watermark' },
        },
        {
          type: 'checkbox',
          label: 'Allow overlapping watermarks',
          path: 'canvas.watermarkAllowOverlap',
          defaultValue: false,
          showWhen: { path: 'canvas.mode', equals: 'watermark' },
        },
        {
          type: 'number',
          label: 'Sheet Columns',
          path: 'canvas.watermarkCols',
          min: 1,
          max: 10,
          defaultValue: 3,
          showWhen: { path: 'canvas.mode', equals: 'watermark' },
        },
        {
          type: 'color',
          label: 'Watermark Color',
          path: 'canvas.watermarkColor',
          defaultValue: '#000000',
          showWhen: { path: 'canvas.mode', equals: 'watermark' },
        },
        {
          type: 'note',
          text: 'Images are matched by filename from the image column in your Google Sheet / CSV (e.g. images/pesto.jpg → upload pesto.jpg).',
          showWhen: { path: 'canvas.mode', equals: 'image' },
        },
        {
          type: 'asset-button',
          label: '+ Upload / Manage Card Art',
          assetKind: 'images',
          showWhen: { path: 'canvas.mode', equals: 'image' },
        },
      ],
    },
    {
      title: 'Semi-Randomization Rules',
      items: [
        { type: 'seed', label: 'Global Seed', path: 'globalSeed', defaultValue: 42 },
        {
          type: 'row',
          items: [
            {
              type: 'number',
              label: 'Top Box Min Left %',
              path: 'topBlock.minLeftPct',
              min: 0,
              max: 45,
              defaultValue: 4,
            },
            {
              type: 'number',
              label: 'Top Box Max Left %',
              path: 'topBlock.maxLeftPct',
              min: 0,
              max: 55,
              defaultValue: 38,
            },
          ],
        },
        {
          type: 'row',
          items: [
            {
              type: 'number',
              label: 'Top Box Min Height %',
              path: 'topBlock.minHeightPct',
              min: 15,
              max: 45,
              defaultValue: 22,
            },
            {
              type: 'number',
              label: 'Top Box Max Height %',
              path: 'topBlock.maxHeightPct',
              min: 18,
              max: 50,
              defaultValue: 36,
            },
          ],
        },
        {
          type: 'row',
          items: [
            {
              type: 'number',
              label: 'Tags Min Left %',
              path: 'topBlock.tagsMinLeftPct',
              min: 0,
              max: 75,
              defaultValue: 4,
            },
            {
              type: 'number',
              label: 'Tags Max Left %',
              path: 'topBlock.tagsMaxLeftPct',
              min: 0,
              max: 80,
              defaultValue: 58,
            },
          ],
        },
        {
          type: 'text',
          label: 'Game Mark Text (e.g. "menu")',
          path: 'gameMark.text',
          defaultValue: 'menu',
        },
        {
          type: 'range',
          label: 'Game Mark Frequency',
          path: 'gameMark.probability',
          min: 0,
          max: 1,
          step: 0.05,
          percent: true,
          defaultValue: 0.45,
        },
        {
          type: 'row',
          items: [
            {
              type: 'number',
              label: 'Mark Min Size (pt)',
              path: 'gameMark.minSizePt',
              min: 6,
              max: 36,
              defaultValue: 12,
            },
            {
              type: 'number',
              label: 'Mark Max Size (pt)',
              path: 'gameMark.maxSizePt',
              min: 8,
              max: 48,
              defaultValue: 22,
            },
          ],
        },
        {
          type: 'multi-pills',
          label: 'Game Mark Font Pool (randomly picked per card)',
          path: 'gameMark.fonts',
          preset: 'fonts',
        },
        {
          type: 'color-list',
          label: 'Game Mark Color Pool',
          path: 'gameMark.colors',
        },
        {
          type: 'range',
          label: 'Subtitle Oval Accent Chance',
          path: 'divider.ovalProbability',
          min: 0,
          max: 0.5,
          step: 0.02,
          percent: true,
          defaultValue: 0.12,
        },
        {
          type: 'multi-pills',
          label: 'Bottom Divider Styles',
          path: 'divider.styles',
          options: [
            { value: 'single-black', label: 'Single Black' },
            { value: 'double-blue', label: 'Double Blue' },
            { value: 'double-pink', label: 'Double Pink' },
            { value: 'red-blue', label: 'Red + Blue' },
            { value: 'double-grey', label: 'Double Grey' },
            { value: 'oval-accent', label: 'Red Oval Accent' },
          ],
        },
      ],
    },
    {
      title: 'Colors & Kitchen Palette',
      items: [
        { type: 'color', label: 'Card BG', path: 'backgroundColor', defaultValue: '#FFFFFF' },
        { type: 'color', label: 'Text', path: 'textColor', defaultValue: '#0F0F0F' },
        { type: 'color-map', path: 'palette' },
      ],
    },
    {
      title: 'Typography',
      items: [
        { type: 'select', label: 'Title Font', path: 'typography.titleFont', preset: 'fonts' },
        { type: 'select', label: 'Tags Font', path: 'typography.tagsFont', preset: 'fonts' },
        {
          type: 'select',
          label: 'Subtitle Font',
          path: 'typography.subtitleFont',
          preset: 'fonts',
        },
        {
          type: 'select',
          label: 'Body / Action Text Font',
          path: 'typography.bodyFont',
          preset: 'fonts',
        },
        {
          type: 'row',
          items: [
            {
              type: 'number',
              label: 'Title (pt)',
              path: 'typography.titleSizePt',
              min: 12,
              max: 48,
              defaultValue: 28,
            },
            {
              type: 'number',
              label: 'Subtitle (pt)',
              path: 'typography.subtitleSizePt',
              min: 8,
              max: 28,
              defaultValue: 14,
            },
          ],
        },
        {
          type: 'row',
          items: [
            {
              type: 'number',
              label: 'Tags (pt)',
              path: 'typography.tagsSizePt',
              min: 6,
              max: 22,
              defaultValue: 11,
            },
            {
              type: 'number',
              label: 'Body (pt)',
              path: 'typography.bodySizePt',
              min: 7,
              max: 20,
              step: 0.5,
              defaultValue: 10.5,
            },
          ],
        },
        {
          type: 'asset-button',
          label: '+ Upload Custom Fonts (.woff2 / .ttf)',
          assetKind: 'fonts',
        },
      ],
    },
  ];
}
