# Build — Ruleswright (UI) / loot-inventory

## Agents
Planner planned this. Coder builds it (`program-agents/CODER.md`). Orchestrator schedules it (`program-agents/ORCHESTRATOR.md`).

**Solo run:** follow the protocol below; one agent works through sessions serially.

**Parallel run:** hand this directory to Orchestrator. Orchestrator spawns Coder as subagents using whatever subagent mechanism is provided by the agent/runtime executing Orchestrator, awaits their results, and owns STATE.md, MASTER.md, and arch files. Coder commits its own lease at every checkpoint.

**Before anything else:** the human decided (2026-09-27, "q1 yes q2 b"). `AUTHOR-REQUEST-LI.md` now holds two **approved** Author work orders. Wave 1 = SESSION-01 + AUTHOR-SPEC-LI (Spec role, `specs/requirements.md` only) + AUTHOR-DESIGN-LI (Designer role, `specs/design.md` + `mocks/*` only). Wave 2 = SESSION-02 (after both Author commits) + SESSION-03 (after SESSION-01 + the Designer commit). Coder never writes `specs/` or `mocks/`.

## Protocol — each iteration (solo mode)
1. Read `program/ruleswright-ui/PROGRAM-CONFIG.MD` (registry, stack, conventions, verification).
2. Read STATE.md: sessions, capability readiness, agreements, blockers, Verification Baseline. Distinguish these from historical handoffs.
3. Pick the next pending session whose dependencies are done and whose required Contract Agreements are agreed with ready producers. Blocked sessions stay blocked until their Current Blockers row clears with evidence.
4. Read SESSION-NN.md fully, plus its Module Context files.
5. Read affected files before modifying them.
6. Execute checkpoint by checkpoint. Commit each with `git add -- <Owns>` and `git commit`. Stay inside Owns.
7. Verify the session checks, PROGRAM-CONFIG compliance, and this checkpoint's CA proofs. Record actual results. Invalidate affected evidence when a contract changes.
8. Update STATE.md (status, checkpoint, date, notes, handoff).
9. Update architecture if a module or public API changed.
10. Loop. When all sessions are done or skipped, write the Final Report. Any required capability still unverified is reported as incomplete, with its owner.

## Crash Recovery
- STATE.md → the in-progress session and its last committed checkpoint.
- `git log --oneline -- <lease paths>` is authoritative.
- Make sure the previous worker has ended. Preserve uncommitted work; validate and resume it.
- Never `git reset --hard`.

## Stopping Conditions
- All sessions done/skipped → Final Report. Product completion requires every in-scope capability to be verified.
- Blocked → mark it and continue with eligible work.
- Context limit → commit the current checkpoint, update STATE.md, stop cleanly.
- User input only for product-design or destructive work. Q1/Q2 are answered; ask again only if an Author worker needs to go beyond the approved content.

## Final Report
Write `program/ruleswright-ui/prompts/loot-inventory/FINAL-REPORT.md` and commit it with `git add -f --` (the prompts dir is gitignored, H-5). Include: summary, sessions done/total, files, architecture impact, verification, residual gaps, follow-up, and the PROGRAM-CONFIG deltas from STATE LI-D8.
