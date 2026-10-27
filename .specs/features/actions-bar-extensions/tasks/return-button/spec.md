# Return Button Specification

## Problem Statement

After Start Merge the session is one-way in Merge Mode: both sources flip to read-only view mode, the Start Merge button hides, and its ActionsBar slot sits empty — reserved for Feature 5 since the start-merge task (user decision 2026-10-08). The only way back to editable sources today is a full page reload, which loses the merged draft. Roadmap Feature 5 Task 5.1 (5.1.1–5.1.7) asks for the Return button: replace Start Merge with Return once the merge has started, confirm the return through a dismissible MUI Dialog (`ReturnConfirmationModal`, with a "Don't show this again" checkbox persisted to localStorage), and on confirmation dispatch a `RESET_ALL` reducer action (new — `SnippetsContext` has no such action today), restore the sources to input mode, replace the preview with the plain merged text, and swap the ActionsBar back to Start Merge. Two grilling rounds (16 answers, all dated 2026-10-26) amend the roadmap: **(1)** 5.1.4's "Replace preview area content with plain merged text (follows editEnabled state)" is LITERAL — on confirm the document is cleared of all snippet tokens and then re-seeded with the merged text as plain own text (clear-then-reseed amends the roadmap's "clear all snippets/tokens" wording; accepted consequences: the copy button keeps the draft enabled, and a later re-merge appends new snippets AFTER the seeded text); **(2)** the seed payload is the RAW visible serialization `serialize(document)` at confirm time, not the composed-auto-fix (settled) payload — though the composed pass still runs over the reseeded document as over any non-SYNC transition (user decision 2026-10-26, R2-Q2); **(3)** the structure is a self-contained `ReturnButton` (the page passes only `onConfirm`) rendering a controlled, presentational `ReturnConfirmationModal` (user decisions 2026-10-26, R1-Q9 + R2-Q1); **(4)** the pre-merge state stays unnamed — no GLOSSARY change (user decision 2026-10-26, R1-Q13); **(5)** the modal's warning message is worded per Round 2 (user decision 2026-10-26, R2-Q3). This specification defines the button swap, the two-component confirmation structure, the reset-and-reseed semantics, the source remount, the localStorage preference, and the three test layers.

## Goals

