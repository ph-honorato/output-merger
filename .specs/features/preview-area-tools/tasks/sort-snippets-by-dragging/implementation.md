# Sort Snippets by Dragging Implementation

**Implemented:** 2026-10-14
**Spec:** `.specs/features/preview-area-tools/tasks/sort-snippets-by-dragging/spec.md`
**Context:** `.specs/features/preview-area-tools/tasks/sort-snippets-by-dragging/context.md`
**Code:** `artifacts/output-merger.UI/src/`
**Status:** Implemented — Feature 3, Task 1 (roadmap 1.1–1.5) complete; verified by 39 new automated tests (154 total), oxlint, `tsc -b`, `vite build`

---

## 1. Deliverables

| File | Role |
| ---- | ---- |
| `package.json` / `package-lock.json` | `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0`, `@dnd-kit/utilities@3.2.2` installed (peer-compatible with React 19.2.8; compiles via `tsc -b` and bundles via `vite build`) |
| `src/context/SnippetsContext/SnippetsContext.types.ts` | Modified: `MoveSnippetAction` (`fromIndex`/`toIndex`, 0-based), `SnippetsAction` union extended, `moveSnippet(fromIndex, toIndex)` added to the context value |
| `src/context/SnippetsContext/SnippetsContext.reducer.ts` | Modified: `MOVE_SNIPPET` case — no-op guards (same index, out-of-bounds), splice from→to, dense 1..n renumber (the sole sanctioned renumbering writer per amended ADR 0001) |
| `src/context/SnippetsContext/SnippetsContext.tsx` | Modified: `moveSnippet` useCallback (stable reference) included in the memoized context value |
| `src/context/SnippetsContext/index.ts` | Modified: `MoveSnippetAction` exported from the barrel |
| `src/pages/MergeSession/components/SortableSegment/` | New page-owned component (standard 6-file split): one sortable snippet chip — `useSortable` wiring (attributes/listeners/ref/transform), tint, dim-while-dragging, affordance styles |
| `src/pages/MergeSession/components/PreviewArea/PreviewArea.hook.tsx` | Modified: `SNIPPET_DRAG_ACTIVATION` (`{ delay: 50, tolerance: 5 }`), `buildSortableId` (`${sourceId}:${id}`), sensors (PointerSensor hold-to-drag + KeyboardSensor), `activeSnippet` overlay state, drag start/end/cancel handlers (drag-end → `moveSnippet`), positions-only announcements, screen-reader instructions |
| `src/pages/MergeSession/components/PreviewArea/PreviewArea.tsx` | Modified: per-instance `DndContext` (closestCenter, accessibility, handlers) + `SortableContext` (rectSortingStrategy) wrapping the segment flow; space separators stay outside the sortable elements; `DragOverlay` (zIndex 200, `dropAnimation={null}`) renders the overlay chip with `data-testid="preview-snippet-overlay"` |
| `src/pages/MergeSession/components/PreviewArea/PreviewArea.styles.ts` | Modified: `Segment` moved to SortableSegment; new `OverlayChip` (snippet tint via inline style, `cursor: grabbing`, elevated shadow, `white-space: pre-wrap`) |
| `src/pages/MergeSession/components/index.ts` | Modified: `SortableSegment` exported (listed first — see §3) |
| `src/pages/MergeSession/components/TutorialBanner/TutorialBanner.tsx` | Modified: step list restructured to six `<li>` (step 4 split; step 5 hold-drag; step 6 copy) |
| `src/i18n/resources/en-US.json`, `pt-BR.json` | 5 new keys under `pages.mergeSession.previewArea.sorting.*` (spec copy, verbatim, both languages); `tutorial.step4` modified; `tutorial.step5`/`step6` added |
| `src/test/setup.ts` | Modified: no-op `Element.prototype.scrollIntoView` shim (jsdom lacks it; dnd-kit's keyboard pickup calls it inside a scrollable container) |
| `src/context/SnippetsContext/SnippetsContext.test.tsx` | +13 tests: reducer `MOVE_SNIPPET` units (moves, cross-source, dense renumber from gaps, repeat-move density, all no-op guards, id-collision reorder, resize-after-move) + provider `moveSnippet` tests (reorder, no-ops, stable reference) |
| `src/pages/MergeSession/components/PreviewArea/PreviewArea.test.tsx` | +21 tests in three new suites (affordances, keyboard sorting, pointer sorting) + mid-drag discard hook test |
| `src/pages/MergeSession/components/SortableSegment/SortableSegment.test.tsx` | +5 unit tests (render/tint, sortable semantics, affordance styles, focus-ring rule, hover tint deepening) |
| `src/pages/MergeSession/components/TutorialBanner/TutorialBanner.test.tsx` | Updated: 6 steps with exact new copy; keys test asserts exact approved copy for steps 4–6 in both languages; language-switch test asserts the restructured steps in pt-BR and en-US |
| `src/pages/MergeSession/MergeSessionPage.test.tsx` | Updated: tutorial step-count assertion 4 → 6 |

No routes changed; no backend files touched; `SET_SOURCE_SNIPPETS` behavior unchanged; ADR 0002 (created) and the ADR 0001 Consequences amendment were delivered by the specs phase and are present in `docs/adr/` (not modified by the developer).

---

## 2. Behavior (as implemented)

```ts
// SnippetsContext.reducer.ts — the sole sanctioned renumbering writer (ADR 0001)
case 'MOVE_SNIPPET': {
  const { fromIndex, toIndex } = action;
  const inBounds = (index: number) => index >= 0 && index < state.length;
  if (fromIndex === toIndex || !inBounds(fromIndex) || !inBounds(toIndex)) {
    return state; // content-identical (same reference)
  }
  const next = [...state];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next.map((entry, index) => ({ ...entry, order: index + 1 })); // dense 1..n
}
```

```tsx
// PreviewArea.tsx — per-instance drag wiring mounts only when ≥1 snippet exists
<DndContext sensors={sensors} collisionDetection={closestCenter}
  accessibility={{ announcements, screenReaderInstructions }}
  onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
  <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
    <S.SegmentFlow data-testid="preview-segment-flow">
      {snippets.map((snippet, index) => (
        <Fragment key={sortableIds[index]}>
          {index > 0 ? ' ' : null}
          <SortableSegment snippet={snippet} sortableId={sortableIds[index]} />
        </Fragment>
      ))}
    </S.SegmentFlow>
  </SortableContext>
  <DragOverlay zIndex={200} dropAnimation={null}>
    {activeSnippet ? (
      <S.OverlayChip data-testid="preview-snippet-overlay" …>{activeSnippet.text}</S.OverlayChip>
    ) : null}
  </DragOverlay>
</DndContext>
```

- **Reorder state (1.2)**: `moveSnippet(fromIndex, toIndex)` is a 0-based, global-sequence API on the context; `MOVE_SNIPPET` splices then renumbers dense. Interleaves safely with `SET_SOURCE_SNIPPETS` (id-based reconciliation keeps a moved/resized snippet at its renumbered order — unit-tested).
- **Activation (1.3)**: PointerSensor `activationConstraint: { delay: 50, tolerance: 5 }` (one named constant, `SNIPPET_DRAG_ACTIVATION`) — release before the delay never drags; a hold wiggling >5px cancels activation; a plain click falls through (Task 3 caret contract). KeyboardSensor with dnd-kit's default bindings (Space/Enter pick up and drop, arrows move, Escape cancels) and `sortableKeyboardCoordinates`.
- **Sorting surface (1.4)**: sortable wiring renders whenever ≥1 snippet exists (no merge-mode gate); the empty-state branch is untouched and mounts no DndContext; a single snippet keeps the same affordances and drags inertly. Space separators stay outside the sortable wrappers, so the flow's textContent keeps equaling `buildMergedText(snippets)` in any order (asserted for the reordered state too).
- **Drag visuals**: DragOverlay floating chip in the snippet's own tint (0.3 alpha) with an elevated shadow and `preview-snippet-overlay` testid; the in-place origin dims to 0.4 opacity; siblings shift via the rectSortingStrategy transform. Chip affordances: `cursor: grab` (idle) / `grabbing` (overlay chip), hover deepens the chip tint (alpha 0.3 → 0.4) in the snippet's own color, `user-select: none` + `touch-action: none` (+ `-webkit-touch-callout: none`), theme focus ring (`:focus-visible`, 2px primary, offset 2px per DESIGN.md Inputs).
- **Announcements**: dnd-kit `accessibility.announcements` built from the five i18n keys, positions-only, 1-based (`{{index}} of {{count}}`); `screenReaderInstructions.draggable` from the `instructions` key, linked to every chip via `aria-describedby` (dnd-kit's mechanism). All strings follow the active language.
- **Tutorial**: six steps (1–3 unchanged; step 4 "Your snippets appear in the preview."; step 5 "Hold and drag a snippet in the preview to change its order."; step 6 "Copy the merged text when you are done."), with the approved pt-BR copy; banner + page step-count assertions updated 4 → 6.

---

## 3. Key implementation decisions (agent defaults, within spec latitude)

- **`sortableKeyboardCoordinates` for the KeyboardSensor.** The key *bindings* stay dnd-kit's defaults (Space/Enter/arrows/Escape), but the coordinate getter is `@dnd-kit/sortable`'s documented getter for the sortable preset. The default 25px-per-keypress getter cannot reliably cross wide snippet chips (a whole-sentence chip can be hundreds of px), which would hollow out DRAG-13's "arrow keys SHALL move it within the sequence"; the preset getter jumps item-to-item per keypress. This also makes the keyboard path deterministic in jsdom.
- **`dropAnimation={null}` on DragOverlay.** dnd-kit's default drop animation is a WAAPI-based 250ms settle that never resolves under jsdom (no `Element.animate`) and, in the wrapping text flow, briefly double-renders the floating chip over the restored in-place chip. Disabling it gives deterministic, layout-glitch-free drops; the spec defines overlay behavior during the drag only.
- **`onDragOver` skips announcing when `over.id === active.id`.** At pickup the collision resolves to the item itself; announcing "now over position N" for the item's own slot would immediately overwrite the "picked up" message. Skipped → the started announcement stays observable (and the lifecycle is less noisy).
- **`zIndex={200}` on DragOverlay** per DESIGN.md's z-index contract (overlay layer 200 — below modal 300 and toast 500, so Task 2's modal and toasts stay above the drag ghost).
- **`MOVE_SNIPPET` "referenced snippet no longer exists" interpretation.** The spec fixes `moveSnippet(fromIndex, toIndex)` (index-based), so the action carries no identity for the reducer to verify. The guard is enforced where identity exists: `handleDragEnd` resolves indexes from the live context array at drag end — a vanished id yields −1 and the reorder is discarded before dispatch (hook-level test), and the reducer independently no-ops on out-of-bounds indexes. Net effect matches the spec's "reorder discarded, no crash".
- **Page barrel ordering.** `SortableSegment` is exported first in `components/index.ts` and PreviewArea imports it via the barrel (`from '../'`, per the AGENTS.md barrel rule). This creates a PreviewArea ↔ barrel module cycle that is safe because the binding is only dereferenced at render time; listing SortableSegment first makes the evaluation order trivially safe. Verified under vitest, `tsc -b`, and the production Rollup build.
- **`buildSortableId`** exported from `PreviewArea.hook.tsx` (codebase precedent: pure helpers exported from hook files) and unit-tested for the cross-source id-collision case.
- **Verified against `@dnd-kit/sortable` 10.0.0 / `@dnd-kit/core` 6.3.1 source** (as the spec's flagged assumption required): sortable item attributes are `role="button"`, `tabIndex: 0`, `aria-roledescription="sortable"`, `aria-describedby` → the hidden instructions element (`DndDescribedBy-N`), plus `aria-pressed` while dragging; the live region is `<div role="status" aria-live="assertive">`; keyboard bindings are start Space/Enter, move arrows, end Space/Enter/Tab, cancel Escape (Tab-to-drop is a dnd-kit default binding, kept).
- **jsdom shims for dnd-kit under test** (test-only, no product impact): `Element.prototype.scrollIntoView` no-op (keyboard pickup calls it when a scrollable ancestor exists — jsdom lacks the method), `getBoundingClientRect` mocks per test (jsdom computes no layout; dnd-kit's rect-based collision needs rects), fake timers only for the pointer describe (the 50ms activation delay), and a microtask flush after drag end/cancel events (dnd-kit's end handler settles the DragOverlay unmount through a promise chain).

---

## 4. Testing strategy

- **Reducer units (SnippetsContext.test.tsx, +10)**: move within a source; move across sources (sourceId never changes); dense renumber from a gapped state; repeat-move keeps 1..n dense; same-index and both out-of-bounds no-ops return the same reference; id-collision reorder resolves array indexes; a later resize keeps the moved snippet at its reordered position.
- **Provider tests (+3)**: `moveSnippet` reorders the global sequence with dense orders; no-ops on equal/out-of-bounds indexes; stable `moveSnippet` reference across re-renders and state changes.
- **SortableSegment units (+5)**: snippet text + tint on the `preview-snippet` element; dnd-kit's exact sortable semantics (role/tabIndex/aria-roledescription/aria-describedby); affordance styles (grab cursor, user-select, touch-action); `:focus-visible` rule present in generated CSS; hover tint deepening.
- **PreviewArea affordances (+9)**: five sorting keys ship verbatim in BOTH resource files; activation constant equals `{ delay: 50, tolerance: 5 }`; composite sortable ids stay unique across colliding ids; every segment is a focusable sortable item linked to the instructions element; affordance styles on all segments; hover tint deepening; no drag wiring mounts while empty (no live region); instructions text follows the active language; the mid-drag discard path (vanished id / no target / own position) leaves the state identical and clears the overlay state.
- **PreviewArea keyboard sorting (+6)**: Space → ArrowRight → Space reorders [Alpha, Beta, Gamma] → [Beta, Alpha, Gamma] with flow textContent equal to `buildMergedText` of the new order; Escape cancels with the order unchanged and the overlay cleared; a single snippet drags but stays inert; live region announces started/over/ended ("Picked up snippet 1 of 3." → "Snippet is now over position 2 of 3." → "Snippet dropped at position 2 of 3."); cancellation announces "Snippet reorder cancelled."; pt-BR announcement copy ("Trecho 1 de 3 pego." / "Reordenação do trecho cancelada.").
- **PreviewArea pointer sorting (+6, fake timers + mocked rects)**: hold 25ms → nothing; +25ms → drag activates (overlay chip present with tint and `grabbing` cursor, origin dimmed to 0.4, sibling shifted via transform), move over Beta → release → live region announces the drop and the order flips; release before the delay never drags (even after advancing past 50ms); a >5px wiggle during the hold cancels activation; release on the item's own position leaves the order unchanged; Escape cancels an activated drag; a single snippet drags inertly.
- **Tutorial**: banner renders 6 `<li>` with the exact restructured copy; keys ship verbatim in both languages; all six steps render in pt-BR after a language switch and back; the page tutorial lifecycle test passes with the updated count (4 → 6).
- **Spec's jsdom fallback NOT triggered**: the fake-timer PointerSensor simulation proved reliable (all six pointer tests green against `@dnd-kit/core` 6.3.1 with the documented mocks), so the full pointer path is part of the automated contract and no manual-only pointer verification is owed.
- Verification: `npx vitest run` (154/154 green across 12 files), `npm run lint` (oxlint, clean), `npx tsc -b` (clean), `npm run build` (clean; bundle now includes dnd-kit — the >500 kB chunk-size note is informational).

---

## 5. Per-requirement outcomes

| ID | Outcome | Note |
| -- | ------ | ---- |
| DRAG-01 | Verified | Every segment registered in `SortableContext` keyed by `${sourceId}:${id}` — test: all 3 segments focusable/linked; composite-id uniqueness unit test |
| DRAG-02 | Verified | Pointer tests: release at 150ms never drags; >5px move during the hold cancels activation (no overlay, order unchanged) |
| DRAG-03 | Verified | Pointer test: at 50ms the overlay chip is visible and the overlay carries `cursor: grabbing` |
| DRAG-04 | Verified | Pointer + keyboard reorder tests end in `moveSnippet(0, 1)` and [Beta, Alpha, Gamma]; reducer/provider suites |
| DRAG-05 | Verified | Escape (pointer + keyboard), own-position release, and no-target release all leave the order unchanged (tests in both suites) |
| DRAG-06 | Verified | Reducer tests: splice/reinsert + dense 1..n renumber; result always sorted by order |
| DRAG-07 | Verified | Same-index and out-of-bounds no-ops return the same state reference; "referenced snippet no longer exists" enforced by fresh index resolution at drag end (vanished id ⇒ −1 ⇒ discard — hook-level test); see §3 interpretation note |
| DRAG-08 | Verified | Provider tests: `moveSnippet` exposed, reorders, stable reference across re-renders/state changes |
| DRAG-09 | Verified | Reducer test: text-1 snippet passes text-2 snippet; `sourceId` unchanged, only `order` changes |
| DRAG-10 | Verified | Reorder tests assert flow textContent === `buildMergedText` of the new order; CopyMergedTextButton consumes the same context with zero wiring changes |
| DRAG-11 | Verified | Affordance test: role=button, tabIndex=0, aria-describedby → instructions element on every segment |
| DRAG-12 | Verified | Keyboard test: Space picks up (overlay renders) and the drag-start announcement fires ("Picked up snippet 1 of 3.") |
| DRAG-13 | Verified | Keyboard test: arrows move within the sequence, Space drops (reorder), Escape cancels (order unchanged) |
| DRAG-14 | Verified | Keyboard and pointer suites produce the identical [Beta, Alpha, Gamma] result through the same `moveSnippet` path |
| DRAG-15 | Verified | Live region asserts started/over/ended/cancelled in en-US (keyboard lifecycle + pointer drop) and pt-BR; 1-based `{{index}} of {{count}}` |
| DRAG-16 | Verified | Instructions element linked via dnd-kit's `aria-describedby` mechanism (DndDescribedBy id); asserted per segment |
| DRAG-17 | Verified | All five keys asserted verbatim in en-US.json AND pt-BR.json; language-switch tests for instructions + announcements |
| DRAG-18 | Verified | Announcement strings built from index/count only — no snippet text is interpolated (code + asserted content) |
| DRAG-19 | Verified | Overlay chip: `preview-snippet-overlay` testid, snippet tint rgba(...,0.3), elevated shadow (styles), renders mid-drag in both pointer and keyboard tests; pointer-following is DragOverlay's contract driven by the same pointer moves the reorder test depends on — visual feel listed for the dev-server pass |
| DRAG-20 | Verified | Origin dimmed to opacity 0.4 (pointer + keyboard assertions); sibling shift asserted via transform during the drag |
| DRAG-21 | Verified | `cursor: grab` on chips, `grabbing` on the overlay chip, hover deepens the tint in the snippet's own color (generated-CSS assertions) |
| DRAG-22 | Verified | `user-select: none` + `touch-action: none` asserted on every segment (`-webkit-touch-callout: none` also set) |
| DRAG-23 | Verified | `:focus-visible` 2px theme-primary ring, offset 2px (DESIGN.md Inputs); rule asserted in generated CSS — visual rendering on real focus needs a browser (manual item below) |
| DRAG-24 | Verified | Separators rendered outside the sortable elements; flow textContent equals `buildMergedText` before and after reordering |
| DRAG-25 | Verified | Empty state untouched (all pre-existing tests green); "mounts no drag wiring while empty" asserts no live region |
| DRAG-26 | Verified | Single-snippet pointer + keyboard tests: affordances present, drag inert, no crash, DOM intact |
| DRAG-27 | Verified | DndContext/sensors/overlay owned by each PreviewArea instance (rendered inside its own tree; no global state); cross-instance proof arrives with Task 2's modal by design |
| DRAG-28 | Verified | All wiring via dnd-kit APIs (attributes/listeners/ref from `useSortable`); snippet text rendered as children — no read-only-DOM assumptions |
| DRAG-29 | Verified | `preview-area`, `preview-segment-flow`, `preview-snippet` (on the sortable element) preserved — the entire pre-existing PreviewArea/page suite passes unchanged; new `preview-snippet-overlay` |
| DRAG-30 | Verified | Banner test: 6 `<li>` with the exact approved copy for steps 4–6 (en-US) |
| DRAG-31 | Verified | Resource test: restructured tutorial keys ship verbatim in both languages |
| DRAG-32 | Verified | Banner renders the two new steps; banner + page step-count assertions updated 4 → 6 (both suites green) |
| DRAG-33 | Verified | Language-switch test: all six steps render in pt-BR and back in en-US |

**33 total: 33 Verified, 0 Deviated, 0 Deferred.**

---

## 6. Deviations from spec.md

None. All 33 requirements were implemented to the spec's contract; no requirement Deviated or Deferred. The following judgment calls were made inside the spec's own agent-default latitude and are recorded in §3 (none changes a specified behavior):

- `sortableKeyboardCoordinates` on the KeyboardSensor (bindings unchanged; the default 25px getter would make DRAG-13 unreliable across wide chips) — flagged here because the spec's assumptions table said "dnd-kit defaults" for the sensor configuration.
- `dropAnimation={null}` (spec-silent; deterministic drops, jsdom-safe, avoids double-vision in the wrapping flow).
- `onDragOver` suppressed when `over` is the dragged item itself (spec-silent; prevents the pickup announcement from being instantly overwritten).
- The §3 note on how "the referenced snippet no longer exists" is enforced, given the spec-fixed index-based `moveSnippet` signature.

---

## 7. Known gaps / deferred

Manual dev-server verification for the tester sub-agent (things jsdom cannot see or feel):

- Pointer-drag **feel**: 50ms hold cadence, 5px tolerance forgiveness, the overlay chip following the cursor, grab/grabbing cursors, hover tint deepening, siblings shifting to make room, and the drop with no animation.
- Touch long-press: native selection/callout/scroll suppression via `user-select`/`touch-action`/`-webkit-touch-callout`.
- The visible focus ring when a segment receives keyboard focus (rule shipped and CSS-asserted; jsdom cannot match `:focus-visible`).
- Overlay elevation/z-index appearance within the preview surface (zIndex 200 per DESIGN.md).

Deferred by spec (not gaps): preview modal re-mount of the sortable PreviewArea (Task 2 — only the per-instance wiring constraint was honored), editable surface/contentEditable (Task 3 — ADR 0002 records the activation contract it must honor), document-model migration (Task 3.1), undo/multi-select/cross-instance dragging/persistence (no v0 home).

---

## 8. Post-implementation adjustments (2026-10-14)

The user tried the interface in the dev server and requested two feel changes. Both were implemented the same day, with the spec, context, and ADR 0002 amended accordingly:

1. **Hold delay reduced 200ms → 50ms** ("start the drag as soon as the user holds"). `SNIPPET_DRAG_ACTIVATION` is the one-line change; the constant-pin test and the pointer-suite timings were updated (25ms below-delay checks, 50ms activation). The click-vs-hold contract is unchanged — a plain click still never starts a drag, so Task 3's caret fall-through stays protected.
2. **Hover affordance replaced**: the 1px own-color outline was removed; hovering now deepens the chip's background tint slightly (alpha 0.3 → 0.4, still in the snippet's own color). The tint moved from an inline style into the `SegmentChip` styled component (a class rule is required for the `:hover` state to win); the `:focus-visible` keyboard outline is unchanged. Hover tests in `SortableSegment.test.tsx` and `PreviewArea.test.tsx` now assert the deepened tint and the absence of a hover outline.

Verification after both changes: `npx vitest run` (154/154), `npm run lint` (clean), `npx tsc -b` (clean).

Roadmap note: the follow-up item "Task 1.6: Add user feedback while sorting" was added to the roadmap by user decision (addressed later); it is out of scope for these two adjustments.
