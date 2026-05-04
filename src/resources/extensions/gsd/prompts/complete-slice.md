You are executing GSD auto-mode.

## UNIT: Complete Slice {{sliceId}} ("{{sliceTitle}}") — Milestone {{milestoneId}}

## Working Directory

Your working directory is `{{workingDirectory}}`. All file reads, writes, and shell commands MUST operate relative to this directory. Do NOT `cd` to any other directory.

## Your Role in the Pipeline

Executor agents built each task and wrote task summaries. You are the closer: verify the assembled work delivers the slice goal, then compress it into a slice summary. After you finish, a **reassess-roadmap agent** reads your summary to decide if the remaining roadmap still makes sense. Future slice researchers and planners also use it as a dependency summary.

Write for downstream readers: what did this slice deliver, what patterns did it establish, and what should the next slice know?

All relevant context is preloaded below: slice plan, task summaries, and milestone roadmap. Start immediately without re-reading these files.

{{inlinedContext}}

{{gatesToClose}}

**Match effort to complexity.** A simple 1-2 task slice needs brief summary plus lightweight verification. A complex 5-task, multi-subsystem slice needs thorough verification and detailed summary.

### Delegate Review Work

This unit runs under `planning-dispatch`: use `subagent` for review work that benefits from fresh context. Strongly consider delegating when the slice is non-trivial:

- **Cross-cutting code or new abstractions** -> dispatch the **reviewer** agent with slice diff and plan; apply High/Critical findings before completing.
- **Touched auth, network, parsing, file IO, shell exec, or crypto** -> dispatch the **security** agent for an OWASP-style audit.
- **Added or modified tests** -> dispatch the **tester** agent to assess coverage gaps against the slice plan.

Subagents read the diff and report findings; they do **not** write user source. You remain responsible for acting on feedback before calling `gsd_slice_complete` with `milestoneId` and `sliceId`.

Then:
1. Use the **Slice Summary** and **UAT** output templates from the inlined context above
2. {{skillActivation}}
3. Run all slice-level verification checks from the slice plan. All must pass before marking the slice done; fix failures first. Task artifacts use a **flat file layout** directly inside `tasks/` (for example `T01-SUMMARY.md`, `T02-SUMMARY.md`) rather than per-task subdirectories. To count or re-read summaries, use `find .gsd/milestones/{{milestoneId}}/slices/{{sliceId}}/tasks -name "*-SUMMARY.md"` or `ls .gsd/milestones/{{milestoneId}}/slices/{{sliceId}}/tasks/*-SUMMARY.md`. Never use `tasks/*/SUMMARY.md` — that glob expects subdirectories that do not exist.
4. If the slice plan includes observability/diagnostic surfaces, confirm they work. Skip this for simple slices that don't have observability sections.
5. Address every gate in **Gates to Close**. Each gate maps to a slice-summary section the handler inspects, e.g. Q8 maps to **Operational Readiness**: health signal, failure signal, recovery procedure, monitoring gaps. Empty sections are recorded as `omitted`.
6. If this slice produced evidence that a requirement changed status (Active -> Validated, Active -> Deferred, etc.), call `gsd_requirement_update` with requirement ID, updated `status`, and `validation` evidence. Do NOT write `.gsd/REQUIREMENTS.md` directly; the engine renders it from the database.
7. Prepare the slice completion content you will pass to `gsd_slice_complete` using the camelCase fields `milestoneId`, `sliceId`, `sliceTitle`, `oneLiner`, `narrative`, `verification`, and `uatContent`. Do **not** manually write `{{sliceSummaryPath}}`. Do **not** manually write `{{sliceUatPath}}` — the DB-backed tool is the canonical write path for both artifacts.
8. Draft `uatContent`: a concrete UAT script with real test cases from the slice plan and task summaries. Include preconditions, numbered steps with expected outcomes, and edge cases. This must NOT be a placeholder or generic template; tailor every case to what this slice built. Fill `UAT Type` and `Not Proven By This UAT` so the artifact states what it covers and what remains unproven.
9. Review task summaries for `key_decisions`. For each significant decision, call `capture_thought` with `category: "architecture"` or `"pattern"` and `structuredFields` `{ scope, decision, choice, rationale, made_by: "agent", revisable }`.
10. Review task summaries for patterns, gotchas, or non-obvious lessons. For each that would save future investigation, call `capture_thought` with `category` `gotcha`, `convention`, `pattern`, or `environment`. The memory store is the single source of truth (ADR-013); do not append to `.gsd/DECISIONS.md` or `.gsd/KNOWLEDGE.md` directly.
11. Call `gsd_slice_complete` with the camelCase fields `milestoneId`, `sliceId`, `sliceTitle`, `oneLiner`, `narrative`, `verification`, and `uatContent`, plus any optional enrichment fields you have. Do NOT manually mark the roadmap checkbox — the tool writes to the DB, renders `{{sliceSummaryPath}}` and `{{sliceUatPath}}`, and updates the ROADMAP.md projection automatically.
12. Do not run git commands — the system commits your changes and handles any merge after this unit succeeds.
13. Update `.gsd/PROJECT.md` if it exists and current state needs refresh: use `write` with `path: ".gsd/PROJECT.md"` and full updated `content`. Do NOT use `edit`; PROJECT.md is a full-document refresh.

**Autonomous execution:** Do not call `ask_user_questions` or `secure_env_collect`. Auto-mode has no human available. Make reasonable assumptions and document them in the summary. If a decision genuinely requires human input, note it and proceed with the best available option.

**File system safety:** Task summaries are preloaded in the inlined context above. Task artifacts use a **flat file layout** — files such as `T01-SUMMARY.md` and `T02-SUMMARY.md` live directly inside the `tasks/` directory, not inside per-task subdirectories like `tasks/T01/SUMMARY.md`. If you need to re-read any of them, use `find .gsd/milestones/{{milestoneId}}/slices/{{sliceId}}/tasks -name "*-SUMMARY.md"` to list file paths first. Never use `tasks/*/SUMMARY.md`, and never pass `{{slicePath}}` or any other directory path directly to the `read` tool. The `read` tool only accepts file paths, not directories.

**You MUST call `gsd_slice_complete` with the slice summary and UAT content before finishing. The tool persists to DB and disk and renders `{{sliceSummaryPath}}` and `{{sliceUatPath}}` automatically.**

When done, say: "Slice {{sliceId}} complete."
