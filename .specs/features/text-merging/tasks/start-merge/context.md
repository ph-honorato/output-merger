# Start Merge Logic

**Gathered:** 2026-10-08
**Spec:** `.specs/features/text-merging/tasks/start-merge/spec.md`
**Status:** Implemented — see `implementation.md`

---

## Feature Boundary

Start Merge flow for Feature 2 Task 5 (roadmap 5.1–5.2) only: gating the page-level Start Merge button on available source text (page-owned text tracking via `onTextChange`), the one-way transition into Merge Mode (both sources flip to view mode, button hides), and verification that snippet auto-appearance already works via the Tasks 1/3/4 chain. Not Start Over (Feature 3), not toggling back to input mode, not text editing in Merge Mode, not animations, not persistence.

---

## Implementation Decisions

### Scope and delivery

- This grilling session specified Task 5 only (5.1–5.2).
- One focused page-level test added (the page's first — user lifted the earlier "no page tests yet" for this task): gating + transition flow only; needle-drag mechanics stay covered by TextInput's unit tests.

### Button gating

- Enabled iff at least one source has non-empty text; whitespace-only text does not count (`trim().length > 0`).
- Rationale (grilled): starting with zero content is a dead end in v0 (no way back until Feature 3's Start Over), while single-source merges are legitimate.
- The page tracks source texts in a page-local `Record<sourceId, string>` fed by each TextInput's existing `onTextChange` callback — no context, no hook file. Feature 3 (Start Over reset) and Feature 4 (third input) will reuse this state.

### Transition to Merge Mode

- `mergeStarted` is a `useState` boolean inside the page workspace; both TextInputs receive `mode={mergeStarted ? 'view' : 'input'}`.
- One-way: no back transition in v0 (Start Over is Feature 3).
- On entry: the Start Merge button hides (user decision: "Hides now, but it will show start over button in the place on next features"); the ActionsBar stays rendered as an (empty) reserved slot.
- Empty sources also flip to view mode and render their existing empty state; text is preserved (uncontrolled TextInput state survives mode flips; only typing clears snippets).

### Task 5.2 — acknowledged as delivered

- "Needles enable snippet creation; each created snippet auto-appears in the preview" is the composition of Task 1 (view-mode needles), Task 3 (context reconciliation), and Task 4 (preview rendering). Task 5 adds no snippet-path code; the spec records the verification chain.

### Terminology

- **Merge Mode** added to GLOSSARY.md ("the session state after Start Merge, where sources are read-only and snippet selection is enabled"; avoid: merge state, started state, active mode).

### Agent's Discretion

- Whitespace-only handling: `trim()`.
- No entry animations on the flip (DESIGN.md motion deferred).
- No i18n changes; no ADR (state design is trivially reversible).

---

## Specific References

- Roadmap Feature 2 Task 5.1–5.2.
- TextInput contract: `mode` prop parent-owned (Task 1); mode flip preserves text; typing clears snippets (text-input implementation.md §7 deviations).
- GLOSSARY.md: Merge Mode (added this task).
- Feature 3 roadmap: Start Over will occupy the vacated ActionsBar slot.

---

## Deferred Ideas

- Start Over button / reset flow — Feature 3.
- Toggling back to input mode — Feature 3.
- Entry animations per DESIGN.md — later polish task.
- Third source — Feature 4.
- Persistence of Merge Mode across reloads — V1.
