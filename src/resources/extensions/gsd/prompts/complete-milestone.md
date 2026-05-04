You are executing GSD auto-mode.

## UNIT: Complete Milestone {{milestoneId}} ("{{milestoneTitle}}")

## Working Directory

Your working directory is `{{workingDirectory}}`. All file reads, writes, and shell commands MUST operate relative to this directory. Do NOT `cd` to any other directory.

## Your Role in the Pipeline

All slices are done. Close the milestone by verifying the assembled work delivers the promised outcome, writing the milestone summary, and updating project state. The summary is the final record; queued milestones start fresh and learn from it.

Preloaded context includes roadmap, compact slice-summary excerpts, requirements, decisions, and project context. **Slice summaries are excerpts, not full files.** They include frontmatter, section heads (deviations, known limitations, follow-ups), and short narrative only. For LEARNINGS, Decision Re-evaluation, or cross-slice narrative, selectively read full slice SUMMARY.md files listed under "On-demand Slice Summaries".

Start from excerpts; read full files only when section heads show needed context.

**On-demand Read ordering:** Complete needed slice SUMMARY Reads for cross-slice synthesis, Decision Re-evaluation, and LEARNINGS **before** calling `gsd_complete_milestone` (step 10). Once that tool runs, the DB marks the milestone complete; running out of tool budget before LEARNINGS leaves the milestone without its LEARNINGS artifact.

### Delegate Review Work

This unit runs under `planning-dispatch`: use `subagent` for review work that benefits from fresh context. For non-trivial milestones, delegate before drafting LEARNINGS:

- **Cross-slice integrations or new public APIs** -> dispatch the **reviewer** agent with milestone diff and roadmap; fold findings into Decision Re-evaluation and LEARNINGS.
- **Touched auth, network, parsing, file IO, shell exec, or crypto** -> dispatch the **security** agent for an OWASP-style audit across merged slices.
- **Significant test surface added or changed** -> dispatch the **tester** agent to assess coverage gaps against milestone success criteria.

Subagents read the diff and report findings; they do **not** write user source. Fold feedback into the summary and captured decisions before `gsd_complete_milestone`.

{{inlinedContext}}

Then:
1. Use the **Milestone Summary** output template from the inlined context above
2. {{skillActivation}}
3. **Verify code changes exist.** Compare the milestone against its integration branch (`main`, `master`, or recorded branch), merge-base as older revision and `HEAD` as newer. If the branch diff lists non-`.gsd/` files, pass. If `HEAD` equals the integration branch/merge-base (retry-on-main self-diff), do **not** treat empty diff as missing code; inspect milestone-scoped commit evidence such as recent `GSD-Unit: {{milestoneId}}` or production `GSD-Task: Sxx/Tyy` trailers whose diff also touches `.gsd/milestones/{{milestoneId}}/`, then check those commits for non-`.gsd/` files. Record a **verification failure** only when neither source shows implementation files.
4. Verify each **success criterion** from `{{roadmapPath}}` with evidence from slice summaries, tests, or observable behavior. Record unmet criteria as **verification failure**.
5. Verify **definition of done**: all slices `[x]`, summaries exist, cross-slice integrations work. Record unmet items as **verification failure**.
6. If the roadmap includes a **Horizontal Checklist**, verify each item was addressed. Note unchecked items in the summary.
7. Fill the **Decision Re-evaluation** table. For each key `.gsd/DECISIONS.md` decision from this milestone, evaluate whether it still matches what shipped. Flag decisions to revisit next milestone.
8. Validate **requirement status transitions**. For each changed requirement, confirm evidence supports the transition. Requirements may move between Active, Validated, Deferred, Blocked, or Out of Scope only with proof.

**DB access safety:** Do NOT query `.gsd/gsd.db` directly via `sqlite3` or `node -e require('better-sqlite3')`; the engine owns the WAL connection. Use `gsd_milestone_status` for milestone/slice state. Use inlined context or `gsd_*` tools, never direct SQL.

### Verification Gate — STOP if verification failed

**If ANY verification failure was recorded in steps 3, 4, or 5, follow the failure path. Do NOT proceed to step 10.**

**Failure path** (verification failed):
- Do NOT call `gsd_complete_milestone` — the milestone must not be marked as complete.
- Do NOT update `.gsd/PROJECT.md` to reflect completion.
- Do NOT update `.gsd/REQUIREMENTS.md` to mark requirements as validated.
- Write a clear failed-verification summary for the next attempt.
- Say: "Milestone {{milestoneId}} verification FAILED — not complete." and stop.

**Success path** (all verifications passed — continue with steps 9–13):

9. For each requirement whose status changed in step 8, call `gsd_requirement_update` with requirement ID plus updated `status` and `validation`; it regenerates `.gsd/REQUIREMENTS.md`. Do this BEFORE milestone completion.
10. **Persist completion through `gsd_complete_milestone`.** Call it with the parameters below. The tool updates DB milestone status, renders `{{milestoneSummaryPath}}`, and validates all slices are complete.

   **Required parameters:**
   - `milestoneId` (string) — Milestone ID (e.g. M001)
   - `title` (string) — Milestone title
   - `oneLiner` (string) — One-sentence summary of what the milestone achieved
   - `narrative` (string) — Detailed narrative of what happened during the milestone
   - `successCriteriaResults` (string) — Markdown detailing how each success criterion was met or not met
   - `definitionOfDoneResults` (string) — Markdown detailing how each definition-of-done item was met
   - `requirementOutcomes` (string) — Markdown detailing requirement status transitions with evidence
   - `keyDecisions` (array of strings) — Key architectural/pattern decisions made during the milestone
   - `keyFiles` (array of strings) — Key files created or modified during the milestone
   - `lessonsLearned` (array of strings) — Lessons learned during the milestone
   - `verificationPassed` (boolean) — Must be `true`; confirms code-change verification, success criteria, and definition-of-done checks all passed

   **Optional parameters:**
   - `followUps` (string) — Follow-up items for future milestones
   - `deviations` (string) — Deviations from the original plan
11. Update `.gsd/PROJECT.md`: use `write` with `path: ".gsd/PROJECT.md"` and full updated `content` reflecting milestone completion/current state. Do NOT use `edit`; PROJECT.md is a full-document refresh.
12. Extract structured learnings and persist them to the GSD memory store. Follow the procedure below; it writes `{{milestoneId}}-LEARNINGS.md` as audit trail and persists Patterns, Lessons, and Decisions via `capture_thought` (categories: pattern, gotcha/convention, architecture). Memory store is the durable source of truth (ADR-013).

{{extractLearningsSteps}}

13. Do not commit manually — the system auto-commits your changes after this unit completes.
- Say: "Milestone {{milestoneId}} complete."

**Important:** Do NOT skip code-change, success-criteria, or definition-of-done verification (steps 3-5). The summary must reflect verified outcomes, not assumed success. Verification failures BLOCK completion; there is no override. If a verification tool fails, errors, or returns unexpected output, treat it as a verification failure. Never rationalize past a tool error ("tool didn't respond, assuming success" is forbidden).

**File system safety:** When scanning milestone directories for evidence, use `ls` or `find` first. Never pass a directory path (e.g. `tasks/`, `slices/`) to `read`; it only accepts file paths.
