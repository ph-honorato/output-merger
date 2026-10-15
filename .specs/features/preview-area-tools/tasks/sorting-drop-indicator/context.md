# Sorting Drop Indicator (Feature 3, Task 1.6)

**Gathered:** 2026-10-15
**Spec:** `.specs/features/preview-area-tools/tasks/sorting-drop-indicator/spec.md`
**Status:** Specified — awaiting implementation

---

## Feature Boundary

An in-flow insertion needle ("drop indicator") rendered in the PreviewArea segment flow while a drag is active, marking the slot where the dragged snippet will land: the index-based, direction-aware placement rule; the TextInput-needle look in a neutral theme color; the lifecycle (origin slot at pickup → hops on hover change → removed on drop/cancel/vanish); keyboard parity; `data-testid="preview-drop-indicator"`; zero new i18n. Not a strategy swap (the `rectSortingStrategy` sibling shifts stay), not new announcement copy, not the preview modal (Task 2), not the editable surface (Task 3), not any SnippetsContext change, not DragOverlay or origin-dimming changes.

---

## Implementation Decisions

### Grilling process

- A full frontier round was prepared (naming, appearance, position semantics, shift interplay, keyboard, announcements, i18n, testids, edge cases). The user settled the design themselves and explicitly declined extended grilling ("you don't need to reason a lot about it") — the prepared recommendations were adopted as recorded below; every remaining ambiguity was resolved as an agent default, with rationale, in the spec's assumptions table.

### User decisions (2026-10-15)

- **What**: while the user is dragging a snippet, a needle renders in the segment flow at the position where the snippet will be placed — sitting before/between/after the other snippets.
- **Look**: styled like the existing TextInput needle, but in a neutral color — not the snippet colors, not theme primary.
- **When**: rendered only during an active drag (pointer or keyboard — same `onDragOver` path); removed on drop, on cancel (Escape), and when the active snippet vanishes mid-drag.
- **Interplay**: complements the existing sibling shifts — the user asked for the needle on top of the current feedback; the shifts stay.
- **data-testid**: `preview-drop-indicator`.
- **i18n/aria**: no new strings, no aria additions. (If implementation uncovers an unavoidable aria need, en-US + pt-BR are both required.)
- **Edge cases to spec**: own-position hover, wrapped multi-line flows, single-snippet inert drag, empty state, Escape cancel, mid-drag deletion discard, DragOverlay chip keeps following the pointer and the origin keeps dimming.

### Agent's Discretion

