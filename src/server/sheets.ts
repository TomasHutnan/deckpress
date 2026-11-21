import fs from 'node:fs/promises';
import { expandCards, parseCsvWithColumns } from '../shared/csv.js';
import type { CardRow, ExpandedCard, ProjectConfig } from '../shared/types.js';
import { resolveProjectCsvPath } from './projects.js';

export interface CardsResult {
  source: 'google-sheet' | 'local-csv';
  warning?: string;
  columns: string[];
  rows: CardRow[];
  cards: ExpandedCard[];
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!h || h === 'localhost' || h === '::1' || h.endsWith('.local') || h.endsWith('.internal')) {
    return true;
  }
  // Reject single-label hostnames (e.g. internal Docker service names like "caddy" or "redis")
  if (!h.includes('.')) return true;
  // IPv4 private / loopback / link-local ranges
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

export function validateExternalSheetUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid Google Sheet URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Sheet URL must use https://');
  }
  if (isPrivateOrLocalHost(parsed.hostname)) {
    throw new Error('Sheet URL cannot target local or private network addresses');
  }
  return parsed.toString();
}

export async function fetchProjectCards(
  slug: string,
  config: ProjectConfig,
  forceLocal = false,
): Promise<CardsResult> {
  const localPath = resolveProjectCsvPath(slug, config.localCsv);

  if (!forceLocal && config.googleSheetUrl && config.googleSheetUrl.trim()) {
    try {
      const safeUrl = validateExternalSheetUrl(config.googleSheetUrl);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(safeUrl, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const csvText = await res.text();
      const { columns, rows } = parseCsvWithColumns(csvText);
      if (rows.length > 0) {
        // Cache latest fetched sheet locally so offline/print works seamlessly
        await fs.writeFile(localPath, csvText, 'utf8').catch(() => {});
        return {
          source: 'google-sheet',
          columns,
          rows,
          cards: expandCards(rows),
        };
      }
      throw new Error('Google Sheet returned 0 rows');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const localText = await fs.readFile(localPath, 'utf8').catch(() => '');
      const { columns, rows } = parseCsvWithColumns(localText);
      return {
        source: 'local-csv',
        warning: `Google Sheet unreachable (${msg}); showing local ${config.localCsv}.`,
        columns,
        rows,
        cards: expandCards(rows),
      };
    }
  }

  const localText = await fs.readFile(localPath, 'utf8').catch(() => '');
  const { columns, rows } = parseCsvWithColumns(localText);
  return {
    source: 'local-csv',
    columns,
    rows,
    cards: expandCards(rows),
  };
}
