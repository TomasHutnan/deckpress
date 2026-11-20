# ADR-0003: Separate Project Storage with Local Git Versioning and Optional Remote Sync

- **Status:** Accepted
- **Date:** 2026-11-20
- **Supersedes:** none

## Context
The user wants to:
1. Edit card designs directly in the UI with instant preview (no Docker rebuilds/redeploys).
2. Experiment freely with layout/style ideas without risking breaking the active/published design.
3. Keep game projects (like *Menu*) separate from the Card Studio application repository (`projects/` gitignored in the app repo), so each game can live in its own Git repository.
4. Support multiple ways to initialize a project in the app, including cloning an existing Git repo and connecting/disconnecting a Git remote.

## Options considered
1. **Plain Volume Folders + Timestamped Snapshots**: Store each project in `/data/projects/<slug>/` with JSON backup copies. Pros: simplest implementation, zero Git logic. Cons: no native Git repo per project, no clone/pull/push workflow.
2. **Remote Git Repo Required**: Every project must be backed by a remote GitHub repo synced via SSH/PAT. Pros: clean remote history. Cons: high friction to start a new game, requires credentials upfront, risk of merge conflicts during rapid UI experimentation.
3. **Hybrid — Local Git Repo per Project + Optional Remote Sync**: Every project folder under `projects/<slug>/` is initialized as a real local Git repository. UI edits live in a browser working draft (plus named design variants in `design.json`) until explicitly saved, which creates a local Git commit. Users can initialize a project as Blank, from a Template, or by Cloning an existing Git repo, and can connect/disconnect a remote URL (with pull/push) at any time. Pros: real Git history and 1-click rollback from day 1, safe experimentation without pushing broken changes, seamless per-game Git repo workflow when desired. Cons: small Git CLI wrapper needed in the backend; remote pull/push requires handling basic auth/PAT and non-fast-forward warnings cleanly.

## Decision
Use **Option 3: Local Git repository per project under a gitignored `projects/` directory, with live UI drafts, named design variants, and optional Git remote connect/disconnect + pull/push.**

This directly resolves the tension between safe, instant UI experimentation and clean per-game Git version control.

## Consequences
**Positive:** Zero container rebuilds for design changes; safe experimentation via unsaved drafts, named variants, and 1-click Git rollback; each game is a clean, portable Git repo (`projects/the-menu/` initialized immediately with the current reference designs and card data).
**Negative / accepted costs:** Backend must shell out safely to `git` (via `execFile`, no shell injection) and surface clear UI errors if a remote push/pull diverges.
**Reversibility:** High — projects are plain files (`project.json`, `design.json`, `overrides.json`, `custom.css`, `assets/`) in standard Git repos.
**Revisit when:** Multiple users need simultaneous live editing on the same project with automatic merge resolution.
