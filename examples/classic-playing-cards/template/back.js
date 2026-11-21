// Full-bleed symmetrical playing card backs (Lattice, Starburst, Minimal).
const { getDeckOpts } = require('./suits.js');

function renderPlayableBack(ctx) {
  const { variant, cardSize } = ctx;
  const opts = getDeckOpts(variant);
  const bg = variant.palette?.backBg || '#1E3A5F';
  const accent = variant.palette?.backAccent || '#E5C17B';
  const pattern = opts.backPattern || 'lattice';
  const mark = helpers.escapeHtml((variant.gameMark?.text || '54').slice(0, 12).toUpperCase());

  let patternSvg = '';
  if (pattern === 'starburst') {
    let rays = '';
    for (let i = 0; i < 24; i++) {
      const a = (i * 15 * Math.PI) / 180;
      const x2 = (50 + Math.cos(a) * 80).toFixed(1);
      const y2 = (70 + Math.sin(a) * 80).toFixed(1);
      rays += `<line x1="50" y1="70" x2="${x2}" y2="${y2}" stroke="${accent}" stroke-opacity="0.32" stroke-width="${i % 2 === 0 ? 0.9 : 0.4}"/>`;
    }
    patternSvg = `
      <svg class="pc-back-svg" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice">
        ${rays}
        <rect x="6" y="6" width="88" height="128" rx="3" fill="none" stroke="${accent}" stroke-width="1.2"/>
        <rect x="10" y="10" width="80" height="120" rx="2" fill="none" stroke="${accent}" stroke-opacity="0.55" stroke-width="0.6"/>
        <circle cx="50" cy="70" r="19" fill="${bg}" stroke="${accent}" stroke-width="1.3"/>
        <polygon points="50,54 54,66 66,70 54,74 50,86 46,74 34,70 46,66" fill="${accent}"/>
      </svg>
    `;
  } else if (pattern === 'minimal') {
    patternSvg = `
      <svg class="pc-back-svg" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice">
        <rect x="8" y="8" width="84" height="124" rx="2.5" fill="none" stroke="${accent}" stroke-width="1.1"/>
        <rect x="13" y="13" width="74" height="114" rx="1.5" fill="none" stroke="${accent}" stroke-opacity="0.45" stroke-width="0.6"/>
        <polygon points="50,42 70,70 50,98 30,70" fill="none" stroke="${accent}" stroke-width="1.2"/>
        <polygon points="50,50 64,70 50,90 36,70" fill="${accent}" fill-opacity="0.16" stroke="${accent}" stroke-width="0.6"/>
        <text x="50" y="72.5" text-anchor="middle" fill="${accent}" font-size="6.8" font-weight="700" letter-spacing="1.2" font-family="${helpers.escapeHtml(variant.typography.subtitleFont)}">${mark}</text>
      </svg>
    `;
  } else {
    // Classic diamond lattice
    let grid = '';
    for (let x = -40; x <= 140; x += 10) {
      grid += `<line x1="${x}" y1="0" x2="${x + 140}" y2="140" stroke="${accent}" stroke-opacity="0.26" stroke-width="0.55"/>`;
      grid += `<line x1="${x + 140}" y1="0" x2="${x}" y2="140" stroke="${accent}" stroke-opacity="0.26" stroke-width="0.55"/>`;
    }
    patternSvg = `
      <svg class="pc-back-svg" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice">
        <defs>
          <clipPath id="pc-back-clip-${ctx.cardIndex}">
            <rect x="9" y="9" width="82" height="122" rx="2"/>
          </clipPath>
        </defs>
        <g clip-path="url(#pc-back-clip-${ctx.cardIndex})">${grid}</g>
        <rect x="6" y="6" width="88" height="128" rx="3" fill="none" stroke="${accent}" stroke-width="1.3"/>
        <rect x="9" y="9" width="82" height="122" rx="2" fill="none" stroke="${accent}" stroke-opacity="0.7" stroke-width="0.6"/>
        <polygon points="50,46 67,70 50,94 33,70" fill="${bg}" stroke="${accent}" stroke-width="1.3"/>
        <polygon points="50,53 61,70 50,87 39,70" fill="none" stroke="${accent}" stroke-opacity="0.7" stroke-width="0.7"/>
        <circle cx="50" cy="70" r="4.2" fill="${accent}"/>
      </svg>
    `;
  }

  return `
    <div class="pc-back-bleed" style="background:${bg};inset:${-cardSize.bleedMm}mm;">
      <div class="pc-back-inner" style="inset:${cardSize.bleedMm + 2.6}mm;background:${bg};">
        ${patternSvg}
      </div>
    </div>
  `;
}

return { renderPlayableBack };
