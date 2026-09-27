# Build — Ruleswright (UI) / combat-complete

## Agents
Planner planned this. Coder builds it (`program-agents/CODER.md`). Orchestrator schedules it (`program-agents/ORCHESTRATOR.md`).

**Solo run:** follow the protocol below; one agent works through sessions serially.

**Parallel run:** hand this directory to Orchestrator. Orchestrator spawns Coder as subagents using whatever
subagent mechanism is provided by the agent/runtime executing Orchestrator, awaits their results, and owns
STATE.md, MASTER.md, and arch files. Coder commits its own lease at every checkpoint. This plan has no
concurrent sessions (CX-D8). Parallelism exists only among the Author workers of wave A0.

**Before anything else:** read `AUTHOR-REQUEST-CX.md`.
- **DF-CX-1** is a design-fill. Orchestrator dispatches it under standing authority, as a Designer worker
  writing only `specs/design.md` + `mocks/combat.html`. That unblocks SESSION-01.
- **Q1–Q4 are open human decisions.** Until they are answered, only DF-CX-1 → SESSION-01 may run. When
  answered, rewrite the request header as "APPROVED work orders" and quote the human's words verbatim.
  Then dispatch AUTHOR-DB-CX / AUTHOR-SPEC-CX / AUTHOR-DESIGN-CX per the answers. DF-CX-1 and
  AUTHOR-DESIGN-CX both write `design.md`: serialize them or merge them into one Designer worker.
- Answers that remove a session: mark it `skipped` (Q2 = b → S03; Q3 = c → S04). Q3 = b needs a Planner
  replan of S04.
- Coder never writes `specs/` or `mocks/`.

## Protocol — each iteration (solo mode)
1. Read `program/ruleswright-ui/PROGRAM-CONFIG.MD` (registry, stack, conventions, verification).
2. Read STATE.md: sessions, capability readiness, agreements, blockers, Verification Baseline. Distinguish
   these from historical handoffs.
3. Pick the next pending session whose dependencies are done and whose required Contract Agreements are
   agreed with ready producers. Provisional CAs (CA-04b) are re-checked against the landed Author text
   before dispatch; the session runs against the amended text. Do not require a session's own future proof.
4. Read SESSION-NN.md fully, plus its Module Context files.
5. Read affected files before modifying them.
6. Execute checkpoint by checkpoint. Commit each with `git add -- <Owns>` and `git commit`, subject
   `combat-complete SESSION-NN: checkpoint N — <what>`. Stay inside Owns.
7. Verify the session checks, PROGRAM-CONFIG compliance, and this checkpoint's CA proofs, using the
   Verification Baseline (hold `e2e:out` for build/e2e). Record actual results. Invalidate affected
   evidence when a contract changes or counterevidence appears.
8. Update STATE.md (status, checkpoint, date, notes, handoff).
9. Update architecture (`arch/M06`, `M09`, `M11-M15-views`, `M15-combat`, `M01`/`M02` for S02) and the
   PROGRAM-CONFIG test-id conventions.
10. Loop. When all sessions are done or skipped, write the Final Report. Any required capability still
    unverified (CAP-06 at least, unless the engine program lands) is reported as incomplete, with its
    owner.

## Crash Recovery
- STATE.md → the in-progress session and its last committed checkpoint.
- `git log --oneline -- <lease paths>` is authoritative.
- Make sure the previous worker has ended before taking its lease. Preserve uncommitted work; validate and
  resume it where possible.
- Never `git reset --hard`. Never rebuild `../Ruleswright/dist` while a session runs (H-3).

## Stopping Conditions
- All sessions done/skipped → Final Report. Product completion requires every in-scope capability to be
  verified against current sources.
- Blocked → mark it and continue with eligible work.
- Context limit → commit the current checkpoint, update STATE.md, stop cleanly.
- User input only for product-design or destructive work: Q1–Q4 as written. Nothing else in this plan
  needs a human.

## Final Report
Write `program/ruleswright-ui/prompts/combat-complete/FINAL-REPORT.md` and commit it with `git add -f --`
(the prompts dir is gitignored, H-5). Never write it to `.program/`. Include: summary, sessions
done/total, files created/modified, architecture impact, verification, residual gaps (CAP-06 spatial
and the engine gaps listed in AUTHOR-REQUEST-CX), and follow-up.

Under Orchestrator, append the Orchestration section (concurrency, wall clock, checkpoints committed by
Coder, lease violations, checkpoint shortfalls, granularity feedback for Planner).
