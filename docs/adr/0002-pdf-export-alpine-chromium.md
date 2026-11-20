# ADR-0002: Server-Side PDF Export via Alpine Linux and System Chromium

- **Status:** Accepted
- **Date:** 2026-11-20
- **Supersedes:** none

## Context
Users need foolproof, 1-click print-ready PDF export directly from the web UI without fighting browser print dialogs. Required export capabilities:
- Configurable card dimensions (`width × height` in mm) and bleed in the UI.
- **Individual mode:** one card per PDF page, where the PDF page size equals `card + 2×bleed`.
- **Sheet-pack mode:** pack cards onto standard or custom sheets (e.g., A4, A3, Letter) with variable spacing/gap (with defaults) and auto-centering.
- **Optional cutting guidelines:** none, corner crop marks, or full-page cut grid.
- Must fit cleanly inside the single VPS Docker container without excessive image bloat.

## Options considered
1. **Alpine Linux + System Chromium (`node:20-alpine` + `apk add chromium` + `puppeteer-core`)**: Render the exact same HTML/CSS/SVG print view inside headless Chromium on the server. Pros: 100% WYSIWYG parity with browser preview, supports arbitrary fonts/CSS/SVG/transforms/exact mm page sizes, ~350–400 MB total image (half the size of Playwright's Ubuntu bundle). Cons: larger than non-browser PDF libraries; needs `--no-sandbox` and shared memory flags in Docker.
2. **WeasyPrint (Python HTML/CSS → PDF)**: ~180–250 MB image. Pros: smaller image, good paged-media CSS. Cons: different CSS engine than browsers (no JS, subtle layout/flexbox drift from preview), introduces Python runtime alongside Node.
3. **Pure SVG → PDF (`pdfkit` + `svg-to-pdfkit`) or Typst**: ~60–90 MB image. Pros: very small and fast. Cons: SVG lacks native multi-line text wrapping for Action/Special card descriptions; requires maintaining a second renderer separate from the browser preview.

## Decision
Use **`node:20-alpine` with system `chromium` and `puppeteer-core`** for server-side PDF generation.

WYSIWYG accuracy and zero-friction 1-click export for a non-coding collaborator outweigh saving ~200 MB of container image size. Using Alpine's system Chromium package avoids Playwright's heavy Debian/Ubuntu base while keeping a single rendering engine for both preview and print.

## Consequences
**Positive:** Exact 1:1 visual match between browser preview and exported PDF across macOS, Linux, and mobile; trivial to support arbitrary card sizes, bleed, sheet packing, variable spacing, and SVG cut guidelines.
**Negative / accepted costs:** Docker image is ~350–400 MB; PDF export uses a brief burst of RAM (~150–300 MB per export job), so exports should be serialized or rate-limited on small VPS instances.
**Reversibility:** Medium-high — export is isolated behind a single `POST /api/projects/:slug/export/pdf` endpoint consuming rendered HTML/CSS.
**Revisit when:** The VPS has <512 MB RAM total or export concurrency grows beyond a handful of simultaneous users.
