// Programmatic Deck Manifest auto-generated directly from cards.csv.
const { cards, palette } = ctx;
const { escapeHtml } = helpers;

// Deduplicate expanded copies back to unique rows with quantity
const byId = new Map();
for (const c of cards) {
  if (!byId.has(c.id)) {
    byId.set(c.id, { ...c, _qty: 1 });
  } else {
    byId.get(c.id)._qty += 1;
  }
}
const unique = Array.from(byId.values());
const countGroup = (g) =>
  cards.filter((c) => String(c.type_group || '').toLowerCase() === g).length;

const suits = [
  { key: 'spades', label: '♠ Spades', color: palette.spades || '#141414' },
  { key: 'hearts', label: '♥ Hearts', color: palette.hearts || '#C81E1E' },
  { key: 'diamonds', label: '♦ Diamonds', color: palette.diamonds || '#C81E1E' },
  { key: 'clubs', label: '♣ Clubs', color: palette.clubs || '#141414' },
];

const suitBlocks = suits
  .map((s) => {
    const items = unique.filter((c) => String(c.suit || '').toLowerCase() === s.key);
    const total = items.reduce((acc, c) => acc + c._qty, 0);
    const rows = items
      .map(
        (c) =>
          `<li><span class="dm-rank-pill" style="color:${escapeHtml(s.color)}">${escapeHtml(c.rank)}</span> ${escapeHtml(c.title)}${c._qty > 1 ? ` <strong>×${c._qty}</strong>` : ''}</li>`,
      )
      .join('');
    return `
      <div class="dm-suit-card">
        <div class="dm-suit-head" style="background:${escapeHtml(s.color)}">
          <span>${escapeHtml(s.label)}</span>
          <span>${total} cards</span>
        </div>
        <ul class="dm-suit-list">${rows}</ul>
      </div>
    `;
  })
  .join('');

const extras = unique.filter((c) => {
  const g = String(c.type_group || '').toLowerCase();
  return g === 'joker' || g === 'reference';
});

const extrasRows = extras
  .map(
    (c) => `
      <tr>
        <td><code>${escapeHtml(c.id)}</code></td>
        <td><strong>${escapeHtml(c.title)}</strong></td>
        <td>${escapeHtml(c.type_group)}</td>
        <td>×${c._qty}</td>
        <td>${escapeHtml(c.description || '')}</td>
      </tr>
    `,
  )
  .join('');

return `
  <section class="dp-doc-page">
    <div class="dm-banner">
      <span class="dm-banner-title">CLASSIC PLAYING CARDS — DECK MANIFEST</span>
      <span class="dm-banner-meta">TOTAL ${cards.length} CARDS (${unique.length} UNIQUE ROWS)</span>
    </div>

    <div class="dm-stats">
      <div class="dm-stat"><div class="dm-stat-num">${countGroup('ace')}</div><div class="dm-stat-lbl">Aces</div></div>
      <div class="dm-stat"><div class="dm-stat-num">${countGroup('number')}</div><div class="dm-stat-lbl">Number</div></div>
      <div class="dm-stat"><div class="dm-stat-num">${countGroup('court')}</div><div class="dm-stat-lbl">Court</div></div>
      <div class="dm-stat"><div class="dm-stat-num">${countGroup('joker')}</div><div class="dm-stat-lbl">Jokers</div></div>
      <div class="dm-stat"><div class="dm-stat-num">${countGroup('reference')}</div><div class="dm-stat-lbl">Reference</div></div>
    </div>

    <div class="dm-grid">${suitBlocks}</div>

    <h2 class="dp-doc-h2" style="--sec-color:${escapeHtml(palette.gold || '#B4832C')}">Jokers &amp; Reference Cards</h2>
    <table class="dm-extras">
      <thead>
        <tr>
          <th>ID</th>
          <th>Title</th>
          <th>Group</th>
          <th>Qty</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>${extrasRows}</tbody>
    </table>
  </section>
`;
