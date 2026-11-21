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
- [x] Drafted and compiled Slovak rulebook ([project/rules/rules.pdf](project/rules/rules.pdf), double-sided A4 landscape) and 4-up 63×88 mm player overviews ([project/rules/overview.pdf](project/rules/overview.pdf)) using generated card PNGs in `project/rules/img/`.
