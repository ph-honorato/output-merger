# Sort Snippets by Dragging Specification

## Problem Statement

The MergeSession preview (Feature 2 Task 4) renders the merge-ordered snippets as a read-only colored flow, and the copy tool serializes them — but the order itself is frozen at selection time. GLOSSARY.md defines **Merge Order** as "editable in the preview", and the v0 epic promises that "users can drag previously highlighted text snippets"; nothing implements it. This specification defines Feature 3 Task 1 (roadmap 1.1–1.5): installing `@dnd-kit`, adding reorder support to SnippetsContext (`MOVE_SNIPPET` reducer action + `moveSnippet` API), configuring a hold-to-drag PointerSensor plus a KeyboardSensor, and making the preview segments sortable with full drag feedback. Two future constraints shape the design: the same PreviewArea will be re-mounted inside a modal (Task 2), and its surface will become contentEditable (Task 3) — so plain clicks must never start drags (they will place the caret later), and the wiring must not assume read-only DOM. The interaction contract is recorded in ADR 0002; the state-model consequence in an amendment to ADR 0001.

## Goals

- [ ] `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` are installed at the verified-compatible versions and compile against React 19.
- [ ] SnippetsContext gains a `MOVE_SNIPPET` reducer action and a `moveSnippet(fromIndex, toIndex)` API (0-based, global merge sequence) with no-op guards and dense renumbering.
- [ ] Sensors: PointerSensor with `activationConstraint: { delay: 200, tolerance: 5 }` (hold-to-drag; plain click never drags) and KeyboardSensor with the default bindings.
- [ ] PreviewArea segments are sortable (DndContext + SortableContext + DragOverlay), drag-end wired to `moveSnippet`; space separators, the empty state, and existing data-testids keep working.
- [ ] Drag affordances: `grab`/`grabbing` cursors, color-matched hover outline, dimmed origin with a floating overlay chip, theme focus ring, `user-select`/`touch-action` guards.
- [ ] Screen-reader announcement and instruction strings exist in en-US and pt-BR under `pages.mergeSession.previewArea.sorting.*`.
- [ ] The tutorial is restructured to six steps (both languages) so the hold-drag is discoverable; banner/page step-count assertions update 4 → 6.
- [ ] Tests: reducer MOVE units, provider `moveSnippet`, keyboard sorting, a fake-timer pointer hold-drag, and a click-never-drags contract test; existing suites keep passing.
- [ ] ADR 0002 is recorded and ADR 0001's Consequences carry the sanctioned-renumbering sentence.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Preview modal ("bigger view") rendering | Task 2 — Task 1 only keeps the wiring re-mount-safe (per-instance DndContext) |
| Editable preview, contentEditable caret semantics, drag on/off toggle | Task 3 — ADR 0002 records the click-vs-hold contract Task 3 must honor |
| Document-model migration (own-text tokens, line breaks, splits) | Task 3.1 — `moveSnippet` deliberately stays simple and index-based |
| Split-snippet / line-break / add-own-text tools | Other Feature 3 tasks |
| Undo/redo of reorders | No undo system exists in v0 |
| Multi-select / multi-item drag | Out of scope for v0 |
| Dragging across preview instances (inline ↔ modal) | Each instance sorts its own copy; no cross-instance dragging |
| Persistence of merge order | V1 (Merges CRUD); v0 order lives in memory |
| Separate TouchSensor/MouseSensor pair | PointerSensor covers mouse, touch, and pen via pointer events |
| New GLOSSARY.md terms | User decision: "Merge Order" already covers the concept; drag/sort/overlay are UI mechanics, not domain language |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here - nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Library & versions | `@dnd-kit/core` 6.3.1 + `@dnd-kit/sortable` 10.0.0 + `@dnd-kit/utilities` 3.2.2 | Settled pre-session: dnd-kit's PointerSensor activation constraints natively express hold-to-drag (@hello-pangea/dnd cannot); peer ranges verified against React 19.2.8 (core: react ≥16.8; sortable: core ^6.3.0) | y (settled; compatibility verified by agent) |
| Activation contract | PointerSensor `activationConstraint: { delay: 200, tolerance: 5 }`; no distance constraint (dnd-kit's delay and distance constraints are mutually exclusive — verified) | Press-and-hold feel between mouse (150–250ms) and touch (500ms) conventions; tolerance forgives a shaky hold; a plain click must never drag (Task 3 caret) | y (grilled) |
| Reorder state model | `MOVE_SNIPPET`: splice fromIndex→toIndex, then renumber the whole sequence dense 1..n; `moveSnippet(fromIndex, toIndex)` on the context, 0-based, global sequence | Arbitrary moves are inexpressible by touching only the moved item's integer order (ADR 0001's gaps); dense renumber is always correct; ADR 0001 amended to sanction it | y (grilled) |
| Activation window | Sortable wiring renders whenever ≥1 snippet exists; no merge-mode gate; empty-state branch untouched | Snippets only exist in Merge Mode today (needles create them in view mode), so a gate adds coupling without behavior | y (grilled) |
| Single snippet | Stays draggable-but-inert (same affordance, drag has no effect) | Zero special-case code; uniform affordance | y (grilled) |
| Drag visuals | DragOverlay floating chip (snippet tint, elevated shadow) + dimmed original (~0.4 opacity); no axis restriction; no placeholder | In-place transforms glitch on wrapped inline text; the flow wraps lines so vertical movement is required; shifting siblings are the placeholder in a text flow | y (grilled) |
| Chip affordance | Cursor `grab`/`grabbing`; hover = 1px outline in the snippet's own color; `user-select: none` + `touch-action: none`; theme focus ring | Deliberate deviation from DESIGN.md's generic scale(1.03) hover (scaling inline chips distorts the reading line); guards against native selection/scroll during the hold | y (grilled) |
| Screen-reader announcements | Positions-only ("{{index}} of {{count}}"); five flat keys under `pages.mergeSession.previewArea.sorting.*`; draft copy approved during grilling | Snippet text can be long/noisy; the item's accessible name is its text already; matches the existing flat-key convention | y (grilled) |
| Tutorial | Restructured to six steps (step 4 split; new reorder step; new copy step); banner + page step-count assertions 4 → 6 | Hold-to-drag is undiscoverable by inspection; reorder is a core v0 capability | y (grilled) |
| Records | ADR 0002 (hold-to-drag contract) + ADR 0001 Consequences amendment (sole sanctioned renumbering writer); no GLOSSARY changes | The contract is hard to reverse (Task 3 depends on it), surprising (future readers may "fix" the delay away), and a real trade-off — ADR triple test passes | y (grilled) |
| Testing | Reducer MOVE units + provider `moveSnippet` + keyboard sorting + one fake-timer pointer hold-drag + click-never-drags contract test; existing suites keep passing (except deliberate tutorial count updates) | Roadmap 1.5; the activation contract is testable with fake timers | y (grilled) |
| Sortable item ids | Composite `sourceId:id` | The reducer tolerates id collisions across sources (unit-tested), so bare ids cannot key sortable items | n (agent default — forced by reducer contract) |
| Testid continuity | `preview-snippet` stays on the sortable element; `preview-area`, `preview-segment-flow`, `preview-empty`, `preview-toolbar`, `preview-copy-button` unchanged; new `preview-snippet-overlay` on the overlay chip | Existing PreviewArea/page suites keep passing unchanged | n (agent default) |
| Drag context placement | DndContext + sensors + overlay owned by each PreviewArea instance (never global) | Task 2 renders a second instance in a modal — instances must sort independently | n (agent default — Task 2 survival constraint settled pre-session) |
| dnd-kit configuration | `closestCenter` collision detection; `rectSortingStrategy` | dnd-kit sortable defaults for mixed/wrapped layouts; `horizontalListSortingStrategy` assumes one row | n (agent default) |
| Keyboard bindings | KeyboardSensor defaults: Space/Enter pick up and drop, arrow keys move, Escape cancels | dnd-kit defaults; the approved instructions copy documents exactly these bindings | n (agent default) |
| Item semantics | Segments get dnd-kit's default button semantics (role, tabIndex 0, instruction linkage via aria-describedby); the exact attribute set is verified against `@dnd-kit/sortable` 10.0.0 during implementation | The spec requires focusability + instruction linkage, not specific attribute internals | n (agent default — flagged) |
| Component ownership | New `SortableSegment` page sub-component under `src/pages/MergeSession/components/` with the standard 6-file split, exported via the page components barrel; PreviewArea keeps DndContext/SortableContext/overlay + drag-end wiring in its own files | AGENTS.md component rules + Task 4 precedent (page-owned pieces) | n (agent default) |
| No-op guards | `MOVE_SNIPPET` no-ops on `fromIndex === toIndex`, out-of-bounds indexes, or a dragged id deleted mid-drag (reorder discarded) | State safety for programmatic and race-y paths | n (agent default) |
| Sensor constant | One named constant holds `{ delay: 200, tolerance: 5 }` so tuning is a one-line change | Feel values must be findable in one place | n (agent default) |
| Interpolation base | Announcement positions are 1-based | Human counting for screen readers | n (agent default) |
| Overlay chip styling | Snippet tint at 0.3 alpha (matches segments), shadow lift per DESIGN.md depth, wraps long/multi-line text (`white-space: pre-wrap`) | DESIGN.md elevation language; no layout stretch | n (agent default) |
| Pointer drag in jsdom | Fake timers + mocked `getBoundingClientRect` drive the PointerSensor hold-drag test; IF the simulation proves unreliable THEN the click-never-drags + reducer + keyboard suites remain the automated contract and the full pointer path is verified manually in the dev server | jsdom does not compute layout; dnd-kit's rect-based collision needs mocked rects | n (agent default — flagged) |

