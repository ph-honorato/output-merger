# Preview Area Modal (Feature 3, Task 2)

**Gathered:** 2026-10-15
**Spec:** `.specs/features/preview-area-tools/tasks/preview-area-modal/spec.md`
**Status:** Specified — awaiting implementation

---

## Feature Boundary

A bigger view of the same preview for Feature 3 Task 2 (roadmap 2.1–2.5) only: a self-contained `PreviewModal` page component (standard 6-file split, barrel export) that owns its open/close state and renders both the toolbar trigger and an MUI Dialog; the Dialog renders the same unmodified `<PreviewArea />` from the shared SnippetsContext (zero duplicated snippet state) plus the existing `<CopyMergedTextButton />` in a new bare right-side tools rail; a visually-hidden DialogTitle provides the accessible name; an additive-only `onActiveDragChange` prop on PreviewArea guards Escape against the verified dnd-kit/MUI mid-drag conflict; responsive rules (trigger hidden below `md`, `md` + ~90dvh sizing above, fullScreen on the resize edge); three new i18n keys in both languages; the unit + integration test suites; and ADR 0003. NOT the editable surface or drag on/off toggle (Task 3), NOT the document-model migration (Task 3.1), NOT split/line-break/own-text tools, NOT cross-instance dragging, NOT `keepMounted`, NOT reusing PreviewToolbar inside the modal, NOT persistence, NOT a programmatic open API, and NOT a roadmap.md update (the orchestrator owns that).

---

## Implementation Decisions

### Scope and delivery

- Two grilling rounds: Round 1 (10 questions — several custom answers reshaped the layout/chrome/i18n decisions), Round 2 (4 recomputed-frontier questions). Every recommendation accepted except where the user customized.

### Modal composition (2.1 / 2.3)

- **User decision (2026-10-15)**: the modal shows exactly how PreviewArea acts today, but centralized; the tools (copy, close) sit at the right side of the modal, pushed a little right, so they do not interfere with the centralization; no visible title.
- **User decision (2026-10-15)**: self-contained `PreviewModal` — one component owning the trigger, the Dialog, and the internal open state; the page only places `<PreviewModal />` inside `<PreviewToolbar>` children. No new context, no prop drilling. Roadmap 2.3's "shared state via context" is satisfied by SnippetsContext: the modal renders the same PreviewArea, which already consumes it — snippet state is never duplicated.

### Trigger (2.2)

- **User decision (2026-10-15)**: `OpenInFull` icon-only IconButton (matches the `CopyMergedTextButton` pattern), translated `aria-label`, placed below the copy button, disabled while the preview is empty.
- **User decision (2026-10-15) — roadmap deviation**: the trigger is hidden below `md`, so the closed modal is unreachable on mobile. This supersedes the roadmap 2.4 phrasing "full-screen on mobile" for the closed state; full-screen occurs only on the resize edge (below).

### Layout (2.1)

- **User decision (2026-10-15)**: flex row inside the Paper — left zone (`flex: 1`) centers the PreviewArea card (natural size up to the available bounds, `min-height: 400px` preserved, internal scroll beyond); right rail is a new bare styled strip in `PreviewModal.styles.ts` (transparent, no card chrome — NOT the PreviewToolbar component, avoiding a duplicate `preview-toolbar` testid and card-in-card chrome), top-aligned, ~16px inset from the right edge.
- **User decision (2026-10-15)**: rail order — copy button on top, close button under it ("include a button under the copy button to close the modal view").
- **User decision (2026-10-15)**: the close icon must be the opposite of the open trigger — `CloseFullscreen`, the canonical Material pair of `OpenInFull` (`open_in_full` ↔ `close_fullscreen`); both verified present in the installed `@mui/icons-material` 9.4.0.
- **User decision (2026-10-15)**: no visible title; the accessible name comes from a visually-hidden `DialogTitle`. Verified in the installed `@mui/material` 9.4.0 source: unknown props land on the Modal root (a plain `aria-label` would NOT name the dialog), while `DialogTitle` consumes `DialogContext.titleId` and auto-wires the dialog's `aria-labelledby`.