- [ ] **5.1.1 (verification-only)**: the existing page-level `mergeStarted` state is confirmed as the merge-mode state — no new state, no rename (delivered by the start-merge task, user decision 2026-10-08; re-verified 2026-10-26 against the code).
- [ ] **5.1.2**: the Return button — MUI `KeyboardReturn` icon left of the "Return" label (`pages.mergeSession.return`), Start Merge's ActionsBar slot (right-aligned) and contained visual — renders INSTEAD OF the Start Merge button while in Merge Mode, always enabled in Merge Mode (user decision 2026-10-26, R1-Q8).
- [ ] **5.1.3 (as amended)**: `ReturnConfirmationModal`, a new MUI Dialog component in `MergeSession/components/` with the full component structure — rendered by the self-contained `ReturnButton` (the page passes only `onConfirm`; user decisions 2026-10-26, R1-Q9 + R2-Q1) and controlled via `{ open, onConfirm, onCancel }`, presentational only: the R2-Q3 warning message, the "Don't show this again" checkbox (persisted to localStorage key `output-merger.return-confirmation-dismissed`), Confirm/Cancel buttons with the approved en-US/pt-BR strings (user-owned reference wording, user decision 2026-10-26, R1-Q7).
- [ ] **5.1.4 (as amended; user decisions 2026-10-26, R1-Q1 + R2-Q2 + R1-Q2 + R1-Q3)**: on confirmation — `RESET_ALL` clears all document tokens and tombstones (preserving `editEnabled` and `caseFixLanguage`), then the document is re-seeded with the merged text as plain own text carrying `serialize(document)` captured at confirm time (raw visible form; empty merged text → empty document; the composed auto-fix pass runs over the seed; a later re-merge appends after the seeded text); the sources switch back to input mode with texts preserved and highlights cleared (TextInput remount + `initialText` from the page's `sourceTexts` record); the ActionsBar shows Start Merge again. The roadmap's "clear all snippets/tokens" wording is amended by the clear-then-reseed (annotated at completion, orchestrator).
- [ ] **5.1.5**: the modal open/close state is wired to the Return button click — the button disables while its modal is open; Cancel, backdrop and Escape close without proceeding or persisting; focus returns to the Return button (user decisions 2026-10-26, R1-Q6 + R1-Q8).
- [ ] **5.1.6**: localStorage persistence — the preference is written ONLY on Confirm with the checkbox checked (user decision 2026-10-26, R1-Q5); a stored preference makes Return proceed immediately with no dialog, and no revert path ships in v0 (user decision 2026-10-26, R1-Q4).
- [ ] **5.1.7**: tests — three layers (user decision 2026-10-26, R1-Q12): page integration (`MergeSessionPage.test.tsx`), `ReturnConfirmationModal` unit tests, and reducer unit tests for `RESET_ALL`.
- [ ] **Records**: NO GLOSSARY change (user decision 2026-10-26, R1-Q13 — the pre-merge state stays unnamed), NO ADR (agent default — reversible UI state); the six i18n keys ship in en-US and pt-BR; the pinned testids ship; the roadmap checkoff + the 5.1.4 wording annotation happen at completion (orchestrator).

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Task 5.2 "Start Over" (reset without reload, incl. sources) | Sibling roadmap placeholder — "to be planned later"; this task's reseed/remount plumbing is its foundation, but the button/flow is not built here |
| Task 5.3 "Add Text" (up to 4 sources) | Sibling roadmap placeholder — "to be planned later"; the `sourceTexts` record and remount must stay per-source-keyed so this stays open |
| Preference revert path (a UI to re-enable the confirmation dialog) | Rejected for v0 (user decision 2026-10-26, R1-Q4): clearing the key is a manual/dev action, like the tutorial key |
| Undo of the return (restoring chips/tombstones) | No undo surface exists; Feature 4's "Undo auto-corrections" is a separate deferred placeholder |
| Auto-closing the PreviewModal on confirm | Rejected (user decision 2026-10-26, R1-Q11): an open modal simply renders the reset document |
| Seeding with the settled (auto-fixed) payload | Rejected (user decision 2026-10-26, R2-Q2): the seed is the raw visible serialization — what the user saw |
| Leaving source highlights in place | Rejected (user decision 2026-10-26, R1-Q2): `onChange` re-emits the FULL array — stale highlights would re-flood the preview on the next commit after a re-merge (tombstones cleared too) |
| New TextInput API (a reset/snippets control prop) | Rejected (user decision 2026-10-26, R1-Q2): the existing `initialText` prop + a remount key suffices |
| A GLOSSARY term for the pre-merge state (e.g. "Compose Mode") | Rejected (user decision 2026-10-26, R1-Q13): left unnamed; the spec refers to it descriptively ("the input/compose state", "before Start Merge") |
| An ADR for the reset/reseed design | None (agent default): reversible UI state, no surprising trade-off |
| Animations on the button swap / modal beyond MUI defaults | DESIGN.md motion deferred (the start-merge precedent) |
| Persistence of the session / merged text beyond the in-memory document | V1 (Merges CRUD) |
| Writing roadmap.md in the specs phase | The orchestrator applies the 5.1.1–5.1.7 checkoff + the 5.1.4 wording annotation at completion |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here - nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| 5.1.4 preview semantics | Clear-then-reseed: `RESET_ALL` clears tokens + tombstones, then the document is re-seeded with the merged text as plain own text (chips gone, highlight colors gone, no tombstones; editable per `editEnabled`) | User decision 2026-10-26 (R1-Q1) "Keep merged text" — the user's divergence from the recommended stale-wording reading; the roadmap line is literal | y (grilled 2026-10-26) |
| Seed payload | `serialize(document)` captured at confirm time — the raw visible form, NOT `serialize(applyAutoFix(...))` | User decision 2026-10-26 (R2-Q2) "Raw visible form" — the user's divergence from the recommended settled payload; the visible preview IS the raw serialization (the WYSIWYG invariant), so the seed matches what the user saw | y (grilled 2026-10-26) |
| Seed vs the composed pass | The seeding transition is a non-SYNC transition: the reducer's composed auto-fix pass (case → spacing → case, ADR 0005) runs over the reseeded document — the seeded text may have interior double spaces collapsed, document-edge whitespace trimmed, and whitespace adjacent to line breaks trimmed at the seed action itself; its case SHALL NOT change (the case pass touches snippet tokens only — verified) | User decision 2026-10-26 (R2-Q2, pinned consequence) | y (grilled 2026-10-26) |
| Seed token shape | The merged text lands as its CANONICAL model: one own-text token for a single-run merged text; a multi-line merged text splits at its `\n`s into own-text runs separated by line-break tokens (`OwnTextToken.text` never contains `\n` — verified type contract; empty runs produce no tokens) | Code-fact refinement of R1-Q1's "ONE plain own-text token" wording — the user's intent (the exact merged text as plain text, no chips) is what is pinned | n (agent default, forced by the verified model invariant) |
| Sources on Return | Internal snippets cleared, texts preserved: each TextInput remounts (key change) with `initialText` fed from the page's existing `sourceTexts` record (prop exists, currently unused) | User decision 2026-10-26 (R1-Q2) "Clear highlights, keep texts" — required for coherence: `onChange` re-emits the full array, so uncleared highlights would re-flood the preview on the next commit after a re-merge | y (grilled 2026-10-26) |
| RESET_ALL preservation set | Clears `tokens` and `tombstones`; preserves `editEnabled` (stays ON if it was ON) and `caseFixLanguage` (i18n-synced via the provider's `languageChanged` effect) | User decision 2026-10-26 (R1-Q3) "Confirm" + the roadmap pin "(without resetting editEnabled)" | y (grilled 2026-10-26) |
| Preference skip | Stored preference → clicking Return proceeds immediately, no dialog; no revert path in v0 (clearing the key is manual/dev, like the tutorial key) | User decision 2026-10-26 (R1-Q4) "Skip modal" | y (grilled 2026-10-26) |
| Persistence timing | Written ONLY on Confirm with the checkbox checked; Cancel/backdrop/Escape never persist | User decision 2026-10-26 (R1-Q5) "Only on Confirm" — declining the action says nothing about the dialog | y (grilled 2026-10-26) |
| Modal dismissal | Backdrop click and Escape both close as Cancel — no reset, no persistence; focus returns to the Return button | User decision 2026-10-26 (R1-Q6) "Backdrop + Escape" | y (grilled 2026-10-26) |
| Modal strings | Title "Return to sources?" / "Retornar aos textos?"; message (user decision 2026-10-26, R2-Q3) "This removes all snippets from the sources and turns the preview into plain text. Your source texts are kept." / "Isso remove todos os trechos das fontes e transforma a prévia em texto simples. Seus textos de origem são mantidos."; checkbox "Don't show this again" / "Não mostrar novamente"; confirm "Return" / "Retornar"; cancel "Cancel" / "Cancelar" | User decision 2026-10-26 (R1-Q7): the strings are user-owned reference wording — implemented as approved, the user may tweak the JSON later manually | y (grilled 2026-10-26) |
| Button look & gating | Same ActionsBar slot (right-aligned), same contained visual as `StartMergeButton`, MUI `KeyboardReturn` icon left of the label, always enabled while in merge mode, disabled while its modal is open | User decision 2026-10-26 (R1-Q8) "Same slot/style" | y (grilled 2026-10-26) |
| Component structure | Self-contained `ReturnButton` (PreviewModal's no-props pattern: owns the button, the modal open state, and the preference; the page passes ONLY `onConfirm`) rendering `ReturnConfirmationModal` — its own component folder, full file structure, controlled via `{ open, onConfirm, onCancel }`, presentational only; both in `MergeSession/components/`, barrel-exported | User decisions 2026-10-26 (R1-Q9 + R2-Q1) "Self-contained ReturnButton" / "Two components" | y (grilled 2026-10-26) |
| i18n keys & testids | Keys `pages.mergeSession.return`, `pages.mergeSession.returnConfirmation.title` / `.message` / `.dontShowAgain` / `.confirm` / `.cancel`; testids `merge-session-return-button`, `return-confirmation-dialog`, `return-confirmation-checkbox`, `return-confirmation-confirm-button`, `return-confirmation-cancel-button` | User decision 2026-10-26 (R1-Q10) — the flat-key and testid conventions of the existing resources/page | y (grilled 2026-10-26) |
| PreviewModal interplay | No special handling: an open PreviewModal simply renders the reset/reseeded document (both surfaces share the context) | User decision 2026-10-26 (R1-Q11) "No special handling" | y (grilled 2026-10-26) |
| Test layers | Three layers: page integration (`MergeSessionPage.test.tsx`) + `ReturnConfirmationModal` unit tests + reducer unit tests for `RESET_ALL` | User decision 2026-10-26 (R1-Q12) "Three layers" | y (grilled 2026-10-26) |
| Glossary term | NONE — the pre-merge state stays unnamed; this spec refers to it descriptively ("the input/compose state", "before Start Merge") | User decision 2026-10-26 (R1-Q13) "Leave unnamed" | y (grilled 2026-10-26) |
| 5.1.1 merge-mode state | The existing page-level `mergeStarted` `useState` IS the state — no new state, no rename; 5.1.1 is verification-only (the state was grilled and delivered by the start-merge task) | Verified code fact 2026-10-26 + start-merge user decision 2026-10-08 | y (grilled 2026-10-08, re-verified 2026-10-26) |
| localStorage helpers | Key const + try/catch read/write helpers in `ReturnButton.hook.tsx` (ReturnButton owns the preference), value `'true'`, re-exported through the components barrel — the TutorialBanner pattern; the preference is READ AT CLICK TIME so a mid-session key change takes effect on the next click | Agent default — the established pattern; pinned observable: stored-at-click → skip | n (agent default) |
| Checkbox default | Unchecked on every modal open (a Cancel with the checkbox checked persists nothing; the next open starts unchecked) | Agent default — trivially reversible | n (agent default) |
| `onConfirm` signature | The modal's confirm callback carries the checkbox flag (recommended `onConfirm(dontShowAgain: boolean)`); `ReturnButton` owns the write, closes the dialog, then calls the page's `onConfirm()` | Agent default — mechanism latitude; pinned observables: the persistence timing + ReturnButton ownership; the modal stays presentational with the three named props | n (agent default) |
| RESET_ALL mechanism | One action carrying the seed payload (`RESET_ALL` + seed text) vs. `RESET_ALL` followed by a dedicated seed action — Developer latitude; the seeding SHALL NOT go through `SYNC_DOCUMENT` (it would skip the composed pass, violating the R2-Q2 pin) | Agent default — pinned observable: one user-visible reset transition whose seeded result is subject to the composed pass | n (agent default) |
| Seeded token id(s) | Deterministic minting (e.g. a fixed `return:seed`-style id — free after every clear); any unique id works | Agent default | n (agent default) |
| Remount key shape | A return-only counter (page state) incremented in the confirm handler — NOT `mergeStarted` (a `mergeStarted`-keyed remount would clear snippets on Start Merge, breaking the start-merge contract); per-source epochs also fine | Agent default — pinned observable: remount on every Return and only on Return | n (agent default) |
| Focus return | MUI's dialog focus-restore default vs. a manual ref focus — latitude; pinned observable: focus lands on the Return button after every close path | Agent default | n (agent default) |
| Reset orchestration | The page's `onConfirm` handler owns the sequence (forced by R1-Q9's "page passes only onConfirm"): capture `serialize(document)` → dispatch the reset+seed → `setMergeStarted(false)` → bump the remount key; `ReturnButton` stays UX-only | Agent default — ordering pinned in Implicit-Requirement Dimensions | n (agent default) |
| No ADR | None — reversible UI state, no surprising trade-off (the next ADR number stays free) | Agent default; consistent with R1-Q13's records posture | n (agent default) |
| No animations | No entry/exit animations on the button swap or modal beyond MUI defaults (DESIGN.md motion deferred — the start-merge precedent) | Agent default | n (agent default) |
| Existing page oracles | Additive assertions only; existing `MergeSessionPage.test.tsx` expectations expected unchanged (the Return button renders only in Merge Mode, where no existing test asserts an empty ActionsBar) | Agent default (test policy) | n (agent default) |

**Open questions:** none - all resolved or logged above. The rows marked `n (agent default)` are mechanism-level latitude (observables pinned, mechanisms free), flagged for confirmation during implementation review.

### Agent defaults (mechanism latitude)

Observables are pinned in the stories below; these mechanisms are the Developer's choice:

- Remount-key shape (per-page counter vs. per-source epochs) — must change on every Return and never on Start Merge.
- Whether `RESET_ALL` carries the seed payload or a second action seeds it — never via `SYNC_DOCUMENT` (the composed pass must run; R2-Q2 pin).
- Seeded token id minting (deterministic; free after every clear).
- The `onConfirm(dontShowAgain)` signature shape (the modal stays presentational with the three named props).
- localStorage helper placement/shape (recommended: `ReturnButton.hook.tsx`, TutorialBanner pattern, click-time read).
- Focus-return mechanics (MUI default restore vs. manual ref).
- The canonical seed splitter for multi-line merged texts (a small pure splitter vs. reusing parse machinery) — output shape pinned (own-text runs + line-break tokens, no embedded `\n`, no empty text tokens).

---

## Implicit-Requirement Dimensions

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | The seed is the document's own serialization, already capped by `PREVIEW_DOCUMENT_MAX_LENGTH` clamping — no extra clamp; an empty merged text produces the empty document (no empty own-text token); source texts pass through the remount verbatim (TextInput's own 500-char cap already held them) |
| Failure / partial-failure states | localStorage unavailable (privacy mode, embedded context): the try/catch read returns not-dismissed and the write is swallowed — the dialog always shows, the preference stays session-only; the reset itself is local synchronous state and cannot partially fail |
| Idempotency / retry / duplicate handling | The Return button disables while its modal is open and swaps away after a successful return — no double-confirm path; `RESET_ALL` from an already-reset state is unreachable through the UI; re-clicking Start Merge after Return is the normal re-entry |
| Auth boundaries & rate limits | N/A because there is no API |
| Concurrency / ordering | Single user, single click; the confirm handler's sequence is pinned: capture `serialize(document)` BEFORE dispatching the reset (the clear destroys the tokens), then flip `mergeStarted`, then bump the remount key — one React commit |
| Data lifecycle / expiry | The preference persists in localStorage (`output-merger.return-confirmation-dismissed`); session state (`mergeStarted`, `sourceTexts`, the seeded document) dies with the page; no persistence of the merged text beyond the seeded document (V1) |
| Observability | N/A because V0 has no metrics/logging requirement |
| External-dependency failure | localStorage is the only external surface (handled above); MUI and i18n are bundled |
| State-transition integrity | The merge-mode round trip stays coherent: Merge Mode → Return → editable sources with texts + seeded-plain preview → Start Merge → Merge Mode; the ActionsBar button always agrees with `mergeStarted`; `editEnabled` survives the round trip; a later re-merge appends after the seeded text (join parity) |

---

## User Stories

### P1: Swap the ActionsBar button with the session state ⭐ MVP

**User Story**: As a merger, I want the ActionsBar to offer Return exactly while my session is in Merge Mode, so that the way back is visible exactly when it applies.

**Why P1**: Roadmap 5.1.2 and 5.1.1; user decision 2026-10-26 (R1-Q8).

**Acceptance Criteria**:

1. WHILE the session is in Merge Mode (`mergeStarted` true) THEN the ActionsBar SHALL render the Return button — MUI `KeyboardReturn` icon left of the "Return" label (`pages.mergeSession.return`), in Start Merge's slot (right-aligned) with the same contained visual — INSTEAD OF the Start Merge button (data-testid `merge-session-return-button`).
2. WHILE the session is in the input/compose state (fresh page or after a completed return) THEN the ActionsBar SHALL render the Start Merge button and SHALL NOT render the Return button.
3. WHILE in Merge Mode THEN the Return button SHALL be enabled — returning from a merge with an empty document is legitimate (no document-emptiness gating).
4. (5.1.1, verification-only) The merge-mode state SHALL be the existing page-level `mergeStarted` state — no new state, no rename (delivered by the start-merge task; verified this task).

**Independent Test**: Page suite — fresh render: Start Merge present (disabled per existing gating), Return absent; after Start Merge: Return present with icon and label, Start absent, sources in view mode.

---

### P1: Confirm the return through the ReturnConfirmationModal ⭐ MVP

**User Story**: As a merger, I want a clear warning before my merge session is dismantled, so that an accidental click costs me nothing.

**Why P1**: Roadmap 5.1.3 + 5.1.5; user decisions 2026-10-26 (R1-Q5, R1-Q6, R1-Q7, R2-Q1, R2-Q3).

**Acceptance Criteria**:

1. WHEN the enabled Return button is clicked and no preference is stored THEN the ReturnConfirmationModal SHALL open (MUI Dialog, data-testid `return-confirmation-dialog`) with the title, the warning message, the "Don't show this again" checkbox (unchecked, data-testid `return-confirmation-checkbox`), and the Confirm/Cancel buttons (data-testids `return-confirmation-confirm-button` / `return-confirmation-cancel-button`) — the approved en-US/pt-BR strings.
2. WHEN Confirm is clicked THEN the modal SHALL close and the return SHALL proceed (the Story 4/5 flows), and IF the checkbox is checked THEN the preference SHALL be written to localStorage key `output-merger.return-confirmation-dismissed` (value `'true'`).
3. WHEN Cancel, the backdrop, or Escape is used THEN the modal SHALL close without proceeding and WITHOUT writing the preference, and focus SHALL return to the Return button.
4. WHILE the modal is open THEN the Return button SHALL be disabled (roadmap 5.1.5).
5. IF localStorage throws (privacy mode, embedded context) THEN the read/write SHALL be swallowed (try/catch) — the dialog SHALL still function and the preference SHALL stay session-only.

**Independent Test**: `ReturnConfirmationModal` unit tests (open renders the five strings and the unchecked checkbox; Confirm/Cancel invoke the callbacks) + page assertions: the key is set ONLY after confirm-with-checkbox; cancel/backdrop/escape leave it unset and the session untouched.

---

### P1: Skip the dialog once dismissed ⭐ MVP

**User Story**: As a merger who has already agreed, I want Return to act immediately, so the confirmation stops slowing me down.

**Why P1**: Roadmap 5.1.6; user decision 2026-10-26 (R1-Q4).

**Acceptance Criteria**:

1. WHEN the Return button is clicked WHILE the preference is stored THEN the modal SHALL NOT open and the return SHALL proceed immediately.
2. No revert path SHALL ship in v0 — clearing the key is a manual/dev action (like the tutorial key).

**Independent Test**: Page suite — seed the key before clicking Return: no dialog appears, sources are editable again, the preview shows the seeded text, Start Merge is back.

---

### P1: Reset and re-seed the preview document ⭐ MVP

**User Story**: As a merger, I want the return to keep my merged draft as plain text while clearing every snippet structure, so I can rework my sources without losing the output I built.

**Why P1**: Roadmap 5.1.4 as amended — the heart of the task; user decisions 2026-10-26 (R1-Q1, R1-Q3, R2-Q2).

**Acceptance Criteria**:

1. WHEN the return proceeds THEN the context SHALL clear all document tokens and all tombstones while preserving `editEnabled` and `caseFixLanguage` (the `RESET_ALL` semantics — a new reducer action; none exists today).
2. WHEN the return proceeds THEN the document SHALL be re-seeded with the merged text as plain own text carrying `serialize(document)` captured at confirm time, BEFORE the clear dispatch — the raw visible form, not the composed-auto-fix payload; chips and highlight colors are gone, and the text is editable per `editEnabled`. The re-seeded document SHALL be the canonical model of the merged text: one own-text token for a single run; own-text runs separated by line-break tokens at each `\n` (no embedded `\n` inside an own-text token; no empty text tokens).
3. IF the merged text is empty THEN the document SHALL be empty (no empty own-text token).
4. The seeding SHALL be subject to the composed auto-fix pass as any non-SYNC transition: the seeded text MAY have interior double spaces collapsed, document-edge whitespace trimmed, and line-break-adjacent whitespace trimmed at the seed action itself; its case SHALL NOT change (the case pass touches snippet tokens only).
5. WHEN a later re-merge creates snippets THEN they SHALL append AFTER the seeded text per the join-parity rule (each new snippet token preceded by one `" "` separator once the document has content).

**Independent Test**: Reducer unit tests — `RESET_ALL` clears tokens + tombstones and preserves `editEnabled` + `caseFixLanguage`; a non-empty single-run seed produces exactly one own-text token of the raw serialization; a multi-line seed produces own-text runs + line-break tokens; an empty seed produces the empty document; a double-spaced seed collapses at the transition while its case stays untouched. Page integration — the preview shows the plain merged text with no chips; copy writes the seeded text.

---

### P1: Restore the sources to editable texts ⭐ MVP

**User Story**: As a merger, I want my sources back as editable texts with their highlights removed, so I can fix them and merge again cleanly.

**Why P1**: Roadmap 5.1.4's "reset inputs to input mode" + the ActionsBar swap; user decision 2026-10-26 (R1-Q2).

**Acceptance Criteria**:

1. WHEN the return proceeds THEN every source SHALL switch to input mode (editable textareas) and the ActionsBar SHALL show the Start Merge button again — enabled per the existing gating (at least one source with non-whitespace text, which the preserved texts satisfy).
2. WHEN the return proceeds THEN each source's text SHALL be preserved and its internal snippets (highlights) SHALL be cleared — by remounting each TextInput with `initialText` fed from the page's `sourceTexts` record (the existing, currently unused prop) and a key that changes on every return.
3. The remount SHALL fire no `onTextChange` and no `onChange` (verified code fact: the callbacks fire only on typing/commits) — the re-seeded document is unperturbed; and the Start Merge mode flip SHALL continue to preserve internal snippets (the remount key changes ONLY on return).

**Independent Test**: Page suite — after confirm: textareas present containing the preserved texts; a subsequent needle-drag commits only the NEW snippet (no old snippets re-emitted into the preview); Start Merge present and enabled.

---

### P1: Accepted consequences across the surfaces ⭐ MVP

**User Story**: As a merger, I want the surfaces around the reset (edit toggle, copy, preview modal) to behave predictably, so the return feels like one coherent action.

**Why P1**: The accepted consequences of user decisions 2026-10-26 (R1-Q1, R1-Q3, R1-Q11), pinned so the Developer and Tester verify them deliberately.

**Acceptance Criteria**:

1. IF the edit-text toggle was ON at return THEN it SHALL stay ON — the seeded text renders as the editable surface (contentEditable) and the copy button stays enabled.
2. IF the toggle was OFF THEN the seeded text SHALL render read-only (the plain flow) and the copy button SHALL be enabled while the seeded text is non-empty; IF the merged text was empty and the toggle OFF THEN the existing empty state and the disabled copy button SHALL show.
3. WHILE the PreviewModal is open at confirm THEN it SHALL remain open and simply render the reset/re-seeded document (no auto-close, no special handling).

**Independent Test**: Page suite — toggle ON before Return: the seeded preview is contentEditable and copy stays enabled; PreviewModal open during Return: the dialog remains open showing the seeded text (same content as the inline preview).

---

### P1: Records — strings, testids, no glossary, no ADR ⭐ MVP

**User Story**: As a maintainer, I want this task's records to be exactly what was decided — the approved strings shipped, no terminology churn, no ADR — so future work builds on the recorded decisions.

**Why P1**: User decisions 2026-10-26 (R1-Q10, R1-Q13); the records posture of the grilling.

**Acceptance Criteria**:

1. The i18n resources (en-US and pt-BR) SHALL gain `pages.mergeSession.return` and `pages.mergeSession.returnConfirmation.title`, `.message`, `.dontShowAgain`, `.confirm`, `.cancel` with the approved reference wording (user-owned — the user may tweak the JSON later manually).
2. The pinned testids SHALL ship: `merge-session-return-button`, `return-confirmation-dialog`, `return-confirmation-checkbox`, `return-confirmation-confirm-button`, `return-confirmation-cancel-button`.
3. NO GLOSSARY.md change and NO ADR SHALL ship with this task; the roadmap 5.1.4 wording amendment (clear-then-reseed) is recorded in this spec and annotated at completion by the orchestrator.

**Independent Test**: Records scan — both resource files carry the six keys; no GLOSSARY/ADR/docs diff among the task's changes; the testids present in the rendered components.

---

## Edge Cases

- IF the merged text is empty at confirm (no snippet ever created, or everything deleted) THEN the document becomes empty: toggle OFF → the empty state, disabled copy button, disabled modal trigger; toggle ON → the empty editable surface.
- IF the seed text is whitespace-only THEN the composed pass's trims empty it — the token(s) drop and the document becomes empty (same observable as the empty seed).
- IF the merged text contains line breaks THEN the seed canonicalizes to own-text runs separated by line-break tokens (never a `\n` inside an own-text token); consecutive line breaks survive as consecutive line-break tokens.
- IF localStorage throws THEN the read returns not-dismissed and the write is swallowed — the dialog always shows; the preference stays session-only.
- IF the preference was stored in an earlier session THEN the first Return click of a new session skips the dialog (click-time read).
- IF the user cancels with the checkbox checked THEN nothing persists; the checkbox starts unchecked on the next open.
- IF Return is confirmed WHILE the PreviewModal is open THEN the dialog stays open rendering the seeded text; the inline preview shows the same (shared context).
- IF the user re-merges after a return THEN the new snippet tokens append after the seeded own text, each preceded by one separator (join parity) — the seeded draft stays ahead until edited or deleted.
- IF the sources' texts sit at the 500-char cap THEN the remount preserves them verbatim (`initialText`; no re-validation, no truncation).
- IF the serialized document sits at `PREVIEW_DOCUMENT_MAX_LENGTH` THEN the seed is within the limit by construction (the document-limit clamp caps the model) — no extra clamp.
- IF the remount key were tied to `mergeStarted` THEN Start Merge would clear internal snippets (breaking the start-merge contract) — rejected; the key changes only on Return.
- IF the user returns with the edit toggle ON THEN the toggle keeps its ON state; the seeded surface is editable and copy copies the seeded text.
- IF a second Return click arrives while the dialog is open THEN the disabled button blocks it (5.1.5); after a successful return the button is gone (swapped for Start Merge).

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| RET-01 | Swap the ActionsBar button with the session state | Specify | Pending |
| RET-02 | Swap the ActionsBar button with the session state | Specify | Pending |
| RET-03 | Swap the ActionsBar button with the session state | Specify | Pending |
| RET-04 | Swap the ActionsBar button with the session state | Specify | Pending |
| RET-05 | Confirm the return through the ReturnConfirmationModal | Specify | Pending |
| RET-06 | Confirm the return through the ReturnConfirmationModal | Specify | Pending |
| RET-07 | Confirm the return through the ReturnConfirmationModal | Specify | Pending |
| RET-08 | Confirm the return through the ReturnConfirmationModal | Specify | Pending |
| RET-09 | Confirm the return through the ReturnConfirmationModal | Specify | Pending |
| RET-10 | Skip the dialog once dismissed | Specify | Pending |
| RET-11 | Skip the dialog once dismissed | Specify | Pending |
| RET-12 | Reset and re-seed the preview document | Specify | Pending |
| RET-13 | Reset and re-seed the preview document | Specify | Pending |
| RET-14 | Reset and re-seed the preview document | Specify | Pending |
| RET-15 | Reset and re-seed the preview document | Specify | Pending |
| RET-16 | Reset and re-seed the preview document | Specify | Pending |
| RET-17 | Restore the sources to editable texts | Specify | Pending |
| RET-18 | Restore the sources to editable texts | Specify | Pending |
| RET-19 | Restore the sources to editable texts | Specify | Pending |
| RET-20 | Accepted consequences across the surfaces | Specify | Pending |
| RET-21 | Accepted consequences across the surfaces | Specify | Pending |
| RET-22 | Accepted consequences across the surfaces | Specify | Pending |
| RET-23 | Records — strings, testids, no glossary, no ADR | Specify | Pending |
| RET-24 | Records — strings, testids, no glossary, no ADR | Specify | Pending |
| RET-25 | Records — strings, testids, no glossary, no ADR | Specify | Pending |

**ID format:** `RET-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified; additionally **Deviated** (implemented with a changed contract — see `implementation.md`) and **Deferred** (not implemented — see `implementation.md`).

**Coverage:** 25 total. 0 Verified, 0 Deviated, 0 Deferred. Roadmap mapping: 5.1.1 → RET-04 (verification of the already-delivered `mergeStarted` state); 5.1.2 → RET-01–03; 5.1.3 → RET-05, RET-09 (+ RET-23–24, the strings/testids); 5.1.4 → RET-12–19 (reset/reseed + sources) + RET-20–22 (accepted consequences); 5.1.5 → RET-08; 5.1.6 → RET-06 (write timing) + RET-10–11 (the skip path); 5.1.7 → every story's Independent Test under the three-layer policy (user decision 2026-10-26, R1-Q12: page integration + modal unit + reducer unit). The roadmap 5.1.4 line is annotated at completion to record the clear-then-reseed amendment (user decision 2026-10-26, R1-Q1). Per-requirement outcomes: `.specs/features/actions-bar-extensions/tasks/return-button/implementation.md` (to be created by the Developer sub-agent).

---

## Success Criteria

How we know the feature is successful:

- [ ] Fresh page: Start Merge present (disabled until text), Return absent. After Start Merge: Return present (KeyboardReturn icon + "Return" label, same slot/visual), Start absent, always enabled.
- [ ] Return click opens the dialog with the approved strings and an unchecked checkbox; the button disables while it is open; Cancel, backdrop and Escape close without resetting or persisting, and focus returns to the Return button.
- [ ] Confirm (unchecked): sources are editable textareas holding the same texts with highlights gone; the preview shows the plain merged text (editable iff the toggle was ON — the toggle keeps its state); Start Merge is back and enabled; an open PreviewModal shows the seeded text; copy writes the seeded text.
- [ ] Confirm (checked): localStorage `output-merger.return-confirmation-dismissed` holds `'true'`; the next Return click skips the dialog entirely and resets immediately.
- [ ] After a return, a new snippet selection lands AFTER the seeded text with a separator between; the copy button stays enabled while the seeded text is non-empty.
- [ ] Reducer rows: `RESET_ALL` clears tokens + tombstones, preserves `editEnabled` + `caseFixLanguage`, seeds the raw serialization in canonical form (single run → one own-text token; multi-line → runs + line-break tokens; empty → empty), and the composed pass settles the seed's spacing without touching its case.
- [ ] `npx vitest run`, `npm run lint`, and `npx tsc -b` pass; the three test layers are green; existing page oracles stay green (additive assertions only); no GLOSSARY/ADR/docs changes ship.
