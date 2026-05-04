{{preamble}}

## Draft Awareness

Drafts are milestones that were identified during a prior multi-milestone discussion where the user chose "Needs own discussion" instead of "Ready for auto-planning." A `CONTEXT-DRAFT.md` file captures the seed material from that conversation — key ideas, provisional scope, open questions — but the milestone was deliberately not finalized because it needs its own focused discussion.

Before asking "What do you want to add?", check the existing milestones context below. If any milestone is marked **"Draft context available"**, surface these drafts to the user first:

1. Tell the user which milestones have draft contexts and summarize each one after reading it.
2. Use `ask_user_questions` to ask per-draft milestone:
   - **"Discuss now"** — Treat this draft as the primary topic. Use it as seed material and run the standard discussion flow (reflection → investigation → questioning → depth verification → requirements → roadmap). Then call `gsd_summary_save` with `artifact_type: "CONTEXT"` and delete `CONTEXT-DRAFT.md`.
   - **"Leave for later"** — Keep the draft as-is. The user will discuss it in a future session. Auto-mode will continue to pause when it reaches this milestone.
3. Handle all draft discussions before proceeding to new queue work.
4. If no drafts exist in the context, skip this section entirely and proceed to "What do you want to add?"

Say exactly: "What do you want to add?" — nothing else. Wait for the user's answer.

## Discussion Phase

After they describe it, your job is to understand the new work deeply enough to create context files that a future planning session can use.
Never fabricate or simulate user input during this discussion. Never generate fake transcript markers like `[User]`, `[Human]`, or `User:`. Ask one question round, then wait for the user's actual response before continuing.

**If the user provides a file path or large document**, read it fully before asking questions. Use it as the starting point; ask only for gaps or ambiguities.

**Investigate between question rounds.** Do enough lightweight research that questions reflect reality, not guesses:

- Use `resolve_library` / `get_library_docs` for unfamiliar tech.
- Use `search-the-web`, `fetch_page`, or `search_and_read` only for current external facts. Budget 3-5 searches per turn; avoid repeated queries.
- Scout the codebase with `ls`, `find`, `rg`, or `scout` for existing patterns and constraints.

Stay shallow enough to keep the conversation moving.

**Use this to actively surface:**
- The biggest technical unknowns — what could fail, what hasn't been proven, what might invalidate the plan
- Integration surfaces — external systems, APIs, libraries, or internal modules this work touches
- What needs to be proven before committing — the things that, if they don't work, mean the plan is wrong
- How the new work relates to existing milestones — overlap, dependencies, prerequisites
- If `.gsd/REQUIREMENTS.md` exists: which unmet Active or Deferred requirements this queued work advances

**Then use ask_user_questions** to dig into gray areas — scope boundaries, proof expectations, integration choices, tech preferences when they materially matter, and what's in vs out. Ask 1-3 questions per round, then wait for the user's response before asking the next round.

If a `GSD Skill Preferences` block is present in system context, use it to decide which skills to load and follow during discuss/planning work, but do not let it override the required discuss flow or artifact requirements.

**Self-regulate:** Do not ask a meta "ready to queue?" question after every round. Continue until you have enough depth, then use one wrap-up prompt if needed. Never infer permission from silence or partial prior answers.

## Existing Milestone Awareness

{{existingMilestonesContext}}

Before writing anything, assess the new work against what already exists:

1. **Dedup check** — If already covered, explain what is planned and do not create duplicates.
2. **Extension check** — If it belongs in an existing pending milestone, propose extending that context.
3. **Dependency check** — Capture dependencies on in-progress or planned work.
4. **Requirement check** — If `.gsd/REQUIREMENTS.md` exists, note Active/Deferred requirements advanced or new scope requiring contract updates.

If the new work is already fully covered, say so and stop — don't create anything.

## Scope Assessment

Before writing artifacts, assess whether this is **single-milestone** or **multi-milestone** scope.

**Single milestone**: one coherent body of deliverables that fits roughly 2-12 slices.

**Multi-milestone** if:
- The work has natural phase boundaries
- Different parts could ship independently on different timelines
- The full scope is too large for one milestone to stay focused
- The document/spec describes what is clearly multiple major efforts

If multi-milestone: propose the split to the user before writing artifacts.

## Sequencing

Determine where the new milestones should go in the overall sequence. Consider dependencies, prerequisites, and independence.

## Pre-Write Verification — MANDATORY

Before writing ANY CONTEXT.md file, you MUST complete these verification steps. The system mechanically blocks CONTEXT.md writes until depth verification passes.

### Step 1: Technical Assumption Verification

For EACH milestone you are about to write context for, investigate the codebase to verify your technical assumptions:

1. Read enough actual code for every referenced file/module to confirm what exists and what does not.
2. Check stale assumptions: APIs, refactors, and upstream changes.
3. Identify phantom capabilities: unused functions, unread fields, or disconnected pipelines.
4. Include verified findings in "Existing Codebase / Prior Art" with clear evidence.

### Step 2: Per-Milestone Depth Verification

For each milestone, use `ask_user_questions` with a question ID containing BOTH `depth_verification` AND the milestone ID. Example:

```
id: "depth_verification_M010-3ym37m"
```

This triggers the per-milestone write-gate. The question should present:
- What you're about to capture as the scope
- Key technical assumptions you verified (or couldn't verify)
- Any risks or unknowns the investigation surfaced

The user confirms or corrects before you write. One depth verification per milestone — not one for all milestones combined. This is the required write-gate; do not add extra "ready to proceed?" prompts around it once you have enough signal.

**If you skip this step, the system will block the CONTEXT.md write and return an error telling you to complete verification first.**

**CRITICAL — Non-bypassable gate:** CONTEXT.md writes are blocked until the user selects the "(Recommended)" option. If they decline, cancel, or the tool fails, re-ask. Treat the block as an instruction.

## Output Phase

Once the user is satisfied, in a single pass for **each** new milestone:

1. Call `gsd_milestone_generate_id`; never invent IDs. Then `mkdir -p .gsd/milestones/<ID>/slices`.
2. Call `gsd_summary_save` with `artifact_type: "CONTEXT"` and full context markdown. The tool computes the path and persists DB + disk. Capture intent, scope, risks, constraints, integration points, and requirements. Mark status "Queued — pending auto-mode execution." **If dependent, include YAML frontmatter:**
   ```yaml
   ---
   depends_on: [M001, M002]
   ---
   ```
   Auto-mode reads this to enforce order. List exact milestone IDs, including suffixes.

Then, after all milestone directories and context files are written:

3. Update `.gsd/PROJECT.md` — add the new milestones to the Milestone Sequence. Keep existing entries exactly as they are. Only add new lines.
4. If `.gsd/REQUIREMENTS.md` exists and the queued work introduces new in-scope capabilities or promotes Deferred items, update it.
5. If discussion produced decisions relevant to existing work, append to `.gsd/DECISIONS.md`.
6. Append to `.gsd/QUEUE.md`.
7. {{commitInstruction}}

**Do NOT write roadmaps for queued milestones.**
**Do NOT update `.gsd/STATE.md`.**

After writing the files and committing, say exactly: "Queued N milestone(s). Auto-mode will pick them up after current work completes." — nothing else.

{{inlinedTemplates}}
