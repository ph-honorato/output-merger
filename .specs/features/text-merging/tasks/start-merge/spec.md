# Start Merge Logic Specification

## Problem Statement

The implemented Merge Session page renders the Start Merge button hardcoded as disabled, and both `TextInput` sources permanently render in `input` mode (compose only). The needle-selection → global context → preview chain already works end-to-end (Tasks 1, 3, 4) but is unreachable through the intended user flow. This specification defines Task 5 of Feature 2 (roadmap 5.1–5.2): gating Start Merge on available source text, the one-way transition into Merge Mode (sources become read-only, snippet selection enabled), and the acknowledgment that snippet auto-appearance in the preview is already delivered.

## Goals

- [ ] The Start Merge button is enabled once at least one source has text, and disabled while every source is empty.
- [ ] Clicking Start Merge enters Merge Mode: both sources switch to `view` mode, the button hides (its slot is reserved for Start Over in Feature 5).
- [ ] Source text is preserved across the transition; an empty source shows its view-mode empty state.
- [ ] Roadmap 5.2 (needles enable snippet creation; snippets auto-appear in the preview) is verified as already delivered — no new snippet-path code.
- [ ] One focused page-level test covers gating and the mode transition (the page's first test, per user decision).

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| "Start Over" button (reset) | Feature 5; will occupy the ActionsBar slot the Start Merge button vacates |
| Toggling back from Merge Mode to input mode | Feature 5 territory (Start Over); Task 5's transition is one-way |
| Text editing in Merge Mode | Sources are read-only in view mode (TextInput contract) |
| Entry animations on the mode flip | DESIGN.md motion rules deferred; no animation this task |
| Third text input | Feature 4 |
| Snippet-path changes (context, preview, needles) | Delivered by Tasks 1, 3, 4; Task 5 wires flow only |
| Persistence | V1 (Merges CRUD) |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here - nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Button gating | Enabled iff at least one source has non-empty text | Prevents the dead end of starting with nothing (no way back until Feature 5) while allowing single-source merges | y (grilled) |
| Text tracking | Page-local `Record<sourceId, string>` fed by `onTextChange`; no context | Needed for gating; page owns session UI state; Feature 4/5 will reuse it | y (grilled) |
| Post-start button | Hidden (not disabled); ActionsBar stays rendered (empty until Feature 5 fills it) | User decision: Start Over takes the place in a later feature | y (grilled) |
| `mergeStarted` state | `useState` inside the page workspace; no context, no hook file | Two-line UI state; SRP — snippets context stays snippets-only | y (grilled) |
| Mode propagation | Both sources get `mode={mergeStarted ? 'view' : 'input'}` | Roadmap 5.1 | y (grilled) |
| Domain term | "Merge Mode" added to GLOSSARY.md | The page now flips between two named states | y (grilled) |
| Page-level test | One focused suite: gating + transition (not needle-drag E2E) | Key user workflow (AGENTS.md integration-test rule); needle mechanics stay covered by TextInput unit tests | y (grilled) |
| Task 5.2 | Already delivered by Tasks 1/3/4; verified by existing suites; no new code | Snippet → `onChange` → context → preview chain is complete | y (grilled) |
| i18n | No new keys (button text unchanged, no new UI strings) | Nothing new to translate | y (grilled) |
| ADR | None | The state design is trivially reversible | y (grilled) |
| "Non-empty" | `text.trim().length > 0` — whitespace-only sources do not count | Pasted whitespace is not content | n (agent default) |
| Empty sources on start | Also flip to view mode and render their existing empty state | All sources share one mode; no per-source branching | n (agent default) |
| Text preservation | Mode flip does not clear text or snippets (TextInput keeps internal uncontrolled state; only typing clears snippets) | TextInput contract (Task 1 implementation.md) | n (agent default) |

**Open questions:** none - all resolved or logged above (required before the spec is confirmed).

---

## Implicit-Requirement Dimensions

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | Gating uses trimmed text length; no other validation (TextInput owns the 500-char cap) |
| Failure / partial-failure states | N/A — local synchronous state; the transition cannot partially fail |
| Idempotency / retry / duplicate handling | The button unmounts after a successful start; re-clicking is impossible; state flips once |
| Auth boundaries & rate limits | N/A because there is no API |
| Concurrency / ordering | Single user, single click; text updates and the start click are sequentially ordered by React state |
| Data lifecycle / expiry | `mergeStarted` and `sourceTexts` die with the page (no persistence by design) |
| Observability | N/A because V0 has no metrics/logging requirement |
| External-dependency failure | N/A because no external services |
| State-transition integrity | One-way compose → Merge Mode; sources and button state always agree (button hidden ⇒ sources in view mode) |

---

## User Stories

### P1: Gate Start Merge on available text ⭐ MVP

**User Story**: As a merger, I want Start Merge enabled only when I have something to select from, so that I cannot start a dead-end session.

**Why P1**: Roadmap 5.1 precondition; user decision (grilled).

**Acceptance Criteria**:

1. WHILE every source's text is empty (or whitespace-only) THEN the Start Merge button SHALL be disabled.
2. WHEN at least one source has non-empty text THEN the Start Merge button SHALL be enabled.
3. IF a source contains only whitespace THEN it SHALL NOT count as having text.

**Independent Test**: Render the page: button disabled; type into the first textarea: enabled; type only spaces in a fresh render: still disabled.

---

### P1: Enter Merge Mode ⭐ MVP

**User Story**: As a merger, I want one click to lock my texts and begin selecting snippets, so that my sources become stable for highlighting.

**Why P1**: Roadmap 5.1; the transition that makes the whole flow reachable.

**Acceptance Criteria**:

1. WHEN the enabled Start Merge button is clicked THEN both sources SHALL switch to `view` mode and SHALL render no textareas.
2. WHEN Merge Mode is entered THEN the Start Merge button SHALL be hidden while the ActionsBar SHALL remain rendered (its slot awaits Start Over in Feature 5).
3. WHEN Merge Mode is entered THEN each source's text SHALL be preserved and visible in view mode.
4. IF a source was empty at entry THEN it SHALL render the view-mode empty state ("No text added yet").

**Independent Test**: Type "Hello world" in source 1, click Start Merge: no textareas remain, `text-input-view` shows "Hello world", `text-input-empty` shows for source 2, start button absent, preview column still rendered.

---

### P1: Snippets auto-appear in Merge Mode (delivered) ⭐ MVP

**User Story**: As a merger, I want every snippet I drag into existence to appear in the preview immediately, so that I can see and copy my merged output.

**Why P1**: Roadmap 5.2. Already implemented by Tasks 1 (needles/view mode), 3 (context), and 4 (preview); this task verifies the flow and adds no snippet-path code.

**Acceptance Criteria**:

1. WHILE in Merge Mode THEN needle-based snippet creation SHALL be active in each source per the TextInput contract (Task 1).
2. WHEN a snippet is created, resized, or removed in any source THEN it SHALL appear, update, or disappear in the preview area automatically (Tasks 3+4 chain: `onChange` → context → preview).

**Independent Test**: Composition of existing suites — TextInput (needle mechanics), SnippetsContext (reconciliation), PreviewArea (rendering) — plus the new page test asserting the mode transition that unlocks the flow.

---

## Edge Cases

- IF all sources contain only whitespace THEN the button remains disabled (whitespace is not content).
- IF the user starts with one empty source THEN the empty source flips to view mode and shows its empty state; snippet creation there is naturally unavailable (no needles on empty text, per Task 1).
- IF the mode flip happens THEN existing snippets (none possible pre-start in v0, but contract-wise) SHALL survive — only typing clears snippets (TextInput contract).
- IF the page unmounts in Merge Mode THEN state is discarded (no persistence).

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| STMRG-01 | Gate Start Merge on available text | Specify | Verified |
| STMRG-02 | Gate Start Merge on available text | Specify | Verified |
| STMRG-03 | Gate Start Merge on available text | Specify | Verified |
| STMRG-04 | Enter Merge Mode | Specify | Verified |
| STMRG-05 | Enter Merge Mode | Specify | Verified |
| STMRG-06 | Enter Merge Mode | Specify | Verified |
| STMRG-07 | Enter Merge Mode | Specify | Verified |
| STMRG-08 | Snippets auto-appear in Merge Mode (delivered) | Specify | Verified |
| STMRG-09 | Snippets auto-appear in Merge Mode (delivered) | Specify | Verified |

**ID format:** `STMRG-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified; additionally **Deviated** (implemented with a changed contract — see `implementation.md`) and **Deferred** (not implemented — see `implementation.md`).

**Coverage:** 9 total. 9 Verified, 0 Deviated, 0 Deferred. Roadmap mapping: 5.1 → STMRG-01–07; 5.2 → STMRG-08–09 (pre-delivered by Tasks 1/3/4, verified this task). Per-requirement outcomes: `.specs/features/text-merging/tasks/start-merge/implementation.md`.

---

## Success Criteria

How we know the feature is successful:

- [ ] Fresh page: both sources in input mode, Start Merge disabled; typing enables it; whitespace does not.
- [ ] Clicking Start Merge removes the textareas and the button, preserves the typed text in view mode, and leaves the ActionsBar and preview intact.
- [ ] From Merge Mode, dragging needles in a source produces a snippet that immediately appears in the preview (manual verification in dev server; mechanics covered by existing suites).
- [ ] `npx vitest run`, `npm run lint`, and `npx tsc -b` all pass.