**Open questions:** none - all resolved or logged above (rows "Item semantics" and "Pointer drag in jsdom" are flagged for confirmation during implementation review).

---

## Implicit-Requirement Dimensions

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | `moveSnippet` no-ops on equal or out-of-bounds indexes; composite sortable ids stay unique despite tolerated cross-source id collisions; reducer guards vanished ids |
| Failure / partial-failure states | Mid-drag snippet deletion (source resize/remove elsewhere) discards the reorder without crashing; cancellation (Escape, release with no target) never dispatches `MOVE_SNIPPET` |
| Idempotency / retry / duplicate handling | Same-index moves are content-identical no-ops; repeating a completed move reproduces the same dense 1..n sequence |
| Auth boundaries & rate limits | N/A because there is no API |
| Concurrency / ordering | Single user, single tab; `SET_SOURCE_SNIPPETS` and `MOVE_SNIPPET` interleave safely because both end in a consistently order-sorted state; id-based reconciliation keeps resizes at their (possibly renumbered) order |
| Data lifecycle / expiry | Merge order lives in SnippetsContext memory; V1 persistence out of scope |
| Observability | N/A because V0 has no metrics/logging requirement |
| External-dependency failure | `@dnd-kit` is bundled at build time (no runtime external calls); dnd-kit sensor cancellation paths never dispatch `MOVE_SNIPPET` |
| State-transition integrity | The state array is always sorted by `order`; `MOVE_SNIPPET` is the sole renumbering writer (ADR 0001 amendment); array position equals merge rank |

