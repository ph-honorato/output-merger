# Sort Snippets by Dragging (Feature 3, Task 1)

**Gathered:** 2026-10-14
**Spec:** `.specs/features/preview-area-tools/tasks/sort-snippets-by-dragging/spec.md`
**Status:** Specified — awaiting implementation

---

## Feature Boundary

Drag-based reordering of preview snippets for Feature 3 Task 1 (roadmap 1.1–1.5) only: installing `@dnd-kit` (core + sortable + utilities), adding reorder support to SnippetsContext (`MOVE_SNIPPET` action + `moveSnippet(fromIndex, toIndex)` API), configuring a hold-to-drag PointerSensor plus a KeyboardSensor, making the PreviewArea segments sortable with DragOverlay feedback and full affordance styling, shipping screen-reader announcements in en-US/pt-BR, restructuring the tutorial to teach reordering, and the ADR records (0002 created; 0001 amended). Not the preview modal (Task 2), not the editable surface or drag on/off toggle (Task 3), not the document-model migration (Task 3.1), not split/line-break/own-text tools, not undo, not persistence.

---

## Implementation Decisions

### Scope and delivery

- One grilling round (9 answers); every recommendation accepted, no overrides.
- All wiring targets the current inline read-only PreviewArea, but must survive Task 2's modal re-mount and Task 3's contentEditable migration (constraints settled before this session: plain click never drags; no read-only-DOM assumptions).

### Library (1.1)

