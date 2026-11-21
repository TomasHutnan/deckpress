import assert from 'node:assert/strict';
import test from 'node:test';
import { createStarterDesign } from './defaults.js';
import { getDocPageDims, renderProjectDocHtml } from './docs.js';
import { renderPrintDocumentHtml } from './print.js';
import { compileTemplateFiles } from './runtime.js';
import type { ExpandedCard, ProjectDoc } from './types.js';

const SAMPLE_CARDS: ExpandedCard[] = [
  {
    id: 'CARD_001',
    type_group: 'Unit',
    faction: 'primary',
    title: 'SCOUT',
    count: 1,
    _copyIndex: 1,
    _totalCopies: 1,
    _instanceKey: 'CARD_001',
  },
  {
    id: 'CARD_002',
    type_group: 'Action',
    faction: 'accent',
    title: 'SURGE',
    count: 1,
    _copyIndex: 1,
    _totalCopies: 1,
    _instanceKey: 'CARD_002',
  },
  {
    id: 'REF_001',
    type_group: 'Reference',
    faction: '',
    title: 'PLAYER AID',
    count: 1,
    _copyIndex: 1,
    _totalCopies: 1,
    _instanceKey: 'REF_001',
  },
];

test('getDocPageDims returns portrait and landscape dimensions', () => {
  assert.deepEqual(getDocPageDims('A4', 'portrait'), { widthMm: 210, heightMm: 297 });
  assert.deepEqual(getDocPageDims('A4', 'landscape'), { widthMm: 297, heightMm: 210 });
});

test('renderProjectDocHtml expands Markdown, colored headings, generic count filters, pills, cards, and diagrams', () => {
  const design = createStarterDesign();
  const variant = design.variants[design.activeVariant];
  const { renderer } = compileTemplateFiles(undefined);

  const doc: ProjectDoc = {
    id: 'rules',
    meta: {
      title: 'Rules',
      pageSize: 'A4',
      orientation: 'landscape',
      columns: 3,
      sections: ['01-intro.md', '02-back.md'],
    },
    stylesCss: '.custom-rule { color: red; }',
    sections: {
      '01-intro.md': [
        '## [primary] Goal ({{count:type_group!=Reference}} playable)',
        'Play with {{pill:primary}} cards ({{count:type_group=Unit & faction=primary}} units, {{count:type_group=Action}} actions).',
        '',
        '1. **Draw**',
        '  - **A:** 2 cards',
        '  - **B:** 1 from market',
        '',
        '{{card-row: width=18mm CARD_001 "Unit" | + | CARD_002}}',
        '{{diagram:sample}}',
        '---page---',
      ].join('\n'),
      '02-back.md': [
        '> **Example:** 5 points',
        '',
        '| Path | Points |',
        '| --- | ---: |',
        '| 3 matching | **5 pts** |',
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
  assert.equal((res.bodyHtml.match(/class="dp-doc-page"/g) || []).length, 2);
  assert.ok(res.bodyHtml.includes('Goal (2 playable)'));
  assert.ok(res.bodyHtml.includes('1 units, 1 actions'));
  assert.ok(res.bodyHtml.includes('dp-doc-pill'));
  assert.ok(res.bodyHtml.includes('dp-doc-card-row'));
  assert.ok(res.bodyHtml.includes('dp-doc-card-caption">Unit</div>'));
  assert.ok(res.bodyHtml.includes('dp-doc-diagram'));
  assert.ok(res.bodyHtml.includes('dp-doc-callout'));
  assert.ok(res.bodyHtml.includes('dp-doc-table'));
  assert.ok(res.bodyHtml.includes('<ul><li><strong>A:</strong> 2 cards</li>'));
});

test('renderProjectDocHtml executes programmatic render.js docs', () => {
  const design = createStarterDesign();
  const variant = design.variants[design.activeVariant];
  const { renderer } = compileTemplateFiles(undefined);

  const doc: ProjectDoc = {
    id: 'card-list',
    meta: { title: 'Card List', pageSize: 'A4', orientation: 'portrait' },
    stylesCss: '',
    sections: {},
    diagrams: {},
    renderJs: `return '<section class="dp-doc-page">Total: ' + ctx.cards.length + '</section>';`,
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
  assert.ok(res.bodyHtml.includes('Total: 3'));
});

test('renderPrintDocumentHtml mirrors back sheets for duplex printing', () => {
  const design = createStarterDesign();
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

  assert.equal((html.match(/class="dp-sheet"/g) || []).length, 2);
  assert.ok(html.indexOf('dp-empty-slot') < html.indexOf('class="b2"'));
  assert.ok(html.indexOf('class="b2"') < html.indexOf('class="b1"'));
});
