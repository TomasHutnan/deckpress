# AGENTS.md

Single source of truth for **DeckPress** (`deckpress`) — architecture, rules, commands, and active work.

## Overview
**DeckPress** — single-container web app (`node:20-alpine` + system Chromium) for designing and exporting data-driven, semi-randomized tabletop card games from Google Sheets / CSV.

- **Architecture:** [docs/architecture.md](docs/architecture.md)
- **ADRs:**
  - [ADR-0001](docs/adr/0001-dedicated-card-studio-app.md): Dedicated single-container web app (Node/Fastify + Vite/React/TS, HTML/CSS/SVG rendering)
  - [ADR-0002](docs/adr/0002-pdf-export-alpine-chromium.md): Server-side WYSIWYG PDF export via Alpine + system Chromium (`puppeteer-core`)
  - [ADR-0003](docs/adr/0003-project-storage-and-local-git.md): Gitignored `projects/` directory with a local Git repo per project, live UI drafts, named variants, and optional Git remote sync
  - [ADR-0004](docs/adr/0004-project-owned-renderer-and-controls.md): Per-project `renderer.js` and `controls.json` so layout, rules, and UI controls evolve without Docker rebuilds
  - [ADR-0005](docs/adr/0005-markdown-rules-and-overview-cards.md): Project-owned section-split Markdown rules (`docs/`), live card embeds, auto-generated card lists, and native DeckPress overview cards
  - [ADR-0006](docs/adr/0006-game-agnostic-engine.md): Game-agnostic core engine (dynamic CSV columns, generic doc `{{count:...}}` filters, extracted print imposition, slim core fonts)

## Commands
- `npm test` — Run unit tests (`node --test src/shared/*.test.ts`)
- `npm run typecheck` — TypeScript check
- `npm run build` — Build Vite client (`dist/client`) and Fastify server (`dist/server`)
- `npm run dev` / `npm run dev:client` — Local dev servers
- `docker compose up --build` — Single-container build & run (mounts `${DECKPRESS_DATA_HOST_DIR:-~/data/deckpress}:/data`)

## Rules
- Keep `projects/` gitignored — game data/designs live in their own per-project Git repos, never in this app repo.
- Work on feature branches; keep commits small and conventional.
- Never store remote Git credentials inside project `.git/config` or committed files.
- Keep this file minimal and up to date as tasks finish or decisions change.

## Tasks

### Completed
- [x] `[ADR-0003]` Created `projects/the-menu/` (gitignored) as its own Git repo with migrated `cards.csv`, `pravidla.md`, `zoznam_kariet.md`, and initial `design.json` matching `project/reference/` (without reference photos).
- [x] `[ADR-0001]` Replaced legacy Jubbly files with DeckPress (`src/shared/`, `src/server/`, `src/client/`) and updated `.gitignore`.
- [x] `[ADR-0001]` Built `src/shared/` card engine (CSV parser, seeded PRNG, semi-randomized Swiss/typographic layouts for whole/half/reversible-dual/Action/Special cards, empty/SVG-pattern/art canvas modes) + unit tests.
- [x] `[ADR-0003]` Built `src/server/` API (project init blank/template/clone, Google Sheets proxy, asset uploads, local Git commits/rollback, remote connect/disconnect/pull/push).
- [x] `[ADR-0001]` Built `src/client/` Design Studio UI (live drafts, named variants, per-card re-roll/toggle, asset manager, export modal).
- [x] `[ADR-0002]` Built Chromium PDF export (individual 1-card-per-page, packed sheets with variable gap, bleed, optional crop marks/cut grid) + `Dockerfile` & `compose.yaml`.
- [x] `[ADR-0004]` Migrated DeckPress to project-owned multi-file `template/` (`index.js`, `styles.css`, `require('./...')` modules) + declarative `controls.json`, live multi-tab `</> Template` editor, and bundled self-hosted `@fontsource` fonts (full Slovak diacritics).
- [x] `[ADR-0004]` Updated `projects/the-menu/` (standalone Git repo) with modular `template/` (left-bleeding headers, dual-cuisine stripe, per-kitchen footers & Chef's Pen color shared between `"menu"` marker and 6 hand-drawn subtitle accent styles, `joins_dish` metadata alignment, merged `subtitle` footers/disclaimers) and cleaned `cards.csv` (114 playable cards).
- [x] Drafted and compiled Slovak rulebook (`projects/the-menu/rules/rules.tex`), 4-up 63×88 mm player overviews (`projects/the-menu/rules/overview.tex`), and auto-generated card list (`projects/the-menu/rules/card_list.tex`).

- [x] `[ADR-0005]` Extended DeckPress with project-owned `docs/` (section-split Markdown + `{{card:...}}`/`{{pill:...}}`/`{{count:...}}`/`{{diagram:...}}` directives + programmatic `render.js`, `Rules & Docs` studio tab, Chromium PDF export) and migrated `projects/the-menu/` to native 63×88 mm overview cards (`template/overview.js`), `docs/rules/`, and `docs/card-list/`.
- [x] `[ADR-0006]` Refactored DeckPress core to be fully game-agnostic: dynamic CSV column schema & built-in Excel-like `Data` editor, generic `{{count:field=val}}` doc filters, extracted pure print/duplex engine (`src/shared/print.ts`), lazy-loaded CodeMirror 6 syntax highlighting, and moved *The Menu*'s display fonts & food SVG icons into `projects/the-menu/`.
- [x] Built & installed custom SIL OFL header font `projects/the-menu/assets/fonts/Menu Barlow.ttf` (unhinted Barlow Semi Condensed Black with unified top caron on `Ľ`, resized `Ä`, exact `yMax = 880` diacritic ceiling & matching vertical metrics) and font-size-proportional `em` flush-top/edge alignment in `projects/the-menu/template/styles.css`.