### Closing & the Escape guard (2.4)

- **User decision (2026-10-15)**: guard while dragging — `PreviewArea` gains an additive-only optional `onActiveDragChange?: (active: boolean) => void` (default no-op); the Dialog sets `disableEscapeKeyDown` while a drag is active in its instance. Escape with no active drag closes (roadmap 2.4); Escape mid-drag cancels only the drag — pointer and keyboard drags alike.
- Rationale (verified in installed `@dnd-kit/core` 6.3.1): its `stopPropagation` helper is never called; both sensors cancel drags on Escape without stopping propagation — unguarded, Escape mid-drag would cancel the drag AND close the dialog. The callback is reusable by Task 3's drag on/off toggle.
- Agent default: backdrop click closes (MUI default); focus trap/restore defaults untouched.

### Sizing & responsive (2.4)

- **User decision (2026-10-15)**: desktop — `maxWidth="md"` + `fullWidth` (Paper up to ~900px) + fixed Paper height ~90dvh (MUI already centers the Paper on screen; verified in the installed Dialog container styles).
- **User decision (2026-10-15)**: resize edge — below `md` the component renders null only when closed; while open it stays mounted and switches to `fullScreen={isBelowMd}` (no abrupt close).

### Duplicate-instance policy (2.3)

- **User decision (2026-10-15)**: content unmounts when closed (no `keepMounted`); duplicate `data-testid`s exist by design only while open; the modal's tests scope queries with `within(getByRole("dialog"))`; MUI keeps the app behind the dialog `aria-hidden` so screen readers see one preview. Recorded as ADR 0003.

### i18n

- **User decision (2026-10-15)**: three flat keys under `pages.mergeSession.previewArea.modal` — `name` (accessible name "Preview"/"Prévia"), `open` (trigger aria-label "Open preview in a bigger view"/"Abrir prévia em visualização ampliada"), `close` (close aria-label "Close preview"/"Fechar prévia"). The Round-1 `title` draft was repurposed as `name` per the no-visible-title decision. Copy strings (`copy.button`, `copy.toast`) are reused verbatim — no new copy-related keys.

### Records

