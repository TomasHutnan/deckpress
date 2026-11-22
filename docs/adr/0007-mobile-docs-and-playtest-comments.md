# ADR-0007: Mobile-First Playtest Notes & Rules/Docs Comments

- **Status:** Accepted
- **Date:** 2026-11-22
- **Supersedes:** none

## Context
During tabletop playtests, designers often open DeckPress on a smartphone at the table to jot down quick rule clarifications, edge-case notes, and balance ideas directly in the rulebook (`docs/`). On small screens, the desktop layout (defaulting to the Cards grid and splitting Rules & Docs with a wide live PDF preview) is cramped and slow for note-taking. In addition, playtest notes written directly into Markdown sections should be clearly distinguished from real rules text, visible in the editor and desktop preview, and completely omitted from exported PDFs.

## Decision

### 1. Comment Syntax: Standard HTML Comments (`<!-- ... -->`)
Playtest comments in Markdown sections use standard HTML comments (`<!-- note -->`), excluding DeckPress's existing layout directives (`<!-- colbreak -->` and `<!-- pagebreak -->`).

*Alternatives considered:*
- **Obsidian-style `%% note %%`:** Shorter to type manually on a phone, but non-standard and renders as raw `%%` text in GitHub and external Markdown viewers.
- **DeckPress directive `{{comment: note}}`:** Consistent with `{{card:...}}` / `{{pill:...}}`, but non-standard outside DeckPress, awkward on mobile keyboards, and fragile if the note contains `}}`.

### 2. Editor Commenting Mode: Safe Comment Mode (Locks Rule Text)
A toggleable **Comment Mode** in the Rules & Docs Markdown editor protects non-comment rule text while active:
- Non-comment text is read-only to prevent accidental rule edits on touch screens.
- Typing anywhere outside a comment automatically inserts a new `<!-- ... -->` comment at that position and places the cursor inside it.
- Existing comments remain freely editable and deletable (deleting an empty comment removes the delimiters cleanly).
- All comments and lines containing comments are highlighted in amber in CodeMirror, and `Ctrl/Cmd+/` wraps/unwraps comments.

*Alternatives considered:*
- **Smart Auto-Wrap with free editing:** Allows editing rule text and auto-wrapping new text simultaneously, but makes accidental rule corruption easy on a smartphone.
- **Quick Floating Input Bar:** Tapping a line opens a separate input dialog/bar; rock-solid on mobile IMEs, but less direct than editing inline.

### 3. Preview Highlighting & Export Stripping
- **Export (`includeComments: false`):** All non-layout HTML comments are stripped *before* Markdown parsing, guaranteeing zero comment text, zero highlighting, and zero blank-line pagination drift in exported PDFs.
- **Studio Preview (`includeComments: true`):** Lines/blocks containing comments receive a pale amber highlight, and each comment renders as a compact `💬` marker with a hover/focus tooltip so pagination and column breaks stay undisturbed. A `Comments (N)` toolbar toggle lets the designer hide/show them at any time.
- **Click-to-focus & inline preview commenting:** Preview elements carry source-line metadata (`data-dp-section`, `data-dp-line`) and comment markers carry their section comment index (`data-dp-comment-idx`) in preview mode only:
  - Clicking a `💬` marker opens a compact popover to **edit**, **delete**, or **jump to the editor**.
  - Clicking text in the preview jumps to that section & line in the editor (or, when **Comment Mode** is ON or `Alt+Click` is used, opens the popover to append a new `<!-- ... -->` comment to that line).

*Alternatives considered:*
- **Inline expanded comment badges in preview:** Easier to scan all comment text at a glance without hovering, but shifts column and page breaks in multi-column rulebooks.

### 4. Smartphone Layout (`<= 768px`)
- On initial load on viewports `<= 768px`, DeckPress defaults to the **Rules & Docs** view (`activeView = 'docs'`) with **Safe Comment Mode ON by default**.
- In Rules & Docs on smartphones, the live preview pane (`.canvas-pane`), drag resizer (`.docs-resizer`), and desktop directives footer are hidden by default so the Markdown editor occupies ~88–90% of the screen.
- Navigation is collapsed into two compact single-row bars:
  1. **Compact mobile topbar (`☰`, project name + dirty dot, `Save`)** opening the retractable **App Navigation Drawer** (project switcher, view tabs, Assets/Template/Git/Export).
  2. **Compact docs sub-bar (`<doc> <section.md> ▾`, `💬 ON/OFF`, `👁`)** where tapping the current file name opens an anchored dropdown menu of documents, `.md` sections (with comment badges), diagrams, and layout files, and tapping `👁` switches full-screen to the live preview (with a `← Editor` button to return).

*Alternatives considered:*
- **Permanently hiding preview on mobile:** Simpler, but designers still occasionally want to check rendered layout or tap a preview line during playtests, so a compact `👁` toggle gives on-demand preview without sacrificing default editor space.

## Consequences
**Positive:** Fast, accident-proof playtest note-taking on smartphones; standard Markdown comments that stay invisible in GitHub and exported PDFs; desktop preview stays pagination-accurate while clearly flagging commented lines and supporting one-click jump to source.
**Negative / accepted costs:** Editing actual rule text requires toggling Comment Mode off; reading full comment text in the desktop preview requires hovering/focusing the `💬` marker (or clicking it to jump to the editor).
**Reversibility:** High — comments are plain HTML comments in `.md` files, and editor/preview/mobile behaviors are self-contained UI choices that can be switched independently.