- `@dnd-kit/core` 6.3.1 + `@dnd-kit/sortable` 10.0.0 + `@dnd-kit/utilities` 3.2.2 — settled pre-session (dnd-kit's PointerSensor activation constraints natively express hold-to-drag; `@hello-pangea/dnd` cannot). Peer compatibility with React 19.2.8 verified against the npm registry during grilling.

### Interaction contract (1.3)

- **User decision**: PointerSensor `activationConstraint: { delay: 50, tolerance: 5 }` — delay reduced from 200ms by user decision after trying the interface (2026-10-14: "start the drag as soon as the user holds"); no distance constraint (dnd-kit's delay and distance constraints are mutually exclusive — verified). A plain click never starts a drag; the press falls through (caret placement in Task 3).
- KeyboardSensor with dnd-kit defaults: Space/Enter pick up and drop, arrow keys move, Escape cancels.
- The values live in one named constant; tuning them later is a feel change, not a contract change.

### Reorder state (1.2)

- **User decision**: `MOVE_SNIPPET` splices fromIndex→toIndex then renumbers the whole sequence dense 1..n; `moveSnippet(fromIndex, toIndex)` is a 0-based, global-sequence API on the context.
- Rationale: arbitrary moves are inexpressible by touching only the moved item's integer order (ADR 0001's gaps); dense renumber is always correct and idempotent. ADR 0001's Consequences amended accordingly (see Records).
- No-op guards (agent default): same index, out-of-bounds indexes, or a dragged id vanished mid-drag → state content-identical.

### Activation window & surface behavior (1.4)

- **User decision**: sortable wiring renders whenever ≥1 snippet exists; no merge-mode gate (snippets only exist in Merge Mode today — needles create them in view mode); empty-state branch untouched; single snippet stays draggable-but-inert.

### Drag visuals & affordance (1.4)

- **User decision**: DragOverlay floating chip (snippet tint at 0.3 alpha, elevated shadow) + dimmed original (~0.4 opacity); no axis restriction (the flow wraps lines, so vertical movement is required); no placeholder (shifting siblings are the placeholder in a text flow).
- **User decision**: cursor `grab`/`grabbing`; hover = the background tint deepens slightly (alpha 0.3 → 0.4) in the snippet's own color — the 1px outline was removed by user decision after trying the interface (2026-10-14); still a deliberate deviation from DESIGN.md's generic scale(1.03) hover (scaling inline chips distorts the reading line); `user-select: none` + `touch-action: none` on segments; theme focus ring for keyboard focus.

### Screen-reader announcements (i18n)

- **User decision**: positions-only verbosity ("{{index}} of {{count}}"); five flat keys under `pages.mergeSession.previewArea.sorting.*` (`instructions`, `started`, `over`, `ended`, `cancelled`); draft copy approved during grilling (see the spec's draft copy tables).

### Tutorial restructure

- **User decision**: six steps — step 4 split into "Your snippets appear in the preview." (step 4) + new step 5 "Hold and drag a snippet in the preview to change its order." + new step 6 "Copy the merged text when you are done."; pt-BR equivalents approved ("Seus trechos aparecem na prévia." / "Segure e arraste um trecho na prévia para mudar sua ordem." / "Copie o texto mesclado quando terminar."). Steps 1–3 unchanged.
- TutorialBanner's hardcoded four-item step list grows to six (`step5`/`step6` `<li>`); banner and page step-count assertions change 4 → 6.

### Records

- **ADR 0002** (`docs/adr/0002-hold-to-drag-snippet-sorting.md`): the hold-to-drag activation contract — user decision (passes the triple test: Task 3 depends on it, future readers may "fix" the delay away, real alternatives existed).
- **ADR 0001 amendment**: one sentence in Consequences making `MOVE_SNIPPET` the sole sanctioned renumbering writer — user decision.
- No GLOSSARY.md changes — user decision ("Merge Order" already says the sequence is editable in the preview; drag/sort/overlay are UI mechanics, not domain language).

### Testing (1.5)

- **User decision**: reducer MOVE unit tests; provider `moveSnippet` tests (dispatch behavior + stable reference); PreviewArea keyboard sorting tests; one fake-timer pointer hold-drag test; a click-never-drags contract test; existing suites keep passing (only the deliberate tutorial count updates).
- jsdom fallback flag (agent default): IF PointerSensor simulation proves unreliable in jsdom THEN the click-never-drags + reducer + keyboard suites remain the automated contract and the full pointer path is verified manually in the dev server.

### Agent's Discretion

- Composite sortable ids `sourceId:id` (forced by the reducer's tolerated cross-source id collisions).
- `preview-snippet` testid stays on the sortable element; new `preview-snippet-overlay` for the DragOverlay chip; all other testids unchanged.
- DndContext/sensors/overlay owned per PreviewArea instance (Task 2 modal independence; no cross-instance dragging).
- `closestCenter` collision detection + `rectSortingStrategy` (dnd-kit sortable defaults for wrapped/mixed layouts).
- Sensor constant: one named `{ delay: 50, tolerance: 5 }` constant.
- Announcement positions are 1-based.
- New `SortableSegment` page sub-component under `src/pages/MergeSession/components/` with the standard 6-file split, exported via the page components barrel; PreviewArea keeps DndContext/SortableContext/overlay and the drag-end → `moveSnippet` wiring in its own files.
- Exact dnd-kit item ARIA attribute defaults verified against `@dnd-kit/sortable` 10.0.0 during implementation (the spec requires focusability + instruction linkage, not specific attribute internals).
- Overlay chip wraps long/multi-line text (`white-space: pre-wrap`).

---

## Specific References

- Roadmap Feature 3 Task 1.1–1.5 (dnd-kit install, reorder support in SnippetsContext, sensors, sortable segments keeping separators/empty state, tests).
- Feature 2 Task 4 (preview-area) & Task 6 (ui-fixes): PreviewArea/SegmentFlow/Segment contracts, testids, TutorialBanner component and its step-count assertions, DESIGN.md Cards/hover/focus language.
- ADR 0001 (diff-by-id merge order) — amended this task; ADR 0002 — created this task.
- GLOSSARY.md: Merge Order, Snippet, Merged Text, Merge Mode.
- SnippetsContext: `OrderedSnippet.order` semantics, SET_SOURCE_SNIPPETS id-based reconciliation, cross-source id-collision tolerance (why sortable ids must be composite).
- DESIGN.md: Elevation & Depth (shadow lift for the overlay chip), Inputs focus ring, hover guidance (deviation recorded), z-index contract (overlay chip floats above preview content within the surface).
- `@dnd-kit/core` 6.3.1 / `@dnd-kit/sortable` 10.0.0 / `@dnd-kit/utilities` 3.2.2 peer ranges vs React 19.2.8 — verified against the npm registry, 2026-10-14.

---

## Deferred Ideas

- Preview modal rendering of the sortable PreviewArea — Task 2 (only the per-instance wiring constraint is honored now).
- Editable surface, contentEditable caret semantics, drag on/off toggle — Task 3 (ADR 0002 records the contract it must honor).
- Document-model migration (own-text tokens, line breaks, splits) — Task 3.1; `moveSnippet` deliberately stays simple and index-based.
- Split-snippet / line-break / add-own-text tools — other Feature 3 tasks.
- Undo/redo of reorders; multi-select drag; cross-instance dragging — no v0 home.
- Persistence of merge order — V1 (Merges CRUD).
- TouchSensor/MouseSensor fallback pair — PointerSensor covers mouse/touch/pen via pointer events.