---

## User Stories

### P1: Pointer hold-and-drag reordering ⭐ MVP

**User Story**: As a merger, I want to press-and-hold a snippet in the preview and drag it to a new spot, so that I control the order of the merged text.

**Why P1**: Roadmap Feature 3 Task 1 (1.3/1.4); the v0 epic promises dragging snippets, and Merge Order is defined as editable in the preview.

**Acceptance Criteria**:

1. WHILE the preview contains one or more snippets THEN every snippet segment SHALL be registered as a sortable item (DndContext + SortableContext) keyed by its composite id `sourceId:id`.
2. WHEN a pointer press on a segment ends before 200ms elapse, or moves more than 5px before the delay elapses THEN NO drag SHALL start: no reorder and no drag visuals — the press falls through as a click.
3. WHEN a pointer press is held for 200ms while moving at most 5px THEN the drag SHALL activate: the `grabbing` cursor applies and the drag overlay becomes visible.
4. WHEN an activated drag is released over a different snippet's position THEN PreviewArea SHALL call `moveSnippet(fromIndex, toIndex)` (0-based indexes into the merge-ordered list) and the merge order SHALL change accordingly.
5. WHEN an activated drag is cancelled (Escape, release over no sortable target, or release on the item's own position) THEN the merge order SHALL remain unchanged.

**Independent Test**: In jsdom with fake timers and mocked item rects: pointerDown on segment A + advance 150ms + pointerUp ⇒ order unchanged (click never drags); pointerDown + advance 200ms + move over B + pointerUp ⇒ `moveSnippet` dispatched and the rendered order flips; Escape or release with no target ⇒ order unchanged.

---

### P1: Reorder support in SnippetsContext ⭐ MVP

**User Story**: As a merger, I want the snippet order in context to update when I drop a drag, so that the preview and the copied text reflect my new order.

**Why P1**: Roadmap 1.2; every consumer (preview rendering, copy tool) derives from context state, so reorder must live there.

**Acceptance Criteria**:

1. WHEN the reducer receives `MOVE_SNIPPET` with two valid, distinct indexes THEN it SHALL splice the state array at `fromIndex`, reinsert at `toIndex`, and renumber the whole sequence to a dense 1..n, returning an array sorted by `order`.
2. IF `fromIndex` equals `toIndex`, either index is out of bounds, or the referenced snippet no longer exists THEN the reducer SHALL leave the state content-identical.
3. `useSnippets` SHALL expose `moveSnippet(fromIndex, toIndex)` dispatching `MOVE_SNIPPET`, with a stable function reference across re-renders.
4. WHEN a snippet moves THEN it SHALL move within the global merge sequence across sources (a text-1 snippet may pass a text-2 snippet); only `order` changes, `sourceId` never does.
5. WHEN the order changes THEN PreviewArea rendering and `buildMergedText`/copy SHALL reflect the new order without extra wiring.

**Independent Test**: Reducer unit tests (move within and across sources, dense renumbering, all no-op guards) plus renderHook provider tests (dispatch behavior, stable reference).

---

### P1: Keyboard reordering ⭐ MVP

**User Story**: As a keyboard user, I want to reorder snippets without a pointer, so that sorting the merge order is accessible.

**Why P1**: Roadmap 1.3; the KeyboardSensor is an explicit accessibility requirement.

**Acceptance Criteria**:

1. WHILE one or more snippets exist THEN every segment SHALL be keyboard-focusable with dnd-kit's default button semantics and instruction linkage (`aria-describedby`).
2. WHEN a focused segment receives Space/Enter THEN the item SHALL be picked up for dragging and the drag-start announcement SHALL fire.
3. WHILE an item is picked up THEN arrow keys SHALL move it within the sequence, Space/Enter SHALL drop it (invoking `moveSnippet` when the position changed), and Escape SHALL cancel with the order unchanged.
4. WHEN a keyboard drag completes at a new position THEN the resulting order SHALL be identical to the equivalent pointer drag, through the same `moveSnippet` path.

**Independent Test**: userEvent keyboard: Tab to a segment, Space, ArrowRight/ArrowLeft, Space ⇒ rendered order changes; Escape mid-drag ⇒ order unchanged.

---

### P1: Screen-reader announcements ⭐ MVP

**User Story**: As a screen-reader user, I want spoken feedback while reordering, so that I know what I picked up, where I am, and where I dropped.

**Why P1**: Sorting without announcements is unusable non-visually; the i18n rule requires both languages.

**Acceptance Criteria**:

1. DndContext SHALL provide announcements for drag start/over/end/cancel built from the keys `pages.mergeSession.previewArea.sorting.started/over/ended/cancelled`, interpolated with the 1-based position and the total count, for pointer and keyboard drags alike.
2. DndContext SHALL provide screen-reader instructions from `pages.mergeSession.previewArea.sorting.instructions`, linked to every sortable item via dnd-kit's `aria-describedby` mechanism.
3. All sorting keys SHALL exist in both `en-US.json` and `pt-BR.json`, and WHEN the active language changes THEN announcement and instruction strings SHALL follow it.
4. Announcements SHALL be position-only; snippet text SHALL NOT be included in announcement strings.

**Independent Test**: Assert the five keys exist in both resource files; during a keyboard drag, the live region exposes the interpolated strings in the active language.

---

### Draft Sorting Announcement Copy (i18n)

Keys under `pages.mergeSession.previewArea.sorting` (copy approved during grilling, 2026-10-14):

| Key | en-US | pt-BR |
| --- | ----- | ----- |
| `instructions` | To pick up a snippet, press Space or Enter. While dragging, use the arrow keys to move it. Press Space or Enter again to drop it, or Escape to cancel. | Para pegar um trecho, pressione Espaço ou Enter. Enquanto arrasta, use as setas para movê-lo. Pressione Espaço ou Enter novamente para soltá-lo, ou Escape para cancelar. |
| `started` | Picked up snippet {{index}} of {{count}}. | Trecho {{index}} de {{count}} pego. |
| `over` | Snippet is now over position {{index}} of {{count}}. | O trecho agora está sobre a posição {{index}} de {{count}}. |
| `ended` | Snippet dropped at position {{index}} of {{count}}. | Trecho solto na posição {{index}} de {{count}}. |
| `cancelled` | Snippet reorder cancelled. | Reordenação do trecho cancelada. |

---

### P1: Drag visual feedback and affordance ⭐ MVP

**User Story**: As a merger, I want clear drag feedback, so that I always know what I am moving and where it will land.

**Why P1**: Roadmap 1.4; hold-to-drag has no discoverability without affordance cues.

**Acceptance Criteria**:

1. WHILE a drag is active THEN a DragOverlay chip SHALL render the dragged snippet in its own tint (color at 0.3 alpha) with an elevated shadow and `data-testid="preview-snippet-overlay"`, following the pointer.
2. WHILE a drag is active THEN the in-place dragged segment SHALL dim to ~0.4 opacity and the remaining segments SHALL shift to make room.
3. WHILE idle over a segment THEN the cursor SHALL be `grab` and hover SHALL show a 1px outline in the snippet's own color; WHILE dragging the cursor SHALL be `grabbing`. (Deliberate deviation from DESIGN.md's scale(1.03) hover — recorded in the context file.)
4. Segments SHALL set `user-select: none` and `touch-action: none` so press-and-hold never starts native text selection or scroll hijack.
5. WHEN a segment receives keyboard focus THEN a visible theme focus ring SHALL render.