- **ADR 0003** (`docs/adr/0003-preview-modal-renders-same-preview-area.md`): the modal renders the same PreviewArea component (no modal variant); duplicate data-testids while open are by design — **user decision (2026-10-15)**. Passes the triple test: Task 3's editable surface architecture depends on single-component reuse (hard to reverse); duplicate testids will tempt future "fixes" (surprising); a modal-specific variant was a real alternative (real trade-off).
- No GLOSSARY.md changes — **user decision (2026-10-15)**: the modal is UI mechanics, not domain language (consistent with Task 1's no-glossary decision).

### Testing (2.5)

- **User decision (2026-10-15)**: full PreviewModal unit suite (trigger render/aria-label/disabled/hidden-below-md; open via trigger → `role="dialog"` with accessible name; scoped preview content parity; copy integration with clipboard mock + toast; close via X/backdrop/Escape; Escape-mid-drag cancels only the drag; fullScreen on the resize edge) plus page-level integration (trigger inside the toolbar; inline preview stays mounted while open; a reorder inside the modal updates the inline flow — the shared-context/no-duplication proof). Existing suites pass unchanged.

### Agent's Discretion

- Testids: `preview-modal-open-button`, `preview-modal-close-button`; the Dialog is located by `role="dialog"` (no extra testid on the Paper).
- PreviewArea stays unmodified except the additive callback; its existing `className` prop carries any modal layout tweak.
- Screen-reader-only styling technique for the hidden DialogTitle (e.g., 1px clip pattern) is the developer's choice.
- Rail inset ~16px = `theme.spacing(2)`; rail vertical alignment top (mirrors the page's `PreviewColumn` `align-items: flex-start`).
- `onActiveDragChange` naming/shape (single boolean payload); fires on drag start and on end/cancel.
- Copy toast Snackbar left as-is inside the dialog — flagged for visual verification during implementation.
- DragOverlay keeps `zIndex={200}` — it renders inside the Dialog's DOM and stacks within the dialog (placement verified); no theme z-index changes.
- If snippets become empty while the modal is open (impossible behind the backdrop today), the empty state renders gracefully; no special handling.
- The rail stays visible in fullScreen so close remains reachable on the resize edge.
- No programmatic open API — the trigger is the only entry point.

---

## Specific References

- Roadmap Feature 3 Task 2.1–2.5 (PreviewModal component, toolbar trigger + translations, shared-state same-PreviewArea rendering, responsive + accessibility pass, tests) — with the recorded mobile deviation (trigger hidden below `md`; fullScreen only on the resize edge).
- `MergeSessionPage.tsx` (`MergeSessionWorkspace` composes `<PreviewArea /><PreviewToolbar><CopyMergedTextButton /></PreviewToolbar>`; the page gains `<PreviewModal />` as the second toolbar child) and `MergeSessionPage.styles.ts` (`PreviewColumn`: column on mobile, row from `md` up).
- `PreviewArea/` (per-instance DndContext, testids `preview-area`/`preview-segment-flow`/`preview-empty`/`preview-snippet`/`preview-snippet-overlay`/`preview-drop-indicator`, `className` prop), `PreviewArea.hook.tsx` (`SNIPPET_DRAG_ACTIVATION` per ADR 0002, drag lifecycle handlers the callback hooks into), `PreviewToolbar/` (children API; vertical bar from `md` up), `CopyMergedTextButton/` (self-contained pattern, `buildMergedText`, `canCopy`, Snackbar toast), `components/index.ts` (barrel).
- `SnippetsContext/` (`snippets` merge-ordered array, `moveSnippet`; the single source of truth both surfaces read).
- ADR 0001 (diff-by-id merge order), ADR 0002 (hold-to-drag activation — Task 3 depends on it), ADR 0003 (created this task).
- GLOSSARY.md: Merge Order, Snippet, Merged Text, Merge Mode (no changes).
- DESIGN.md: z-index contract (overlay 200 within the surface; MUI's dialog layering dominates at the portal level), body ~72ch line length (motivates `maxWidth="md"`), mobile collapse below 900px (`md`), Cards styling.
- i18n resources: `src/i18n/resources/en-US.json`, `pt-BR.json` (flat keys under `pages.mergeSession.previewArea.*`).
- Installed-source verifications (2026-10-15): `@dnd-kit/core` 6.3.1 (`stopPropagation` never called; Escape cancels both PointerSensor and KeyboardSensor without stopping propagation); `@mui/material` 9.4.0 `Dialog.js` (`aria-labelledby`/`aria-describedby` → Paper with `role="dialog"`; unknown props → Modal root; `DialogTitle.js` consumes `DialogContext.titleId`; default `scroll="paper"` container centers the Paper); `@mui/icons-material` 9.4.0 (`OpenInFull` and `CloseFullscreen` both present).
- Prior tasks in this feature: `sort-snippets-by-dragging` (per-instance DndContext constraint, ADR 0002), `sorting-drop-indicator` (needle contract the modal instance inherits for free).

---

## Deferred Ideas

- Editable preview (contentEditable caret semantics), drag on/off toggle — Task 3; the modal renders the same component precisely so the editable surface is built once, and `onActiveDragChange` is reusable by the toggle.
- Document-model migration (own-text tokens, line breaks, splits) — Task 3.1.
- Split-snippet / line-break / add-own-text tools — other Feature 3 tasks; the modal rail is their natural future host (currently copy + close only).
- A `keepMounted`/always-mounted dialog variant — rejected during grilling (duplicates would exist always, not just while open).
- Reusing `<PreviewToolbar>` as the modal rail — rejected (duplicate `preview-toolbar` testid + card-in-card chrome); revisit only if the rail needs toolbar-grade styling.
- Programmatic open API / deep-linking to an open modal — no caller exists in v0.
- Third text input, ActionsBar extensions (Feature 5).
- Persistence of merge sessions (including any modal state) — V1 (Merges CRUD).
