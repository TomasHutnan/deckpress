import fs from 'node:fs/promises';
import path from 'node:path';

interface BuiltinFontSpec {
  pkg: string;
  family: string;
  weight: number;
  style: 'normal' | 'italic';
}

const BUILTIN_FONTS: readonly BuiltinFontSpec[] = [
  { pkg: 'barlow-condensed', family: 'Barlow Condensed', weight: 300, style: 'italic' },
  { pkg: 'barlow-condensed', family: 'Barlow Condensed', weight: 400, style: 'italic' },
  { pkg: 'barlow-condensed', family: 'Barlow Condensed', weight: 500, style: 'normal' },
  { pkg: 'barlow-condensed', family: 'Barlow Condensed', weight: 700, style: 'normal' },
  { pkg: 'barlow-condensed', family: 'Barlow Condensed', weight: 800, style: 'normal' },
  { pkg: 'barlow-condensed', family: 'Barlow Condensed', weight: 900, style: 'normal' },
  { pkg: 'oswald', family: 'Oswald', weight: 500, style: 'normal' },
  { pkg: 'oswald', family: 'Oswald', weight: 700, style: 'normal' },
  { pkg: 'inter', family: 'Inter', weight: 300, style: 'italic' },
  { pkg: 'inter', family: 'Inter', weight: 400, style: 'italic' },
  { pkg: 'inter', family: 'Inter', weight: 400, style: 'normal' },
  { pkg: 'inter', family: 'Inter', weight: 600, style: 'normal' },
  { pkg: 'inter', family: 'Inter', weight: 700, style: 'normal' },
  { pkg: 'space-grotesk', family: 'Space Grotesk', weight: 500, style: 'normal' },
  { pkg: 'space-grotesk', family: 'Space Grotesk', weight: 700, style: 'normal' },
  { pkg: 'dancing-script', family: 'Dancing Script', weight: 500, style: 'normal' },
  { pkg: 'dancing-script', family: 'Dancing Script', weight: 700, style: 'normal' },
  { pkg: 'great-vibes', family: 'Great Vibes', weight: 400, style: 'normal' },
  { pkg: 'kaushan-script', family: 'Kaushan Script', weight: 400, style: 'normal' },
  { pkg: 'yusei-magic', family: 'Yusei Magic', weight: 400, style: 'normal' },
  { pkg: 'playfair-display', family: 'Playfair Display', weight: 700, style: 'normal' },
  { pkg: 'caveat', family: 'Caveat', weight: 500, style: 'normal' },
  { pkg: 'caveat', family: 'Caveat', weight: 700, style: 'normal' },
  { pkg: 'pacifico', family: 'Pacifico', weight: 400, style: 'normal' },
];

// Unicode ranges matching @fontsource latin-ext + latin subsets (includes full Slovak diacritics)
const SUBSET_RANGES: Record<'latin-ext' | 'latin', string> = {
  'latin-ext':
    'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
  latin:
    'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
};

let cachedCss: string | null = null;

/**
 * Inlines bundled SIL OFL @fontsource families as base64 data-URI @font-face rules so
 * headless Chromium renders 100% identical fonts to the browser preview offline.
 */
export async function getBuiltinFontsCss(): Promise<string> {
  if (cachedCss !== null) return cachedCss;

  const rules: string[] = [];
  const root = path.resolve(process.cwd(), 'node_modules', '@fontsource');

  for (const spec of BUILTIN_FONTS) {
    for (const subset of ['latin-ext', 'latin'] as const) {
      const file = path.join(
        root,
        spec.pkg,
        'files',
        `${spec.pkg}-${subset}-${spec.weight}-${spec.style}.woff2`,
      );
      try {
        const buf = await fs.readFile(file);
        const b64 = buf.toString('base64');
        rules.push(
          `@font-face { font-family: '${spec.family}'; font-style: ${spec.style}; font-weight: ${spec.weight}; font-display: block; src: url('data:font/woff2;base64,${b64}') format('woff2'); unicode-range: ${SUBSET_RANGES[subset]}; }`,
        );
      } catch {
        // Skip missing subset file if a font only ships latin
      }
    }
  }

  cachedCss = rules.join('\n');
  return cachedCss;
}
