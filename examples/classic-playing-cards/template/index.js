// Entry point for "Classic Playing Cards" demo template (template/index.js).
const { getDeckOpts } = require('./suits.js');
const { renderNumberCard, renderAceCard } = require('./pips.js');
const { renderCourtCard } = require('./court.js');
const { renderJokerCard, renderReferenceFront, renderReferenceBack } = require('./special.js');
const { renderPlayableBack } = require('./back.js');

function wrapCard(ctx, inner, extraClass = '') {
  const { card, variant, cardSize } = ctx;
  const opts = getDeckOpts(variant);
  const idxScale = opts.indexScale ?? 1;
  return `
    <div class="dp-card ${extraClass}" data-card-id="${helpers.escapeHtml(card._instanceKey)}" style="--pc-w:${cardSize.widthMm}mm;--pc-h:${cardSize.heightMm}mm;--pc-bleed:${cardSize.bleedMm}mm;--dp-bg:${variant.backgroundColor};--dp-fg:${variant.textColor};--dp-title-font:${variant.typography.titleFont};--dp-sub-font:${variant.typography.subtitleFont};--dp-body-font:${variant.typography.bodyFont};--dp-title-size:${(variant.typography.titleSizePt * idxScale).toFixed(2)}pt;--dp-body-size:${variant.typography.bodySizePt}pt;">
      <div class="dp-trim-area">
        ${inner}
      </div>
    </div>
  `;
}

return {
  renderCard(ctx) {
    const { card, variant, overrides } = ctx;
    const override = overrides[card._instanceKey] ?? overrides[card.id];
    const baseSeed =
      override?.seed !== undefined ? override.seed : variant.globalSeed;
    const rng = helpers.mulberry32(
      helpers.hashString(`${card._instanceKey}::${baseSeed}`),
    );

    const group = String(card.type_group || '').trim().toLowerCase();
    let inner = '';
    if (group === 'reference') {
      inner = renderReferenceFront(ctx);
    } else if (group === 'joker') {
      inner = renderJokerCard(ctx, rng);
    } else if (group === 'court') {
      inner = renderCourtCard(ctx, rng);
    } else if (group === 'ace') {
      inner = renderAceCard(ctx, rng);
    } else {
      inner = renderNumberCard(ctx, rng);
    }

    return wrapCard(ctx, inner);
  },

  renderCardBack(ctx) {
    const group = String(ctx.card.type_group || '').trim().toLowerCase();
    if (group === 'reference') {
      return wrapCard(ctx, renderReferenceBack(ctx));
    }
    return wrapCard(ctx, renderPlayableBack(ctx), 'is-card-back');
  },

  getBaseCss(_cardSize, customCss) {
    return customCss || '';
  },
};