**Independent Test**: Style assertions on segments (cursor, user-select, touch-action); during a fake-timer drag, the overlay testid is present and the dragged segment has reduced opacity.

---

### P1: Flow semantics and forward-compatible wiring ⭐ MVP

**User Story**: As a merger, I want reordering to leave the preview's reading flow, empty state, and existing behavior intact, so that sorting is an invisible upgrade until I use it.

**Why P1**: Roadmap 1.4 explicitly demands keeping space separators and the empty state working; Tasks 2/3 demand re-mount-safe, DOM-agnostic wiring.

**Acceptance Criteria**:

1. Space separators SHALL remain outside the sortable item wrappers; the segment flow's textContent SHALL keep equaling `buildMergedText(snippets)` in any order.
2. WHILE the preview is empty THEN the empty state SHALL render exactly as today (testids `preview-area`/`preview-empty` preserved) and no drag wiring SHALL mount.
3. IF exactly one snippet exists THEN its segment SHALL render with the same sortable affordances and any drag SHALL be inert (no reorder, no crash).
4. Each PreviewArea instance SHALL own its DndContext, sensors, and overlay (no global drag state), so a future second instance (Task 2 modal) sorts independently and dragging between instances SHALL NOT occur.
5. The sortable wiring SHALL NOT assume read-only DOM: attributes, listeners, and refs SHALL be applied via dnd-kit's APIs with content rendered as children, so Task 3 can make the same surface contentEditable without changing the activation model.
6. Data-testids `preview-area`, `preview-segment-flow`, and `preview-snippet` (on the sortable element) SHALL be preserved so existing suites keep passing.