- **Placement rule**: slot = `from < to ? to + 1 : to` (0-based slots `0..n` of the current render order). After the hovered snippet when moving forward, before it when moving backward, at the origin slot when hovering the dragged snippet itself (including the pickup instant). Index-based, never pointer-geometry-based — it reproduces `moveSnippet`'s splice landing exactly, so the needle cannot contradict the drop outcome.
- **No target (`over` is null)**: the needle hides. The user left "keep at drop-result position or hide" open; hide picked and documented — a no-target drop announces "cancelled" today, and a frozen needle at the origin reads as stale. Mirrors the announcement logic.
- **Neutral color**: `palette.text.secondary` (`#64748b` light — the active theme; `#94a3b8` in the dark theme, which is exported but currently unused), read from the theme, never a literal. Chosen over `divider` (rgba(0,0,0,0.12) — too faint for a 4px bar on white paper) and `text.disabled` (MUI-implicit, not explicitly themed). **Flagged for a dev-server visibility check.**
- **Shape**: width 4px, height 1.5em, border-radius 2px — the exact `Needle` dimensions in `TextInput.styles.ts`; 1.5em spans the flow's 1.6 body line-height (DESIGN.md typography).
- **Animation**: none — instant appear/disappear (Task 1's `dropAnimation={null}` precedent; deterministic tests).
- **Layout footprint**: zero-width inline anchor recommended (the 4px bar rendered absolutely inside it) so the needle takes no flow width and cannot perturb dnd-kit's measured sortable rects or sibling transforms mid-drag; a plain 4px inline element is acceptable IF the existing pointer suite stays green with no jitter. **Flagged for implementation review.**
- **State & lifecycle wiring**: `dropIndicatorIndex: number | null` in the PreviewArea hook — derived at drag start (origin slot; pickup resolves to the item itself), updated on every `onDragOver`, cleared on drag end and cancel; active/over indexes resolved fresh from the live context array on every event; any unresolved id (-1) hides the needle (mirrors the Task 1 discard path).
- **Pure helper**: `computeNeedleIndex(fromIndex, overIndex)` exported from the hook file and unit-tested (codebase precedent: `buildSortableId`).
- **Text content**: the needle renders no text and is `aria-hidden` — the flow's `textContent === buildMergedText(snippets)` parity holds even mid-drag.
- **Component structure**: developer's structural call — a styled span in `PreviewArea.styles.ts` rendered inline between sortable items, or a small page sub-component with the standard 6-file split under `src/pages/MergeSession/components/` (AGENTS.md rules are satisfied either way; the spec pins behavior, not file layout).

### Naming and records

- **Naming**: GLOSSARY.md defines no "Needle" term. In the codebase and roadmap, "needle" means TextInput's drag handles (`text-input-needle` testid; roadmap Feature 2 Tasks 1.3/1.5). The user verbally reuses "needle" for this indicator; the spec and code name it **DropIndicator** (`preview-drop-indicator`) to avoid overloading the TextInput term. No glossary entry: UI mechanics, not domain language — the Task 1 precedent ("drag/sort/overlay are UI mechanics") applies unchanged.
- **No new ADR**: every decision here is reversible UI mechanics living inside ADR 0002's recorded activation contract; nothing passes the ADR triple test.

---

## Specific References

- Roadmap Feature 3, Task 1.6 — "Add user feedback while sorting" (unchecked; the only roadmap line this task implements).
- Parent Task 1 records: `.specs/features/preview-area-tools/tasks/sort-snippets-by-dragging/` — `spec.md` (DRAG-19/DRAG-20 drag-visual feedback this task extends), `context.md`, `implementation.md` (§3 jsdom harness: fake timers, mocked `getBoundingClientRect`, `scrollIntoView` shim, microtask flush after drag end/cancel; §8 post-implementation adjustments: hold delay 50ms, hover tint 0.3 → 0.4).
- ADR 0002 (`docs/adr/0002-hold-to-drag-snippet-sorting.md`) — the hold-to-drag activation contract; unchanged by this task (the needle adds no activation semantics).
- `PreviewArea.hook.tsx` — `SNIPPET_DRAG_ACTIVATION`, `buildSortableId`, `indexOfSortableId`, `handleDragStart/End/Cancel`, positions-only announcements (the `onDragOver` handler and needle state slot in beside these).
- `PreviewArea.tsx` — per-instance `DndContext` + `SortableContext` wiring, space separators rendered outside the sortable elements, `DragOverlay` (zIndex 200, `dropAnimation={null}`).
- `SortableSegment/` — dimmed origin (0.4 opacity), transform application; `PreviewArea.styles.ts` — `SegmentFlow` (`white-space: pre-wrap`, `overflow-wrap: break-word`).
- `src/components/TextInput/TextInput.styles.ts` — `Needle` styled component: 4px wide, 1.5em tall, 2px radius (shape language source).
- `src/theme/index.ts` — `palette.text.secondary` (`#64748b` light / `#94a3b8` dark); `darkTheme` exported but unused today.
- `SnippetsContext` — `moveSnippet(fromIndex, toIndex)` splice semantics: the placement rule's ground truth.
- i18n resources `src/i18n/resources/en-US.json` / `pt-BR.json` — `pages.mergeSession.previewArea.sorting.*` keys unchanged by this task.
- DESIGN.md — typography (body 1rem / 1.6 line-height), "No pure black" (the neutral `#64748b` complies); z-index contract untouched.

---

## Deferred Ideas

- Replacing the sibling shift with a needle-only mode — the user chose complement; revisit only if the shift reads as clutter after real use.
- Direction-aware announcement copy ("before/after position N") — announcements stay positions-only (Task 1 decision); extend only if non-visual users report ambiguity.
- A needle for cross-instance drags — no cross-instance dragging exists (per-instance DndContext, Task 2 constraint).
- Drop/settle animation for the needle — no v0 home (determinism, per the `dropAnimation={null}` precedent).
