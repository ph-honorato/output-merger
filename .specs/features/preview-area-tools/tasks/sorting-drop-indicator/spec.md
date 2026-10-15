# Sorting Drop Indicator Specification

## Problem Statement

Task 1 (roadmap 1.1–1.5, completed and verified) made the preview segments sortable: a held pointer or a keyboard pickup drags a snippet, a floating overlay chip follows the pointer, the dragged origin dims, and the remaining snippets shift to make room. But the shift only opens a general "hole" — during an active drag nothing marks the *exact* position the dragged snippet will occupy. The user's requirement, verbatim: *"While the user is dragging the snippet, a needle should be positioned on the actual text. So the user knows where snippets will be placed."* This specification defines Feature 3, Task 1.6 (roadmap "Add user feedback while sorting"): an insertion needle rendered in the segment flow during an active drag, at the slot where the dragged snippet would land if released. It extends the completed Task 1 with new requirements — its drag lifecycle, sensors, announcements, and visuals stay exactly as shipped and tested — and it stays neutral to Task 2 (modal re-mount) and Task 3 (contentEditable migration) by deriving everything from dnd-kit's drag events and rendering a plain, inert, inline element.

## Goals

- [ ] While a drag is active (pointer or keyboard) and a hover target resolves, a needle — `data-testid="preview-drop-indicator"` — renders inside the segment flow at the insertion slot where the dragged snippet would land.
- [ ] Placement is index-based and direction-aware: after the hovered snippet when moving forward, before it when moving backward, at the origin slot when hovering the dragged snippet itself — always agreeing with `moveSnippet` semantics.
- [ ] The needle disappears on drop, on cancel (Escape), and when the active or hovered snippet vanishes mid-drag; it never renders while no drag is active or when no target resolves.
- [ ] Appearance mirrors the TextInput needle's shape language (4px × 1.5em, 2px radius) in a neutral theme color — never a snippet color, never the primary accent; non-interactive and decorative.
- [ ] The needle complements (does not replace) the existing `rectSortingStrategy` sibling shifts; the overlay chip, dimmed origin, and every Task 1 affordance are unchanged.
- [ ] Flow integrity: the needle renders no text, wraps with the flow, and does not perturb sibling layout or measured sortable rects mid-drag.
- [ ] Zero new i18n strings; the existing `sorting.*` announcements and instructions are untouched.
- [ ] Tests: a pure placement-helper unit suite plus pointer and keyboard integration tests for presence, position, hopping, lifecycle, and every edge case; all existing suites keep passing.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Replacing or removing the sibling shifts (strategy swap) | User decision 2026-10-15: the needle complements the shift; Task 1's verified "siblings shift to make room" (DRAG-20) stays as shipped |
| New or changed announcement/instruction copy | The five `sorting.*` keys already announce positions; the needle is visual-only (user decision) |
| Pointer-following indicator or DragOverlay changes | The needle marks the landing slot in the flow, not the pointer; the overlay chip stays exactly as Task 1 shipped it |
| Preview modal rendering | Task 2 — the needle inherits per-instance DndContext safety by construction |
| Editable surface, contentEditable caret, drag on/off toggle | Task 3 — ADR 0002's activation contract is untouched; the needle adds no activation semantics |
| Mid-drag snippet deletion *tooling* | Deletion happens in source editing; this task only guarantees the needle hides and the discard path stays safe |
| SnippetsContext changes | Placement is drag-local UI state; `moveSnippet` semantics are the ground truth the needle reads, never a thing it changes |
| GLOSSARY.md terms / new ADRs | "Needle" is UI mechanics (Task 1 precedent); no decision here passes the ADR triple test — all choices are reversible UI mechanics (rationale in the assumptions table) |
| Drop/settle animation for the needle | Deterministic, instant appear/disappear — consistent with Task 1's `dropAnimation={null}` decision |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here - nothing is left silently unclear. The design was settled by the user on 2026-10-15 (grilling declined); everything below the confirmed rows is an agent default adopted as instructed and recorded with rationale.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Indicator concept | While a drag is active, render a needle in the segment flow — before/between/after the snippets — at the exact slot where the dragged snippet will be placed | User requirement verbatim: "While the user is dragging the snippet, a needle should be positioned on the actual text. So the user knows where snippets will be placed." | y (user, 2026-10-15) |
| Look | TextInput-needle shape language in a neutral color — not snippet colors, not theme primary | User decision; the TextInput needle (`TextInput.styles.ts`) is the app's one existing "needle" visual: 4px wide, 1.5em tall, 2px radius | y (user, 2026-10-15) |
| When it shows/hides | Only during an active drag, pointer and keyboard alike (same `onDragOver` path); removed on drop, on cancel (Escape), and when the active snippet vanishes mid-drag | User decision | y (user, 2026-10-15) |
| Relation to existing feedback | Complements: the `rectSortingStrategy` sibling shifts stay; the needle adds the explicit "it lands HERE" marker on top | User decision (asked for the needle on top of the current feedback); also avoids reopening Task 1's verified DRAG-20 | y (user, 2026-10-15) |
| Keyboard parity | The needle appears for KeyboardSensor drags too, driven by the same `onDragOver` path as pointer drags | User decision | y (user, 2026-10-15) |
| data-testid | `preview-drop-indicator` | User default 2026-10-15; follows the `preview-*` convention; no collision exists today (verified by search) | y (user, 2026-10-15) |
| i18n / aria | Zero new strings; no aria additions — the marker is decorative and the existing `sorting.*` announcements already cover non-visual feedback | User decision; if implementation uncovers an unavoidable aria need, en-US + pt-BR are both required | y (user, 2026-10-15) |
| Edge cases to spec | Own-position hover, wrapped multi-line flows, single-snippet inert drag, empty state, Escape cancel, mid-drag deletion discard, overlay/origin interplay | User decision 2026-10-15 (list provided by the user) | y (user, 2026-10-15) |
| Placement rule | Index-based direction semantics, in slots `0..n` of the current render order: `slot = from < to ? to + 1 : to`. Moving forward → needle AFTER the hovered snippet; moving backward → BEFORE it; hovering the dragged snippet itself (including the pickup instant) → at the origin slot (between its preceding neighbor and itself) | dnd-kit reports `over` (a hovered item), never an insertion index — the user's "standard sortable semantics" made concrete. The rule reproduces `moveSnippet`'s splice landing exactly (dropping over index `to` splices the item in at `to`), so the needle can never contradict the drop outcome. Pointer-geometry-based (half-of-item) placement was rejected: it can disagree with the splice semantics | n (agent default) |
| No target (`over` is null) | The needle is hidden | The user left this open ("keep the needle at the drop-result position or hide it — pick one, document it"). Hide picked: a no-target drop is a cancel today (order unchanged, "cancelled" announcement), and a frozen needle pointing at the origin while the user is away from the flow reads as stale. The state is transient under `closestCenter` | n (agent default — documented pick of the user's open choice) |
| Neutral color token | `palette.text.secondary` — `#64748b` in the light theme (the active theme; `#94a3b8` in the dark theme), read via the theme object, never a hex literal | Candidates from the user's list: `divider` (rgba(0,0,0,0.12)) is too faint for a 4px bar on white paper; `text.disabled` is MUI-implicit and not explicitly themed in `src/theme/index.ts`; `text.secondary` is the app's canonical neutral (labels, counters, empty states) — clearly visible, explicitly defined in both themes, semantically "UI furniture" rather than content | n (agent default — flagged for a dev-server visibility check) |
| Shape | Width 4px, height 1.5em, border-radius 2px — the TextInput needle's exact dimensions | Consistency with the one needle visual the app already has; 1.5em ≈ the flow's 1.6 body line-height (DESIGN.md typography), so the bar spans the reading line | n (agent default) |
| Animation | None — the needle appears and disappears instantly | Deterministic tests and the Task 1 `dropAnimation={null}` precedent; a fade adds no information | n (agent default) |
| Text content | The needle renders no text and is `aria-hidden` | Preserves the flow's `textContent === buildMergedText(snippets)` contract even mid-drag, and cannot pollute copied text | n (agent default) |
| Layout footprint | Zero-width inline anchor recommended (the 4px bar rendered absolutely inside it), so the needle takes no flow width and cannot perturb dnd-kit's measured sortable rects or sibling transforms mid-drag; a plain 4px inline element is acceptable IF the existing pointer suite stays green with no jitter | dnd-kit re-measures droppables on collision changes (`MeasuringFrequency.Optimized` in the sortable preset); an element that changes flow width mid-drag risks rect/transform glitching | n (agent default — flagged for implementation review) |
| State & lifecycle wiring | The hook adds needle state (`dropIndicatorIndex: number \| null`): derived at drag start (origin slot — pickup resolves to the item itself), updated on every `onDragOver`, cleared on drag end and cancel; active/over indexes are resolved fresh from the live context array on every event, and any unresolved id (-1) hides the needle | Mirrors the Task 1 discard path (vanished ids → hide/discard, no crash); one source of truth for placement | n (agent default) |
| Pure helper | `computeNeedleIndex(fromIndex, overIndex)` exported from the hook file and unit-tested | Codebase precedent: `buildSortableId` is an exported pure helper with unit tests; the placement rule must be pinned by tests independent of jsdom drag simulation | n (agent default) |
| Component structure | Developer's structural call: a styled span in `PreviewArea.styles.ts` rendered inline between sortable items, or a small page sub-component with the standard 6-file split under `src/pages/MergeSession/components/` | AGENTS.md component rules are satisfied either way; the spec pins behavior, not file layout (user: "spec the behavior, not the file layout") | n (agent default) |
| Terminology | The spec and code name it DropIndicator (`preview-drop-indicator`); the user's word for it is "needle" | GLOSSARY.md defines no "Needle" term; in the codebase and roadmap "needle" already means TextInput's drag handles (`text-input-needle`, roadmap Feature 2 Tasks 1.3/1.5). The new indicator must not overload that term; the naming relationship is recorded in this spec and in context.md | n (agent default) |
| Records | No new ADR; no GLOSSARY.md changes | No decision passes the ADR triple test (all reversible UI mechanics inside ADR 0002's recorded contract); "needle / drop indicator" is UI mechanics, not domain language — the Task 1 precedent (drag/sort/overlay were not added either) applies | n (agent default) |

**Open questions:** none - all resolved or logged above (rows "Neutral color token" and "Layout footprint" are flagged for confirmation during implementation review; rows "Placement rule" and "No target" document the concrete picks made for the choices the user left open).

---

## Implicit-Requirement Dimensions

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | Needle placement resolves active/over ids against the live snippets array on every drag event; unresolved ids (-1) hide the needle; computed slots always stay within `0..n` |
| Failure / partial-failure states | Mid-drag deletion of the active or hovered snippet hides the needle without crashing; drag-end keeps the Task 1 discard path; cancel (Escape / no target) clears the needle with the order unchanged |
| Idempotency / retry / duplicate handling | The same (active, over) pair always produces the same needle slot; re-renders during a drag do not move it; repeated over events with an unchanged target are stable |
| Auth boundaries & rate limits | N/A because there is no API |
| Concurrency / ordering | Single user, single tab; snippet mutations during a drag are re-resolved on the next drag event and at drag end (fresh index resolution, as in Task 1) |
| Data lifecycle / expiry | The needle is drag-local UI state only — never persisted, never part of SnippetsContext |
| Observability | N/A because v0 has no metrics/logging requirement |
| External-dependency failure | `@dnd-kit` is bundled at build time (no runtime external calls); `onDragOver` is a local event contract |
| State-transition integrity | The needle is cleared at every drag lifecycle terminal (start resets, end clears, cancel clears); it can never outlive the drag that produced it |

---

## User Stories

### P1: Needle marks the landing position during a pointer drag ⭐ MVP

**User Story**: As a merger, I want a needle in the text flow while I drag a snippet, so that I can see exactly where the snippet will be placed before I release it.

**Why P1**: Roadmap Feature 3, Task 1.6; the user's verbatim requirement ("a needle should be positioned on the actual text. So the user knows where snippets will be placed"). The sibling shift shows a hole — only the needle pins the exact slot.

**Acceptance Criteria**:

1. WHILE a pointer drag is active and `over` resolves to a sortable item THEN the needle SHALL render inside the segment flow, carrying `data-testid="preview-drop-indicator"`.
2. WHILE no drag is active THEN the needle SHALL NOT render anywhere in the preview.
3. WHILE a drag is active and `over` resolves to no item THEN the needle SHALL NOT render — a no-target drop is a cancel today, and the needle mirrors the existing "cancelled" semantics.
4. WHEN the drag ends by drop or by cancel THEN the needle SHALL be removed in the same lifecycle step that clears the overlay chip.
5. WHILE the needle is visible THEN the DragOverlay chip SHALL keep following the pointer and the dragged origin SHALL keep its dimmed appearance — the needle adds feedback, it changes none.

**Independent Test**: With the existing fake-timer pointer harness: no drag → `queryByTestId('preview-drop-indicator')` is null; hold 50ms (drag activates) → the needle is present; move over another snippet → still present; release → removed. The overlay chip testid and the 0.4 origin opacity assert unchanged from Task 1.

---

### P1: Placement follows the drop target and direction ⭐ MVP

**User Story**: As a merger, I want the needle to sit exactly where my snippet will be inserted, so that the marker never lies about the result of the drop.

**Why P1**: dnd-kit reports the hovered item, not an insertion index; the rule must reproduce `moveSnippet`'s splice semantics or the needle contradicts the drop.

**Acceptance Criteria**:

1. WHEN the dragged snippet's index is lower than the hovered item's index (moving forward in merge order) THEN the needle SHALL render AFTER the hovered snippet in the flow.
2. WHEN the dragged snippet's index is higher than the hovered item's index (moving backward) THEN the needle SHALL render BEFORE the hovered snippet in the flow.
3. WHEN the hovered item is the dragged snippet itself — including the pickup instant and returning to the origin slot mid-drag — THEN the needle SHALL render at the dragged snippet's origin slot (between its preceding neighbor and itself).
4. WHEN the drag moves forward over the last snippet THEN the needle SHALL render after the last snippet (the trailing slot `n`).
5. WHILE the needle is visible THEN its slot SHALL be the one `moveSnippet(fromIndex, toIndex)` would produce if the drag ended now — the needle SHALL never contradict the drop outcome.
6. WHEN the hovered item changes during the drag THEN the needle SHALL move to the newly computed slot on the same `onDragOver` event (no stale position).

**Independent Test**: Unit-test the pure `computeNeedleIndex(from, to)` for every branch (forward, backward, equal, first, last); in integration, assert DOM order (`compareDocumentPosition`): dragging Alpha over Gamma in [Alpha, Beta, Gamma] puts the needle after Gamma; dragging Gamma over Beta puts it before Beta; at pickup it sits at Alpha's origin slot.

---

### P1: Keyboard drag parity ⭐ MVP

**User Story**: As a keyboard user, I want the same needle feedback while reordering with the arrow keys, so that I know where the snippet will land without a pointer.

**Why P1**: The KeyboardSensor drives the same `onDragOver` path (user decision 2026-10-15); parity keeps visual and non-visual feedback consistent.

**Acceptance Criteria**:

1. WHILE a keyboard drag is active and arrow keys move over items THEN the needle SHALL render and update through the same index/direction logic as pointer drags.
2. WHEN a keyboard drag and a pointer drag hover the same (active, over) pair THEN the rendered needle slot SHALL be identical.
3. WHEN a keyboard drag is cancelled with Escape THEN the needle SHALL be removed and the merge order SHALL remain unchanged.

**Independent Test**: userEvent keyboard: Space pickup → needle at the origin slot; ArrowRight over the next snippet → needle after it; Escape → needle removed, order unchanged; repeat the same (active, over) pair via the pointer harness and assert the same DOM position.

---

### P1: Neutral needle appearance ⭐ MVP

**User Story**: As a merger, I want the needle to look like the app's other needle marker but stay neutral, so that it reads as position feedback and never as content or a selection color.

**Why P1**: User decision 2026-10-15 — TextInput-needle look, neutral color; the preview's color vocabulary (snippet tints, primary accent) must stay reserved for content and focus.

**Acceptance Criteria**:

1. The needle SHALL mirror the TextInput needle's shape language: 4px wide, 1.5em tall, 2px border radius.
2. The needle SHALL use the theme's neutral `palette.text.secondary` color — never a snippet color, never the primary accent.
3. The needle SHALL be non-interactive and decorative: no cursor affordance, no pointer listeners, `aria-hidden`, not focusable, and never registered as a sortable/droppable item.
4. The needle SHALL appear and disappear instantly — no entry, exit, or idle animation.

**Independent Test**: Style assertions on the rendered needle (width 4px, height 1.5em, border-radius 2px, background-color equal to the theme's `text.secondary` in generated CSS/inline styles); assert `aria-hidden`, the absence of sortable semantics (role/tabIndex/aria-roledescription), and that no needle id ever enters the `SortableContext` items.

---

### P1: Flow integrity and lifecycle safety ⭐ MVP

**User Story**: As a merger, I want the needle to never disturb the text flow or the drag machinery, so that adding it is an invisible upgrade until I need it.

**Why P1**: Task 1 pinned hard invariants (textContent parity, wrapping, per-instance wiring, discard paths); the needle must preserve every one of them.

**Acceptance Criteria**:

1. WHILE the needle is visible THEN the segment flow's textContent SHALL still equal `buildMergedText(snippets)` — the needle renders no text.
2. WHEN the insertion slot falls on a line-wrap boundary THEN the needle SHALL render on the line the flow's inline wrapping assigns it (it participates in the flow as an inline element; it is not coordinate-positioned against the container).
3. WHILE the needle appears, moves, or disappears THEN sibling chips SHALL NOT visibly jump and the needle SHALL NOT perturb dnd-kit's measured sortable rects or transforms mid-drag.
4. IF the dragged snippet or the hovered snippet vanishes mid-drag (deleted or resized elsewhere) THEN the needle SHALL hide without crashing and the drag-end discard path SHALL behave exactly as in Task 1.
5. IF exactly one snippet exists and it is dragged (inert) THEN the needle SHALL render at its origin slot only — never a misleading other position.
6. WHILE the preview is empty THEN no drag wiring mounts and the needle SHALL never render.
7. The feature SHALL ship with zero new i18n keys and no changes to the existing sorting announcement or instruction copy in either language.

**Independent Test**: textContent parity asserted mid-drag; a wrapped-flow render asserts the needle is an inline element of the SegmentFlow; mid-drag context removal hides the needle with no error; a single-snippet drag keeps the needle at the origin slot; the empty state asserts no needle (and the existing no-live-region assertion keeps passing); the i18n resources assert the `sorting.*` keys are unchanged.

---

## Edge Cases

- IF the drag activates (pickup) THEN the collision resolves to the dragged item itself: the needle appears at the origin slot, between the snippet's preceding neighbor and the dimmed origin chip — an immediate drop is a no-op and the marker is honest about it.
- IF the user hovers the dragged snippet's own slot again mid-drag THEN the needle returns to the origin slot (`over === active`).
- IF the pointer moves forward past the last snippet THEN the needle renders after the last snippet — the trailing slot `n`.
- IF `over` resolves to nothing (pointer outside all droppable rects; transient under `closestCenter`) THEN the needle hides: a no-target drop is a cancel today ("Snippet reorder cancelled."), and a marker left pointing at the origin would be stale.
- IF the flow wraps across lines and the insertion slot falls at a wrap boundary THEN the needle renders inline at the end of the earlier line — normal inline behavior, no coordinate computation against the container.
- IF exactly one snippet is dragged THEN the drag is inert and the needle can only ever sit at its origin slot.
- IF the preview is empty THEN no DndContext mounts and the needle cannot render.
- IF Escape is pressed during an active drag (pointer or keyboard) THEN the needle is removed together with the overlay chip and the order is unchanged.
- IF a snippet is deleted or resized while a drag is active THEN the needle hides; drag end resolves indexes fresh and discards the reorder as in Task 1 — no crash.
- IF the language is switched mid-drag THEN nothing changes for the needle (visual-only, no strings); announcements keep following the active language as today.
- IF two PreviewArea instances ever render simultaneously (Task 2 modal) THEN each instance's DndContext drives its own needle — no shared state, no cross-instance marker.
- IF the needle element is present THEN it takes zero flow width (recommended) so dnd-kit's measured rects and the `rectSortingStrategy` transforms are untouched mid-drag; IF the implementation instead gives it flow width THEN the existing pointer suite must stay green with no visible sibling jump (flagged assumption).

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| DROP-01 | Needle marks the landing position during a pointer drag | Specify | Pending |
| DROP-02 | Needle marks the landing position during a pointer drag | Specify | Pending |
| DROP-03 | Needle marks the landing position during a pointer drag | Specify | Pending |
| DROP-04 | Needle marks the landing position during a pointer drag | Specify | Pending |
| DROP-05 | Needle marks the landing position during a pointer drag | Specify | Pending |
| DROP-06 | Placement follows the drop target and direction | Specify | Pending |
| DROP-07 | Placement follows the drop target and direction | Specify | Pending |
| DROP-08 | Placement follows the drop target and direction | Specify | Pending |
| DROP-09 | Placement follows the drop target and direction | Specify | Pending |
| DROP-10 | Placement follows the drop target and direction | Specify | Pending |
| DROP-11 | Placement follows the drop target and direction | Specify | Pending |
| DROP-12 | Keyboard drag parity | Specify | Pending |
| DROP-13 | Keyboard drag parity | Specify | Pending |
| DROP-14 | Keyboard drag parity | Specify | Pending |
| DROP-15 | Neutral needle appearance | Specify | Pending |
| DROP-16 | Neutral needle appearance | Specify | Pending |
| DROP-17 | Neutral needle appearance | Specify | Pending |
| DROP-18 | Neutral needle appearance | Specify | Pending |
| DROP-19 | Flow integrity and lifecycle safety | Specify | Pending |
| DROP-20 | Flow integrity and lifecycle safety | Specify | Pending |
| DROP-21 | Flow integrity and lifecycle safety | Specify | Pending |
| DROP-22 | Flow integrity and lifecycle safety | Specify | Pending |
| DROP-23 | Flow integrity and lifecycle safety | Specify | Pending |
| DROP-24 | Flow integrity and lifecycle safety | Specify | Pending |
| DROP-25 | Flow integrity and lifecycle safety | Specify | Pending |

**ID format:** `DROP-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified; additionally **Deviated** (implemented with a changed contract — see `implementation.md`) and **Deferred** (not implemented — see `implementation.md`).

**Coverage:** 25 total. 0 Verified, 0 Deviated, 0 Deferred. Roadmap mapping: Task 1.6 ("Add user feedback while sorting") → all 25 requirements (DROP-01–05 presence/lifecycle; DROP-06–11 placement rule; DROP-12–14 keyboard parity; DROP-15–18 appearance; DROP-19–25 integrity and edge cases). Parent relation: extends Task 1's drag-visual feedback family (DRAG-19/DRAG-20 in `.specs/features/preview-area-tools/tasks/sort-snippets-by-dragging/spec.md`) with new requirements — no DRAG requirement is reopened or amended. Per-requirement outcomes: `.specs/features/preview-area-tools/tasks/sorting-drop-indicator/implementation.md` (to be created by the developer sub-agent).

---

## Success Criteria

How we know the feature is successful:

- [ ] Holding a snippet shows the needle at its origin slot; dragging over another snippet moves the needle to the exact landing slot — after the hovered snippet when moving forward, before it when moving backward — and it hops along as the hover changes.
- [ ] The needle never contradicts a drop: releasing while it is visible produces exactly the order it marked; Escape or release-with-no-target clears it with the order unchanged.
- [ ] Keyboard drags show the identical needle behavior through the same `onDragOver` path.
- [ ] The needle is a thin neutral bar (TextInput-needle shape, theme `text.secondary`) that wraps with the text, renders no text, and leaves the sibling shifts, overlay chip, dimmed origin, and announcements exactly as Task 1 shipped them.
- [ ] Single-snippet, empty-state, and mid-drag-deletion paths are safe: the needle hides or stays at the origin slot, nothing crashes, no misleading position is ever shown.
- [ ] `npx vitest run`, `npm run lint`, and `npx tsc -b` all pass, with the new helper-unit and pointer/keyboard integration suites green and every existing suite passing unchanged.
