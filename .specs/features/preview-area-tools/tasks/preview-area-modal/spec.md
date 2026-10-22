# Preview Area Modal Specification

## Problem Statement

The merged-text preview lives in the third column of the MergeSession page — roughly one third of the 1280px layout (~400px wide) — so any non-trivial merge order wraps into many short lines and is hard to read. Roadmap Feature 3 Task 2 (2.1–2.5) asks for a "bigger view of the same preview": a `PreviewModal` component (MUI Dialog, full component structure), an open-preview trigger in the `PreviewToolbar` with en-US/pt-BR translations, open/close state that renders the *same* `PreviewArea` inside the modal (shared state via context, no duplication), a responsive + accessibility pass (ESC/backdrop close, focus trap, full-screen behavior), and tests (open/close, preview content rendering, copy button integration). Task 1 already prepared the ground: each `PreviewArea` instance owns its DndContext precisely so a second instance sorts independently, and Task 3 will make the same surface contentEditable — the modal must render the same component so that migration happens once (ADR 0003). Two facts verified in the installed packages shape this specification: (1) `@dnd-kit/core` 6.3.1 cancels both pointer and keyboard drags on Escape without ever stopping propagation, so an unguarded Escape mid-drag would simultaneously cancel the drag *and* close the dialog; (2) MUI v9's Dialog puts unknown props on the Modal root — only a `DialogTitle` (visible or visually hidden) auto-wires the dialog's accessible name via `DialogContext`.

## Goals

