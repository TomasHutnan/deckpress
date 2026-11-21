// Traditional French-suited pip layouts (2-10) and ornate centerpiece Aces.
const { getDeckOpts, getSuitColor, getSuitSvg, renderCornerIndices, renderCanvasLayer } =
  require('./suits.js');

// Coordinates [xPct, yPct, isInverted] inside the central pip stage
const PIP_LAYOUTS = {
  '2': [
    [50, 12, false],
    [50, 88, true],
  ],
  '3': [
    [50, 12, false],
    [50, 50, false],
    [50, 88, true],
  ],
  '4': [
    [26, 12, false],
    [74, 12, false],
    [26, 88, true],
    [74, 88, true],
  ],
  '5': [
    [26, 12, false],
    [74, 12, false],
    [50, 50, false],
    [26, 88, true],
    [74, 88, true],
  ],
  '6': [
    [26, 12, false],
    [74, 12, false],
    [26, 50, false],
    [74, 50, false],
    [26, 88, true],
    [74, 88, true],
  ],
  '7': [
    [26, 12, false],
    [74, 12, false],
    [50, 31, false],
    [26, 50, false],
    [74, 50, false],
    [26, 88, true],
    [74, 88, true],
  ],
  '8': [
    [26, 12, false],
    [74, 12, false],
    [50, 31, false],
    [26, 50, false],
    [74, 50, false],
    [50, 69, true],
    [26, 88, true],
    [74, 88, true],
  ],
  '9': [
    [26, 11, false],
    [74, 11, false],
    [26, 37, false],
    [74, 37, false],
    [50, 50, false],
    [26, 63, true],
    [74, 63, true],
    [26, 89, true],
    [74, 89, true],
  ],
  '10': [
    [26, 11, false],
    [74, 11, false],
    [50, 24, false],
    [26, 37, false],
    [74, 37, false],
    [26, 63, true],
    [74, 63, true],
    [50, 76, true],
    [26, 89, true],
    [74, 89, true],
  ],
};

function renderNumberCard(ctx, rng) {
  const { card, variant } = ctx;
  const opts = getDeckOpts(variant);
  const suit = String(card.suit || 'spades').toLowerCase();
  const rank = String(card.rank || '2');
  const color = getSuitColor(suit, variant);
  const coords = PIP_LAYOUTS[rank] || PIP_LAYOUTS['2'];
  const pipSizeMm = rank === '9' || rank === '10' ? 9.2 : rank === '7' || rank === '8' ? 9.8 : 10.6;

  const pipsHtml = coords
    .map(([x, y, flip]) => {
      const svg = getSuitSvg(suit, opts.pipStyle, 'pc-pip-svg');
      return `<div class="pc-pip${flip ? ' is-flipped' : ''}" style="left:${x}%;top:${y}%;width:${pipSizeMm}mm;height:${pipSizeMm}mm;color:${color}">${svg}</div>`;
    })
    .join('');

  return `
    ${renderCanvasLayer(ctx, rng, color)}
    ${renderCornerIndices(rank, suit, color, opts.pipStyle)}
    <div class="pc-pip-stage">${pipsHtml}</div>
  `;
}

function renderAceCard(ctx, rng) {
  const { card, variant } = ctx;
  const opts = getDeckOpts(variant);
  const suit = String(card.suit || 'spades').toLowerCase();
  const color = getSuitColor(suit, variant);
  const gold = variant.palette?.gold || '#B4832C';
  const isSpades = suit === 'spades';
  const orn = opts.ornamentLevel ?? 1;

  // Seeded radial rays behind the Ace emblem
  const rayCount = isSpades ? Math.round(16 + rng() * 12) : Math.round(8 + rng() * 6);
  const rayOffset = Math.round(rng() * 15);
  let rays = '';
  if (orn > 0) {
    for (let i = 0; i < rayCount; i++) {
      const angle = (360 / rayCount) * i + rayOffset;
      const len = i % 2 === 0 ? 44 : 36;
      const sw = i % 2 === 0 ? 0.65 : 0.35;
      rays += `<line x1="50" y1="50" x2="${(50 + Math.cos((angle * Math.PI) / 180) * len).toFixed(1)}" y2="${(50 + Math.sin((angle * Math.PI) / 180) * len).toFixed(1)}" stroke="${isSpades ? gold : color}" stroke-opacity="${(0.28 * orn).toFixed(2)}" stroke-width="${sw}"/>`;
    }
  }

  const edition = helpers.escapeHtml((variant.gameMark?.text || 'DECKPRESS 54').toUpperCase());
  const frameClass = opts.showInnerFrame ? ' has-frame' : '';

  return `
    ${renderCanvasLayer(ctx, rng, color)}
    ${renderCornerIndices('A', suit, color, opts.pipStyle)}
    <div class="pc-ace-stage${frameClass}" style="--pc-suit:${color};--pc-gold:${gold}">
      <svg class="pc-ace-ornament" viewBox="0 0 100 100" aria-hidden="true">
        ${rays}
        ${
          isSpades
            ? `<circle cx="50" cy="50" r="34" fill="none" stroke="${gold}" stroke-width="0.9" stroke-dasharray="2.5 1.8"/>
               <circle cx="50" cy="50" r="29" fill="none" stroke="${color}" stroke-opacity="0.35" stroke-width="0.6"/>`
            : `<polygon points="50,12 88,50 50,88 12,50" fill="none" stroke="${color}" stroke-opacity="0.22" stroke-width="0.7"/>`
        }
      </svg>
      <div class="pc-ace-emblem${isSpades ? ' is-spades' : ''}" style="color:${color}">
        ${getSuitSvg(suit, opts.pipStyle, 'pc-ace-svg')}
      </div>
      ${isSpades ? `<div class="pc-ace-edition" style="color:${color}">${edition}</div>` : ''}
    </div>
  `;
}

return { renderNumberCard, renderAceCard };
