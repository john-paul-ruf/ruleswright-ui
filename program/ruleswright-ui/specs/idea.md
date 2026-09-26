# Idea — Ruleswright (UI working name)

## One-Sentence Summary

An Electron desktop app where you set a theme, roll a campaign pack, and step into that world to play — the first shell of the game, built on the headless Ruleswright engine.

## Problem

Ruleswright is headless by design: pure API, no I/O, hosts own storage and UI. Today it has no window into it — no way to *play* what it generates. The only interactions are test output and ad-hoc node scripts, and the game it's becoming has no shell to grow into. Meanwhile its two best features — byte determinism and provenanced events — are exactly the ones hardest to *see* through test assertions.

## Vision

A desktop app that is the game's v1 body: pick a theme, set seed and knobs, roll the pack — and the world appears. Browse its classes, spells, bestiary, and tables; create a character the way the README does; then fight — a stepwise, theater-of-mind round where `declare`/`step` are buttons and the event log is the stage, every roll showing its provenance (which pack rule, which dice).

Same-seed rerun is a first-class affordance: hit it and watch the identical fight replay — the library's core promise made visible.

And the bar: **art to be proud of.** This should feel like a crafted game object — moody, cohesive, best-in-class — not a devtool admin panel. A candidate ambition for design: let the rolled pack's theme influence the app's mood, so dark-fantasy and zombie-urban feel like different games.

This is deliberately a work in progress: quests and campaign systems are v2 engine work, already coming. When the engine grows, this shell grows with it — the UI's job now is to be a beautiful, honest v1 of a bigger game.

## Target User

- **Primary:** You — developing a game incrementally on top of your own headless engine, with this app as its shell.
- **Secondary:** Anyone playing or evaluating the game — the shell doubles as the library's demo.

## Key Features (high-level)

1. **Roll a world** — theme picker + seed + knobs → validated campaign pack; knob inputs driven by the library's machine-readable knob declarations, not hardcoded to the two sample themes.
2. **Browse the world** — views over pack artifacts (classes, spells, bestiary, tables) with a raw-JSON toggle; packs export/import as JSON.
3. **Live in the world** — one character: create, level/award XP, spend pools, prepare/cast, apply/remove conditions; snapshot save/restore, host-owned persistence.
4. **Fight in the world** — one stepwise theater-of-mind combat via `allies`/`enemies`; one player-owned character, bestiary monsters filling the rest; provenanced event log as the primary panel.
5. **Determinism affordances** — seed always visible; rerun-same-seed; RNG state inspectable through snapshots.

## Non-Goals

- No quests, campaign management, or world exploration — v2 engine work; the UI waits on the engine.
- No backend, accounts, or sync — a local desktop app; storage owned by the Electron host.
- No pack *editing* — packs are generated artifacts; inspect only.
- No grid/map spatial UI — theater-of-mind only.
- No party management — one active character (v1).
- Consumes Ruleswright as a library; never forks or edits the library's source. Engine changes are a separate program in that repo.

## Decisions already made (defaults proposed by Spec, standing unless you object)

- Inspector coverage: bespoke views for classes/spells/bestiary/tables; everything else falls back to the raw-JSON toggle.
- Combat shape: two sides via `allies`/`enemies`; one player-owned character, bestiary-spawned monsters otherwise.
- Schema validation on pack load/paste: yes, with the library's error cards on failure.

## Open Questions (for later phases)

- Electron packaging, main/renderer split, how the sibling library is consumed — Architect's call.
- Visual language, theme-driven mood — Designer's call.
- Database phase: what (if anything) needs persisted schema vs plain JSON files — DB's call.