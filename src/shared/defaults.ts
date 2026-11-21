import type { DesignConfig, ProjectConfig } from './types.js';

export function createStarterDesign(): DesignConfig {
  return {
    activeVariant: 'default',
    variants: {
      default: {
        label: 'Default',
        globalSeed: 42,
        backgroundColor: '#FFFFFF',
        textColor: '#111111',
        palette: {
          primary: '#2563EB',
          secondary: '#16A34A',
          accent: '#DC2626',
          neutral: '#6B7280',
          default: '#1C1C1C',
        },
        typography: {
          titleFont: "'Barlow Condensed', 'Oswald', sans-serif",
          tagsFont: "'Inter', sans-serif",
          subtitleFont: "'Barlow Condensed', 'Oswald', sans-serif",
          bodyFont: "'Inter', sans-serif",
          titleSizePt: 24,
          tagsSizePt: 10,
          subtitleSizePt: 12,
          bodySizePt: 10,
        },
        topBlock: {
          minLeftPct: 4,
          maxLeftPct: 24,
          minHeightPct: 22,
          maxHeightPct: 32,
          tagsMinLeftPct: 4,
          tagsMaxLeftPct: 40,
          halfBorderMm: 1.5,
          bleedRight: true,
        },
        divider: {
          enabled: true,
          styles: ['single-black'],
          ovalProbability: 0,
        },
        gameMark: {
          text: '',
          probability: 0,
          fonts: ["'Space Grotesk', sans-serif"],
          colors: ['#111111'],
          minSizePt: 12,
          maxSizePt: 20,
        },
        canvas: {
          mode: 'empty',
          patternOpacity: 0.1,
          patternDensity: 10,
          patternScale: 1,
        },
      },
    },
  };
}

export function createBlankDesign(): DesignConfig {
  return createStarterDesign();
}

export function createStarterProjectConfig(name: string, slug: string): ProjectConfig {
  return {
    name,
    slug,
    description: '',
    googleSheetUrl: '',
    localCsv: 'cards.csv',
    cardSize: {
      widthMm: 63,
      heightMm: 88,
      bleedMm: 3,
    },
  };
}

export const STARTER_CSV = `id,type_group,color,title,subtitle,count,description
CARD_001,Unit,primary,SCOUT,FAST UNIT,2,Move up to 2 spaces on your turn.
CARD_002,Unit,secondary,GUARDIAN,DEFENDER,2,Absorb 1 damage for an adjacent ally.
CARD_003,Action,accent,SURGE,INSTANT,1,Draw 2 cards and take an extra action.
`;
