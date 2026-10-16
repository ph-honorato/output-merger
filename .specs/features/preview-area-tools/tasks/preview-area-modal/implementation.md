# Preview Area Modal Implementation

**Implemented:** 2026-10-15
**Spec:** `.specs/features/preview-area-tools/tasks/preview-area-modal/spec.md`
**Context:** `.specs/features/preview-area-tools/tasks/preview-area-modal/context.md`
**Code:** `artifacts/output-merger.UI/src/`
**Status:** Implemented — Feature 3, Task 2 (roadmap 2.1–2.5) complete; verified by 19 new automated tests (194 total), oxlint, `tsc -b`, `vite build`. One mechanism deviation (MODAL-22 — the MUI prop the spec named no longer exists in the installed version; behavior implemented and verified identically — see §6).

---

## 1. Deliverables

| File | Role |
| ---- | ---- |
| `src/pages/MergeSession/components/PreviewModal/PreviewModal.tsx` | New page-owned component (standard 6-file split): renders the icon-only trigger (hidden below md, disabled while the preview is empty) and, when open, the MUI Dialog — the same unmodified `<PreviewArea />` (rendered through the `ModalPreviewArea` tweak via styled-components' `as`), the existing `<CopyMergedTextButton />`, and the close button in the right-side tools rail |
| `src/pages/MergeSession/components/PreviewModal/PreviewModal.hook.tsx` | New: open/close `useState`, below-md `useMediaQuery(theme.breakpoints.down('md'))` gate, empty-preview `canOpen`, the drag-active guard state fed by `onActiveDragChange`, `handleDialogClose` (the Dialog `onClose` funnel: Escape-veto while dragging + the close/reset path) |
| `src/pages/MergeSession/components/PreviewModal/PreviewModal.styles.ts` | New: `VisuallyHiddenTitle` (sr-only `styled(DialogTitle)`), `ModalLayout` (paper content as a flex row, 90dvh at md+ / 100% in fullScreen), `PreviewZone` (flex 1, centers the card), `ModalPreviewArea` (the className-borne layout tweak for the shared PreviewArea root), `ToolsRail` (bare transparent strip, top-aligned, `theme.spacing(2)` right inset) |
| `src/pages/MergeSession/components/PreviewModal/PreviewModal.types.ts` | New: `PreviewModalProps` (`className?` on the trigger) |
| `src/pages/MergeSession/components/PreviewModal/PreviewModal.test.tsx` | New: +17 unit tests (trigger, labelled dialog, scoped content parity, layout/rail, copy integration, all close paths, Escape-mid-drag guard, resize edge, reopen cycle, background aria-hidden, additive-callback hook tests) |
| `src/pages/MergeSession/components/PreviewModal/index.ts` | New: barrel for the component and its types |
| `src/pages/MergeSession/components/PreviewArea/PreviewArea.types.ts` | Modified (additive-only): optional `onActiveDragChange?: (active: boolean) => void` prop |
| `src/pages/MergeSession/components/PreviewArea/PreviewArea.hook.tsx` | Modified (additive-only): `usePreviewArea(onActiveDragChange?)` — `notifyActiveDragChange` fires `true` on drag start and `false` on drag end (every path, before any early return) and drag cancel; no existing return value, testid, or behavior touched |
| `src/pages/MergeSession/components/PreviewArea/PreviewArea.tsx` | Modified (additive-only): destructures and forwards the new prop to the hook (one line) |
| `src/pages/MergeSession/components/index.ts` | Modified: `export * from './PreviewModal'` (appended) |
| `src/pages/MergeSession/MergeSessionPage.tsx` | Modified: `<PreviewModal />` placed as the second child of `<PreviewToolbar>`, below `<CopyMergedTextButton />`; import via the page components barrel |
| `src/pages/MergeSession/MergeSessionPage.test.tsx` | Modified (additive-only): +2 integration tests — trigger placement inside the toolbar; the full shared-state proof (seed snippets through the real UI, open the modal, keyboard-reorder inside it, assert the inline flow updates, close, assert a single instance remains). The `TextInput.geometry` module is mocked with a virtual monospace layout (10px/char) so needle drags create real snippets through the actual page UI |
| `src/i18n/resources/en-US.json`, `pt-BR.json` | Modified: 3 new keys under `pages.mergeSession.previewArea.modal.*` (spec copy, verbatim, both languages); copy strings reused, no new copy-related keys |

ADR 0003 (`docs/adr/0003-preview-modal-renders-same-preview-area.md`) was delivered by the specs phase and is present (not modified by the developer). No routes changed; no backend files touched; `roadmap.md`, `context.md`, `GLOSSARY.md`, and the spec untouched.

---

## 2. Behavior (as implemented)

```tsx
// PreviewModal.tsx — the page only places <PreviewModal /> in the toolbar
{isBelowMd ? null : (
  <IconButton data-testid="preview-modal-open-button"
    aria-label={t('pages.mergeSession.previewArea.modal.open')}
    disabled={!canOpen} onClick={handleOpen}>
    <OpenInFull />
  </IconButton>
)}
<Dialog open={open} onClose={handleDialogClose}
  maxWidth="md" fullWidth fullScreen={isBelowMd}>
  <S.VisuallyHiddenTitle>{t('pages.mergeSession.previewArea.modal.name')}</S.VisuallyHiddenTitle>
  <S.ModalLayout $fullScreen={isBelowMd}>
    <S.PreviewZone>
      <S.ModalPreviewArea as={PreviewArea} onActiveDragChange={handleActiveDragChange} />
    </S.PreviewZone>
    <S.ToolsRail>
      <CopyMergedTextButton />
      <IconButton data-testid="preview-modal-close-button"
        aria-label={t('pages.mergeSession.previewArea.modal.close')} onClick={handleClose}>
        <CloseFullscreen />
      </IconButton>
    </S.ToolsRail>
  </S.ModalLayout>
</Dialog>
```

```tsx
// PreviewModal.hook.tsx — the Escape guard (see §3/§6 for the mechanism)
const handleDialogClose = useCallback(
  (_event: unknown, reason: 'backdropClick' | 'escapeKeyDown') => {
    if (reason === 'escapeKeyDown' && dragActive) {
      // MUI v9 removed disableEscapeKeyDown AND its modal root stops
      // Escape propagation before dnd-kit's document-level sensors
      // can see the key — veto the close and forward a fresh Escape
      // so the sensors cancel the drag; the dialog stays open.
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }),
      );
      return;
    }
    handleClose();
  },
  [dragActive, handleClose],
);
```

```ts
// PreviewArea.hook.tsx — additive-only drag-lifecycle notification
notifyActiveDragChange(true);   // handleDragStart (unconditional)
notifyActiveDragChange(false);  // handleDragEnd — FIRST line, before every early return
notifyActiveDragChange(false);  // handleDragCancel
```

- **Trigger (2.2)**: icon-only `IconButton` with `OpenInFull`, `data-testid="preview-modal-open-button"`, `aria-label` from `modal.open`, placed below the copy button, `disabled` while `snippets.length === 0`, not rendered below `md` (`useMediaQuery(theme.breakpoints.down('md'))`). The open dialog itself is never gated: below `md` the component renders nothing only while closed.
- **Dialog (2.1/2.3/2.4)**: `maxWidth="md"` + `fullWidth` + `fullScreen={isBelowMd}`; no `keepMounted` (content unmounts on close); MUI focus trap/autoFocus/restoreFocus defaults untouched; a visually hidden `DialogTitle` (1px-clip sr-only pattern) carries `modal.name` and auto-wires the dialog's `aria-labelledby` via `DialogContext` — `getByRole('dialog', { name: 'Preview' })` and `'Prévia'` both resolve.
- **Layout**: the paper's content is one flex row — `PreviewZone` (`flex: 1`, `align-self: stretch`, `align-items: center`, `theme.spacing(2)` padding) centers the shared PreviewArea card at its natural size up to the zone bounds; `ToolsRail` (transparent, no card chrome, top-aligned, `margin: 16px 16px 0 0`) holds copy on top and close under it and stays visible in fullScreen. The layout row is fixed at `height: 90dvh` at md+ (100% in fullScreen), so the paper renders ~90dvh, its chrome stays stable, and long text scrolls inside the preview card (its own `overflow: auto`, `min-height: 400px` untouched).
- **Escape guard (2.4)**: `onActiveDragChange` (additive, default no-op) mirrors the modal's PreviewArea instance drag lifecycle into `dragActive`; `handleDialogClose` vetoes the `escapeKeyDown` close while a drag is active and re-dispatches a fresh Escape at the document so dnd-kit's sensors cancel the drag; `handleClose` also resets the guard (covers a close during an in-flight drag, e.g. the rail close button tapped mid-pointer-drag: dnd-kit cleanup cancels that drag without firing the callback).
- **Close paths**: rail close button, backdrop click, and Escape (no active drag) all funnel into the same `handleClose` state transition; the first two need no veto, Escape passes through the guard.
- **Shared state (2.3)**: zero duplicated snippet state — the modal renders the same `PreviewArea` consuming `useSnippets()`; any reorder dispatch re-renders both surfaces simultaneously (proven by the page integration test).

---

## 3. Key implementation decisions (agent defaults, within spec latitude)

- **`disableEscapeKeyDown` does not exist in the installed MUI 9.4.0 — and its absence reshaped the mechanism.** Verified against the installed source and CHANGELOG ("[Dialog][Modal] Remove `disableEscapeKeyDown` prop (#47695)"): v9's `useModal` keydown handler is the only Escape consumer, and it both `stopPropagation()`s the key at the Modal **root div** (before the event can reach dnd-kit's document-level sensor listeners) and calls `onClose(event, 'escapeKeyDown')`. Passing the spec-named prop would not compile (unknown prop) and would do nothing. The reimplemented guard: veto the `escapeKeyDown` close in `onClose` while `dragActive`, then `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }))` so the PointerSensor/KeyboardSensor document listeners receive exactly one Escape and cancel the drag (announcements, overlay cleanup, `onActiveDragChange(false)` all run). The observable contract is identical to the spec's; see §6.
- **The modal's PreviewArea tweak is carried by its existing `className` prop via styled-components' `as`.** `S.ModalPreviewArea` is a `styled.div` (declaring the optional `onActiveDragChange` prop type) rendered with `as={PreviewArea}`: the generated class merges into the shared `PreviewAreaRoot`'s own class, flipping only its flex participation for the centered zone (`flex: 0 1 auto; max-width: 100%` — natural size up to the zone bounds, internal scroll beyond, `min-height: 400px` preserved). An earlier `styled(PreviewArea)` variant was rejected: it dereferences the component at module-evaluation time and crashes (`Cannot create styled-component for component: undefined`) whenever the module graph is entered through `PreviewArea.tsx` (which itself imports the barrel for `SortableSegment`) — the cycle leaves `PreviewArea.tsx` mid-evaluation. The `as` form keeps `PreviewModal.styles.ts` free of barrel imports entirely; JSX component references are dereferenced at render time, so the remaining barrel use is safe under every entry point.
- **The paper height is carried by the fixed-height content row.** MUI v9's Dialog Paper styles (maxWidth/fullWidth/fullScreen variants, flex column, `maxHeight: calc(100% - 64px)`) belong to the emotion-styled `DialogPaper`, which is only injected when the default paper slot renders — replacing the slot (e.g. a custom `styled(Paper)`) would silently drop the `maxWidth`/`fullScreen` sizing. The layout instead renders one fixed-`90dvh` flex row inside the untouched paper: the paper hugs it (net paper height ≈ 90dvh, centered by MUI's own scroll-paper container), and the `$fullScreen` transient prop switches the row to `height: 100%` so the resize edge leaves no gap. `dvh` is asserted through the generated CSS (jsdom's CSSOM does not resolve the unit in `toHaveStyle`).
- **Below-md viewport in tests.** MUI v9's `useMediaQuery` uses `useSyncExternalStore` against the query `(max-width:899.95px)`; the suite installs a mutable `window.matchMedia` spy (live `matches` getter + captured change listeners) so the initial state and the resize flip are both deterministic. `vi.restoreAllMocks()` blanks the setup file's bare `vi.fn` mocks (no original implementation to restore) — the suite re-establishes the default `matches: false` behavior (and the clipboard mock's resolved value) in its `beforeEach`/`afterEach`.
- **Clipboard in tests.** `userEvent.setup()` replaces `navigator.clipboard` with its own stub for the whole environment, so the copy test avoids userEvent entirely (opening and copying via `fireEvent`), matching the proven `CopyMergedTextButton.test` pattern. This was the one genuinely non-obvious testing landmine found while building the suite.
- **Trigger focus restore** relies on MUI's default `disableRestoreFocus: false`: the trigger is focused by the userEvent click that opens the dialog, and the TrapFocus unmount restore returns focus to it (asserted after the close path completes).
- **Backward close semantics**: the modal's Escape is suppressed only while `dragActive`; a backdrop click or rail-close during a drag still closes (the spec's mid-drag-close edge case), and `handleClose` resets the guard so a reopened dialog always closes on plain Escape.

---

## 4. Testing strategy

- **Trigger units (+5)**: renders inside the toolbar, below the copy button, translated and enabled with snippets; disabled while empty; hidden below md (and nothing else renders while closed); the three keys ship verbatim in BOTH resource files; pt-BR labels for the trigger, dialog name, and close button.
- **Dialog units (+10)**: opens a dialog named "Preview" with sr-only title styles and `MuiDialog-paperWidthMd`/`MuiDialog-paperFullWidth` classes plus `height:90dvh` in the generated CSS; scoped content parity (`within(dialog)` segment flow equals `buildMergedText(context)`), duplicate `preview-area` testids by design while the inline instance stays mounted, and the inline surface inside `aria-hidden="true"` while the modal's is not; rail order (copy on top, close under it, both direct children) + no `preview-toolbar` reuse + row/rail CSS; copy integration (clipboard mock payload + toast within the dialog); close via rail button (content unmounts → one `preview-area`, focus restored to the trigger), backdrop (mouseDown+click on the container), and Escape; the reopen cycle.
- **Escape guard (+1 unit + hook pair)**: keyboard pickup inside the modal (rect-mock + `pressKey` pattern from the PreviewArea suite) → Escape at the dragged chip → the drag cancels (overlay gone, order unchanged, live region announces "Snippet reorder cancelled.") and the dialog **stays open**; the next Escape closes it. Hook-level: `onActiveDragChange` fires true on start and false on end/cancel (all paths); without a callback the hook behaves exactly as before.
- **Resize edge (+1)**: open at md+, flip the media query live → the dialog stays mounted, the paper gains `MuiDialog-paperFullScreen`, the rail (close button) stays reachable, the trigger hides; flip back → md sizing and trigger return.
- **Page integration (+2)**: the trigger renders inside the real toolbar (disabled before any snippets); the full flow — type two sources, start the merge, needle-drag snippets through the real TextInput (geometry mocked 10px/char), open the modal, keyboard-reorder a snippet `within(getByRole("dialog"))`, assert **both** the dialog's flow and the inline flow render `beta beta gamma`, close, assert a single `preview-area` remains with the reordered text (the shared-context/no-duplication proof, MODAL-06..11).
- **Additive-only proof**: `PreviewArea.test.tsx` is byte-identical (`git status` shows it untouched) and all 175 pre-existing tests pass unchanged; the entire existing suite (13 files) is green.
- Verification: `npx tsc -b` (clean), `npm run lint` (oxlint, clean), `npx vitest run` (194/194 across 13 files), `npm run build` (clean; the >500 kB chunk-size note is informational, unchanged from Task 1).

---

## 5. Per-requirement outcomes

| ID | Outcome | Note |
| -- | ------ | ---- |
| MODAL-01 | Verified | Unit: trigger inside the toolbar, below the copy button, `OpenInFull`, `preview-modal-open-button`, `modal.open` aria-label; page: trigger inside the real toolbar |
| MODAL-02 | Verified | Unit: disabled while the preview is empty; page: disabled before snippets exist |
| MODAL-03 | Verified | Unit: below-md viewport mock — no trigger, no dialog while closed (user-decision mobile deviation) |
| MODAL-04 | Verified | Every dialog test opens via the enabled trigger (`openDialog`) |
| MODAL-05 | Verified | Unit: pt-BR trigger label / dialog name "Prévia" / close label; resource keys asserted verbatim in both languages |
| MODAL-06 | Verified | The modal renders the same `PreviewArea` component consuming `useSnippets()` via `as` (no variant, no copied state); parity test + page flow |
| MODAL-07 | Verified | Page integration: inside-modal reorder updates both surfaces identically (`beta beta gamma` in the dialog's flow AND the inline flow) |
| MODAL-08 | Verified | Two `preview-area` instances while open (unit + page); the inline preview never unmounts/swaps |
| MODAL-09 | Verified | Per-instance DndContext (Task 1, untouched); the modal's instance sorts its own sequence independently (mid-drag unit test exercises its own drag lifecycle); cross-instance dragging never wired |
| MODAL-10 | Verified | Close tests: content unmounts (no `keepMounted`) — one `preview-area` after close; reopen cycle re-mounts from context |
| MODAL-11 | Verified | All modal queries scope with `within(getByRole('dialog'))`; duplicate testids exist only while open (ADR 0003) |
| MODAL-12 | Verified | `ModalLayout` flex row + `PreviewZone` (flex 1, centered, stretch) in generated CSS; `min-height: 400px` + internal scroll inherited from the untouched `PreviewAreaRoot`; visual centering listed for the manual pass |
| MODAL-13 | Verified | `ToolsRail`: transparent, no background/border/shadow, top-aligned, `margin:16px 16px 0 0` (spacing(2) right inset) — CSS-asserted; NOT the PreviewToolbar component (asserted absent in the dialog) |
| MODAL-14 | Verified | Rail order: copy button precedes the close button, both direct children of the rail |
| MODAL-15 | Verified | No visible title; sr-only `DialogTitle` auto-wires the accessible name — `getByRole('dialog', { name: 'Preview' })` and `{ name: 'Prévia' }` resolve; 1px/absolute/overflow-hidden styles asserted |
| MODAL-16 | Verified | `MuiDialog-paperWidthMd` + `MuiDialog-paperFullWidth` classes; the fixed `height:90dvh` content row (see §3 height nuance); chrome stability + internal card scroll |
| MODAL-17 | Verified | Resize edge: open dialog survives the flip to below-md, paper gains `MuiDialog-paperFullScreen`, rail stays reachable, trigger hidden; flip back returns md sizing |
| MODAL-18 | Verified | `CloseFullscreen` icon, `preview-modal-close-button` testid, `modal.close` aria-label (en + pt) |
| MODAL-19 | Verified | Rail close button click closes the dialog (unit) |
| MODAL-20 | Verified | Backdrop mouseDown+click on the dialog container closes (unit) |
| MODAL-21 | Verified | Escape with no active drag closes the dialog (unit) |
| MODAL-22 | Deviated (mechanism only — behavior Verified) | Escape mid-drag cancels only the drag and the dialog stays open (unit test: overlay cleared, order unchanged, cancellation announced, dialog open; next Escape closes). **Mechanism deviation:** `disableEscapeKeyDown` was removed in the installed MUI v9.4.0 and v9's modal root additionally stops Escape propagation before dnd-kit's document-level sensors can receive it — the guard is implemented as an `onClose('escapeKeyDown')` veto while `dragActive` plus a re-dispatched Escape to the sensors (§3). The spec's observable contract is met in full; the named prop no longer exists to pass |
| MODAL-23 | Verified | `onActiveDragChange` is optional with a no-op default; `PreviewArea.test.tsx` is byte-identical and the full existing suite passes unchanged; hook-level tests cover true-on-start / false-on-end-and-cancel (all paths) and the no-callback default |
| MODAL-24 | Verified | MUI focus trap + restoreFocus defaults untouched; unit: focus returns to the trigger after close; trap enforcement itself is MUI's default behavior (manual pass item) |
| MODAL-25 | Verified | Unit: while open, the inline preview sits inside `aria-hidden="true"` (MUI ModalManager) and the modal's instance does not |
| MODAL-26 | Verified | The modal's copy button is the existing component reusing `copy.button`/`copy.toast` verbatim; no new copy-related keys (resource diff shows only the three modal keys) |
| MODAL-27 | Verified | Unit: `writeText('Hello Alpha')` === `buildMergedText(context order)` and the toast renders within the dialog |
| MODAL-28 | Verified | The rail's copy is the existing `CopyMergedTextButton` with its unchanged `canCopy` empty-state disable (its own suite passes unchanged) |

**28 total: 27 Verified, 1 Deviated (mechanism-only, behavior fully implemented and tested), 0 Deferred.**

---

## 6. Deviations from spec.md

One, forced by the installed dependency version (details in §3):

- **MODAL-22's named mechanism (`disableEscapeKeyDown`) does not exist in the installed `@mui/material` 9.4.0.** The CHANGELOG records its removal ("[Dialog][Modal] Remove `disableEscapeKeyDown` prop (#47695)"), and the v9 `useModal` keydown handler additionally `stopPropagation()`s Escape at the Modal root — before dnd-kit's document-level sensor listeners can receive the key (the spec's verification focused on dnd-kit's non-stopping behavior and on the DialogTitle auto-wiring, both of which held; the removed prop did not). The implemented guard preserves every specified observable behavior: while a drag is active in the modal's preview, an Escape is swallowed (the close is vetoed) and a fresh Escape is forwarded to the document so the drag cancels through dnd-kit's own cancel path; with no active drag, Escape closes normally; the guard resets when the drag ends/cancels and on close. Verified by the mid-keyboard-drag unit test (cancel-only-drag, dialog open, cancellation announced, second Escape closes) and the additive hook tests. No other requirement deviated.

Judgment calls inside the spec's agent-default latitude (recorded in §3, none changes a specified behavior): the paper height is carried by a fixed-90dvh content row inside the untouched MUI paper (net rendered height ~90dvh; avoids replacing MUI's paper slot, which would silently drop the maxWidth/fullScreen variant styles); the PreviewArea tweak rides its existing `className` prop through styled-components' `as` (the direct `styled(PreviewArea)` form crashes under barrel entry orders — verified); the three close paths share one `handleClose` state transition (the rail button cannot literally travel through the Dialog's `onClose` event — the funnel is the shared handler, with Escape additionally passing through the guard).

