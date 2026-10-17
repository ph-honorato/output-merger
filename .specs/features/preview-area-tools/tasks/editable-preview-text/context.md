# Editable Preview Text (Feature 3, Task 3)

**Gathered:** 2026-10-16
**Spec:** `.specs/features/preview-area-tools/tasks/editable-preview-text/spec.md`
**Status:** Specified — awaiting implementation

---

## Feature Boundary

Making the preview text editable, inline and in the modal, for Feature 3 Task 3 (roadmap 3.1–3.6) only: SnippetsContext becomes the preview document model — a single ordered `PreviewToken[]` (snippet tokens, own-text tokens, line-break tokens) where position IS the merge order, with the token-index move (Task 1's reorder migrated), whole-document parsed-edit sync, session tombstones, and a session-level `editEnabled` flag; `SET_SOURCE_SNIPPETS` reconciles snippet tokens inside the document (track/freeze/existence package); the PreviewArea flow root becomes a contentEditable surface while edit is ON (React-rendered token spans, `"\n"` text-node line breaks, mode-aware focused-surface-owns-DOM contract); a "T" edit-text toggle (default OFF, shared state, toolbar + modal rail) gates editing only — dragging stays always live; a pure DOM→tokens parser and a `serialize(document)` copy path with the four-quadrant gating matrix and the empty-document placeholder editor; plus the records (ADR 0004, the ADR 0001 amendment, GLOSSARY updates — Developer deliverables, drafts in the spec) and the test suites. Two **roadmap deviations** (user decisions 2026-10-16, both roadmap lines updated at completion time): (a) roadmap 3.3's drag on/off toggle is replaced by the edit-text toggle; (b) roadmap 3.4's "typing inside a snippet splits it between words" is replaced by in-snippet integration (no split). NOT editing the source TextInputs from the preview, NOT a custom undo/redo system, NOT rich-text paste or formatting tools, NOT tutorial changes, NOT a document character cap, NOT persistence (document, edit state, tombstones — V1), NOT cross-instance dragging, NOT new routes, and NOT writing docs/adr or GLOSSARY.md during the specs phase (Developer deliverables).

---

## Implementation Decisions

### Scope and delivery

- Two grilling rounds: Round 1 (16 answers — two custom answers reshaped the task: Q3 in-snippet integration, Q8 the edit toggle), Round 2 (3 follow-ups: F1 typing+sorting coexist, F2 both bars shared state, F3 placeholder style). Two roadmap deviations recorded with user decision date 2026-10-16, mirroring how the modal task recorded its mobile deviation.

### Document model (3.1)

- **User decision (2026-10-16)**: flat token array — SnippetsContext state becomes a single ordered `PreviewToken[]`; array position IS the merge order; the `order` integer and MOVE_SNIPPET's dense renumbering retire; unique token ids become the sortable ids; the SnippetsContext name and folder stay; `moveSnippet` → a token-index splice.
- **User decision (2026-10-16)**: explicit space tokens — the implicit join-space becomes a `" "` own-text token; serialization is pure concatenation; an unedited session copies byte-identically to today's `join(' ')`.
- Agent default: token shapes — SnippetToken `{kind, tokenId, sourceSnippetId, sourceId, color, text, edited}`, OwnTextToken `{kind, tokenId, text}` (never containing `"\n"` — the parser splits text runs at newlines), LineBreakToken `{kind, tokenId}` serializing `"\n"`; exact field names are Developer latitude within the pinned semantics.
- Agent default: the reducer state carries the tombstone list beside the tokens (below).

### Source reconciliation (3.1 / Q4, adapted to Q3)

- **User decision (2026-10-16)**: the track/freeze/existence package — unedited snippet tokens track their source (a resize rewrites their text; source deletion removes the token); **edited** tokens — meaning tokens containing typed-inside integrated text, per the Q3 no-split decision — are text-frozen (resizes no longer rewrite them) but their existence still follows the source (deletion removes them); new source snippets append at the document end, each preceded by one `" "` separator token; source-deletion removal also removes one adjacent separator token so unedited flows keep serializing like today.
- Agent default: tombstones — the reducer keeps per-session removed-source-snippet ids, set when a parsed edit deletes a snippet token entirely, consulted by `SET_SOURCE_SNIPPETS` (a tombstoned id is not re-appended), cleared when the source emission no longer reports the id; in-memory only. Without tombstones, the next source emission would resurrect user-deleted snippets (a problem the old model never had — the preview could not delete tokens).
- Agent default: the "edited" flag is computed during parsed-edit sync (a snippet token whose text changed vs the previous model token with the same tokenId); it never resets; source-side updates never set it.

### Editable surface & the focused-surface contract (3.2 / Q6)

- **User decision (2026-10-16)**: React spans + freeze — a contentEditable root (the existing `preview-segment-flow`) rendering React token spans (innerHTML technically rejected: dnd-kit's `useSortable` needs React-rendered nodes for refs/listeners); own text as plain text nodes; line breaks as `"\n"` text nodes (no `<br>` — the flow's `white-space: pre-wrap` carries them, and `textContent` then matches serialization for free); while edit ON and focused, React must not reconcile the surface's token children in response to its own typing (memo-frozen children, thawed on blur); the blurred twin re-renders live; non-text model changes (a completed drag, source-driven reconciliation) DO re-render the focused surface; Enter is prevented natively and a `"\n"` text node is inserted manually.
- **Consequence 3 (mode-aware contract)**: with edit OFF the surface behaves exactly as today — React reconciles freely, chips draggable, no caret, no contentEditable attribute. ADR 0004's contract statement is mode-aware.
- Agent default: the freeze mechanism (memo-frozen children keyed on the document, absorbing only the focused surface's own syncs) is implementation latitude within the pinned contract; a caret reset after a drag-while-focused is accepted (keyed reconciliation usually preserves selection — manual check flagged).
- Agent default: ARIA — the host keeps its implicit textbox role + `aria-multiline="true"` + the translated `editing.label`; dnd-kit's chip semantics (role=button, tabIndex, instruction linkage) stay inside the textbox; screen-reader reading of buttons-inside-a-textbox flagged for a manual pass.

### The edit-text toggle (3.3 — roadmap deviation a)

- **User decision (2026-10-16, verbatim)**: "I accept the tradeoff, but the original idea of the app is facilitate merge by selecting snippets. So instead having a toggle drag on/off, we should have a toggle edit text. It should come on off by default. It should be a button under the open modal button with a text 'T' symbol. When it is on, user can type freely. If disabled, the user can just sort the snippets." — replaces roadmap 3.3's "drag on/off toggle that disables dragging only"; the roadmap line is updated at completion time.
- **User decision (2026-10-16, F1)**: typing + sorting coexist — dragging is ALWAYS live in both modes (hold-to-drag still activates after 50ms); the mouse text-selection sacrifice while both are active is accepted; the toggle gates EDITING only.
- **User decision (2026-10-16, F2)**: both bars, one shared session state — the toggle appears in the PreviewToolbar (under the modal-open trigger) AND in the modal's tools rail (under copy, above close), both reflecting the single `editEnabled` in SnippetsContext (default OFF).
- Agent default: the "T" icon is MUI's `Title` (verified present in the installed `@mui/icons-material` 9.4.0 — `Title.js` exists); fallback: a text glyph if it proves visually unsuitable.
- Agent default: a new page-owned `TextEditingToggle` component (standard 6-file split, barrel export), self-contained like `CopyMergedTextButton` (reads context, no props); `PreviewModal`'s rail order becomes copy → edit toggle → close; `editEnabled` is in-memory and resets to OFF on reload.

### Click-vs-drag verification (3.3 / Q11)

- **User decision (2026-10-16)**: snippet chips keep dnd-kit's focusable button semantics for keyboard reordering; typing happens on the editor root; Space/Enter mean "pickup" on a focused chip and "type" on the root.
- Verified in the installed `@dnd-kit/core` 6.3.1 source (2026-10-16): the KeyboardSensor activator `preventDefault()`s the activation key AND only activates when the keydown target IS the activator node — root-caret typing targets the editing host, so the activator declines and the character types. A runtime browser confirmation plus a chip-level `preventDefault` fallback are still prescribed during implementation.
- Agent default: the `sorting.*` announcements now count snippet tokens (the draggable population), 1-based, keys and copy unchanged; the gap/needle index math (`computeNeedleIndex` / `computeGapMoveIndex` / gap droppables) migrates to token indexes as pure, unit-tested helpers; the drop indicator and gap drops land exactly where the needle marks.

### Parsing/sync & in-snippet integration (3.4 — roadmap deviation b)

- **User decision (2026-10-16, verbatim)**: "The user can type inside a snippet, but the snippet does not split into two. The new text just integrates inside the snippet so when the user drags the snippet the new text should be dragged together" — supersedes roadmap 3.4's "typing inside a snippet splits it between words"; the roadmap line is updated at completion time. The integrated text stays inside the colored span, serializes as part of the token, drags along, and the token becomes text-frozen.
- **User decision (2026-10-16)**: whole-document sync — a pure parser runs on every input event and dispatches ONE sync action; deletion is native textarea-like; empty tokens are pruned; the parser and serializer are pure, round-trip-tested helpers.
- **User decision (2026-10-16)**: paste inserts plain text only (`text/plain`, formatting stripped, multi-line preserved as line-break tokens); undo/redo is browser-native, best-effort, only while the surface stays focused; no custom undo in v0.
- Agent default: unrecognized DOM (e.g. from a text drop) flattens to its text content on the next parse — the document degrades to plain text, never to corrupt tokens.

### Serialization & copy (3.5 / Q13)

- **User decision (2026-10-16)**: `buildMergedText` becomes `serialize(document)` — pure concatenation, line-break tokens → `"\n"`, no trimming, no implicit separators; unedited copies byte-identical; the WYSIWYG invariant `flow.textContent === serialize(document)` holds at all times; own-text-only documents are copyable; the `CopyMergedTextButton` component and its strings are reused verbatim.
- Agent default: copy on a still-empty document (edit ON) writes the current serialized text (the empty string) and shows the toast — the defensible pick the user asked for (F3), logged in the spec.
- Agent default: the copy/modal-open gate is `editEnabled || serialize(document).length > 0`, superseding `snippets.length > 0` while preserving today's OFF+empty behavior.

### Empty-document editing (3.2 / Q7 + F3)

- **User decision (2026-10-16)**: the empty preview is clickable-to-edit — the user can build a document purely from own text; with edit ON + empty, the empty-state MESSAGE is replaced by a placeholder-style hint inside the editor, and copy + modal-open enable immediately.
- **Agent default**: the hint is a `data-placeholder` attribute + CSS `:empty::before` pseudo-element (no DOM, no parse/serialization footprint, translation via the React attribute); known caveat — a stray zero-length text node left by the browser while focused may keep the hint hidden until blur; the documented fallback is an absolutely-positioned React overlay sibling. The `preview-empty` block renders only for edit OFF + empty.
- The gating matrix (edit OFF/ON × empty/non-empty × inline/modal) is pinned as a table in the spec (identical inline and in the modal).

### Records

- **User decision (2026-10-16)**: ADR 0004 (`docs/adr/0004-preview-document-model.md`) — the token document model AND the mode-aware focused-surface-owns-DOM contract, one story; plus a one-sentence ADR 0001 amendment (diff-by-id applies to snippet tokens; dense renumbering retired). Both are Developer deliverables — the drafted copy is in the spec's "Draft Records Copy" section; the specs phase does not write docs/adr files.
- **User decision (2026-10-16)**: GLOSSARY.md — update Merged Text's definition; add Own Text and Line Break (drafts in the spec; Developer deliverable); skip a "Preview Document" term (the token model is internal). No other glossary changes.

### i18n

- **User decision (2026-10-16)**: the tutorial is NOT touched (stays 6 steps; no count-assertion changes). Four accessibility-required keys under `pages.mergeSession.previewArea.editing.*` ship in BOTH languages: `label` ("Merged text editor" / "Editor de texto mesclado"), `placeholder` ("Type here to add your own text" / "Digite aqui para adicionar seu próprio texto"), `toggleOn` ("Enable text editing" / "Ativar edição de texto"), `toggleOff` ("Disable text editing" / "Desativar edição de texto"). Copy/sorting/empty strings are reused verbatim.

### Testing (3.6 / Q16)

- **User decision (2026-10-16)**: behavior-level policy — existing suites keep passing at the behavior level (WYSIWYG parity, drag contracts, modal flows, testids) with only listed, deliberate model-migration assertion updates (SnippetsContext reducer tests, PreviewArea flow/parity tests, page integration seeds, copy tests); no suite is deleted. New suites: document-model reducer/provider units, reconciliation units, parser/serializer round-trip units, editing workflows, the toggle, the click-vs-drag contract on the editable surface, serialization/gating, inline↔modal sync.
- Agent default (flagged): IF `userEvent` caret-typing into the contentEditable proves unreliable in jsdom (partial Selection API), THEN the parser/serializer/reducer suites plus manually-dispatched input events remain the automated contract and caret feel is verified manually in the dev server — the Task 1 pointer-drag flag precedent.

### Agent's Discretion

- Token field names and state shape within the pinned semantics; the freeze/thaw mechanism (memo-frozen children recommended).
- Testids: `preview-edit-toggle` (both instances; duplicate while the modal is open by design — ADR 0003); `preview-segment-flow` stays on the editable root; `preview-empty` renders only for edit OFF + empty; all existing preview testids preserved.
- `TextEditingToggle` component name; the toggle is self-contained (no props), like `CopyMergedTextButton`.
- Placeholder technique (`data-placeholder` + `:empty::before`), with the overlay fallback documented.
- Tombstone list naming and storage inside the reducer state; "edited"-flag computation (text changed vs the previous model token with the same tokenId).
- No document character cap; `editEnabled` resets to OFF on reload; spellcheck left at the browser default.
- Announcement positions count snippet tokens; the DragOverlay `zIndex={200}` and all Task 1/1.6 affordances are untouched.
- The gap/needle index-math migration is a set of pure, unit-tested helpers (the spec pins the landing-where-marked behavior, not the helper names).

---

## Specific References

- Roadmap Feature 3 Task 3.1–3.6 (document model + reorder migration, editable surface, click-vs-drag + toggle — deviation a, parsing/sync — deviation b, serialization, tests); both roadmap lines updated at completion time.
- `SnippetsContext/` (`SnippetsState = OrderedSnippet[]`, `SET_SOURCE_SNIPPETS` diff-by-id per ADR 0001, `MOVE_SNIPPET` splice + dense renumber — both migrate; `moveSnippet`; the context value shape).
- `PreviewArea/` (per-instance DndContext, testids `preview-area`/`preview-segment-flow`/`preview-empty`/`preview-snippet`/`preview-snippet-overlay`/`preview-drop-indicator`/`preview-drop-gap`, `className` prop, additive `onActiveDragChange`), `PreviewArea.hook.tsx` (`SNIPPET_DRAG_ACTIVATION` per ADR 0002, `buildSortableId` — dies with token ids, `computeNeedleIndex`, `buildGapId`/`parseGapId`, `computeGapMoveIndex`, announcements), `PreviewArea.styles.ts` (`SegmentFlow` block + `white-space: pre-wrap` — what makes `"\n"` text-node line breaks render; the needle/gap zero-footprint anchors), `SortableSegment/` (chip styling: grab cursors, tint, `user-select: none`, `touch-action: none`), `PreviewToolbar/` (children API), `CopyMergedTextButton/` (`buildMergedText` → `serialize`, `canCopy`, clipboard + toast pattern), `PreviewModal/` (`ModalPreviewArea` via styled-components' `as` — keep this pattern: the direct `styled(PreviewArea)` form crashes under barrel entry orders (implementation.md §3); `ToolsRail` gains the toggle between copy and close; the Escape guard stays untouched), `MergeSessionPage.tsx` (toolbar order copy → modal-open → toggle), `components/index.ts` (barrel).
- `TextInput.types.ts` (`Snippet`: id/text/startIndex/endIndex/color — the source shape the tokens reference), `TextInput.snippets.ts`/`TextInput.tokenize.ts` (word-aligned boundaries, `generateId` uniqueness — a deleted-and-recreated snippet gets a new id, which is why tombstones never block re-creations).
- `src/i18n/resources/en-US.json` + `pt-BR.json` (flat keys; the new `editing.*` block); `utils/color.ts` (`withAlpha` 0.3/0.4 tints).
- ADR 0001 (diff-by-id merge order — amended this task), ADR 0002 (hold-to-drag activation — the contract this task verifies on the editable surface), ADR 0003 (same PreviewArea inline + modal; duplicate testids by design).
- GLOSSARY.md: Merge Order, Snippet, Merged Text (updated), Merge Mode; new Own Text, Line Break (drafts in the spec — Developer deliverables).
- Prior specs: `sort-snippets-by-dragging` (sensors, per-instance DndContext, no-merge-mode gate), `sorting-drop-indicator` (the gap/needle helpers that migrate to token indexes), `preview-area-modal` + its `implementation.md` (MUI v9 quirks: `disableEscapeKeyDown` was REMOVED and the modal root stops Escape propagation — the existing veto+re-dispatch guard stays untouched by this task; the `as={PreviewArea}` styled pattern; the clipboard/userEvent interplay; the media-query mocking pattern), `preview-area-text-flow` (the WYSIWYG `textContent === buildMergedText` invariant and the single-space join contract — the space-token migration supersedes its implicit-separator mechanics while preserving its invariant and by-design double spaces at snippet edges).
- DESIGN.md: body typography (16px/1.6 — the pre-wrap line-break rendering), Cards, focus ring, cursor language (the grab/grabbing chips stay).
- Installed-source verifications (2026-10-16): `@mui/icons-material` 9.4.0 (`Title` present); `@dnd-kit/core` 6.3.1 KeyboardSensor activator (target guard + `preventDefault` on the activation key); stack versions React 19.3.0 / `@mui/material` 9.4.0 / `@dnd-kit/core` 6.3.1 / `@dnd-kit/sortable` 10.0.0 / `@dnd-kit/utilities` 3.2.2 / vitest 5.0.3 / jsdom 30.1.1 / styled-components 6.5.3 / oxlint — React is 19.3.0 installed, newer than the 19.2.8 recorded in prior specs.

---

## Deferred Ideas

- Splitting snippets on typed-inside text (roadmap 3.4's original wording) — rejected by user decision 2026-10-16; revisit only on explicit user request.
- A drag on/off toggle (roadmap 3.3's original wording) — replaced by the edit toggle (user decision 2026-10-16); the drag-gating need is covered by the accepted hold-vs-select tradeoff.
- Custom undo/redo system; rich-text paste; a formatting toolbar — no v0 home.
- A document character cap — no requirement; revisit if UX research asks.
- Persistence of the document, edit state, or tombstones — V1 (Merges CRUD).
- A tutorial step for editing — user decision 2026-10-16: not now; revisit with Feature 5's ActionsBar work if discoverability demands it.
- Cross-instance dragging — Task 1 decision (per-instance DndContext).
- Mobile-specific editor affordances beyond the current responsive behavior.
- A "Preview Document" glossary term — user decision (Q14): the token model stays internal language.
