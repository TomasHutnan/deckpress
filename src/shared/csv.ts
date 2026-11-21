import type { CardRow, ExpandedCard } from './types.js';

function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
}

/**
 * RFC-4180 compliant CSV parser preserving UTF-8 diacritics, quoted newlines/commas,
 * and exact column order for arbitrary game schemas.
 */
export function parseCsvWithColumns(input: string): {
  columns: string[];
  rows: CardRow[];
} {
  const grid: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(cell);
      grid.push(row);
      row = [];
      cell = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(cell);
      grid.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    grid.push(row);
  }

  if (grid.length === 0) return { columns: [], rows: [] };
  const rawHeaders = grid.shift()!;
  const headers = rawHeaders.map(normalizeHeader);
  const columns = headers.filter(Boolean);

  const rows: CardRow[] = [];
  for (let r = 0; r < grid.length; r++) {
    const line = grid[r];
    if (!line || line.every((v) => v.trim() === '')) continue;

    const record: Record<string, string | number | undefined> = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      record[key] = (line[c] ?? '').trim();
    }

    const parsedCount = Number.parseInt(
      String(record.count ?? record.quantity ?? '1'),
      10,
    );
    const count = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 1;

    rows.push({
      ...record,
      id: String(record.id || `ROW_${String(r + 1).padStart(3, '0')}`),
      count,
    });
  }

  return { columns, rows };
}

export function parseCsv(input: string): CardRow[] {
  return parseCsvWithColumns(input).rows;
}

export function expandCards(rows: CardRow[]): ExpandedCard[] {
  const expanded: ExpandedCard[] = [];
  for (const row of rows) {
    const copies = Math.max(1, Number(row.count) || 1);
    for (let i = 0; i < copies; i++) {
      expanded.push({
        ...row,
        _copyIndex: i + 1,
        _totalCopies: copies,
        _instanceKey: copies > 1 ? `${row.id}__${i + 1}` : row.id,
      });
    }
  }
  return expanded;
}

function escapeCsvCell(value: string | number | undefined): string {
  const str = value === undefined || value === null ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serializes CardRow[] back to RFC-4180 UTF-8 CSV, preserving column order.
 */
export function serializeCsv(rows: CardRow[], preferredColumns?: string[]): string {
  const colSet = new Set<string>(preferredColumns || []);
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (key.startsWith('_')) continue;
      if (row[key] !== undefined) {
        colSet.add(key);
      }
    }
  }
  const cols = Array.from(colSet);
  const lines = [cols.join(',')];
  for (const row of rows) {
    lines.push(cols.map((c) => escapeCsvCell(row[c])).join(','));
  }
  return lines.join('\n') + '\n';
}
