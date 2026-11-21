import assert from 'node:assert/strict';
import test from 'node:test';
import { createMenuTemplateDesign } from './defaults.js';
import { getDocPageDims, renderProjectDocHtml } from './docs.js';
import { compileTemplateFiles } from './runtime.js';
import type { ExpandedCard, ProjectDoc } from './types.js';

const SAMPLE_CARDS: ExpandedCard[] = [
  {
    id: 'CARD_001',
    type_group: 'Surovina',
    kitchen: 'TAL',
    color: '',
    size: 'celá',
    title: 'CESTOVINY',
    subtitle: 'FETTUCCINE',
    tags_str: 'TAL V',
    count: 1,
    image: '',
    is_action: '0',
    description: '',
    _copyIndex: 0,
    _totalCopies: 1,
    _instanceKey: 'CARD_001#1',
  },
  {
    id: 'CARD_075',
    type_group: 'Akcia',
    kitchen: '',
    color: '',
    size: '',
    title: 'DUPĽA',
    subtitle: 'VYLOŽ HNEĎ PO AKČNEJ KARTE',
    tags_str: '',
    count: 1,
    image: '',
    is_action: '1',
    description: 'Zopakuj účinok',
    _copyIndex: 0,
    _totalCopies: 1,
    _instanceKey: 'CARD_075#1',
  },
  {
    id: 'OV_FRONT',
    type_group: 'Prehľad',
    kitchen: '',
    color: '',
    size: '',
    title: 'PREHĽAD',
    subtitle: '',
    tags_str: '',
    count: 1,
    image: '',
    is_action: '0',
    description: '',
    _copyIndex: 0,
    _totalCopies: 1,
    _instanceKey: 'OV_FRONT#1',
  },
];

test('getDocPageDims returns portrait and landscape dimensions', () => {
  assert.deepEqual(getDocPageDims('A4', 'portrait'), { widthMm: 210, heightMm: 297 });
  assert.deepEqual(getDocPageDims('A4', 'landscape'), { widthMm: 297, heightMm: 210 });
});

test('renderProjectDocHtml expands Markdown, colored headings, counts, pills, cards, and diagrams', () => {
  const design = createMenuTemplateDesign();
  const variant = design.variants[design.activeVariant];
  const { renderer } = compileTemplateFiles(undefined);

  const doc: ProjectDoc = {
    id: 'rules',
    meta: {
      title: 'Pravidlá',
      pageSize: 'A4',
      orientation: 'landscape',
      columns: 3,
      sections: ['01-intro.md', '02-back.md'],
    },
    stylesCss: '.custom-rule { color: red; }',
    sections: {
      '01-intro.md': [
        '## [TAL] Cieľ hry ({{count:playable}} kariet)',
        'Hraj s {{pill:TAL}} kartami ({{count:kitchen:TAL}} TAL, {{count:Akcia}} Akčné).',
        '',
        '1. **Ťahanie**',
        '  - **A:** 2 karty',
        '  - **B:** 1 z Obchodu',
        '',
        '{{card-row: width=18mm CARD_001 "Celá" | + | CARD_075}}',
        '{{diagram:sample}}',
        '---page---',
      ].join('\n'),
      '02-back.md': [
        '> **Príklad:** 5 bodov',
        '',
        '| Cesta | Body |',
        '| --- | ---: |',
        '| 3 rovnaké | **5 b.** |',
      ].join('\n'),
    },
    diagrams: {
      'sample.html': '<div class="box">{{card:CARD_001 width=11mm}}</div>',
    },
  };

  const res = renderProjectDocHtml({
    doc,
    cards: SAMPLE_CARDS,
    variant,
    cardSize: { widthMm: 63, heightMm: 88, bleedMm: 0 },
    overrides: {},
    renderer,
    assetBaseUrl: '/assets',
  });

  assert.equal(res.error, null);
  // Two pages separated by ---page---
  assert.equal((res.bodyHtml.match(/class="dp-doc-page"/g) || []).length, 2);
  // Playable count excludes Prehľad overview card (2 instead of 3)
  assert.ok(res.bodyHtml.includes('Cieľ hry (2 kariet)'));
  assert.ok(res.bodyHtml.includes('1 TAL, 1 Akčné'));
  assert.ok(res.bodyHtml.includes('dp-doc-pill'));
  assert.ok(res.bodyHtml.includes('dp-doc-card-row'));
  assert.ok(res.bodyHtml.includes('dp-doc-card-caption">Celá</div>'));
  assert.ok(res.bodyHtml.includes('dp-doc-diagram'));
  assert.ok(res.bodyHtml.includes('dp-doc-callout'));
  assert.ok(res.bodyHtml.includes('dp-doc-table'));
  assert.ok(res.bodyHtml.includes('<ul><li><strong>A:</strong> 2 karty</li>'));
});

test('renderProjectDocHtml executes programmatic render.js docs', () => {
  const design = createMenuTemplateDesign();
  const variant = design.variants[design.activeVariant];
  const { renderer } = compileTemplateFiles(undefined);

  const doc: ProjectDoc = {
    id: 'card-list',
    meta: { title: 'Card List', pageSize: 'A4', orientation: 'portrait' },
    stylesCss: '',
    sections: {},
    diagrams: {},
    renderJs: `return '<section class="dp-doc-page">Total: ' + ctx.playableCards.length + '</section>';`,
  };

  const res = renderProjectDocHtml({
    doc,
    cards: SAMPLE_CARDS,
    variant,
    cardSize: { widthMm: 63, heightMm: 88, bleedMm: 0 },
    overrides: {},
    renderer,
    assetBaseUrl: '/assets',
  });

  assert.equal(res.error, null);
  assert.ok(res.bodyHtml.includes('Total: 2'));
});

test('renderPrintDocumentHtml mirrors back sheets for duplex printing', async () => {
  const { renderPrintDocumentHtml } = await import('./renderCard.js');
  const design = createMenuTemplateDesign();
  const variant = design.variants[design.activeVariant];
  const html = renderPrintDocumentHtml({
    cards: SAMPLE_CARDS.slice(0, 2),
    variant,
    overrides: {},
    options: {
      cardWidthMm: 63,
      cardHeightMm: 88,
      bleedMm: 2,
      mode: 'sheet',
      sides: 'duplex',
      sheetFormat: 'a4',
      gapMm: 2,
      guidelines: 'crop-marks',
    },
    assetBaseUrl: '/assets',
    preRenderedCardsHtml: ['<div class="f1">F1</div>', '<div class="f2">F2</div>'],
    preRenderedBacksHtml: ['<div class="b1">B1</div>', '<div class="b2">B2</div>'],
  });

  // 1 front sheet + 1 mirrored back sheet
  assert.equal((html.match(/class="dp-sheet"/g) || []).length, 2);
  // Row of 3 cols: [B1, B2, empty] mirrored -> [empty, B2, B1]
  assert.ok(html.indexOf('dp-empty-slot') < html.indexOf('class="b2"'));
  assert.ok(html.indexOf('class="b2"') < html.indexOf('class="b1"'));
});
