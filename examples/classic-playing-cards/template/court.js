// Double-headed Swiss/Bauhaus geometric Court cards (Jack, Queen, King).
const { getDeckOpts, getSuitColor, getSuitSvg, renderCornerIndices, renderCanvasLayer } =
  require('./suits.js');

function renderRoyalHalf(rank, suit, suitColor, gold, bg, style, rng, orn) {
  const rankUpper = String(rank || 'K').toUpperCase();
  const accentShift = (rng() - 0.5) * 6;
  const motifStyle = Math.floor(rng() * 3);

  // Distinct geometric crown / royal emblem per rank
  let crownSvg = '';
  let emblemSvg = '';
  if (rankUpper === 'K') {
    crownSvg = `
      <path d="M22 31L26 14L38 23L50 10L62 23L74 14L78 31Z" fill="${gold}" stroke="${suitColor}" stroke-width="1.6" stroke-linejoin="round"/>
      <rect x="22" y="31" width="56" height="5" rx="1.2" fill="${suitColor}"/>
      <circle cx="50" cy="8.5" r="2.6" fill="${suitColor}"/>
      <circle cx="26" cy="12.5" r="2.2" fill="${suitColor}"/>
      <circle cx="74" cy="12.5" r="2.2" fill="${suitColor}"/>
    `;
    // Royal scepter / sword diamond
    emblemSvg = `
      <line x1="50" y1="39" x2="50" y2="74" stroke="${gold}" stroke-width="2.2"/>
      <line x1="38" y1="50" x2="62" y2="50" stroke="${gold}" stroke-width="2.2"/>
      <polygon points="50,41 58,50 50,59 42,50" fill="${suitColor}"/>
    `;
  } else if (rankUpper === 'Q') {
    crownSvg = `
      <path d="M24 31L30 16L42 24L50 12L58 24L70 16L76 31Z" fill="${gold}" stroke="${suitColor}" stroke-width="1.5" stroke-linejoin="round"/>
      <rect x="24" y="31" width="52" height="4.5" rx="2" fill="${suitColor}"/>
      <circle cx="50" cy="11" r="2.5" fill="${gold}" stroke="${suitColor}" stroke-width="1.2"/>
    `;
    // Stylized geometric rose
    emblemSvg = `
      <circle cx="50" cy="52" r="11" fill="${gold}" fill-opacity="0.28" stroke="${gold}" stroke-width="1.4"/>
      <circle cx="50" cy="52" r="6.5" fill="${suitColor}"/>
      <circle cx="50" cy="52" r="2.6" fill="${bg}"/>
    `;
  } else {
    // Jack: geometric knight crest / shield
    crownSvg = `
      <path d="M27 32C29 19 39 14 50 14C61 14 71 19 73 32Z" fill="${suitColor}"/>
      <path d="M50 14L65 9L58 21Z" fill="${gold}"/>
      <rect x="25" y="31" width="50" height="4.5" rx="1.2" fill="${gold}"/>
    `;
    emblemSvg = `
      <path d="M38 41H62V54C62 61 50 67 50 67C50 67 38 61 38 54Z" fill="${gold}" fill-opacity="0.26" stroke="${suitColor}" stroke-width="1.8"/>
      <polygon points="50,45 55,53 50,61 45,53" fill="${suitColor}"/>
    `;
  }

  // Seeded subtle background geometric flourish
  let geoFlourish = '';
  if (orn > 0) {
    const op = (0.14 * orn).toFixed(2);
    if (motifStyle === 0) {
      geoFlourish = `<circle cx="${(50 + accentShift).toFixed(1)}" cy="52" r="28" fill="none" stroke="${suitColor}" stroke-opacity="${op}" stroke-width="0.9" stroke-dasharray="3 2.5"/>`;
    } else if (motifStyle === 1) {
      geoFlourish = `<polygon points="50,18 82,52 50,86 18,52" fill="none" stroke="${gold}" stroke-opacity="${(0.24 * orn).toFixed(2)}" stroke-width="1"/>`;
    } else {
      geoFlourish = `<line x1="14" y1="20" x2="86" y2="74" stroke="${suitColor}" stroke-opacity="${op}" stroke-width="0.8"/><line x1="86" y1="20" x2="14" y2="74" stroke="${suitColor}" stroke-opacity="${op}" stroke-width="0.8"/>`;
    }
  }

  return `
    <div class="pc-court-half">
      <svg class="pc-court-art" viewBox="0 0 100 78" aria-hidden="true">
        ${geoFlourish}
        ${crownSvg}
        ${emblemSvg}
      </svg>
      <div class="pc-court-pip-badge" style="color:${suitColor}">
        ${getSuitSvg(suit, style, 'pc-court-pip-svg')}
      </div>
    </div>
  `;
}

function renderCourtCard(ctx, rng) {
  const { card, variant } = ctx;
  const opts = getDeckOpts(variant);
  const suit = String(card.suit || 'spades').toLowerCase();
  const rank = String(card.rank || 'K');
  const color = getSuitColor(suit, variant);
  const gold = variant.palette?.gold || '#B4832C';
  const orn = opts.ornamentLevel ?? 1;

  // Use the same RNG state for both halves so the court card is perfectly symmetrical
  const halfSeed = Math.floor(rng() * 1e9);
  const halfRngA = helpers.mulberry32(halfSeed);
  const halfRngB = helpers.mulberry32(halfSeed);

  const topHalf = renderRoyalHalf(
    rank,
    suit,
    color,
    gold,
    variant.backgroundColor,
    opts.pipStyle,
    halfRngA,
    orn,
  );
  const bottomHalf = renderRoyalHalf(
    rank,
    suit,
    color,
    gold,
    variant.backgroundColor,
    opts.pipStyle,
    halfRngB,
    orn,
  );

  return `
    ${renderCanvasLayer(ctx, rng, color)}
    ${renderCornerIndices(rank, suit, color, opts.pipStyle)}
    <div class="pc-court-frame${opts.showInnerFrame ? ' has-frame' : ''}" style="--pc-suit:${color};--pc-gold:${gold}">
      <div class="pc-court-top">${topHalf}</div>
      <div class="pc-court-divider">
        <span class="pc-court-sash-diamond"></span>
        <span class="pc-court-sash-label">${helpers.escapeHtml(rank)}</span>
        <span class="pc-court-sash-diamond"></span>
      </div>
      <div class="pc-court-bottom">${bottomHalf}</div>
    </div>
  `;
}

return { renderCourtCard };
