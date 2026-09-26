# Cleanup Ledger — Ruleswright (UI)

Archivist scouts; it does not clean. Every candidate below is open until one of the four
statuses applies: `tracking` (evidence exists, below threshold), `briefed` (threshold crossed,
Planner brief emitted), `accepted` (approved cleanup program), `retired` (evidence false,
obsolete, or intentionally retained).

---

## 2026-09-26 — final pass (feature `v1-shell`)

### C1 — `release/` absent from `.gitignore`
- **evidence:** `.gitignore` has the demiurge block plus `/out/`, `/test-results/`, `/playwright-report/`; `electron-builder.yml` declares `output: release`; no `/release/` line exists. SESSION-01 declared the gap verbatim and placed it outside its lease ("the Orchestrator may want to add it").
- **confidence:** high — the contradiction is between a committed config file and the ignore file, both in the tree.
- **blast radius:** one line in `.gitignore`; no source or test edits.
- **proposed check:** `git check-ignore release/` fails (as it must, until the line lands); after the line lands, `electron-builder` output stays untracked.
- **status:** tracking (below the Planner-brief threshold: one high-confidence finding, not a campaign).

### C2 — `OkCard` exported with no consumer outside its own module
- **evidence:** `ui/index.ts` exports `ErrorCard, OkCard`; `OkCard` has no consumer in `src/`, `tests/`, or `e2e/` (the World pass strip carries the `ok-card` test id on `DeterminismStrip` instead). Recorded in M08's realized text, not deleted.
- **confidence:** medium — dynamic/framework usage risk is low for a pure presentational component, but removal is a product-design-adjacent call and Archivist does not sweep.
- **blast radius:** one barrel export; the component itself is untouched either way.
- **proposed check:** `grep -rn OkCard src tests e2e` after any removal shows no stragglers; unit gate stays green.
- **status:** tracking.

### C3 — engine follow-up ledger (not UI cleanup; owned by the engine program)
- **evidence:** the engine program's follow-ups named in the realized M06 delta: `editDistance` spelling-hint bug; attack tables don't cover AC 11 and up; conditions not carried into combat; Unprepare (no API) and next-level XP (no field). Each is named, owned, and planned — none is a defect in this feature's tree.
- **confidence:** n/a (advisory, not cleanup evidence against this program).
- **blast radius:** none here; the UI re-entry when the APIs land is a planned Coder lease.
- **status:** tracking (cross-program advisory; not actionable from this program's lease).

---

No candidate crosses a Planner-brief threshold this pass (fewer than five related medium-confidence findings, fewer than three related high-confidence findings, no high-confidence destructive cleanup). Recorded honestly rather than queued behind a blockage that is itself an instance of the pattern.