**Independent Test**: The existing PreviewArea suite (textContent parity, tint, layout, empty state) passes unchanged; a single-snippet drag attempt leaves order and DOM intact.

---

### P1: Tutorial teaches reordering ⭐ MVP

**User Story**: As a first-time merger, I want the tutorial to tell me snippets can be reordered by holding and dragging, so that I discover the interaction without trial and error.

**Why P1**: User decision extending the Feature 2 Task 6 tutorial: hold-to-drag is undiscoverable by inspection, and reorder is a core v0 capability.

**Acceptance Criteria**:

1. The tutorial banner SHALL render six ordered steps: steps 1–3 unchanged; step 4 "Your snippets appear in the preview."; step 5 "Hold and drag a snippet in the preview to change its order."; step 6 "Copy the merged text when you are done."
2. The restructured tutorial keys SHALL exist in both en-US and pt-BR resources with the approved copy.
3. TutorialBanner SHALL render the two new steps (the component's step list grows to six), and the banner and page suites' step-count assertions SHALL be updated from 4 to 6.
4. WHEN the active language changes THEN all six steps SHALL render in that language.

**Independent Test**: The banner renders 6 `<li>` with the new copy in en-US; switching to pt-BR renders the Portuguese copy; the page tutorial lifecycle test passes with the updated count.

---

### Draft Tutorial Copy (i18n)

Keys under `pages.mergeSession.tutorial` (steps 1–3 unchanged; step 4 modified; steps 5–6 new — approved during grilling, 2026-10-14):

| Key | en-US | pt-BR |
| --- | ----- | ----- |
| `step1` (unchanged) | Type or paste your texts into the input fields. | Digite ou cole seus textos nos campos de entrada. |
| `step2` (unchanged) | Click "Start Merge" to lock your texts and start selecting. | Clique em "Iniciar Merge" para travar seus textos e começar a seleção. |
| `step3` (unchanged) | Drag the handles that appear over the text to highlight the parts you want. | Arraste os marcadores que aparecem sobre o texto para destacar as partes desejadas. |
| `step4` (modified) | Your snippets appear in the preview. | Seus trechos aparecem na prévia. |
| `step5` (new) | Hold and drag a snippet in the preview to change its order. | Segure e arraste um trecho na prévia para mudar sua ordem. |
| `step6` (new) | Copy the merged text when you are done. | Copie o texto mesclado quando terminar. |

---

## Edge Cases

- IF a pointer press is released before 200ms THEN no drag starts; today nothing happens on the read-only segments, and in Task 3 the same click will place the caret — this is the contract this feature protects.
- IF the pointer moves more than 5px during the hold THEN activation is cancelled and the gesture falls through to click/scroll.
- IF the user drag-ends outside any sortable target (empty preview space, outside the flow) THEN the order is unchanged.
- IF the user presses Escape during an active drag THEN the drag is cancelled, the order is unchanged, and the cancelled announcement fires.
- IF a snippet is deleted or resized in a source while a drag is active THEN the reorder at drag end is discarded (no crash); state stays consistent.
- IF two snippets share the same id across sources THEN composite sortable ids keep them distinct; reordering resolves indexes against the context array, never bare ids.
- IF the dragged snippet text is long or multi-line THEN the overlay chip wraps it (`white-space: pre-wrap`) without stretching the preview layout.
- IF the user long-presses on touch THEN the same hold-to-drag contract applies; `user-select: none` and `touch-action: none` (and, where supported, `-webkit-touch-callout: none`) suppress native selection, callout, and scroll.
- IF the language is switched mid-session THEN announcement, instruction, and tutorial strings all follow the active language (i18n is orthogonal to drag state).
- IF two PreviewArea instances ever render simultaneously (Task 2 modal) THEN each instance drags within its own copy only.
- IF a segment gains keyboard focus THEN it is an additional tab stop in flow order with a visible focus ring.

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| DRAG-01 | Pointer hold-and-drag reordering | Specify | Pending |
| DRAG-02 | Pointer hold-and-drag reordering | Specify | Pending |
| DRAG-03 | Pointer hold-and-drag reordering | Specify | Pending |
| DRAG-04 | Pointer hold-and-drag reordering | Specify | Pending |
| DRAG-05 | Pointer hold-and-drag reordering | Specify | Pending |
| DRAG-06 | Reorder support in SnippetsContext | Specify | Pending |
| DRAG-07 | Reorder support in SnippetsContext | Specify | Pending |
| DRAG-08 | Reorder support in SnippetsContext | Specify | Pending |
| DRAG-09 | Reorder support in SnippetsContext | Specify | Pending |
| DRAG-10 | Reorder support in SnippetsContext | Specify | Pending |
| DRAG-11 | Keyboard reordering | Specify | Pending |
| DRAG-12 | Keyboard reordering | Specify | Pending |
| DRAG-13 | Keyboard reordering | Specify | Pending |
| DRAG-14 | Keyboard reordering | Specify | Pending |
| DRAG-15 | Screen-reader announcements | Specify | Pending |
| DRAG-16 | Screen-reader announcements | Specify | Pending |
| DRAG-17 | Screen-reader announcements | Specify | Pending |
| DRAG-18 | Screen-reader announcements | Specify | Pending |
| DRAG-19 | Drag visual feedback and affordance | Specify | Pending |
| DRAG-20 | Drag visual feedback and affordance | Specify | Pending |
| DRAG-21 | Drag visual feedback and affordance | Specify | Pending |
| DRAG-22 | Drag visual feedback and affordance | Specify | Pending |
| DRAG-23 | Drag visual feedback and affordance | Specify | Pending |
| DRAG-24 | Flow semantics and forward-compatible wiring | Specify | Pending |
| DRAG-25 | Flow semantics and forward-compatible wiring | Specify | Pending |
| DRAG-26 | Flow semantics and forward-compatible wiring | Specify | Pending |
| DRAG-27 | Flow semantics and forward-compatible wiring | Specify | Pending |
| DRAG-28 | Flow semantics and forward-compatible wiring | Specify | Pending |
| DRAG-29 | Flow semantics and forward-compatible wiring | Specify | Pending |
| DRAG-30 | Tutorial teaches reordering | Specify | Pending |
| DRAG-31 | Tutorial teaches reordering | Specify | Pending |
| DRAG-32 | Tutorial teaches reordering | Specify | Pending |
| DRAG-33 | Tutorial teaches reordering | Specify | Pending |

**ID format:** `DRAG-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified; additionally **Deviated** (implemented with a changed contract — see `implementation.md`) and **Deferred** (not implemented — see `implementation.md`).

**Coverage:** 33 total. 0 Verified, 0 Deviated, 0 Deferred. Roadmap mapping: 1.1 → dependency setup (no standalone requirement — verified via `tsc`/`vitest`; versions in Assumptions); 1.2 → DRAG-06–10; 1.3 → DRAG-02–05 (pointer contract) + DRAG-11–14 (keyboard); 1.4 → DRAG-01, DRAG-19–29; 1.5 → every story's Independent Test (reducer, provider, and component suites); tutorial restructure → DRAG-30–33 (user decision beyond the roadmap lines). Per-requirement outcomes: `.specs/features/preview-area-tools/tasks/sort-snippets-by-dragging/implementation.md` (to be created by the developer sub-agent).

---

## Success Criteria

How we know the feature is successful:

- [ ] Holding a snippet ~200ms shows the `grabbing` cursor and the floating overlay chip; siblings shift; dropping over another snippet reorders the flow, and the copy button outputs the new order.
- [ ] A quick click, and a hold that wiggles more than 5px, never start a drag.
- [ ] Keyboard: Tab → Space → arrows → Space reorders; Escape cancels; focus rings are visible on every segment.
- [ ] The screen-reader live region announces start/over/end/cancel in the active language (en-US and pt-BR both ship).
- [ ] Empty state and single-snippet behavior are unchanged; space separators are intact; the flow's textContent still equals `buildMergedText`.
- [ ] The tutorial shows the six steps in both languages.
- [ ] `npx vitest run`, `npm run lint`, and `npx tsc -b` all pass, with the new reducer/provider/component suites green and existing PreviewArea/page suites passing (only the deliberate tutorial step-count updates 4 → 6).
