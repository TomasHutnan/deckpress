// Shared suit vectors, palette resolution, corner indices, and background canvas layers.

const CLASSIC_PATHS = {
  spades:
    '<path fill="currentColor" d="M12 2C9.5 6 4 10.2 4 14.3c0 2.5 1.9 4.2 4.2 4.2 1.4 0 2.5-.6 3.2-1.5-.1 1.8-.8 3.5-2.4 4.5h6c-1.6-1-2.3-2.7-2.4-4.5.7.9 1.8 1.5 3.2 1.5 2.3 0 4.2-1.7 4.2-4.2C20 10.2 14.5 6 12 2z"/>',
  hearts:
    '<path fill="currentColor" d="M12 21.2C10.8 20 3.5 13.7 3.5 8.4 3.5 5.4 5.8 3.2 8.6 3.2c1.6 0 2.8.8 3.4 2 .6-1.2 1.8-2 3.4-2 2.8 0 5.1 2.2 5.1 5.2 0 5.3-7.3 11.6-8.5 12.8z"/>',
  diamonds:
    '<path fill="currentColor" d="M12 2.2L19.6 12 12 21.8 4.4 12 12 2.2z"/>',
  clubs:
    '<path fill="currentColor" d="M12 2.6a3.9 3.9 0 0 0-3.2 6.1 4.1 4.1 0 1 0 2.6 7.4c-.2 2-.9 3.7-2.4 4.9h6c-1.5-1.2-2.2-2.9-2.4-4.9a4.1 4.1 0 1 0 2.6-7.4A3.9 3.9 0 0 0 12 2.6z"/>',
};

const MODERN_PATHS = {
  spades:
    '<path fill="currentColor" d="M12 2.2L19.8 13.2a4.6 4.6 0 0 1-7.1 3.9l2.1 4.7H9.2l2.1-4.7a4.6 4.6 0 0 1-7.1-3.9L12 2.2z"/>',
  hearts:
    '<path fill="currentColor" d="M12 21.4L4.2 12.2a4.8 4.8 0 0 1 7.8-5.3 4.8 4.8 0 0 1 7.8 5.3L12 21.4z"/>',
  diamonds:
    '<path fill="currentColor" d="M12 2L18.8 12 12 22 5.2 12 12 2z"/>',
  clubs:
    '<circle cx="12" cy="7.2" r="4.1" fill="currentColor"/><circle cx="7.4" cy="13.8" r="4.1" fill="currentColor"/><circle cx="16.6" cy="13.8" r="4.1" fill="currentColor"/><path fill="currentColor" d="M11 14h2l2.1 7.5H8.9L11 14z"/>',
};

function getDeckOpts(variant) {
  return Object.assign(
    {
      pipStyle: 'classic',
      showInnerFrame: true,
      indexScale: 1,
      ornamentLevel: 1,
      backPattern: 'lattice',
    },
    variant.deck || {},
  );
}

function getSuitColor(suit, variant) {
  const key = String(suit || '').toLowerCase();
  const p = variant.palette || {};
  if (key === 'hearts') return p.hearts || '#C81E1E';
  if (key === 'diamonds') return p.diamonds || '#C81E1E';
  if (key === 'clubs') return p.clubs || '#141414';
  if (key === 'spades') return p.spades || '#141414';
  return variant.textColor || '#141414';
}

function getSuitSvg(suit, style = 'classic', className = 'pc-suit-svg') {
  const key = String(suit || 'spades').toLowerCase();
  const table = style === 'modern' ? MODERN_PATHS : CLASSIC_PATHS;
  const inner = table[key] || table.spades;
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
}

function renderCornerIndices(rank, suit, color, style) {
  const safeRank = helpers.escapeHtml(String(rank || ''));
  const isTen = safeRank === '10';
  const pip = getSuitSvg(suit, style, 'pc-idx-pip');
  const block = `
    <div class="pc-idx-rank${isTen ? ' is-ten' : ''}">${safeRank}</div>
    ${pip}
  `;
  return `
    <div class="pc-index pc-index-tl" style="color:${color}">${block}</div>
    <div class="pc-index pc-index-br" style="color:${color}">${block}</div>
  `;
}

function renderCanvasLayer(ctx, rng, accentColor) {
  const { variant, cardSize, cardIndex, customIconsSvg } = ctx;
  const canvas = variant.canvas || { mode: 'empty' };

  if (canvas.mode === 'watermark') {
    const { sheetX, sheetY, words, params } = helpers.getCardWatermarks(
      variant,
      cardIndex,
      cardSize,
    );
    const text = helpers.escapeHtml(params.text || 'DECK 54');
    const items = words
      .map((w) => {
        const lx = w.x - sheetX;
        const ly = w.y - sheetY;
        return `<text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" font-size="${w.sizeMm.toFixed(2)}" fill="${params.color}" fill-opacity="${params.opacity}" font-weight="800" text-anchor="middle" dominant-baseline="central" transform="rotate(${w.angleDeg.toFixed(1)} ${lx.toFixed(2)} ${ly.toFixed(2)})" font-family="${helpers.escapeHtml(variant.typography.titleFont)}">${text}</text>`;
      })
      .join('');
    return `<svg class="pc-canvas-layer" viewBox="0 0 ${cardSize.widthMm} ${cardSize.heightMm}" preserveAspectRatio="none">${items}</svg>`;
  }

  if (canvas.mode === 'pattern') {
    const icons =
      customIconsSvg && customIconsSvg.length > 0
        ? customIconsSvg
        : Object.values(CLASSIC_PATHS);
    const count = Math.max(4, Math.min(24, canvas.patternDensity ?? 10));
    const opacity = canvas.patternOpacity ?? 0.06;
    const scale = canvas.patternScale ?? 0.9;
    const cols = Math.ceil(Math.sqrt(count * 0.72));
    const rows = Math.ceil(count / cols);
    let out = '';
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = ((col + 0.5 + (rng() - 0.5) * 0.5) / cols) * 100;
      const y = ((row + 0.5 + (rng() - 0.5) * 0.5) / rows) * 100;
      const rot = Math.round((rng() - 0.5) * 55);
      const sizeMm = (5.5 + rng() * 3.5) * scale;
      const svgInner = icons[Math.floor(rng() * icons.length)];
      out += `<svg class="pc-pattern-icon" viewBox="0 0 24 24" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;width:${sizeMm.toFixed(1)}mm;height:${sizeMm.toFixed(1)}mm;color:${accentColor};opacity:${opacity};transform:translate(-50%,-50%) rotate(${rot}deg)">${svgInner}</svg>`;
    }
    return `<div class="pc-canvas-layer">${out}</div>`;
  }

  return '';
}

return {
  CLASSIC_PATHS,
  MODERN_PATHS,
  getDeckOpts,
  getSuitColor,
  getSuitSvg,
  renderCornerIndices,
  renderCanvasLayer,
};
