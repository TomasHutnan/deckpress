# ADR-0006: Game-Agnostic Core Engine & Minimal Project-Owned Assets

- **Status:** Accepted
- **Date:** 2026-11-21
- **Supersedes:** none

## Context
Even after moving card rendering (`template/`), sidebar controls (`controls.json`), and rules (`docs/`) into each project under ADR-0004 and ADR-0005, several *The Menu*-specific assumptions remained in DeckPress's core engine (`src/`):
1. Hardcoded Menu CSV columns (`kitchen`, `size`, `tags_str`, `is_action`, `joins_dish`, `recipe_change`) and Slovak defaults (`Surovina`, `NOVÁ KARTA`) in `types.ts`, `csv.ts`, and `DataEditor.tsx`.
2. Hardcoded Slovak card types (`Prehľad`, `Surovina`, `kitchen:TAL`) and fixed 3-letter pill widths inside `src/shared/docs.ts`.
3. Legacy pre-ADR-0004 *The Menu* card renderer (`renderCard.ts`), Slovak color aliases (`layout.ts`), food SVG icons (`defaults.ts`), and kitchen-labeled font presets (`DesignPanel.tsx`).
4. Six *The Menu*-specific script/display fonts bundled inside DeckPress's core `package.json` and client bundle.

## Decision
Refactor DeckPress's core (`src/`) to be strictly game-agnostic across four clean boundaries:
1. **Dynamic CSV & Spreadsheet**: `CardRow` requires only `{ id, count, type_group?, [col]: string | number | undefined }`. `parseCsvWithColumns()` preserves exact header order and `DataEditor.tsx` derives columns dynamically from each project's `cards.csv`.
2. **Generic Docs Directives**: Replace hardcoded `kitchen:`/`playable` counters in `docs.ts` with a generic filter expression (`{{count:all}}`, `{{count:field=value}}`, `{{count:field!=value}}`, `{{count:field~substr}}`, combined with `&`). Move game-specific pill sizing into each project's `docs/*/styles.css`.
3. **Pure Print Imposition & Generic Starter**: Extract generic sheet packing, duplex row mirroring, bleed, and cutting guidelines into `src/shared/print.ts`. Replace the legacy hardcoded Menu renderer with a minimal generic starter card renderer and remove `BUILTIN_FOOD_ICONS` and Slovak color aliases from core.
4. **Slim Core Fonts**: Keep only universal sans fonts (`Inter`, `Barlow Condensed`, `Oswald`, `Space Grotesk`) bundled in DeckPress; move game-specific display/script fonts into each project's `assets/fonts/`.

## Consequences
**Positive:** New card games work out of the box with arbitrary CSV schemas, custom doc counters, and clean starters; smaller client bundle and Docker image; clear separation between DeckPress engine and game projects.
**Negative / accepted costs:** Each project owns its own display fonts in `assets/fonts/` and explicit filter queries in Markdown docs (e.g. `{{count:type_group!=Prehľad}}`), which is slightly more verbose than `{{count:playable}}` but completely transparent and reusable across any game.
**Reversibility:** High — all project-specific assets and styles live cleanly in each project's own Git repo.
