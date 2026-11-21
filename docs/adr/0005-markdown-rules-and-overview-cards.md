# ADR-0005: Project-Owned Markdown Rules & DeckPress Overview Cards

- **Status:** Accepted
- **Date:** 2026-11-21
- **Supersedes:** none

## Context
Currently, rulebooks (`rules.tex`), player overview cards (`overview.tex`), and card lists (`card_list.tex`) are maintained in LaTeX (`XeLaTeX`) outside DeckPress's HTML/CSS rendering pipeline. This creates three friction points:
1. **Duplicate card rendering**: Rulebook examples require manually exporting and syncing card thumbnails into `rules/img/`.
2. **Separate overview-card export**: 63×88 mm player overview cards (`Skrátený prehľad pre hráča`) cannot be exported together with the playable deck using DeckPress's shared bleed, crop marks, and packed-sheet press.
3. **Readability & toolchain**: Raw LaTeX layout macros make prose harder to edit for collaborators and require a separate TeX toolchain alongside DeckPress's Chromium container.

## Options considered
1. **Keep LaTeX + add a card-thumbnail export script**: Export selected cards as single-page vector PDFs from Chromium into gitignored `rules/img/` and compile with `XeLaTeX`. Pros: minimal DeckPress changes. Cons: still two toolchains, overview cards stay separate from deck export.
2. **Raw monolithic HTML+CSS rules in DeckPress**: Author rules directly as HTML files. Pros: single Chromium pipeline, live card embeds. Cons: mixing prose and layout markup is noisy and unfriendly for human editing.
3. **Section-split Markdown + project-owned HTML/CSS layout + native Overview cards**:
   - Move 63×88 mm overview cards directly into DeckPress so they share fonts, palette, bleed, and sheet export with all other cards.
   - Author the rulebook in clean, section-split Markdown files (e.g. `rules/01-ciel.md`, `rules/02-priprava.md`, …) with lightweight card-embed directives (`{{card:CARD_029}}`) and auto-generated card lists from `cards.csv`.
   - Render rules & card lists through a project-owned layout/CSS template directly to vector PDF via DeckPress's existing Chromium press.

## Decision
Adopt **Option 3: Project-owned `docs/` (section-split Markdown + HTML/CSS layout + optional `render.js`) and native DeckPress overview cards**.

For security (matching ADR-0004), document Markdown/directive expansion and optional `render.js` execution happen in the browser preview; PDF export posts pre-rendered document HTML and CSS to `POST /api/projects/:slug/export/doc`, where the server inlines fonts and pipes into headless Chromium (`renderHtmlToPdf`).

## Consequences
**Expected positive:** Single Chromium toolchain; live, always-up-to-date vector card embeds inside rules; overview cards exported alongside the playable deck; clean human-editable Markdown split by section.
**Expected costs:** Requires designing a lightweight Markdown + embed renderer and replacing TikZ diagrams with HTML/SVG equivalents.
**Reversibility:** High — Markdown content and CSS templates are plain text files inside each project repo.
