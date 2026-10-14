# Preview Area

**Gathered:** 2026-10-08
**Spec:** `.specs/features/text-merging/tasks/preview-area/spec.md`
**Status:** Implemented — see `implementation.md`

---

## Feature Boundary

Read-only preview for Feature 2 Task 4 (roadmap 4.1–4.4) only: a page-owned `PreviewArea` rendering the merge-ordered context snippets as colored segments, an icon+text empty state, a floating vertical `PreviewToolbar` on the preview's right side, and a `CopyMergedTextButton` writing the space-joined Merged Text to the clipboard with toast feedback. Not user text editing (deferred), not drag-sort/split/line-break tools (Feature 3), not Start Merge (Task 5).

---

## Implementation Decisions

### Scope and delivery

- This grilling session specified Task 4 only (4.1–4.4).
- Preview pieces are **page sub-components** under `src/pages/MergeSession/components/` (user decision), each with the standard file split and unit tests.
- The invisible stub `src/components/PreviewArea/` (Task 2) is deleted along with its barrel export.

### Display (4.1–4.3)

- `PreviewArea` consumes `useSnippets()` directly; the page passes no snippet props.
- One segment per snippet, in merge order, as a wrapping flow; segment background = `snippet.color` at 0.3 alpha (matches TextInput's committed highlights).
- Empty state: MUI `Preview` icon + `pages.mergeSession.previewArea.empty` text; no action button.
- Forward compatibility (user requirement): the display is a dumb, data-driven map over context snippets — no display state beyond the toast — so a future editable surface can replace content rendering without touching the context, toolbar, or copy tool.

### Toolbar (4.4, generalized)

- User decision evolved the "sideway copy tool" into a **floating vertical toolbar** that will host multiple icon tools; copy is the first.
- Toolbar is pure layout: absolute position at the preview's right edge, vertically centered, above content; composes `children` (one per tool); owns no actions.
- Icon buttons: icon-only, MUI default hover background fill as the "basic visual return".

### Copy tool & Merged Text (4.4)

- `buildMergedText(snippets)`: snippet texts joined by a single space in merge order — pure, exported from the copy button's hook.
- `navigator.clipboard.writeText` only; failure is a silent no-op.
- Disabled at zero snippets; icon-only with i18n aria-label.
- Feedback: MUI Snackbar toast, bottom-center, auto-hide ~2.5s, user-supplied copy: "Text copied to clipboard" / "Texto copiado para área de transferência".

### Terminology

- **Merged Text** added to GLOSSARY.md ("the text composed of snippets in merge order; the session's output"; avoid: built text, preview text, result).

### Editing direction — deliberately NOT decided

- User north star for later features: "the user should be able to edit the text however they want" while snippets remain reorderable.
- The agent-proposed atomic-islands model (caret cannot enter snippets) was **not** adopted or rejected — all editing-model decisions, and the necessity of the Feature 3 tools (split, line breaks, add-own-text), are deferred to Feature 3 discussions. No ADR, no extra glossary terms.
- Task 4 constraint recorded instead: keep the component malleable for a future editor (dumb display, data-driven).

### i18n

- All new keys under `pages.mergeSession.previewArea.*` (user decision): `.empty`, `.copy.button` (aria-label), `.copy.toast` — en-US and pt-BR.

### Agent's Discretion

- Toolbar: absolute right edge, vertically centered, z-index 1, card-like surface (paper, 1px border, 0.75rem radius, subtle shadow).
- Segment flow: right padding so text never flows under the floating toolbar.
- Toast bottom-center via MUI Snackbar defaults + 2500ms auto-hide.
- Empty-state icon choice: MUI `Preview`.
- data-testids: `preview-area` (stub continuity), `preview-snippet`, `preview-toolbar`, `preview-copy-button`, `preview-copy-toast`.

---

## Specific References

- Roadmap Feature 2 Task 4.1–4.4 (preview replacing the stub, context consumption, side-by-side colored snippets, sideway copy tool).
- Task 3: `useSnippets()` always returns merge-ordered `OrderedSnippet[]` (ADR 0001).
- GLOSSARY.md: Merged Text (added this task).
- DESIGN.md: Cards, Empty States, hover states, z-index contract.

---

## Deferred Ideas

- Editing model (free typing vs atomic snippet islands), caret behavior, paste/selection semantics — Feature 3.
- Drag-sort snippet reordering — Feature 3.
- Split-snippet / line-break / add-own-text tools — Feature 3; necessity to be re-discussed (typing may replace them).
- Toolbar's future buttons — added per feature as needed.
- Persistence of preview content — V1.
