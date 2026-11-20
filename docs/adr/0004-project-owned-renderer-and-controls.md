# ADR-0004: Move Card Rendering Logic and Sidebar Controls into Each Project (`renderer.js` + `controls.json`)

- **Status:** Accepted
- **Date:** 2026-11-20
- **Supersedes:** none

## Context
Under ADR-0001 and ADR-0003, `design.json` (colors, font choices, randomization ranges) lived in each project repo while card HTML/SVG structure and sidebar UI controls remained hardcoded inside DeckPress (`src/shared/renderCard.ts`, `src/client/components/DesignPanel.tsx`). In practice, iterating on *The Menu* frequently required structural tweaks (conditional tags, `recipe_change` formatting, sheet-connected watermarks, new sliders), each forcing a DeckPress code change, Docker image rebuild, and VPS redeploy.

## Options considered
1. **Per-project `renderer.js` only**: Move card rendering into `projects/<slug>/renderer.js`, keeping sidebar UI controls fixed in DeckPress. Pros: lowest build effort, zero Docker rebuilds for layout changes. Cons: adding a new slider/toggle still requires modifying and redeploying DeckPress.
2. **Visual No-Code Layer Builder**: Replace templates with a generic layer/expression tree editor in the UI. Pros: drag-and-drop structural edits. Cons: high complexity, still hits limits on custom procedural graphics (SAT watermarks, custom token formatting).
3. **Hybrid — Per-project `renderer.js` + `controls.json`**: Each project owns its card renderer (`renderer.js`) and declarative sidebar control schema (`controls.json`), while DeckPress provides the stable studio shell, spreadsheet sync, Git versioning, asset uploads, helper library, and Chromium PDF press. Pros: zero Docker rebuilds for layout, rule, or UI control changes; non-coding collaborators still only interact with clean controls; truly multi-game. Cons: moderate one-time refactor; project JS runs in browser/Chromium.

## Decision
Adopt **Option 3: Per-project `renderer.js` and `controls.json`** with live draft editing in a tucked-away **Template** editor in the UI and full Git versioning inside each project repo.

For security, `renderer.js` is never executed inside the Node backend process — it runs only in the user's browser during preview and inside the sandboxed headless Chromium page during PDF export. Projects without `renderer.js` or `controls.json` gracefully fall back to DeckPress's built-in defaults.

## Consequences
**Positive:** Structural card edits, new procedural backgrounds, custom formatting rules, and new UI controls require zero Docker rebuilds or VPS redeploys; edits can be made live in the browser or locally via Git Pull; DeckPress becomes genuinely game-agnostic.
**Negative / accepted costs:** Project authors editing `renderer.js` write plain JS/HTML/CSS (mitigated by live preview, inline error reporting, and draft revert); DeckPress exposes a stable helper API (`helpers`) that should remain backwards-compatible.
**Reversibility:** High — `renderer.js` and `controls.json` are plain text files in each project's Git repo.
**Revisit when:** DeckPress is opened to untrusted public multi-tenant users (where running arbitrary user JS in the browser would require stricter iframe sandboxing).
