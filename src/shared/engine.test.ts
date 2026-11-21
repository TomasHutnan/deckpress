import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultControlsSchema, getByPath, setByPath } from './controls.js';
import { expandCards, parseCsvWithColumns, serializeCsv } from './csv.js';
import { createStarterDesign } from './defaults.js';
import { resolveColor } from './layout.js';
import { renderDefaultCardHtml, renderPrintDocumentHtml } from './print.js';
import { compileProjectRenderer, compileTemplateFiles } from './runtime.js';
import { getSheetWatermarks, watermarksOverlap } from './watermark.js';

describe('DeckPress game-agnostic core engine', () => {
  it('parses arbitrary UTF-8 CSV columns, expands counts, and round-trips via serializeCsv', () => {
    const csv = [
      'id,type_group,faction,title,count,effect',
      'CARD_001,Unit,Blue,"HERO, ""ELITE""",2,Draw 1 card',
      'CARD_002,Spell,Red,FIREBALL,1,Deal 3 damage',
    ].join('\n');

    const { columns, rows } = parseCsvWithColumns(csv);
    assert.deepEqual(columns, ['id', 'type_group', 'faction', 'title', 'count', 'effect']);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].title, 'HERO, "ELITE"');
    assert.equal(rows[0].count, 2);

    const expanded = expandCards(rows);
    assert.equal(expanded.length, 3);
    assert.equal(expanded[0]._instanceKey, 'CARD_001__1');
    assert.equal(expanded[1]._instanceKey, 'CARD_001__2');
    assert.equal(expanded[2]._instanceKey, 'CARD_002');

    const roundTrip = parseCsvWithColumns(serializeCsv(rows, columns));
    assert.deepEqual(roundTrip.columns, columns);
    assert.equal(roundTrip.rows[0].title, 'HERO, "ELITE"');
  });

  it('resolves palette colors generically with case-insensitive fallback', () => {
    const palette = { primary: '#2563EB', ACCENT: '#DC2626', default: '#1C1C1C' };
    assert.equal(resolveColor('primary', palette), '#2563EB');
    assert.equal(resolveColor('accent', palette), '#DC2626');
    assert.equal(resolveColor('missing', palette), '#1C1C1C');
  });

  it('generates non-overlapping connected sheet watermarks and print documents', () => {
    const variant = createStarterDesign().variants.default;
    const cards = expandCards(
      parseCsvWithColumns(
        'id,type_group,color,title,count,description\n' +
          'C1,Unit,primary,SCOUT,1,Fast\n' +
          'C2,Action,accent,SURGE,1,Draw 2',
      ).rows,
    );

    const starterHtml = renderDefaultCardHtml(cards[0], variant);
    assert.match(starterHtml, /SCOUT/);
    assert.match(starterHtml, /#2563EB/);

    const wmVariant = structuredClone(variant);
    wmVariant.canvas.mode = 'watermark';
    wmVariant.canvas.watermarkText = 'GAME';
    wmVariant.canvas.watermarkSizeMinMm = 18;
    wmVariant.canvas.watermarkSizeMaxMm = 42;
    wmVariant.canvas.watermarkAngleMinDeg = -35;
    wmVariant.canvas.watermarkAngleMaxDeg = 35;
    wmVariant.canvas.watermarkAllowOverlap = false;
    wmVariant.canvas.watermarkCols = 3;

    const sheetSize = { widthMm: 63, heightMm: 88, bleedMm: 0 };
    const wmWords = getSheetWatermarks(wmVariant, sheetSize, 6);
    assert.ok(wmWords.length > 0);
    for (let i = 0; i < wmWords.length; i++) {
      assert.ok(wmWords[i].sizeMm >= 18 && wmWords[i].sizeMm <= 42);
      assert.ok(wmWords[i].angleDeg >= -35 && wmWords[i].angleDeg <= 35);
      for (let j = i + 1; j < wmWords.length; j++) {
        assert.equal(watermarksOverlap(wmWords[i], wmWords[j]), false);
      }
    }

    const individualDoc = renderPrintDocumentHtml({
      cards,
      variant,
      overrides: {},
      assetBaseUrl: '/api/projects/demo/assets',
      options: {
        cardWidthMm: 63,
        cardHeightMm: 88,
        bleedMm: 3,
        mode: 'individual',
        sheetFormat: 'a4',
        gapMm: 0,
        guidelines: 'none',
      },
    });
    assert.match(individualDoc, /size: 69mm 94mm/);

    const sheetDoc = renderPrintDocumentHtml({
      cards,
      variant,
      overrides: {},
      assetBaseUrl: '/api/projects/demo/assets',
      options: {
        cardWidthMm: 63,
        cardHeightMm: 88,
        bleedMm: 2,
        mode: 'sheet',
        sheetFormat: 'a4',
        gapMm: 2,
        guidelines: 'cut-grid',
      },
    });
    assert.match(sheetDoc, /size: 210mm 297mm/);
    assert.match(sheetDoc, /dp-cut-grid/);
  });

  it('compiles multi-file project templates and updates nested values via controls paths', () => {
    const schema = createDefaultControlsSchema();
    assert.ok(schema.length >= 4);

    const obj = { canvas: { watermarkAngleMinDeg: -35 } };
    const updated = setByPath(obj, 'canvas.watermarkAngleMinDeg', -10);
    assert.equal(getByPath(updated, 'canvas.watermarkAngleMinDeg'), -10);
    assert.equal(obj.canvas.watermarkAngleMinDeg, -35);

    const custom = compileProjectRenderer(`
      return {
        renderCard(ctx) {
          return '<div class="custom-card">' + helpers.escapeHtml(ctx.card.title) + '</div>';
        }
      };
    `);
    assert.equal(custom.error, null);
    const variant = createStarterDesign().variants.default;
    const [card] = expandCards(parseCsvWithColumns('id,title,count\nC1,SCOUT,1').rows);
    const html = custom.renderer.renderCard({
      card,
      variant,
      overrides: {},
      assetBaseUrl: '/assets',
      cardIndex: 0,
      cardSize: { widthMm: 63, heightMm: 88, bleedMm: 0 },
    });
    assert.equal(html, '<div class="custom-card">SCOUT</div>');

    const broken = compileProjectRenderer('return {{{ broken');
    assert.ok(broken.error);

    const multi = compileTemplateFiles({
      'index.js': "const m = require('./sub.js'); return { renderCard: (ctx) => m.wrap(ctx.card.title) };",
      'sub.js': "return { wrap: (t) => '<p>' + t + '</p>' };",
      'styles.css': '.custom { color: red; }',
    });
    assert.equal(multi.error, null);
    assert.equal(
      multi.renderer.renderCard({
        card,
        variant,
        overrides: {},
        assetBaseUrl: '/assets',
        cardIndex: 0,
        cardSize: { widthMm: 63, heightMm: 88, bleedMm: 0 },
      }),
      '<p>SCOUT</p>',
    );
    assert.match(
      multi.renderer.getBaseCss({ widthMm: 63, heightMm: 88, bleedMm: 0 }, ''),
      /\.custom \{ color: red; \}/,
    );
  });
});
