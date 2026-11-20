# ADR-0001: Replace Jubbly with a Dedicated Single-Container Card Studio Web App

- **Status:** Accepted
- **Date:** 2026-11-20
- **Supersedes:** none

## Context
The repository currently contains a customized fork of Jubbly (HTML + SCSS + Alpine.js + `webpack-dev-server`) used to prototype a card game (*Menu*). The user wants a tool usable by a non-coding finance-major collaborator, hosted in a single Docker container on a VPS (and runnable locally on macOS/Linux), that generates semi-randomized card designs from a spreadsheet (Google Sheets / CSV) and lets users edit designs directly in the UI without rebuilding or redeploying the container.

Ranked priorities:
1. Ease of use for a non-coding collaborator (GUI editing, zero dev tools, 1-click PDF export).
2. Visual fidelity & creative flexibility (exact Swiss/typographic match to `project/reference/`, deterministic semi-randomization, toggleable empty / SVG food-icon pattern / per-card art canvas).
3. Simple single-container deployment on a VPS (and local Mac/Linux).

## Options considered
1. **Keep Jubbly + Dockerize it**: Replace `webpack-dev-server` with a small static/proxy Node server and rewrite `card.html`/`sass/card.scss`. Pros: minimal upfront effort. Cons: design changes still require editing HTML/SCSS in code, no UI for randomization/re-rolling/assets, fragile manual browser print dialog.
2. **Dedicated lightweight web app in 1 Docker container**: A Node backend + browser SPA frontend rendering cards via HTML/CSS/SVG from a structured `design.json` + spreadsheet data, with a live Design Studio UI, asset uploads, and 1-click PDF export. Pros: zero-code workflow for collaborator, instant live preview, deterministic seeded randomization, clean separation of app engine and game projects. Cons: higher initial build effort than wrapping Jubbly.
3. **Off-the-shelf no-code tool (Dextrous / Component.Studio / nanDECK)**: Hosted or desktop card makers with CSV import. Pros: no app to build. Cons: semi-randomized per-card block offsets, varied divider lines, varied `"menu"` wordmarks, and 180°-reversible dual-cuisine cards are awkward or unsupported without scripting; vendor lock-in and paid tiers.

## Decision
Replace the Jubbly codebase in this repository with a **dedicated single-container Card Studio web application** (Node + Fastify/Express backend serving a built Vite + React + TypeScript frontend) using HTML + CSS + SVG for card rendering.

It wins on all three priorities: non-coders get a tailored browser UI while keeping Google Sheets/CSV as the data source, HTML/CSS/SVG gives full typographic and procedural control, and everything ships as one Docker image with optional simple password protection.

## Consequences
**Positive:** Non-technical collaborators can edit colors, fonts, randomization rules, card sizes, and artwork directly in the browser with instant preview; the app engine is reusable across multiple card games.
**Negative / accepted costs:** Requires building and maintaining the studio UI and backend (~small, self-contained Node/React codebase) instead of reusing Jubbly's existing shell.
**Reversibility:** High — card data remains in Google Sheets/CSV and designs live as portable JSON + assets in separate project folders.
**Revisit when:** Requirements expand to real-time multi-user collaborative editing (CRDTs) or a commercial SaaS with multi-tenant accounts.