- [ ] `PreviewModal` page component in `src/pages/MergeSession/components/PreviewModal/` with the standard 6-file split (`.tsx`, `.hook.tsx`, `.test.tsx`, `.styles.ts`, `.types.ts`, `index.ts`), exported via the page components barrel; sibling imports go through the barrel, never individual subfolders.
- [ ] Self-contained behavior: the component owns its open/close state and renders both the toolbar trigger and the Dialog; the page only places `<PreviewModal />` inside `<PreviewToolbar>` children, below `<CopyMergedTextButton />`.
- [ ] Trigger: icon-only `IconButton` with the `OpenInFull` icon, `data-testid="preview-modal-open-button"`, `aria-label` from `pages.mergeSession.previewArea.modal.open`, disabled while the preview is empty, not rendered below `md` (while closed).
- [ ] The Dialog renders the same, unmodified `<PreviewArea />` consuming SnippetsContext — zero duplicated snippet state — plus the existing `<CopyMergedTextButton />` in a right-side tools rail.
- [ ] Layout: Paper as a flex row — PreviewArea card centered in the left zone (`flex: 1`), a new bare vertical tools rail at the right (copy button on top, close button under it, top-aligned, ~16px inset); no visible title; a visually-hidden `DialogTitle` ("Preview"/"Prévia") auto-wiring `aria-labelledby`.
- [ ] Close paths: rail close button (`CloseFullscreen` icon, translated `aria-label`), backdrop click, and Escape — with Escape suppressed while a drag is active in the modal's preview.
- [ ] Escape guard: `PreviewArea` gains an additive-only optional `onActiveDragChange` callback; the Dialog sets `disableEscapeKeyDown` while a drag is active.
- [ ] Responsive: `maxWidth="md"` + `fullWidth` + Paper height ~90dvh at `md`+; below `md` the closed component renders nothing (user-decision roadmap deviation — the modal cannot be opened from mobile); an open dialog survives a viewport shrink by switching to `fullScreen`.
- [ ] Accessibility: MUI focus trap + focus restore defaults kept, labelled dialog, `aria-hidden` on the app behind the modal.
- [ ] Three new i18n keys in both en-US and pt-BR under `pages.mergeSession.previewArea.modal.*`.
- [ ] Tests: a PreviewModal unit suite (trigger, open/close paths, scoped preview content, copy integration, Escape-drag guard, mobile hiding, resize edge) plus page-level integration (trigger placement, inline preview stays mounted, inside-modal reorder syncs the inline flow).
- [ ] ADR 0003 is recorded (the modal renders the same PreviewArea instance contract; duplicate data-testids while open are by design).

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Editable preview, contentEditable caret semantics, drag on/off toggle | Task 3 — the modal renders the same component precisely so the editable surface is built once |
| Document-model migration (own-text tokens, line breaks, splits) | Task 3.1 — `moveSnippet` and the modal wiring stay as they are |
| Split-snippet / line-break / add-own-text tools | Other Feature 3 tasks — the rail is their natural future host, but hosts only copy + close now |
| Dragging snippets across the inline ↔ modal instances | Task 1 decision: per-instance DndContext; each instance sorts its own copy |
| `keepMounted` variant of the Dialog | Rejected (2026-10-15): duplicate testids would exist always, not just while open |
| Reusing `<PreviewToolbar>` as the modal's tools rail | Rejected (2026-10-15): duplicate `preview-toolbar` testid + card-inside-card chrome; a new bare rail is specified |
| Extra tools in the modal rail beyond copy + close | Not requested; scope creep |
| Persisting modal-open state across sessions/reloads | V1 (Merges CRUD); v0 state lives in memory |
| Programmatic open API (open the modal from elsewhere) | No caller exists; the trigger is the only entry point |
| Third text input, ActionsBar extensions | Feature 5 |
| Undo/redo | No undo system in v0 |
| New GLOSSARY.md terms | User decision (2026-10-15): the modal is UI mechanics, not domain language |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here - nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Modal composition | The same unmodified `<PreviewArea />` + the existing `<CopyMergedTextButton />`; the preview acts exactly as it does inline; the modal is centralized and the tools sit at the right side, pushed a little right so they do not interfere with the centralization; no visible title | User wording (2026-10-15); reuses existing components untouched; ADR 0003 | y (grilled 2026-10-15) |
| State ownership | Self-contained `PreviewModal`: owns its open/close `useState`, renders trigger + Dialog; the page just places it in the toolbar; no new context | Roadmap 2.3's "shared state via context" is satisfied by SnippetsContext (the modal re-renders the same PreviewArea from it); `CopyMergedTextButton` set the self-contained precedent; no prop drilling anywhere | y (grilled 2026-10-15) |
| Trigger affordance | Icon-only `IconButton`, `OpenInFull` icon, translated `aria-label`, placed below the copy button, disabled while the preview is empty | Matches the icon-only `CopyMergedTextButton` pattern; roadmap 6.4 pinned copy at the top of the bar; an empty preview in a big modal serves no one | y (grilled 2026-10-15) |
| Trigger visibility | Hidden below `md`; the closed modal is unreachable on mobile | User decision (2026-10-15). **Roadmap deviation**: supersedes 2.4's "full-screen on mobile" phrasing for the closed state — full-screen occurs only on the resize edge (below) | y (grilled 2026-10-15) |
| Tools rail | A new bare vertical strip in `PreviewModal.styles.ts` (transparent, no card chrome), top-aligned, inset ~16px (`theme.spacing(2)`) from the Paper's right edge; NOT the `PreviewToolbar` component | Avoids a duplicate `preview-toolbar` testid and card-in-card chrome; mirrors the page's `PreviewColumn` row (preview + bar beside it, `align-items: flex-start`) | y (grilled 2026-10-15) |
| Rail order | Copy button on top, close button under it | User decision (2026-10-15, Round 2): "include a button under the copy button to close the modal view"; copy stays the top tool, as inline | y (grilled 2026-10-15) |
| Close icon | `CloseFullscreen` — the canonical Material opposite of the trigger's `OpenInFull` (`open_in_full` ↔ `close_fullscreen` pair) | User decision (2026-10-15): the closing icon must match the opposite of the open button; both icons verified present in the installed `@mui/icons-material` 9.4.0 | y (grilled 2026-10-15) |
| Accessible name | No visible title; a visually-hidden (screen-reader-only) `DialogTitle` carries `modal.name`; MUI auto-wires the dialog's `aria-labelledby` | Verified in installed `@mui/material` 9.4.0: unknown props land on the Modal root (a plain `aria-label` would NOT name the dialog), while `DialogTitle` consumes `DialogContext.titleId` and auto-wires | y (grilled 2026-10-15) |
| Escape mid-drag conflict | `PreviewArea` gains an additive-only optional `onActiveDragChange?: (active: boolean) => void`; the Dialog sets `disableEscapeKeyDown` while a drag is active in its instance | Verified in installed `@dnd-kit/core` 6.3.1: neither PointerSensor nor KeyboardSensor stops Escape propagation — unguarded, Escape mid-drag cancels the drag AND closes the dialog; the guard also covers Task 3's future drag on/off toggle | y (grilled 2026-10-15) |
| Desktop sizing | `maxWidth="md"` + `fullWidth` (Paper up to ~900px) + fixed Paper height ~90dvh | ~900px is a genuinely bigger reading surface vs the ~400px inline column while staying near DESIGN.md's ~72ch comfortable line length; fixed height keeps chrome stable while long text scrolls inside the preview card | y (grilled 2026-10-15) |
| Resize edge | While open below `md`: stays mounted and switches to `fullScreen={isBelowMd}`; renders null below `md` only when closed | No abrupt close on viewport shrink; the resize edge is the only place full-screen occurs (per the mobile deviation) | y (grilled 2026-10-15) |
| Duplicate-instance policy | Content unmounts when closed (no `keepMounted`); duplicate `data-testid`s exist by design only while open; modal tests scope queries with `within(getByRole("dialog"))` | Existing single-instance suites stay green; screen readers see one preview (MUI `aria-hidden` on the background); ADR 0003 records the contract | y (grilled 2026-10-15) |
| i18n keys | Three flat keys: `modal.name` (accessible name), `modal.open` (trigger aria-label), `modal.close` (close aria-label); copy strings reused | Flat-key convention; the round-1 `title` draft was repurposed as the accessible-name key per the no-visible-title decision | y (grilled 2026-10-15) |
| Testing scope | Full PreviewModal unit suite + page-level integration including the inside-modal-reorder → inline-sync proof | Roadmap 2.5 plus the 2.3 "shared state" proof | y (grilled 2026-10-15) |
| Records | ADR 0003 created; no GLOSSARY changes | The same-component decision passes the triple test (Task 3 architecture depends on it; duplicate testids will tempt future "fixes"; a modal variant was a real alternative); the modal is UI mechanics, not domain language | y (grilled 2026-10-15) |
| Testids | `preview-modal-open-button` (trigger), `preview-modal-close-button` (close); the Dialog itself is located by `role="dialog"` (no extra testid) | Follows the `preview-copy-button` naming convention; role-based dialog lookup is the accessible-query norm | n (agent default) |
| Focus management | MUI defaults kept: autoFocus on the paper, focus trap enforced, focus restored to the trigger on close | No requirement justifies disabling any default | n (agent default) |
| Backdrop click | Closes the dialog (MUI default `onClose` reason `backdropClick`) | Roadmap 2.4 asks for it; default behavior | n (agent default) |
| Copy strings | The modal's copy button reuses `copy.button` / `copy.toast` verbatim — no new copy-related keys | The strings read fine in both surfaces; duplication of copy would double the translation surface | n (agent default) |
| DragOverlay z-index | Unchanged (`zIndex={200}`) — it renders inside the Dialog's DOM and stacks within the dialog | No conflict with MUI's dialog z-index; the overlay floats above the preview content within the surface | n (agent default — placement verified) |
| Copy toast in the dialog | The existing `Snackbar` works as-is inside the dialog (it renders in the dialog's stacking context) | No code change expected; flagged for visual verification during implementation | n (agent default — flagged) |
| PreviewArea surface | The component stays unmodified except the additive callback; its existing `className` prop may carry any modal layout tweak | "The same PreviewArea" is the contract (ADR 0003); `className` exists for exactly this | n (agent default) |
| Empty while open | IF snippets ever become empty while the modal is open (impossible behind the backdrop today), the modal renders the empty state gracefully | Defensive only; no special handling | n (agent default) |
| Hidden title technique | Screen-reader-only styling (1px clip pattern); exact technique is the developer's choice | Only the contract (invisible + accessible) is specified | n (agent default) |
| Rail in fullScreen | The rail (copy + close) stays visible in full-screen mode | Close must remain reachable on the resize edge | n (agent default) |

**Open questions:** none - all resolved or logged above (rows "Copy toast in the dialog" is flagged for visual verification during implementation review).

---

## Implicit-Requirement Dimensions

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | Trigger disabled while `snippets.length === 0`; `onActiveDragChange` optional with a default no-op so every existing PreviewArea consumer and suite is unaffected; viewport gating via `useMediaQuery(theme.breakpoints.down('md'))` |
| Failure / partial-failure states | Clipboard unavailable → existing `CopyMergedTextButton` no-op; snippets vanish while open → empty state renders; a second pointer tapping close during an active drag unmounts the dialog mid-drag → dnd-kit cleanup cancels the drag and no `MOVE_SNIPPET` dispatches, state stays consistent |
| Idempotency / retry / duplicate handling | open → close → open repeats cleanly (content unmounts and remounts from context); the Escape guard resets when the drag ends or cancels; duplicate testids while open are by design, never an error state |
| Auth boundaries & rate limits | N/A because there is no API |
| Concurrency / ordering | Single user, single tab; both preview instances read the one SnippetsContext array; any reorder dispatch re-renders both surfaces simultaneously |
| Data lifecycle / expiry | The open state is component memory; nothing persists |
| Observability | N/A because V0 has no metrics/logging requirement |
| External-dependency failure | MUI and dnd-kit are bundled at build time (no runtime external calls); if `onActiveDragChange` never fires, `disableEscapeKeyDown` stays false and Escape falls back to the roadmap 2.4 close behavior (fail-safe to the spec'd default) |
| State-transition integrity | closed→open only via the trigger; open→closed only via the close button, backdrop, or Escape with no active drag; below `md`: closed stays closed, open stays open (fullScreen) |

---

## User Stories

### P1: Trigger to open the bigger view ⭐ MVP

**User Story**: As a merger, I want a button on the preview toolbar that opens the preview in a bigger view, so that I can read long merged text comfortably.

**Why P1**: Roadmap 2.2; without a trigger there is no feature, and the i18n rule requires both languages for its label.

**Acceptance Criteria**:

1. WHILE the viewport is `md` or wider and the preview contains at least one snippet THEN the PreviewToolbar SHALL render, below the CopyMergedTextButton, an icon-only trigger with the `OpenInFull` icon, `data-testid="preview-modal-open-button"`, and `aria-label` from `pages.mergeSession.previewArea.modal.open`.
2. WHILE the preview is empty THEN the trigger SHALL be disabled.
3. WHILE the viewport is below `md` and the modal is closed THEN PreviewModal SHALL render nothing (user-decision roadmap deviation: the modal cannot be opened from mobile).
4. WHEN the enabled trigger is activated THEN the Dialog SHALL open.
5. WHEN the active language changes THEN the trigger's `aria-label` SHALL follow it (en-US and pt-BR both ship).

**Independent Test**: RTL with `matchMedia` mocks: with snippets seeded, the trigger renders inside the toolbar, labelled, enabled; with no snippets it is disabled; with the below-`md` media query mocked it is absent; clicking it opens `getByRole("dialog")`.

---

### P1: The modal renders the same preview from shared state ⭐ MVP

**User Story**: As a merger, I want the modal to show the exact same preview — same snippets, same order, same behavior — so that the bigger view is just a bigger view, never a diverging copy.

**Why P1**: Roadmap 2.3 ("shared state via context, no duplication"); Task 3's editable surface must be built once and used by both surfaces.

**Acceptance Criteria**:

1. WHEN the Dialog is open THEN it SHALL render the same `PreviewArea` component as the inline preview, consuming `useSnippets()` — the modal SHALL NOT copy or derive its own snippet state.
2. WHEN the merge order changes while the modal is open (e.g. a drag completed inside the modal) THEN both the modal's and the inline preview SHALL re-render identically from the single context state.
3. WHILE the modal is open THEN the inline preview SHALL stay mounted (no swap or unmount of the inline instance).
4. WHILE both instances are mounted THEN each SHALL own its DndContext (Task 1 contract): sorting inside the modal reorders the shared merge sequence, and dragging across instances SHALL NOT occur.
5. WHEN the modal closes THEN its content SHALL unmount (no `keepMounted`), leaving the inline preview as the only mounted instance.
6. WHILE the modal is open THEN duplicate `data-testid`s inside the dialog exist by design (ADR 0003); the modal's own tests SHALL scope queries with `within(getByRole("dialog"))`.

**Independent Test**: SnippetsProvider harness: open the modal; keyboard-sort a snippet `within(getByRole("dialog"))`; assert both the dialog's flow and the inline flow render the new order; close → the modal's `preview-area` is gone from the DOM and the inline one remains.

---

### P1: Centralized layout with a right-side tools rail ⭐ MVP

**User Story**: As a merger, I want the modal's preview centered with the tools tucked at the right edge, so that the bigger view stays visually focused on the text.

**Why P1**: User decision (2026-10-15) on layout; roadmap 2.1 (full component structure, MUI Dialog).

**Acceptance Criteria**:

1. WHEN the Dialog renders THEN its Paper SHALL lay out as a flex row: a left zone (`flex: 1`) that centers the PreviewArea card — natural size up to the available bounds, `min-height: 400px` preserved, internal scrolling beyond — and a bare vertical tools rail at the right.
2. The tools rail SHALL be a new styled strip in `PreviewModal.styles.ts` (transparent, no card chrome — not the `PreviewToolbar` component), top-aligned, inset ~16px from the Paper's right edge, so it does not interfere with the centralization of the preview.
3. The rail SHALL render the CopyMergedTextButton on top and the close button under it.
4. The Dialog SHALL render no visible title; a visually-hidden `DialogTitle` carrying `pages.mergeSession.previewArea.modal.name` SHALL provide the accessible name, auto-wired by MUI's DialogContext (`getByRole("dialog", { name: ... })` resolves).
5. WHILE the viewport is `md` or wider THEN the Dialog SHALL use `maxWidth="md"`, `fullWidth`, and a fixed Paper height of ~90dvh (MUI centers the Paper on screen by itself — verified in the installed Dialog container styles).
6. WHILE the Dialog is open and the viewport is below `md` THEN it SHALL render full-screen (`fullScreen={isBelowMd}`); the rail SHALL remain visible so close stays reachable.

**Independent Test**: `getByRole("dialog", { name: "Preview" })` resolves (and "Prévia" under pt-BR); style assertions on the row/rail layout and the rail's button order; a below-`md` open dialog carries MUI's `fullScreen` paper class.

---

### P1: Closing paths and the Escape-drag guard ⭐ MVP

**User Story**: As a merger, I want obvious, predictable ways to close the bigger view — and I never want Escape to yank the modal away while I am mid-reorder.

**Why P1**: Roadmap 2.4 (ESC/backdrop close, focus trap) + the verified dnd-kit/MUI Escape conflict.

**Acceptance Criteria**:

1. The close button SHALL render in the rail under the copy button with the `CloseFullscreen` icon (the Material opposite of the trigger's `OpenInFull`), `data-testid="preview-modal-close-button"`, and `aria-label` from `pages.mergeSession.previewArea.modal.close`.
2. WHEN the close button is activated THEN the Dialog SHALL close.
3. WHEN the backdrop is clicked THEN the Dialog SHALL close.
4. WHEN Escape is pressed while no drag is active in the modal's preview THEN the Dialog SHALL close.
5. WHILE a pointer or keyboard drag is active in the modal's preview THEN Escape SHALL cancel only the drag and the Dialog SHALL NOT close — implemented via `disableEscapeKeyDown` driven by PreviewArea's `onActiveDragChange`.
6. PreviewArea's new prop SHALL be optional and additive-only (`onActiveDragChange?: (active: boolean) => void`, default no-op): existing PreviewArea consumers and all existing PreviewArea suites SHALL keep passing unchanged.
7. WHILE the Dialog is open THEN focus SHALL be trapped inside it; WHEN it closes THEN focus SHALL return to the trigger (MUI defaults, untouched).
8. WHILE the Dialog is open THEN MUI SHALL keep the app behind it `aria-hidden`, so assistive tech encounters exactly one preview despite the duplicate DOM.

**Independent Test**: click close → dialog gone; backdrop click → gone; Escape (no drag) → gone; keyboard-drag pickup + Escape → drag cancelled, dialog still open, then Escape again → closed; the existing PreviewArea suite passes unmodified (additive-prop proof).

---

### P1: Copy the merged text from the modal ⭐ MVP

**User Story**: As a merger, I want the copy tool right there in the bigger view, so that I do not have to close the modal to grab the merged text.

**Why P1**: Roadmap 2.5 explicitly requires copy button integration in the modal.

**Acceptance Criteria**:

1. The modal rail SHALL render the existing CopyMergedTextButton in the top slot, reusing the existing `copy.button` aria-label and `copy.toast` strings — no new copy-related i18n keys.
2. WHEN the modal's copy button is activated THEN the clipboard SHALL receive `buildMergedText(snippets)` — byte-identical to the inline copy — and the toast SHALL show.
3. WHILE the snippets list is empty THEN the modal's copy button SHALL be disabled (existing `canCopy` behavior, unchanged).

**Independent Test**: clipboard mock: open the modal, click copy `within(getByRole("dialog"))`, assert `writeText` payload equals `buildMergedText(snippets)` and the toast appears within the dialog.

---

### Draft Modal Copy (i18n)

Keys under `pages.mergeSession.previewArea.modal` (copy approved during grilling, 2026-10-15; the copy button reuses the existing `copy.button` / `copy.toast` strings):

| Key | en-US | pt-BR |
| --- | ----- | ----- |
| `name` (accessible name of the dialog, rendered by the visually-hidden DialogTitle) | Preview | Prévia |
| `open` (trigger aria-label) | Open preview in a bigger view | Abrir prévia em visualização ampliada |
| `close` (close button aria-label) | Close preview | Fechar prévia |

---

## Edge Cases

- IF the viewport shrinks below `md` while the modal is open THEN the dialog stays mounted and switches to `fullScreen`; the trigger stays hidden and the rail stays reachable.
- IF the viewport grows back to `md`+ while open THEN the dialog returns to the `md` sizing (`fullScreen` off).
- IF the preview becomes empty while the modal is open (impossible behind the backdrop today) THEN the modal renders the empty state gracefully and the copy button disables itself.
- IF Escape is pressed mid-keyboard-drag or mid-pointer-drag in the modal THEN only the drag cancels (the verified dnd-kit conflict is neutralized by the guard).
- IF a drag ends or cancels THEN `disableEscapeKeyDown` resets so plain Escape closes the modal again.
- IF a second pointer taps the close button while a first pointer drags a snippet THEN the dialog unmounts mid-drag: dnd-kit cleanup cancels the drag, no `MOVE_SNIPPET` dispatches, state stays consistent.
- IF both instances are mounted while the modal is open THEN duplicate `data-testid`s exist by design (ADR 0003); tests scope with `within(getByRole("dialog"))`; screen readers see only the dialog's copy (MUI `aria-hidden` on the background).
- IF the language changes while the modal is open THEN the accessible name, trigger label, close label, sorting announcements, and empty-state text all follow the active language.
- IF the clipboard API is unavailable THEN the copy click no-ops (existing behavior).
- IF the trigger is focused when the dialog opens and closed THEN focus returns to the trigger (MUI restoreFocus).
- IF the merged text is very long THEN the preview card scrolls internally; the dialog chrome never moves.
- IF exactly one snippet exists THEN the modal opens and the single-snippet drag stays inert exactly as inline (Task 1 behavior).

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| MODAL-01 | Trigger to open the bigger view | Specify | Pending |
| MODAL-02 | Trigger to open the bigger view | Specify | Pending |
| MODAL-03 | Trigger to open the bigger view | Specify | Pending |
| MODAL-04 | Trigger to open the bigger view | Specify | Pending |
| MODAL-05 | Trigger to open the bigger view | Specify | Pending |
| MODAL-06 | The modal renders the same preview from shared state | Specify | Pending |
| MODAL-07 | The modal renders the same preview from shared state | Specify | Pending |
| MODAL-08 | The modal renders the same preview from shared state | Specify | Pending |
| MODAL-09 | The modal renders the same preview from shared state | Specify | Pending |
| MODAL-10 | The modal renders the same preview from shared state | Specify | Pending |
| MODAL-11 | The modal renders the same preview from shared state | Specify | Pending |
| MODAL-12 | Centralized layout with a right-side tools rail | Specify | Pending |
| MODAL-13 | Centralized layout with a right-side tools rail | Specify | Pending |
| MODAL-14 | Centralized layout with a right-side tools rail | Specify | Pending |
| MODAL-15 | Centralized layout with a right-side tools rail | Specify | Pending |
| MODAL-16 | Centralized layout with a right-side tools rail | Specify | Pending |
| MODAL-17 | Centralized layout with a right-side tools rail | Specify | Pending |
| MODAL-18 | Closing paths and the Escape-drag guard | Specify | Pending |
| MODAL-19 | Closing paths and the Escape-drag guard | Specify | Pending |
| MODAL-20 | Closing paths and the Escape-drag guard | Specify | Pending |
| MODAL-21 | Closing paths and the Escape-drag guard | Specify | Pending |
| MODAL-22 | Closing paths and the Escape-drag guard | Specify | Pending |
| MODAL-23 | Closing paths and the Escape-drag guard | Specify | Pending |
| MODAL-24 | Closing paths and the Escape-drag guard | Specify | Pending |
| MODAL-25 | Closing paths and the Escape-drag guard | Specify | Pending |
| MODAL-26 | Copy the merged text from the modal | Specify | Pending |
| MODAL-27 | Copy the merged text from the modal | Specify | Pending |
| MODAL-28 | Copy the merged text from the modal | Specify | Pending |

**ID format:** `MODAL-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified; additionally **Deviated** (implemented with a changed contract — see `implementation.md`) and **Deferred** (not implemented — see `implementation.md`).

**Coverage:** 28 total. 0 Verified, 0 Deviated, 0 Deferred. Roadmap mapping: 2.1 (PreviewModal component, MUI Dialog, full structure) → MODAL-12–17 plus the component-structure Goal; 2.2 (open-preview button + translations) → MODAL-01–05 plus the draft i18n table; 2.3 (open/close state, same PreviewArea, shared context, no duplication) → MODAL-04, MODAL-06–11; 2.4 (responsive + accessibility pass) → MODAL-03, MODAL-16–17 (responsive, incl. the user-decision mobile deviation) and MODAL-18–25 (ESC/backdrop close, focus trap, hidden-title naming, background aria-hidden); 2.5 (tests) → every story's Independent Test. Per-requirement outcomes: `.specs/features/preview-area-tools/tasks/preview-area-modal/implementation.md` (to be created by the developer sub-agent).

---

## Success Criteria

How we know the feature is successful:

- [ ] An `OpenInFull` button sits below the copy button in the toolbar, disabled while the preview is empty, absent below `md`; clicking it opens a centered dialog (~900px wide, ~90dvh tall).
- [ ] The dialog shows the same snippets in the same order from SnippetsContext; a reorder performed inside the modal is instantly visible in the inline preview behind it; copy inside the modal puts the byte-identical merged text on the clipboard with the toast.
- [ ] The preview card is centered with the tools rail at the right (copy on top, `CloseFullscreen` under it); no visible title, but screen readers announce the dialog as "Preview"/"Prévia".
- [ ] Close works via the rail button, the backdrop, and Escape; Escape during an active drag (pointer or keyboard) cancels only the drag and the dialog stays open.
- [ ] Focus is trapped while open and returns to the trigger on close; the app behind the dialog is `aria-hidden`.
- [ ] Shrinking the viewport below `md` while open keeps the dialog alive in full-screen; closed below `md`, nothing renders.
- [ ] The three new keys ship in both en-US and pt-BR; existing copy strings are reused verbatim.
- [ ] `npx vitest run`, `npm run lint`, and `npx tsc -b` all pass, with the new PreviewModal suite green and every existing suite passing unchanged (the PreviewArea suite proves the `onActiveDragChange` prop is purely additive).
