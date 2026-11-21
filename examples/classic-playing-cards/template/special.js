// Jokers (Color & Monochrome) and double-sided 63x88mm Player Reference cards.
const { getDeckOpts, getSuitColor, getSuitSvg, renderCanvasLayer } = require('./suits.js');

function renderJokerCard(ctx, rng) {
  const { card, variant } = ctx;
  const opts = getDeckOpts(variant);
  const isColor = String(card.suit || '').toLowerCase() === 'color';
  const primary = isColor
    ? variant.palette?.hearts || '#C81E1E'
    : variant.palette?.spades || '#141414';
  const secondary = isColor
    ? variant.palette?.gold || '#B4832C'
    : variant.textColor || '#141414';
  const tertiary = isColor
    ? variant.palette?.diamonds || '#1D4ED8'
    : primary;
  const orn = opts.ornamentLevel ?? 1;

  // Seeded confetti diamonds
  let confetti = '';
  const pieces = Math.round(10 * Math.max(0.4, orn));
  const palette = [primary, secondary, tertiary];
  for (let i = 0; i < pieces; i++) {
    const x = 14 + rng() * 72;
    const y = 14 + rng() * 112;
    if (x > 30 && x < 70 && y > 40 && y < 100) continue; // keep center clear
    const r = 1.6 + rng() * 2.4;
    const col = palette[i % palette.length];
    const op = isColor ? 0.65 : 0.25;
    confetti += `<polygon points="${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}" fill="${col}" fill-opacity="${op}"/>`;
  }

  const label = isColor ? 'COLOR JOKER' : 'JOKER';

  return `
    ${renderCanvasLayer(ctx, rng, primary)}
    <div class="pc-joker-idx pc-joker-tl" style="color:${primary}"><span>J</span><span>O</span><span>K</span><span>E</span><span>R</span></div>
    <div class="pc-joker-idx pc-joker-br" style="color:${primary}"><span>J</span><span>O</span><span>K</span><span>E</span><span>R</span></div>
    <div class="pc-joker-stage${opts.showInnerFrame ? ' has-frame' : ''}" style="--pc-suit:${primary};--pc-gold:${secondary}">
      <svg class="pc-joker-svg" viewBox="0 0 100 140" aria-hidden="true">
        ${confetti}
        <!-- Geometric Jester Hat -->
        <path d="M50 48 C42 28, 22 30, 18 46 C28 44, 38 50, 44 62 Z" fill="${primary}"/>
        <path d="M50 48 C58 28, 78 30, 82 46 C72 44, 62 50, 56 62 Z" fill="${tertiary}" fill-opacity="${isColor ? '0.92' : '0.45'}"/>
        <path d="M50 26 C42 40, 42 52, 50 64 C58 52, 58 40, 50 26 Z" fill="${secondary}"/>
        <circle cx="17" cy="48" r="3.4" fill="${secondary}"/>
        <circle cx="83" cy="48" r="3.4" fill="${secondary}"/>
        <circle cx="50" cy="24" r="3.8" fill="${primary}"/>
        <!-- Collar ruff -->
        <polygon points="24,66 36,78 50,68 64,78 76,66 64,62 50,66 36,62" fill="${primary}" fill-opacity="0.18" stroke="${primary}" stroke-width="1.2"/>
        <!-- Starburst emblem -->
        <polygon points="50,76 54,88 66,88 56,95 60,107 50,100 40,107 44,95 34,88 46,88" fill="${secondary}"/>
      </svg>
      <div class="pc-joker-banner" style="color:${primary}">${label}</div>
    </div>
  `;
}

function renderReferenceFront(ctx) {
  const { variant } = ctx;
  const ink = variant.textColor || '#141414';
  const accent = variant.palette?.hearts || '#C81E1E';
  const gold = variant.palette?.gold || '#B4832C';
  const hands = [
    ['1', 'Royal Flush', 'A K Q J 10 (same suit)'],
    ['2', 'Straight Flush', '5 in sequence, same suit'],
    ['3', 'Four of a Kind', '4 cards of equal rank'],
    ['4', 'Full House', '3 of a kind + a pair'],
    ['5', 'Flush', 'Any 5 of the same suit'],
    ['6', 'Straight', '5 in sequence, mixed'],
    ['7', 'Three of a Kind', '3 cards of equal rank'],
    ['8', 'Two Pair', '2 different pairs'],
    ['9', 'One Pair', '2 cards of equal rank'],
    ['10', 'High Card', 'Highest single card'],
  ];

  const rows = hands
    .map(
      ([n, name, desc]) => `
        <div class="pc-ref-row">
          <span class="pc-ref-num" style="background:${n === '1' ? accent : ink}">${n}</span>
          <div class="pc-ref-text">
            <strong>${name}</strong>
            <span>${desc}</span>
          </div>
        </div>
      `,
    )
    .join('');

  return `
    <div class="pc-ref-card" style="--pc-ink:${ink};--pc-accent:${accent};--pc-gold:${gold}">
      <div class="pc-ref-header" style="background:${ink};color:${variant.backgroundColor}">
        <span class="pc-ref-title">POKER HAND RANKINGS</span>
        <span class="pc-ref-sub">HIGHEST → LOWEST</span>
      </div>
      <div class="pc-ref-list">${rows}</div>
      <div class="pc-ref-footer">
        <span>${getSuitSvg('spades', 'classic', 'pc-ref-pip')}</span>
        <span>${getSuitSvg('hearts', 'classic', 'pc-ref-pip')}</span>
        <span>${getSuitSvg('diamonds', 'classic', 'pc-ref-pip')}</span>
        <span>${getSuitSvg('clubs', 'classic', 'pc-ref-pip')}</span>
      </div>
    </div>
  `;
}

function renderReferenceBack(ctx) {
  const { variant } = ctx;
  const ink = variant.textColor || '#141414';
  const accent = variant.palette?.hearts || '#C81E1E';
  const gold = variant.palette?.gold || '#B4832C';

  return `
    <div class="pc-ref-card" style="--pc-ink:${ink};--pc-accent:${accent};--pc-gold:${gold}">
      <div class="pc-ref-header" style="background:${accent};color:#FFFFFF">
        <span class="pc-ref-title">CLASSIC GAMES GUIDE</span>
        <span class="pc-ref-sub">QUICK RULES</span>
      </div>
      <div class="pc-ref-body">
        <div class="pc-ref-block">
          <div class="pc-ref-block-title" style="color:${accent}">CRAZY EIGHTS (2–5P)</div>
          <ul>
            <li>Deal <strong>5 cards</strong> each (7 for 2 players).</li>
            <li>Match the top discard's <strong>suit or rank</strong>.</li>
            <li><strong>8s are wild</strong> — play anytime &amp; name the new suit.</li>
            <li>No match? Draw from the deck until playable.</li>
            <li>First player to empty their hand wins!</li>
          </ul>
        </div>
        <div class="pc-ref-block">
          <div class="pc-ref-block-title" style="color:${ink}">BLACKJACK (21)</div>
          <ul>
            <li>Get closer to <strong>21</strong> than the dealer without busting.</li>
            <li><strong>2–10</strong> = face value · <strong>J/Q/K</strong> = 10 · <strong>A</strong> = 1 or 11.</li>
            <li>Dealer draws to 16, stands on all 17s.</li>
            <li><strong>Ace + 10-card</strong> on deal = Natural Blackjack!</li>
          </ul>
        </div>
      </div>
      <div class="pc-ref-note">DECKPRESS DEMO · PUBLIC DOMAIN DECK</div>
    </div>
  `;
}

return { renderJokerCard, renderReferenceFront, renderReferenceBack };
