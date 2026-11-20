import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { expandCards, parseCsv } from './csv.js';
import { createMenuTemplateDesign } from './defaults.js';
import { computeCardLayout, detectCardKind } from './layout.js';
import { renderCardHtml, renderPrintDocumentHtml } from './renderCard.js';

describe('DeckPress shared card engine', () => {
  it('parses Slovak UTF-8 CSV with quoted fields and expands counts', () => {
    const csv = [
      'id,type_group,kitchen,color,size,title,subtitle,tags_str,count,image,is_action,description',
      'CARD_001,Surovina,UNI,sivá,celá,"SÓJOVÉ ""MÄSO""",SÓJOVÉ MÄSO,UNI V,2,,0,',
      'CARD_002,Surovina,IND~JAP,hnedá/červená,celá,ZÁZVOR,ZÁZVOR,IND~JAP V,1,,0,',
    ].join('\n');

    const rows = parseCsv(csv);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].title, 'SÓJOVÉ "MÄSO"');
    assert.equal(rows[0].count, 2);

    const expanded = expandCards(rows);
    assert.equal(expanded.length, 3);
    assert.equal(expanded[0]._instanceKey, 'CARD_001__1');
    assert.equal(expanded[1]._instanceKey, 'CARD_001__2');
    assert.equal(expanded[2]._instanceKey, 'CARD_002');
  });

  it('detects all five card kinds accurately', () => {
    const rows = parseCsv(
      [
        'id,type_group,kitchen,color,size,title,subtitle,tags_str,count,image,is_action,description',
        'C1,Surovina,TAL,zelená,celá,OLIVY,ČIERNE OLIVY,TAL V,1,,0,',
        'C2,Surovina,TAL,zelená,polovičná,BRUSCHETTA,BRUSCHETTA,TAL V 1/2,1,,0,',
        'C3,Surovina,IND~JAP,hnedá/červená,celá,ZÁZVOR,ZÁZVOR,IND~JAP V,1,,0,',
        'C4,Akcia,,čierna,,INVENTÚRA,,,1,,1,Skontroluj karty',
        'C5,Špeciálna,,modrá,,KORENIE (FRA),,,1,,2,Zmení chod',
      ].join('\n'),
    );
    const expanded = expandCards(rows);
    assert.deepEqual(expanded.map(detectCardKind), [
      'ingredient-whole',
      'ingredient-half',
      'ingredient-dual',
      'action',
      'special',
    ]);
  });

  it('produces deterministic layouts that change when seed override changes', () => {
    const variant = createMenuTemplateDesign().variants['classic-minimal'];
    const [card] = expandCards(
      parseCsv(
        'id,type_group,kitchen,color,size,title,subtitle,tags_str,count,image,is_action,description\n' +
          'C1,Surovina,TAL,zelená,celá,OLIVY,ČIERNE OLIVY,TAL V,1,,0,',
      ),
    );

    const a = computeCardLayout(card, variant);
    const b = computeCardLayout(card, variant);
    const c = computeCardLayout(card, variant, { seed: 99999 });

    assert.deepEqual(a, b);
    assert.notEqual(a.effectiveSeed, c.effectiveSeed);
  });

  it('renders both individual and packed sheet print documents with cut guidelines', () => {
    const variant = createMenuTemplateDesign().variants['classic-minimal'];
    const cards = expandCards(
      parseCsv(
        'id,type_group,kitchen,color,size,title,subtitle,tags_str,count,image,is_action,description\n' +
          'C1,Surovina,TAL,zelená,celá,OLIVY,ČIERNE OLIVY,TAL V,1,,0,\n' +
          'C2,Surovina,IND~JAP,hnedá/červená,celá,ZÁZVOR,ZÁZVOR,IND~JAP V,1,,0,',
      ),
    );

    const single = renderCardHtml(cards[1], variant, {}, '/api/projects/the-menu/assets');
    assert.match(single.html, /dp-dual-bottom/);
    assert.equal(single.layout.primaryColor, variant.palette.IND);
    assert.equal(single.layout.secondaryColor, variant.palette.JAP);

    const [veganSpecial] = expandCards(
      parseCsv(
        'id,type_group,kitchen,size,title,subtitle,tags_str,count,image,is_action,description\n' +
          'C96,Špeciálna,,,VEGÁN,ŠPECIÁLNA KARTA,V BONUS,1,,2,Vyber protihráča (ostáva na stole)',
      ),
    );
    const specialRes = renderCardHtml(
      veganSpecial,
      variant,
      {},
      '/api/projects/the-menu/assets',
    );
    assert.equal(specialRes.layout.primaryColor, variant.palette.default);
    assert.match(specialRes.html, />V BONUS</);
    assert.match(specialRes.html, /class="dp-subtitle">ŠPECIÁLNA KARTA</);
    assert.doesNotMatch(specialRes.html, /dp-subtitle-muted/);

    const [recipeCard] = expandCards(
      parseCsv(
        'id,type_group,kitchen,size,title,subtitle,tags_str,count,image,is_action,description,recipe_change\n' +
          'C88,Špeciálna,TAL,,DETSKÁ PORCIA,ŠPECIÁLNA KARTA,TAL,1,,2,Na TAL chody ti stačia iba tri suroviny,2+2 -> 2+1',
      ),
    );
    const recipeHtml = renderCardHtml(
      recipeCard,
      variant,
      {},
      '/api/projects/the-menu/assets',
    ).html;
    assert.match(recipeHtml, /dp-recipe-change/);
    assert.match(
      recipeHtml,
      new RegExp(`style="color:${variant.palette.TAL}">2</span>.*style="color:${variant.palette.UNI}">2</span>.*→.*style="color:${variant.palette.TAL}">2</span>.*style="color:${variant.palette.UNI}">1</span>`),
    );
    assert.match(
      recipeHtml,
      new RegExp(`<strong style="color:${variant.palette.TAL}">TAL</strong>`),
    );

    const individualDoc = renderPrintDocumentHtml({
      cards,
      variant,
      overrides: {},
      assetBaseUrl: '/api/projects/the-menu/assets',
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
      assetBaseUrl: '/api/projects/the-menu/assets',
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
});