---

## 7. Known gaps / deferred

Manual dev-server verification for the tester sub-agent (things jsdom cannot see or feel):

- **Copy toast legibility inside the dialog (the spec's flagged item)**: the existing `Snackbar` renders inside the dialog's stacking context; its contrast/positioning over the dialog surface (and over the preview card) needs an eyeball check — flagged, expected to work unchanged, do not "fix" without checking MODAL-26 (no new copy keys).
- The centered natural-size preview card (short content centered, long content filling the ~830px zone and scrolling internally at 90dvh) and the rail's visual alignment with the card's top edge.
- The fullScreen switch on a live viewport resize (below md while open) and the trigger's disappearance/reappearance.
- Focus trapping feel with the keyboard (Tab cycling) and the visible focus return to the trigger on close (restore is asserted in jsdom; the visual focus ring is not).
- The Escape-mid-drag behavior with a real pointer drag (hold-and-drag a chip, press Escape): the drag should cancel with the announcement and the dialog must stay open — the guard mechanism is input-agnostic and keyboard-proven, but the pointer path is worth a manual confirmation.

Deferred by spec (not gaps): editable preview / drag on/off toggle (Task 3 — the modal renders the same component precisely so that surface is built once), document-model migration (Task 3.1), extra rail tools (other Feature 3 tasks), `keepMounted` variant (rejected), persistence (V1), programmatic open API (no caller).
