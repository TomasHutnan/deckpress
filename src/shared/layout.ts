/**
 * Generic palette lookup helper: matches exact key, UPPERCASE, lowercase, or 'default'.
 */
export function resolveColor(
  key: string,
  palette: Record<string, string>,
): string {
  const raw = (key || '').trim();
  const candidates = [raw, raw.toUpperCase(), raw.toLowerCase(), 'default'].filter(Boolean);
  for (const c of candidates) {
    if (palette[c]) return palette[c];
  }
  return '#1C1C1C';
}
