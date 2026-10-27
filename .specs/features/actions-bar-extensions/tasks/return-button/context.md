# Return Button (Feature 5, Task 5.1)

**Gathered:** 2026-10-26
**Spec:** `.specs/features/actions-bar-extensions/tasks/return-button/spec.md`
**Status:** Specified — awaiting implementation

---

## Feature Boundary

Return-button flow for Feature 5 Task 5.1 only (roadmap 5.1.1–5.1.7): the ActionsBar button swap (Start Merge ⇄ Return, driven by the existing page-level `mergeStarted` state — 5.1.1 is verification-only, no new state), the two-component confirmation structure (a self-contained `ReturnButton` owning the button, the modal open state, and the don't-show-again preference — the page passes only `onConfirm` — rendering a controlled, presentational `ReturnConfirmationModal`), the modal behavior (R2-Q3 warning message, "Don't show this again" checkbox persisted to localStorage key `output-merger.return-confirmation-dismissed`, Confirm/Cancel, backdrop/Escape as Cancel), the skip-when-dismissed path, the `RESET_ALL` reducer action (clears tokens + tombstones, preserves `editEnabled` + `caseFixLanguage`) followed by the clear-then-re-seed of the preview document with the merged text as plain own text (`serialize(document)` captured at confirm time — the raw visible form), the source restore (input mode, texts preserved via the `initialText` remount, highlights cleared), and the three test layers. NOT Task 5.2 "Start Over", NOT Task 5.3 "Add Text", not undo of the return, not a preference revert path, not PreviewModal changes, not persistence (V1), not GLOSSARY/ADR records.

---

## Implementation Decisions

### Grilling record and scope

- Two rounds, 16 answers, all dated 2026-10-26: Round 1 (Q1–Q13) settled the 5.1.4 semantics, the source reset, the RESET_ALL preservation set, the skip path, persistence timing, dismissal paths, the strings, the button look, the component structure, the keys/testids, the PreviewModal interplay, the test layers, and the glossary; Round 2 (Q1–Q3) settled the two-component refinement, the raw seed payload, and the message wording.

### Button and the mode swap (5.1.1 / 5.1.2)

- **5.1.1 verification-only**: the merge-mode state is the existing `mergeStarted` `useState` in the page workspace (grilled and delivered by the start-merge task, user decision 2026-10-08; re-verified 2026-10-26) — no new state, no rename.
- **User decision (2026-10-26, R1-Q8)**: same ActionsBar slot (right-aligned), same contained visual as `StartMergeButton`, MUI `KeyboardReturn` icon left of the "Return" label, always enabled while in merge mode (returning from an empty merge is legitimate).
- The conditional rendering stays page-owned: `mergeStarted ? <ReturnButton onConfirm={...} /> : <S.StartMergeButton ... />` — the ReturnButton has no knowledge of the mode.

### Two-component structure (R1-Q9 + R2-Q1)

- **User decision (2026-10-26, R1-Q9)**: self-contained `ReturnButton` — PreviewModal's no-props pattern; it owns the button, the modal open state, and the don't-show-again preference; the page passes ONLY `onConfirm` (the page's confirm handler owns the reset orchestration: capture `serialize(document)` from `useSnippets` → dispatch the reset+seed → `setMergeStarted(false)` → bump the remount key; ordering pinned — the capture precedes the clear).
- **User decision (2026-10-26, R2-Q1)**: `ReturnButton` renders `ReturnConfirmationModal` — its own component folder with the full file structure (AGENTS.md component pattern), controlled via `{ open, onConfirm, onCancel }`, presentational only. Both live in `src/pages/MergeSession/components/`, barrel-exported through `components/index.ts`. This satisfies BOTH roadmap 5.1.3's named component AND the self-contained decision.

### Modal behavior and strings (5.1.3 / 5.1.5)

- **User decision (2026-10-26, R1-Q6)**: backdrop click and Escape both close as Cancel — no reset, no persistence; focus returns to the Return button (MUI v9's `onClose` reason funnel; `disableEscapeKeyDown` no longer exists — the PreviewModal hook documents the mechanism).
- **User decision (2026-10-26, R1-Q5)**: the preference is written ONLY on Confirm with the checkbox checked; Cancel/backdrop/Escape never persist. Checkbox default: unchecked on every open (agent default).
- **Strings (user-owned reference wording — the user may tweak the JSON later manually)**:
  - Title: "Return to sources?" / "Retornar aos textos?" (user decision 2026-10-26, R1-Q7)
  - Message: "This removes all snippets from the sources and turns the preview into plain text. Your source texts are kept." / "Isso remove todos os trechos das fontes e transforma a prévia em texto simples. Seus textos de origem são mantidos." (user decision 2026-10-26, R2-Q3 — adjusted now, not deferred)
  - Checkbox: "Don't show this again" / "Não mostrar novamente"; Confirm: "Return" / "Retornar"; Cancel: "Cancel" / "Cancelar" (R1-Q7)
- i18n keys and testids per R1-Q10 (2026-10-26): keys `pages.mergeSession.return`, `pages.mergeSession.returnConfirmation.title` / `.message` / `.dontShowAgain` / `.confirm` / `.cancel`; testids `merge-session-return-button`, `return-confirmation-dialog`, `return-confirmation-checkbox`, `return-confirmation-confirm-button`, `return-confirmation-cancel-button`.

### The skip path (5.1.6)

- **User decision (2026-10-26, R1-Q4)**: a stored preference → clicking Return proceeds immediately, no dialog; no revert path in v0 (clearing the key is manual/dev, like the tutorial key). Recommended read timing: at click (agent default) so a mid-session key change takes effect on the next click.
- localStorage key `output-merger.return-confirmation-dismissed` (roadmap-pinned), value `'true'`, the TutorialBanner try/catch read/write pattern; helpers live in `ReturnButton.hook.tsx` (ReturnButton owns the preference) and re-export through the components barrel (agent default).

### Reset and re-seed (5.1.4 as amended)

- **User decision (2026-10-26, R1-Q1) "Keep merged text"** — the user's divergence from the recommended stale-wording reading: roadmap 5.1.4's "Replace preview area content with plain merged text" is LITERAL. On confirm the document is cleared of all snippet tokens and then RE-SEEDED with the merged text as plain own text (chips gone, highlight colors gone, no tombstones; editable per `editEnabled`). Accepted consequences (pinned in the chosen option): the clear-then-reseed amends the roadmap's "clear all snippets/tokens" wording (annotated at completion, orchestrator); the copy button keeps the draft enabled (non-empty seeded text); a later re-merge appends new snippets AFTER the seeded text per the join-parity rule.
- **User decision (2026-10-26, R1-Q3)**: `RESET_ALL` clears `tokens` + `tombstones`, preserves `editEnabled` (stays ON if ON — empty-vs-editable consequence below) and `caseFixLanguage` (i18n-synced via the provider's `languageChanged` effect).
- **User decision (2026-10-26, R2-Q2) "Raw visible form"** — the user's divergence from the recommended settled payload: the seed is `serialize(document)` — the serialization of the document at confirm time, NOT `serialize(applyAutoFix(...))`. Pinned consequences: the seeding is a non-SYNC transition, so the reducer's composed auto-fix pass still runs over the reseeded document (interior double spaces may collapse, document-edge and line-break-adjacent whitespace may trim, at the seed action itself); own text is never case-fixed (the case pass touches snippet tokens only). An EMPTY merged text produces the EMPTY document (no empty own-text token).
- Code-fact refinement (agent default, forced by the verified `OwnTextToken` contract — its text never contains `\n`): a multi-line merged text seeds as own-text runs separated by line-break tokens (the canonical parse shape of the serialization); the single-run case is the one own-text token of R1-Q1's wording. The seeding SHALL NOT go through `SYNC_DOCUMENT` (it would skip the composed pass — the R2-Q2 pin).
- The sources: **user decision (2026-10-26, R1-Q2)** — internal snippets cleared, texts preserved, via remount (`initialText` fed from the page's existing `sourceTexts` record — the prop exists and is currently unused; a key that changes on every Return and never on Start Merge). Verified fact: the remount fires no `onTextChange`/`onChange`, so the reseed is unperturbed; verified trap avoided: `onChange` re-emits the FULL snippet array, so uncleared highlights would re-flood the preview on the next commit after a re-merge.

### Accepted consequences (R1-Q1 / R1-Q3 / R1-Q11)

- Edit toggle ON at return → stays ON: the seeded text renders as the editable surface; copy stays enabled (copies the seeded text). Toggle OFF → seeded text read-only; copy enabled while the seed is non-empty; empty seed + OFF → the existing empty state and disabled copy.
- **User decision (2026-10-26, R1-Q11)**: an open PreviewModal simply renders the reset/reseeded document — no auto-close, no special handling (both surfaces share the context; the modal's `canOpen` gating follows the existing matrix).

### Tests (5.1.7)

- **User decision (2026-10-26, R1-Q12) "Three layers"**: (1) page-level integration in `MergeSessionPage.test.tsx` — button swap, modal open on click, disabled while open, Cancel/backdrop/Escape without reset, the full confirm flow (sources editable with texts preserved and highlights cleared, seeded preview, Start Merge back and enabled, toggle state preserved), the skip path, persistence timing, PreviewModal interplay; (2) `ReturnConfirmationModal` unit tests; (3) reducer unit tests for `RESET_ALL`. A `ReturnButton` unit suite is Developer latitude (its wiring is exercised by the page suite). Existing page oracles stay green — additive assertions only (agent default).

### Records (R1-Q13)

- **User decision (2026-10-26, R1-Q13) "Leave unnamed"**: NO GLOSSARY.md change — the pre-merge state stays unnamed; refer to it descriptively ("the input/compose state", "before Start Merge"). No ADR (agent default — reversible UI state, no surprising trade-off). The roadmap 5.1.1–5.1.7 checkoff + the 5.1.4 wording annotation happen at completion, by the orchestrator.

### Agent's Discretion

- Remount-key shape (per-page counter vs. per-source epochs) — pinned observable: remount on every Return and only on Return.
- Whether `RESET_ALL` carries the seed payload or a second action seeds it — never via `SYNC_DOCUMENT`; pinned observable: one user-visible reset transition whose seeded result is subject to the composed pass.
- Seeded token id minting (deterministic; free after every clear).
- The `onConfirm` signature carrying the checkbox flag (recommended `onConfirm(dontShowAgain: boolean)`) — the modal stays presentational with the three named props; ReturnButton owns the write.
- localStorage helper placement/naming (recommended: `ReturnButton.hook.tsx`, TutorialBanner pattern, click-time read).
- Focus-return mechanics (MUI's dialog focus restore vs. a manual ref).
- The canonical seed splitter for multi-line merged texts (a small pure splitter vs. parse machinery) — output shape pinned.
- Modal styling details (MUI Dialog defaults + styled-components per the house pattern); no animations beyond MUI defaults.

---

## Specific References

UI paths are relative to `artifacts/output-merger.UI/`.

- `src/pages/MergeSession/components/ReturnButton/` — NEW component folder, full file structure (`ReturnButton.tsx` / `.hook.tsx` / `.types.ts` / `.styles.ts` / `.test.tsx` / `index.ts`): the styled contained Button (StartMergeButton's visual) with the KeyboardReturn icon and label, the modal open state, the disabled-while-open wiring, the preference check + write (the key const + try/catch helpers exported through the barrel), the focus return; props: `onConfirm` only.
- `src/pages/MergeSession/components/ReturnConfirmationModal/` — NEW component folder, full file structure: controlled presentational MUI Dialog `{ open, onConfirm, onCancel }`; title, R2-Q3 message, checkbox (unchecked default), Confirm/Cancel; the pinned i18n keys/testids.
- `src/pages/MergeSession/components/index.ts` — barrel exports for both components.
- `src/pages/MergeSession/MergeSessionPage.tsx` — the ActionsBar children swap; the confirm handler (capture `serialize(document)` via `useSnippets` → dispatch the reset+seed → `setMergeStarted(false)` → bump the remount key); each TextInput gains the remount key + `initialText={sourceTexts[id]}`.
- `src/context/SnippetsContext/SnippetsContext.types.ts` — the `RESET_ALL` action type + the `resetAll` API in `SnippetsContextValue`.
- `src/context/SnippetsContext/SnippetsContext.reducer.ts` — the `RESET_ALL` case (clear tokens + tombstones; preserve `editEnabled` + `caseFixLanguage`; seed per the mechanism choice; the composed-pass wrapper applies as to any non-SYNC transition).
- `src/context/SnippetsContext/SnippetsContext.tsx` — the `resetAll` callback + value wiring.
- `src/context/SnippetsContext/index.ts` — the new type exports.
- `src/i18n/resources/en-US.json` + `pt-BR.json` — the six keys (R1-Q10 + R2-Q3 + R1-Q7 wording).
- `src/pages/MergeSession/MergeSessionPage.test.tsx` — the page integration layer (the established `renderPage` pattern, `localStorage.clear()` in `beforeEach`, testid/`within(dialog)` assertions).
- `src/pages/MergeSession/components/ReturnConfirmationModal/ReturnConfirmationModal.test.tsx` — the modal unit layer.
- `src/context/SnippetsContext/SnippetsContext.reducer.test.ts` — the `RESET_ALL` unit layer.
- `src/pages/MergeSession/components/ReturnButton/ReturnButton.test.tsx` — latitude (covered by the page suite; a focused unit suite is allowed, not required).
- Referenced, UNCHANGED: `src/components/TextInput/TextInput.hook.tsx` + `TextInput.types.ts` (the `initialText` prop consumed — exists, currently unused; mode flips preserve internal text + snippets; only typing clears snippets; `onChange` emits the full array); `src/pages/MergeSession/components/PreviewModal/` (no auto-close plumbing — R1-Q11); `src/pages/MergeSession/components/PreviewArea/` (renders the reseeded document per its existing gating `showEmptyState = !editEnabled && isDocumentEmpty`); `src/pages/MergeSession/components/CopyMergedTextButton/` (`canCopy` keeps the seeded draft's copy enabled); `src/utils/previewDocument.ts` (`serialize` — the raw seed source; the composed `applyAutoFix`); `src/pages/MergeSession/MergeSessionPage.styles.ts` (`StartMergeButton` stays; the Return button's styles live in `ReturnButton.styles.ts`).
- Prior records: `.specs/features/text-merging/tasks/start-merge/` (the one-way transition this task reverses; the `mergeStarted` decision, 2026-10-08; the reserved ActionsBar slot); ADR 0001 (diff-by-id reconciliation — the join-parity rule the re-merge append follows); ADR 0003 (one PreviewArea inline + modal — the shared-surface interplay); ADR 0005 (the composed auto-fix pass — the seed's spacing settlement); `TutorialBanner.hook.tsx` (the localStorage try/catch pattern, key `output-merger.tutorial.dismissed`).
- `roadmap.md` — the 5.1.1–5.1.7 checkoff + the 5.1.4 wording annotation at completion, by the orchestrator.

---

## Deferred Ideas

- Task 5.2 "Start Over" (reset without reload, including the sources) — sibling roadmap placeholder, "to be planned later"; the seeded-preview + remount plumbing built here is its foundation.
- Task 5.3 "Add Text" (up to 4 sources) — sibling roadmap placeholder, "to be planned later"; the `sourceTexts` record and the remount must stay per-source-keyed so this stays open.
- Preference revert path (a UI to re-enable the confirmation dialog) — out of scope in v0 (R1-Q4); clearing the key is manual.
- Undo of the return (restoring chips/tombstones) — no undo surface exists; Feature 4's "Undo auto-corrections" is the deferred umbrella.
- Animations for the button swap / modal transitions beyond MUI defaults — the DESIGN.md motion pass, later polish.
- Persistence of the merge session / merged text beyond the in-memory seeded document — V1 (Merges CRUD).
