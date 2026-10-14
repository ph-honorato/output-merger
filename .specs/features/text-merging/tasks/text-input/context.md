# Text Input Context

**Gathered:** 2026-10-06
**Spec:** `.specs/features/text-input/spec.md`
**Status:** Implemented — see `implementation.md`

---

## Feature Boundary

Reusable `TextInput` for Feature 2 Task 1 (roadmap 1.1–1.8) only: parent-owned `mode` (`input` | `view`), 500-character textarea, view-mode needle selection, snippet model `{ id, text, startIndex, endIndex, color }`, `onChange` of the full snippet array, default highlight `#FF1493` with prop override, mouse and touch. Not MergeSession layout, PreviewArea, global context, Start Merge page wiring, or Feature 4 preview tools.

---

## Implementation Decisions

### Scope and delivery

- This grilling session specified Task 1 only (1.1–1.8), not Feature 2 Tasks 2–5.
- Product code is out of this session; artifacts are spec + this context.
- Later implementation belongs under `artifacts/output-merger.UI/src/components/TextInput/` with the Header/Example file split and `@components` export.

### Modes

- Parent owns `mode: 'input' | 'view'`. Default `input`.
- Input = textarea, compose only, no needles, no highlights.
- View = no textarea, needles + highlights only.
- Snippets exist only in view. Switching view → input clears all snippets.

### Selection mechanism

- Needles only. No native `window.getSelection()` snippet creation.
- Create (fine pointer): hover a **word boundary** → **one** grab needle appears → press/hold that needle and drag across words → pointerup commits.
- After commit: range is highlighted and **two** resize needles sit on start and end so the user can resize both ways.
- “All ticks visible” was rejected in favor of a single hovered grab needle (Q14).

### Word unit

- Unicode words; punctuation is its own stop; whitespace is not a stop.
- Canonical example `Hello, world`: stops `0, 5, 6, 7, 12` (the plan’s `8, 13` pair was an off-by-one on a 12-character string; spec uses measured UTF-16 indices).

### Overlap and adjacency

- Overlap (shared character) is forbidden.
- Reject is **silent** (no toast): create does not add; resize snaps back.
- Abutting ranges are allowed (`endIndex === next.startIndex`).
- Ranges are half-open so abutting is well-defined.

### Delete vs drag

- Hover/click (or tap) the **already highlighted body** removes that snippet.
- Needles are a different hit target: dragging a needle creates or resizes, never deletes.
- Interior word stops of a highlight do not show create needles.

### Touch

- Touch is in Task 1 scope (parity, not a later phase).
- Press-and-hold reveals the **nearest** eligible boundary needle, then drag.
- Only the needle is draggable; the rest of the text may scroll.
- Tap highlight body (not needle) deletes.

### Data contract

- `onChange` returns the array of all snippets after each mutation.
- Text is `value` + `onValueChange`.
- `highlightColor` optional; default `#FF1493` from Aurora `design.md`, not MUI `palette.secondary`.

### Agent's Discretion

- Live prospective highlight during drag.
- Mouse create uses `pointerdown` on the hovered needle (no 400ms delay); 400ms press-and-hold is touch-only for revealing the nearest needle.
- UUID ids; 44px minimum coarse-pointer needle hit target.
- Uncontrolled snippet state inside the component; the snippets context (Task 3) aggregates via `onChange`.
- Remaining-character counter in input mode; i18n keys at implementation.
- Parent replacing `value` while in view clears snippets (`onChange([])`).
- Keyboard needle control out of scope.

### Declined / Undiscussed Gray Areas → Assumptions

- Grapheme vs UTF-16 length: UTF-16 / `maxLength` (logged in spec).
- Exact press-and-hold milliseconds: ~400ms (logged).
- Whether snippets are a fully controlled prop in Task 1: no, callback-only (logged).

---

## Specific References

- Roadmap Feature 2 Task 1.1–1.8 (needles at word boundaries, snippet shape, `onChange`, color override).
- Epic copy “select with the mouse” is the **outcome** of needle drag, not the OS selection API.
- User clarification (Q8b/Q13): remove by hovering and clicking an existing highlight; create by hovering a word boundary until a needle appears, holding it, dragging across other words, releasing; then highlight plus needles on both ends for resize.
- Task 5 later sets `mode` to `view` after Start Merge; Task 1 still implements both modes now.

---

## Deferred Ideas

- ActionsBar, two-column TextInputs, PreviewArea, global snippet order, Start Merge (Feature 2 Tasks 2–5).
- Split from interior stops, overlap merge, preview drag-sort, typed preview text (Feature 4).
- Click-commit one-word snippets (rejected).
- Slot-drag with every boundary tick visible at once (rejected after Q14).
