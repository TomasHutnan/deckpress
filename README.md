# DeckPress

Self-hosted, single-container tabletop card design studio and print-ready PDF press.

## Features
- **Spreadsheet-driven cards:** Live sync from a published Google Sheet CSV URL or local CSV upload.
- **Deterministic semi-randomization:** Seeded layout engine varies top-block offsets/heights, bottom divider styles, game mark placement/typography, and procedural SVG food-icon patterns — with per-card **Re-roll** and **Reset** controls.
- **Pluggable middle canvas:** Toggle instantly between *Empty*, *Procedural SVG Icon Pattern*, and *Per-Card Uploaded Artwork*.
- **Live Design Studio + Safe Experimentation:** Edit colors, fonts, card size, randomization ranges, and custom CSS in the browser with instant preview, named design variants, and unsaved drafts.
- **Per-project Git repositories:** Each game lives in its own local Git repo under `projects/<slug>/` (gitignored from this app repo) with 1-click version saves, commit history rollback, project initialization (*Template / Blank / Clone Repo*), and optional Git remote connect/disconnect + pull/push.
- **1-Click Print-Ready PDF Export:** Server-side WYSIWYG rendering via Alpine + system Chromium supporting custom card dimensions, bleed, **1 card per page** (exact card+bleed page size), or **sheet-packed** (A4 / A3 / Letter / Custom) with variable spacing and optional corner crop marks or full cut grid.

## Quick Start (Docker — VPS / Mac / Linux)
```bash
cp .env.example .env
# Optionally set DECKPRESS_PASSWORD and DECKPRESS_DATA_HOST_DIR (defaults to ~/data/deckpress)
docker compose up -d --build
```
Open `http://127.0.0.1:8080`.

To seed your VPS with the local `projects/the-menu` repo, copy it into `~/data/deckpress/projects/the-menu` (or clone its Git repo directly from the **+ New / Clone** button in the UI).

## Local Development
```bash
npm install
npm run dev        # Fastify API on :8080
npm run dev:client # Vite React Studio on :5173 (proxies /api to :8080)
npm test           # Unit tests for shared card engine
npm run build      # Build production client & server bundles
```
