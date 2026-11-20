import type { DesignConfig, ProjectConfig } from './types.js';

/**
 * Built-in minimalist line-art SVG food icons for the procedural pattern canvas mode.
 * ViewBox is always 0 0 24 24.
 */
export const BUILTIN_FOOD_ICONS: readonly string[] = [
  // Fork & knife
  '<path d="M7 3v7a2 2 0 0 1-2 2v9M5 3v4M9 3v4M17 3v18M17 3c2 2 2 6 0 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  // Leaf / basil
  '<path d="M5 19C5 11 11 5 19 5c0 8-6 14-14 14Zm0 0 8-8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  // Tomato / round fruit
  '<circle cx="12" cy="13" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 6.5V4M9.5 6.5c1-1.2 4-1.2 5 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  // Cheese wedge
  '<path d="M4 17h16v-6L11 5 4 11v6Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="10" cy="13.5" r="1.1" fill="currentColor"/><circle cx="15" cy="14" r="0.9" fill="currentColor"/>',
  // Bowl with steam
  '<path d="M4 12h16a8 8 0 0 1-16 0ZM8 7c0-1.5 1-2 1-3M12 7c0-1.5 1-2 1-3M16 7c0-1.5 1-2 1-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  // Chili pepper
  '<path d="M17 5c1-1 2.5-1 3 0M17 5c-1 6-5 12-12 13 2-5 5-10 12-13Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  // Wine glass
  '<path d="M8 3h8l-1 6a3 3 0 0 1-6 0L8 3ZM12 12v8M9 20h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  // Citrus slice
  '<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 5v14M5 12h14M7.1 7.1l9.8 9.8M16.9 7.1l-9.8 9.8" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>',
];

export function createMenuTemplateDesign(): DesignConfig {
  return {
    activeVariant: 'classic-minimal',
    variants: {
      'classic-minimal': {
        label: 'Classic Minimal',
        globalSeed: 42,
        backgroundColor: '#FFFFFF',
        textColor: '#0F0F0F',
        palette: {
          'zelená': '#5EB052',
          'modrá': '#3B82F6',
          'žltá': '#F2C200',
          'hnedá': '#846144',
          'červená': '#DF2C14',
          'sivá': '#888888',
          'čierna': '#1C1C1C',
          default: '#2D2D2D',
        },
        typography: {
          titleFont: "'Oswald', 'Arial Narrow', Impact, sans-serif",
          tagsFont: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          subtitleFont: "'Oswald', 'Arial Narrow', sans-serif",
          bodyFont: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          titleSizePt: 28,
          tagsSizePt: 11,
          subtitleSizePt: 14,
          bodySizePt: 10.5,
        },
        topBlock: {
          minLeftPct: 4,
          maxLeftPct: 38,
          minHeightPct: 22,
          maxHeightPct: 36,
          halfBorderMm: 1.6,
          bleedRight: true,
        },
        divider: {
          enabled: true,
          styles: [
            'single-black',
            'double-blue',
            'double-pink',
            'red-blue',
            'double-grey',
            'oval-accent',
          ],
          ovalProbability: 0.12,
        },
        gameMark: {
          text: 'menu',
          probability: 0.45,
          fonts: [
            "'Caveat', cursive",
            "'Pacifico', cursive",
            "'Oswald', sans-serif",
            "'Space Grotesk', sans-serif",
          ],
          colors: ['#1D4ED8', '#DC2626', '#111111', '#15803D', '#9333EA'],
          minSizePt: 12,
          maxSizePt: 22,
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
  const base = createMenuTemplateDesign();
  base.variants['classic-minimal'].label = 'Default';
  base.variants['classic-minimal'].gameMark.text = '';
  base.variants['classic-minimal'].gameMark.probability = 0;
  return base;
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

export const STARTER_CSV = `id,type_group,kitchen,color,size,title,subtitle,tags_str,count,image,is_action,description
CARD_001,Surovina,TAL,zelená,celá,CESTOVINY,FETTUCCINE,TAL V,1,,0,
CARD_002,Surovina,TAL,zelená,polovičná,BRUSCHETTA,BRUSCHETTA,TAL V 1/2,1,,0,
CARD_003,Surovina,IND~JAP,hnedá/červená,celá,ZÁZVOR,ZÁZVOR,IND~JAP V,1,,0,
CARD_004,Akcia,,čierna,,INVENTÚRA,,,1,,1,Skontroluj karty na ruke protihráča a jednu si zober
CARD_005,Špeciálna,,modrá,,KORENIE (FRA),,,1,,2,Zmení hotový chod na FRA kuchyňu
`;
