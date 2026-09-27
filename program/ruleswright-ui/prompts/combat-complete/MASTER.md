# Build — Ruleswright (UI) / combat-complete (plan revision 2)

## Agents
Planner planned this. Coder builds it (`program-agents/CODER.md`). Orchestrator schedules it
(`program-agents/ORCHESTRATOR.md`).

**Solo run:** follow the protocol below; one agent works through sessions serially.

**Parallel run:** hand this directory to Orchestrator. Orchestrator spawns Coder as subagents using whatever
subagent mechanism is provided by the agent/runtime executing Orchestrator, awaits their results, and owns
STATE.md, MASTER.md and arch files. Coder commits its own lease at every checkpoint.

**Before anything else:** revision 2 exists because engine `dadf461` shipped grid combat and every newly forged
world now needs positions. **The unit gates are red today** (STATE Verification Baseline) and combat is
refused on new worlds until SESSION-01/02 land. The human decided (2026-09-27, "q4 a-i, q1 a, q2 a, q3 a"):
`AUTHOR-REQUEST-CX.md` now holds **APPROVED** work orders. Wave A0 = DF-CX-1 ∥ AUTHOR-DB-CX ∥
AUTHOR-SPEC-CX, then AUTHOR-DESIGN-CX **after** DF-CX-1 (both write `design.md` + `mocks/combat.html`).
SESSION-01 may start as soon as the DB commit lands. All six sessions run; none is skipped. Coder never writes
`specs/` or `mocks/`.

**Do not rebuild `../Ruleswright/dist` during this run** (H-3). If the engine moves again, stop dispatch and
ask Planner to recheck.

## Protocol — each iteration (solo mode)
1. Read `program/ruleswright-ui/PROGRAM-CONFIG.MD`.
2. Read STATE.md: sessions, capability readiness, agreements, blockers, Verification Baseline (incl. the known
   red window). Distinguish these from historical handoffs.
3. Pick the next pending session whose dependencies are done and whose required Contract Agreements are
   agreed with ready producers. Provisional CAs (CA-14, CA-04b) are re-checked against the committed
   `database.md` before dispatch; dispatch against the committed text.
4. Read SESSION-NN.md fully, plus its Module Context files. Its "On Qn = (b)/(c)" notes no longer apply.
5. Read affected files before modifying them.
6. Execute checkpoint by checkpoint. Commit each with `git add -- <Owns>` and `git commit`. Stay inside Owns.
7. Verify the session checks and this checkpoint's CA proofs. Record actual results; inside the red window,
   record the whole-repo result without claiming green.
8. Update STATE.md (status, checkpoint, date, notes, handoff). Close the red window only with evidence
   (S01 c3: `pnpm test` + `pnpm typecheck` 0 failures; S02 c3: `pnpm verify` rc 0).
9. Update architecture if a module or public API changed.
10. Loop. All sessions done → Final Report; any required capability still unverified is reported as
    incomplete, with its owner.

## Crash Recovery
- STATE.md → the in-progress session and its last committed checkpoint.
- `git log --oneline -- <lease paths>` is authoritative.
- Make sure the previous worker has ended. Preserve and validate uncommitted work; resume it.
- Never `git reset --hard`.

## Stopping Conditions
- All sessions done → Final Report. Product completion requires every in-scope capability verified.
- Blocked → mark it and continue with eligible work.
- Context limit → commit the current checkpoint, update STATE.md, stop cleanly.
- User input only for product-design or destructive work. Q1–Q4 are answered; ask again only if an Author
  worker needs to go beyond the approved content.

## Final Report
Write `program/ruleswright-ui/prompts/combat-complete/FINAL-REPORT.md` and commit it with `git add -f --`
(prompts dir gitignored, H-5). Include: summary, sessions done/total, files, architecture impact,
verification, residual gaps (engine gaps EG-1..EG-7 with the engine program as owner), follow-up, and the
PROGRAM-CONFIG deltas (new test ids; FR-11 spatial wording; the `move` script op).
