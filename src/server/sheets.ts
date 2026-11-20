import fs from 'node:fs/promises';
import path from 'node:path';
import { expandCards, parseCsv } from '../shared/csv.js';
import type { CardRow, ExpandedCard, ProjectConfig } from '../shared/types.js';
import { resolveProjectDir } from './projects.js';

export interface CardsResult {
  source: 'google-sheet' | 'local-csv';
  warning?: string;
  rows: CardRow[];
  cards: ExpandedCard[];
}

export async function fetchProjectCards(
  slug: string,
  config: ProjectConfig,
  forceLocal = false,
): Promise<CardsResult> {
  const dir = resolveProjectDir(slug);
  const localPath = path.join(dir, config.localCsv || 'cards.csv');

  if (!forceLocal && config.googleSheetUrl && config.googleSheetUrl.trim()) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(config.googleSheetUrl.trim(), {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const csvText = await res.text();
      const rows = parseCsv(csvText);
      if (rows.length > 0) {
        // Cache latest fetched sheet locally so offline/print works seamlessly
        await fs.writeFile(localPath, csvText, 'utf8').catch(() => {});
        return {
          source: 'google-sheet',
          rows,
          cards: expandCards(rows),
        };
      }
      throw new Error('Google Sheet returned 0 rows');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const localText = await fs.readFile(localPath, 'utf8').catch(() => '');
      const rows = parseCsv(localText);
      return {
        source: 'local-csv',
        warning: `Google Sheet unreachable (${msg}); showing local ${config.localCsv}.`,
        rows,
        cards: expandCards(rows),
      };
    }
  }

  const localText = await fs.readFile(localPath, 'utf8').catch(() => '');
  const rows = parseCsv(localText);
  return {
    source: 'local-csv',
    rows,
    cards: expandCards(rows),
  };
}
