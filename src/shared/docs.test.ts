import assert from 'node:assert/strict';
import test from 'node:test';
import { createStarterDesign } from './defaults.js';
import {
  appendCommentToLine,
  countDocComments,
  deleteDocComment,
  findDocCommentRanges,
  getDocPageDims,
  renderProjectDocHtml,
  stripDocComments,
  updateDocComment,
} from './docs.js';
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

test('renderProjectDocHtml renders kind=notes as flowing sheet without print pagination', () => {
  const design = createStarterDesign();
  const variant = design.variants[design.activeVariant];
  const { renderer } = compileTemplateFiles(undefined);

  const doc: ProjectDoc = {
    id: 'notes',
    meta: {
      title: 'Playtest Notes',
      kind: 'notes',
      sections: ['01-playtests.md', '02-ideas.md'],
    },
    stylesCss: '',
    sections: {
      '01-playtests.md': '## Playtest 1\n- Kompost worked well\n---page---\n- Second note',
      '02-ideas.md': '## Ideas\n- Card count: {{count:all}}',
    },
    diagrams: {},
  };

  const res = renderProjectDocHtml({
    doc,
    cards: SAMPLE_CARDS,
    variant,
    cardSize: { widthMm: 63, heightMm: 88, bleedMm: 0 },
    overrides: {},
    renderer,
    assetBaseUrl: '/assets',
    includeSourceMap: true,
  });

  assert.equal(res.error, null);
  assert.ok(res.bodyHtml.includes('dp-doc-notes-sheet'));
  assert.ok(!res.bodyHtml.includes('class="dp-doc-page"'));
  assert.ok(res.bodyHtml.includes('Card count: 3'));
  assert.ok(res.bodyHtml.includes('data-dp-section="01-playtests.md"'));
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

test('playtest HTML comments are highlighted in preview, mapped to source lines, and completely stripped on export', () => {
  const design = createStarterDesign();
  const variant = design.variants[design.activeVariant];
  const { renderer } = compileTemplateFiles(undefined);

  const doc: ProjectDoc = {
    id: 'rules',
    meta: {
      title: 'Rules',
      pageSize: 'A4',
      orientation: 'portrait',
      columns: 1,
      sections: ['01-setup.md', '02-turns.md'],
    },
    stylesCss: '',
    sections: {
      '01-setup.md': [
        '## Setup',
        'Deal 3 cards to each player. <!-- test 4 cards? -->',
        '<!-- standalone playtest note -->',
        '<!-- colbreak -->',
        'Place the deck in the center.',
      ].join('\n'),
      '02-turns.md': [
        '## Turns',
        '- Draw 1 card <!-- too slow? -->',
        '- Play 1 card',
      ].join('\n'),
    },
    diagrams: {},
  };

  // Layout directives are not counted as playtest comments
  assert.equal(countDocComments(doc), 3);
  assert.equal(findDocCommentRanges('<!-- colbreak --> <!-- real -->').length, 1);

  // Strip preserves colbreak and drops standalone comment lines without leaving blanks
  const stripped = stripDocComments(doc.sections['01-setup.md']);
  assert.equal(
    stripped,
    ['## Setup', 'Deal 3 cards to each player.', '<!-- colbreak -->', 'Place the deck in the center.'].join('\n'),
  );

  // Export mode (default): zero comments, zero highlights, zero source-map attributes
  const exported = renderProjectDocHtml({
    doc,
    cards: SAMPLE_CARDS,
    variant,
    cardSize: { widthMm: 63, heightMm: 88, bleedMm: 0 },
    overrides: {},
    renderer,
    assetBaseUrl: '/assets',
    includeComments: false,
    includeSourceMap: false,
  });
  assert.equal(exported.error, null);
  assert.ok(!exported.bodyHtml.includes('test 4 cards?'));
  assert.ok(!exported.bodyHtml.includes('standalone playtest note'));
  assert.ok(!exported.bodyHtml.includes('dp-doc-has-comment'));
  assert.ok(!exported.bodyHtml.includes('dp-doc-comment-marker'));
  assert.ok(!exported.bodyHtml.includes('data-dp-section'));
  assert.ok(exported.bodyHtml.includes('dp-doc-col-break'));

  // Preview mode: highlights commented lines, renders hover tooltip markers, and attaches source line attrs
  const preview = renderProjectDocHtml({
    doc,
    cards: SAMPLE_CARDS,
    variant,
    cardSize: { widthMm: 63, heightMm: 88, bleedMm: 0 },
    overrides: {},
    renderer,
    assetBaseUrl: '/assets',
    includeComments: true,
    includeSourceMap: true,
  });
  assert.equal(preview.error, null);
  assert.ok(preview.bodyHtml.includes('dp-doc-has-comment'));
  assert.ok(preview.bodyHtml.includes('dp-doc-comment-tip">test 4 cards?</span>'));
  assert.ok(preview.bodyHtml.includes('dp-doc-comment-standalone'));
  assert.ok(preview.bodyHtml.includes('data-dp-section="01-setup.md" data-dp-line="2"'));
  assert.ok(preview.bodyHtml.includes('data-dp-section="02-turns.md" data-dp-line="2"'));
  assert.ok(preview.bodyHtml.includes('data-dp-comment-section="01-setup.md" data-dp-comment-line="2" data-dp-comment-idx="0"'));
  assert.ok(preview.bodyHtml.includes('data-dp-comment-section="01-setup.md" data-dp-comment-line="3" data-dp-comment-idx="1"'));

  // Preview comment CRUD helpers
  const updated = updateDocComment(doc.sections['01-setup.md'], 0, 'try 5 cards');
  assert.ok(updated.includes('Deal 3 cards to each player. <!-- try 5 cards -->'));
  const deletedStandalone = deleteDocComment(doc.sections['01-setup.md'], 1);
  assert.ok(!deletedStandalone.includes('standalone playtest note'));
  assert.ok(deletedStandalone.includes('Deal 3 cards to each player. <!-- test 4 cards? -->\n<!-- colbreak -->'));
  const appended = appendCommentToLine(doc.sections['02-turns.md'], 3, 'needs icon');
  assert.ok(appended.endsWith('- Play 1 card <!-- needs icon -->'));
});
