# Editable Preview Text Specification

## Problem Statement

The preview (Feature 3 Tasks 1–2) is a read-only sortable flow: a merge-ordered array of `OrderedSnippet`s rendered as colored segment spans, reorderable by hold-to-drag (ADR 0002) and rendered identically inline and in the modal (ADR 0003), with `buildMergedText` joining snippet texts with single spaces. Roadmap Feature 3 Task 3 (3.1–3.6) asks for the v0 epic's remaining promise — make the preview text editable, inline and in the modal: extend SnippetsContext into a preview document model (snippet tokens + own-text tokens + line breaks, migrating Task 1's reorder onto it), build the editable surface (contentEditable rendering colored snippet tokens, textarea-like caret/selection), verify the click-vs-drag contract with a mode toggle, implement edit parsing/sync, and serialize the document for copy. Two user decisions (2026-10-16) reshape the roadmap lines and are recorded as deviations, mirroring how the modal task recorded its mobile deviation: **(a)** roadmap 3.3's "drag on/off toggle that disables dragging only" is replaced by an **edit-text toggle** — off by default, a "T" button — that gates editing only, while dragging stays always live in both modes; **(b)** roadmap 3.4's "typing inside a snippet splits it between words" is replaced by **in-snippet integration** — typed text joins the snippet token so the snippet still drags and serializes as one unit. Both roadmap lines are updated at completion time to record the deviations. Three facts verified in the installed packages shape this specification: (1) dnd-kit's `useSortable` needs React-rendered nodes, so the classic contentEditable technique (`dangerouslySetInnerHTML` with update-skipping) is technically infeasible — the token spans must stay React elements, and the focused surface must simply not be reconciled instead; (2) installed `@dnd-kit/core` 6.3.1's KeyboardSensor activator both `preventDefault()`s the activation key and only activates when the keydown target IS the activator node — exactly the split needed for Space/Enter to mean "pickup" on a focused chip and "type" on the editor root; (3) the installed stack is React 19.3.0 / `@mui/material` 9.4.0 / `@dnd-kit` core 6.3.1 + sortable 10.0.0 / vitest 5.0.3 / jsdom 30.1.1 / styled-components 6.5.3 — React is now 19.3.0, slightly newer than the 19.2.8 recorded in prior specs.

## Goals

- [ ] SnippetsContext becomes the preview document model: a single ordered `PreviewToken[]` (snippet / own-text / line-break tokens) where array position IS the merge order; `MOVE_SNIPPET` becomes a token-index splice (the `order` integer and dense renumbering retire); every token carries a globally unique id (the sortable id); a whole-document sync action absorbs parsed edits; a session-level `editEnabled` flag (default OFF) lives beside the document; reducer + provider suites migrate.
- [ ] `SET_SOURCE_SNIPPETS` reconciles snippet tokens inside the document: the initial build and appends insert `" "` own-text separator tokens (join parity — an unedited session serializes byte-identically to today's `join(' ')`); resizes rewrite unedited tokens' text; edited (typed-in) tokens are text-frozen; source deletion removes all of a snippet's tokens plus one adjacent separator; user-deleted snippet ids are tombstoned against resurrection.
- [ ] Editable surface: with edit ON, the segment flow root (`preview-segment-flow`) becomes a single contentEditable surface (implicit textbox semantics, `aria-multiline`, translated label) rendering React token spans — colored snippet chips unchanged, own text as plain text nodes, line breaks as `"\n"` text nodes (no `<br>`); with edit OFF the surface is exactly today's read-only flow.
- [ ] Focused-surface-owns-DOM contract (mode-aware, ADR 0004): while edit ON and focused, React does not reconcile the surface's token children in response to its own parsed edits; thaw on blur; non-text model changes (completed drag, source-driven reconciliation) re-render the focused surface; Enter is prevented natively and inserts a `"\n"` text node; deletion is native textarea-like.
- [ ] Edit-text toggle: icon-only "T" IconButton (`Title` icon — verified installed in `@mui/icons-material` 9.4.0), `aria-pressed`, translated labels, default OFF, ONE shared session state reflected by buttons in BOTH the PreviewToolbar (under the modal-open trigger) and the modal's tools rail (under copy, above close) — **replaces roadmap 3.3's drag on/off toggle (deviation a)**; toggling OFF mid-typing commits the focused DOM first.
- [ ] ADR 0002's click-vs-hold contract verified on the editable surface: click = caret, hold = drag — dragging stays always live in both modes (F1); chips keep dnd-kit's keyboard-sortable semantics; the drop indicator and gap drops land exactly where marked, on token indexes.
- [ ] Edit parsing/sync: a pure DOM→tokens parser runs on every input event, dispatching ONE whole-document sync; typing inside a snippet integrates into the token (no split — **deviation b**); plain-text multi-line paste; tombstone writes on full snippet deletion.
- [ ] Serialization: `buildMergedText` becomes `serialize(document)` — pure concatenation, line-break tokens → `"\n"`, no trimming, no implicit separators; the WYSIWYG invariant `flow.textContent === serialize(document)`; the copy/canOpen gating matrix; empty copy (edit ON) writes `""` with the toast.
- [ ] Empty-document editing: edit ON + empty renders the editable root with a placeholder hint (no `preview-empty` block) and copy/modal-open enabled (F3); edit OFF + empty keeps today's empty state and disabled gating.
- [ ] Four i18n keys ship in both en-US and pt-BR under `pages.mergeSession.previewArea.editing.*`; the tutorial is NOT touched (user decision).
- [ ] Tests per the Q16 policy: new suites for the document model, reconciliation, parser/serializer round-trips, editing workflows, the toggle, the click-vs-drag contract, serialization, and inline↔modal sync; existing suites pass at behavior level with only listed model-migration updates; the jsdom caret-typing fallback is flagged.
- [ ] Records as Developer deliverables (drafts in this spec): ADR 0004 (document model + focused-surface contract), the ADR 0001 amendment sentence, and the GLOSSARY updates (Merged Text update; new Own Text and Line Break terms).

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Drag on/off toggle (roadmap 3.3's original wording) | Replaced by the edit-text toggle — user decision 2026-10-16 (deviation a); dragging stays always live in both modes |
| Splitting snippets on typed-inside text (roadmap 3.4's original wording) | Replaced by in-snippet integration — user decision 2026-10-16 (deviation b) |
| Editing the source TextInputs from the preview | Sources are locked in Merge Mode and are the snippets' origin; preview edits mutate the document only |
| Custom undo/redo system | Native best-effort while the surface stays focused; no undo requirement in v0 (modal-spec precedent) |
| Rich-text paste or a formatting toolbar (bold, lists) | v0 merged text is plain; paste strips to `text/plain` |
| Tutorial changes (a 7th step) | User decision 2026-10-16: "No need to update tutorial for this"; the toggle's translated labels carry discoverability |
| Document character cap | The 500-char limit is TextInput's input-mode limit; the roadmap sets no cap for the document |
| Persistence of the document, edit state, or tombstones | V1 (Merges CRUD); v0 lives in memory |
| Cross-instance dragging (inline ↔ modal) | Task 1 decision stands (per-instance DndContext) |
| Third text input, ActionsBar extensions | Features 4/5 |
| New routes/pages | None; the feature lives on the MergeSession page |
| Replacing dnd-kit | The editable surface keeps Task 1's sortable investment (ADR 0002) |
| New "Preview Document" GLOSSARY term | User decision (Q14): the token model is internal; Merged Text / Own Text / Line Break cover the language |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here - nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Document model shape | Flat ordered `PreviewToken[]` in SnippetsContext; array position IS the merge order; unique token ids as sortable ids; `MOVE_SNIPPET` → token-index splice with no renumbering; keep the SnippetsContext name and folder | Roadmap 3.1 "extend SnippetsContext"; the name already owns "the merge sequence" and renaming touches everything for nothing | y (grilled 2026-10-16) |
| Space separators | The implicit join-space becomes an explicit `" "` own-text token; serialization is pure concatenation; an unedited session copies byte-identically to today's `join(' ')` | Every character must belong to exactly one token for editing to be uniform; join parity keeps copy/WYSIWYG stable | y (grilled 2026-10-16) |
| Typing inside a snippet — **roadmap deviation (b)** | NO split: typed text integrates INTO the snippet token (stays inside the colored span, serializes as part of the token, drags together with it); the token becomes text-frozen ("edited") | User decision, verbatim: "The user can type inside a snippet, but the snippet does not split into two. The new text just integrates inside the snippet so when the user drags the snippet the new text should be dragged together". Supersedes roadmap 3.4's "splits between words"; the roadmap line is updated at completion time | y (grilled 2026-10-16) |
| Source reconciliation package | Unedited snippet tokens track the source (resize rewrites text; source deletion removes the token); edited tokens (containing typed-inside text) are text-frozen but their existence still follows the source; new source snippets append at the end, each preceded by one `" "` token; source-deletion removal also removes one adjacent separator token | User accepted Q4, adapted to Q3 ("edited" = contains typed-inside integrated text); keeps unedited flows serializing like today | y (grilled 2026-10-16) |
| Records | ADR 0004 (document model + focused-surface-owns-DOM contract, one story) + a one-sentence ADR 0001 amendment — both Developer deliverables, drafts in this spec | User accepted Q5; both pass the ADR triple test (hard to reverse, surprising, real trade-offs) | y (grilled 2026-10-16) |
| Surface mechanics | contentEditable root with React-rendered token spans (innerHTML rejected: dnd-kit needs React nodes); own text as plain text nodes; line breaks as `"\n"` text nodes (no `<br>` — the flow's `white-space: pre-wrap` carries them); focused surface not reconciled for its own typing (memo-frozen children, thawed on blur); the blurred twin re-renders live; non-text model changes (completed drag, source-driven reconciliation) re-render the focused surface; Enter prevented natively + manual `"\n"` insertion | User accepted Q6; the only technique compatible with dnd-kit's ref/listener model | y (grilled 2026-10-16) |
| Editable when empty | Edit ON + empty = editable editor with a placeholder hint; copy and modal-open enabled; the user can build a document purely from own text | User decision (Q7 + F3 custom) | y (grilled 2026-10-16) |
| Edit toggle replaces drag toggle — **roadmap deviation (a)** | A "T" IconButton (default OFF) gates EDITING only: ON = typing enabled, OFF = today's sort-only behavior; placed under the modal-open trigger (toolbar) and in the modal rail; dragging is always live in both modes | User decision, verbatim: "...instead having a toggle drag on/off, we should have a toggle edit text. It should come on off by default. It should be a button under the open modal button with a text 'T' symbol. When it is on, user can type freely. If disabled, the user can just sort the snippets." Supersedes roadmap 3.3's drag on/off toggle; the roadmap line is updated at completion time | y (grilled 2026-10-16) |
| Dragging always live | Edit ON keeps hold-to-drag active (50ms activation, ADR 0002); mouse text-selection is the accepted sacrifice while both are active; edit OFF = today exactly | F1 follow-up: the toggle gates editing only | y (grilled 2026-10-16) |
| Shared edit state | ONE session-level `editEnabled` (default OFF) in SnippetsContext; both toggle buttons (toolbar + modal rail) reflect and control it | F2 follow-up + Q10 reinterpreted for the edit toggle | y (grilled 2026-10-16) |
| Paste & undo | Plain-text paste (`text/plain`, formatting stripped, multi-line preserved as line-break tokens); undo/redo browser-native best-effort only while focused; blurring re-renders from the model and resets the native undo stack; no custom undo in v0 | User accepted Q9; modal-spec precedent ("No undo system in v0") | y (grilled 2026-10-16) |
| Keyboard drag coexistence | Chips keep dnd-kit's focusable button semantics (tabIndex, role, instruction linkage): Space/Enter on a FOCUSED chip picks it up; typing happens on the editor root. Verified in installed `@dnd-kit/core` 6.3.1: the activator `preventDefault()`s the activation key AND only activates when the keydown target IS the activator node (root-caret typing targets the host → activator declines → character types) | User accepted Q11; runtime browser confirmation plus a chip-level `preventDefault` fallback still prescribed during implementation | y (grilled 2026-10-16; mechanism verified, runtime flagged) |
| Edit dispatch | A pure DOM→tokens parser on every input event → ONE whole-document sync action; native textarea-like deletion; empty tokens pruned; parser and serializer are pure, round-trip-tested helpers | User accepted Q12; nothing in v0 consumes per-keystroke granularity (no persistence, native undo) | y (grilled 2026-10-16) |
| Serialization | `serialize(document)` = pure concatenation of token texts (line-break tokens → `"\n"`), no trimming, no implicit separators; unedited copy byte-identical; WYSIWYG invariant `flow.textContent === serialize(document)`; own-text-only documents are copyable | User accepted Q13 | y (grilled 2026-10-16) |
| GLOSSARY | Update Merged Text's definition; add Own Text and Line Break (drafts in this spec, Developer deliverables); no "Preview Document" term | User accepted Q14; these are user-facing domain concepts (the v0 epic promises "add own text"), unlike Task 1's UI mechanics | y (grilled 2026-10-16) |
| i18n + tutorial | Four keys under `pages.mergeSession.previewArea.editing.*` (`label`, `placeholder`, `toggleOn`, `toggleOff`) in BOTH languages — accessibility-required; the tutorial is NOT touched (stays 6 steps, no count-assertion changes) | User decision Q15: "No need to update tutorial for this" | y (grilled 2026-10-16) |
| Test policy | Behavior-level: existing suites keep passing with only listed, deliberate model-migration assertion updates; no suite deleted; jsdom caret-typing fallback flagged | User accepted Q16; "unchanged" would be false for a state-model migration | y (grilled 2026-10-16) |
| Gating matrix | edit OFF + empty = today (empty-state block, copy/modal-open disabled); edit OFF + non-empty = today (enabled); edit ON + empty = editable editor + placeholder hint, copy/modal-open enabled; edit ON + non-empty = editable, everything enabled — identical inline and in the modal | F3 + Q7/Q8 consequences, pinned per user answers | y (grilled 2026-10-16) |
| Copy on an empty document | Writes the current serialized text (the empty string) and shows the toast | User asked for a defensible agent pick (F3); WYSIWYG-honest: copy always copies what the document is | n (agent default) |
| "T" icon | MUI `Title` icon — verified present in the installed `@mui/icons-material` 9.4.0 (`Title.js` exists); fallback: a text-glyph button if the icon proves unsuitable visually | The user's "text 'T' symbol"; `Title` is the canonical Material T glyph | n (agent default — icon verified installed) |
| Toggle component | New page-owned `TextEditingToggle` component (standard 6-file split, barrel export), self-contained like `CopyMergedTextButton`: reads context, renders the IconButton; placed by `MergeSessionPage` (toolbar) and `PreviewModal` (rail) | AGENTS.md component rules; the self-contained precedent | n (agent default) |
| Testids | `preview-edit-toggle` on both instances (duplicate while the modal is open, by design — ADR 0003); `preview-segment-flow` stays on the editable root; `preview-empty` renders only for edit OFF + empty; all existing preview testids preserved | Testid continuity precedent (`preview-*` naming, no collision — verified by search during grilling) | n (agent default) |
| Placeholder mechanism | `data-placeholder` attribute on the editor root + CSS `:empty::before` (a pseudo-element: no DOM, no parse/serialization footprint, translation flows via the React attribute). Known caveat: a stray zero-length text node left by the browser while focused may keep the hint hidden until blur — IF unreliable in practice, fall back to an absolutely-positioned React overlay sibling | The standard editable-placeholder technique; parse purity outranks the cosmetic caveat | n (agent default — flagged) |
| Tombstones | The reducer keeps per-session removed-source-snippet ids: set when a parsed edit deletes a snippet token entirely; consulted by `SET_SOURCE_SNIPPETS` (a tombstoned id is NOT re-appended); cleared when the source emission no longer reports the id; in-memory only | The old model never allowed preview-side deletion, so this is new state; without it, the next source emission would resurrect user-deleted snippets | n (agent default) |
| "edited" flag mechanism | Computed during parsed-edit sync: a snippet token whose text changed vs the previous model token with the same tokenId becomes edited (never resets; source-side updates never set it) | Observable semantics are pinned in the reconciliation story; the mechanism is implementation latitude | n (agent default) |
| Editor ARIA | The contentEditable host keeps its implicit textbox role + `aria-multiline="true"` + `aria-label` from `editing.label`; chips keep dnd-kit's role=button semantics inside the textbox; screen-reader reading of buttons-inside-a-textbox is flagged for a manual pass | Native semantics; dnd-kit defaults preserved | n (agent default — flagged) |
| Document length | No character cap on the preview document | The 500-char limit is TextInput's input-mode limit; sources are the funnel for snippet text; the roadmap sets no document cap | n (agent default) |
| Edit state persistence | `editEnabled` is in-memory session state, default OFF on every reload | v0 has no persistence (V1 will) | n (agent default) |
| Announcement semantics | The `sorting.*` announcement positions now count snippet tokens (the draggable population), 1-based; keys and copy unchanged | Announcements describe the sortable items; keys reused verbatim | n (agent default) |
| Focus behavior details | Native caret on click; programmatic focus places the caret per browser default; a caret reset after a drag-while-focused is accepted (keyed reconciliation usually preserves selection — manual check) | Textarea-like feel; browser-native | n (agent default — flagged) |
| Reconciliation re-render while focused | A source-driven `SET_SOURCE_SNIPPETS` is a "non-text" change → the focused surface re-renders from the model (the Q6 rule) | The sources sit behind the modal when it is open; inline it is the ordinary path | n (agent default) |
| jsdom caret typing | IF `userEvent` typing into the contentEditable proves unreliable in jsdom THEN the parser/serializer/reducer suites plus manually-dispatched input events remain the automated contract; caret feel is verified manually in the dev server | jsdom's Selection API is partial; Task 1's pointer-drag flag precedent | n (agent default — flagged) |
| Spellcheck | Browser default on the contentEditable host; no custom dictionary work | No requirement; native feel | n (agent default) |

**Open questions:** none - all resolved or logged above (rows "Keyboard drag coexistence", "Placeholder mechanism", "Editor ARIA", "Focus behavior details", and "jsdom caret typing" are flagged for confirmation during implementation review).

---

## Implicit-Requirement Dimensions

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | The parser prunes empty tokens; `moveToken` no-ops on equal/out-of-bounds indexes or a vanished token id; token ids are globally unique; no document length cap (agent default); `editEnabled` is one boolean of shared state |
| Failure / partial-failure states | Mid-typing modal close/unmount loses nothing (every input event synced the document); mid-drag token deletion discards the reorder (fresh id resolution, as in Task 1); toggling edit OFF mid-typing commits before freezing; a paste with no `text/plain` data no-ops; a source emission arriving during focused typing reconciles safely (the reducer serializes all actions) |
| Idempotency / retry / duplicate handling | Re-dispatching an identical whole-document sync yields content-identical state; the toggle is idempotent; parse and serialize are pure; repeated drag-over events with an unchanged target stay stable |
| Auth boundaries & rate limits | N/A because there is no API |
| Concurrency / ordering | Single user, single tab; one reducer serializes sync/reconcile/move actions; the focused surface absorbs its own syncs; both surfaces read the one document |
| Data lifecycle / expiry | The document, tombstones, and `editEnabled` are in-memory session state; persistence is V1 |
| Observability | N/A because V0 has no metrics/logging requirement |
| External-dependency failure | dnd-kit and MUI are bundled at build time; contentEditable is the browser runtime surface — a browser without it degrades to the edit-OFF flow (not a supported target in practice) |
| State-transition integrity | After every sync the token array IS the parse of the focused DOM (the freeze invariant); the four gating-matrix quadrants have well-defined transitions; the freeze/thaw lifecycle is tied to focus and edit mode; `editEnabled` OFF always renders today's flow |

---

## User Stories

### P1: The preview document model ⭐ MVP

**User Story**: As a merger, I want the preview to be a document — snippets plus my own text and line breaks in one sequence — so that the merged output can contain more than selected snippets.

**Why P1**: Roadmap 3.1; every other requirement in this task stands on this model.

**Acceptance Criteria**:

1. WHILE a merge session is active THEN SnippetsContext state SHALL be a single ordered `PreviewToken[]` (the preview document) where array position IS the merge order; the token kinds SHALL be snippet (tokenId, sourceSnippetId, sourceId, color, text, edited), text (tokenId, text — never containing `"\n"`), and line-break (tokenId, serializing `"\n"`).
2. WHEN a drag completes THEN the context SHALL move the dragged snippet token by a token-index splice action with no-op guards (equal indexes, out-of-bounds, or a token id that vanished mid-drag → content-identical state); the `order` integer and dense renumbering are retired (ADR 0001 amendment).
3. Every token SHALL carry a globally unique tokenId; sortable/draggable items SHALL be snippet tokens only, keyed by tokenId; own-text and line-break tokens are never sortable.
4. `useSnippets` SHALL expose the document, `setSourceSnippets`, `moveToken(fromIndex, toIndex)`, the parsed-edit sync dispatcher, `editEnabled`, and `setEditEnabled` — with stable references across re-renders.
5. WHILE edit mode is OFF THEN the document SHALL render exactly today's flow (WYSIWYG parity with the pre-migration snippets array, including the empty state and the copy path).
6. ADR 0004 and the ADR 0001 amendment SHALL be recorded (Developer deliverables; drafts in this spec).

**Independent Test**: Reducer + provider units: the token shape and kinds; `moveToken` splice behavior and every no-op guard; stable API references; the whole-document sync replaces the tokens; `SET_EDIT_ENABLED` flips the flag; a render parity check that the edit-OFF flow matches today's output for the same content.

---

### P1: Building the document from sources — reconciliation ⭐ MVP

**User Story**: As a merger, I want snippets I select in my sources to flow into the document automatically — and my preview edits to survive source changes — so that both surfaces stay truthful without fighting me.

**Why P1**: Roadmap 3.1 ("migrating Task 1 reorder onto it") extends beyond ordering: `SET_SOURCE_SNIPPETS` must keep working on the new model (ADR 0001's diff-by-id, now on snippet tokens).

**Acceptance Criteria**:

1. WHEN a source emits snippets into an empty document THEN the document SHALL contain the snippet tokens joined by single `" "` own-text separator tokens (one emission of two snippets yields `[A, " ", B]`); WHEN snippets append to a non-empty document THEN each new token SHALL be preceded by one `" "` separator token, in emission order — an unedited document SHALL always serialize byte-identically to the old `join(' ')`.
2. WHEN a source snippet is resized THEN its unedited snippet tokens SHALL have their text rewritten in place (position, color, and identity unchanged); edited (text-frozen) tokens SHALL NOT change.
3. WHEN a source snippet is deleted THEN all its tokens (edited or not) SHALL be removed together with ONE adjacent `" "` separator token (the preceding one when present, else the following one), so an unedited flow keeps serializing like the old join; the snippet's tombstone, if any, SHALL clear.
4. WHEN the user has deleted a snippet token's entire text from the document THEN the source snippet id SHALL be tombstoned: later emissions containing that id SHALL NOT re-append it for the session; tombstones live in memory only and are never persisted.
5. WHEN new snippet ids appear in a source emission THEN each SHALL append at the document end per the separator rule of criterion 1 — a tombstoned id is the only append exception.
6. WHILE reconciliation runs THEN a snippet token's "edited" flag SHALL mean "the user has typed inside this token" — set only by parsed-edit sync when the token's text changed by typing, never by source-side updates — and once set it never resets (except by token removal).

**Independent Test**: Reducer units: initial-build join parity (emit one snippet, then a second → `[A, " ", B]`); append with separators; resize rewrites unedited tokens in place; edited tokens stay frozen; source deletion removes tokens + one separator and clears the tombstone; a tombstoned id is not re-appended by a later emission; a deleted-and-recreated source snippet (new id) appends normally.

---

### P1: The editable surface ⭐ MVP

**User Story**: As a merger, I want to click into the preview and type — with the caret, Enter, and deletion feeling like a normal text editor — so that I can shape the merged text directly.

**Why P1**: Roadmap 3.2 (contentEditable rendering colored snippet tokens, textarea-like caret/selection); the surface is one component shared inline and in the modal (ADR 0003).

**Acceptance Criteria**:

1. WHILE edit mode is OFF THEN the surface SHALL behave exactly as today: read-only flow, React reconciles freely, chips draggable, no caret, no contentEditable attribute.
2. WHILE edit mode is ON THEN the segment flow root (`preview-segment-flow`) SHALL become a single contentEditable surface (implicit textbox role, `aria-multiline="true"`, `aria-label` from `pages.mergeSession.previewArea.editing.label`, `suppressContentEditableWarning`) rendering React token children: snippet tokens as colored spans (existing tint, testids, and dnd-kit wiring), own text as plain text nodes, line breaks as `"\n"` text nodes (no `<br>` — `white-space: pre-wrap` carries them).
3. WHILE edit mode is ON and the surface is focused THEN React SHALL NOT reconcile the surface's token children in response to that surface's own parsed edits (the focused DOM is the source of truth for parsing) — the contract is mode-aware: with edit OFF the surface reconciles freely (ADR 0004).
4. WHEN a non-text model change occurs while the surface is focused (a completed drag reorder, source-driven reconciliation) THEN the focused surface SHALL re-render from the model (keyed reconciliation; a possible caret reset after a drag is the accepted trade-off — flagged for manual verification).
5. WHEN the surface loses focus or edit mode is toggled off THEN the surface SHALL first commit the focused DOM (parse → sync) and then re-render its children from the model (thaw).
6. WHEN Enter is pressed with the caret in the editor THEN the native block insertion SHALL be prevented and a line break SHALL be created (a `"\n"` text node inserted at the caret, parsed into a line-break token).
7. WHILE typing THEN deletion SHALL be native textarea-like: Backspace/Delete eat characters across token boundaries; empty tokens are pruned; a fully-deleted snippet token vanishes from the document while its source highlight remains untouched — preview edits never mutate source state.

**Independent Test**: RTL units: edit OFF renders today's DOM (no contentEditable attribute); edit ON renders the editable root with aria-multiline and the translated label; typing (or a dispatched input event) dispatches the sync while the focused token DOM is not re-rendered (assert node identity/stability); blur re-renders from the model; Enter creates a line-break token; Backspace across a token boundary updates the model (parse result) — with the jsdom caret fallback flag when userEvent proves unreliable.

---

### P1: The edit-text toggle ⭐ MVP

**User Story**: As a merger, I want a clear on/off switch for typing in the preview — off by default — so that the preview stays a stable sorting surface until I deliberately start editing.

**Why P1**: Roadmap 3.3 — **deviation (a)**: the user's edit-text toggle replaces the roadmap's drag on/off toggle (user decision 2026-10-16); the toggle is the sole gate into every editing behavior.

**Acceptance Criteria**:

1. The toggle SHALL render as an icon-only IconButton with the `Title` icon (the "T" glyph — verified installed), `aria-pressed` reflecting the shared edit state, `data-testid="preview-edit-toggle"`, and an `aria-label` from `editing.toggleOn` (while edit is OFF — the enabling action) or `editing.toggleOff` (while ON).
2. The edit state SHALL be ONE session-level setting in SnippetsContext (`editEnabled`, default OFF) shared by the inline toolbar button and the modal rail button; both SHALL reflect and control the same state, and pressing either SHALL update the other on its next render.
3. Placement: the PreviewToolbar renders it UNDER the modal-open trigger (toolbar order: copy, modal-open, edit toggle); the modal's tools rail renders it under copy, above close (rail order: copy, edit toggle, close).
4. WHEN edit mode is OFF THEN the preview SHALL behave exactly as today (sort-only; the empty gating of today); WHEN ON THEN editing is enabled on BOTH surfaces (inline and modal) with the empty-document placeholder per the empty-document story.
5. WHEN edit mode is toggled OFF while a surface is focused mid-typing THEN the pending DOM SHALL be committed (parse → sync) before the surface freezes — no keystroke is lost.
6. WHEN the active language changes THEN the toggle labels and the editor label SHALL follow (keys ship in en-US and pt-BR).
7. **Roadmap deviation (a), user decision 2026-10-16**: this edit toggle REPLACES roadmap Task 3.3's "drag on/off toggle that disables dragging only"; dragging is always live in both modes (F1); the roadmap line is updated at completion time.

**Independent Test**: RTL + provider units: default OFF; clicking either instance flips the shared state and both `aria-pressed` values; the labels flip per state and per language (keys asserted verbatim in both resource files); placement assertions (toolbar order copy → modal-open → toggle; rail order copy → toggle → close); toggling OFF mid-typing dispatches the sync before the surface becomes read-only.

---

### P1: Click = caret, hold = drag — the contract on an editable surface ⭐ MVP

**User Story**: As a merger, I want the preview to stay a reliable sorting surface even while it is editable — a quick click places my caret, a hold still drags — so that both capabilities coexist without surprises.

**Why P1**: Roadmap 3.3's first half ("Verify the click-vs-drag contract") on top of ADR 0002 — the activation model must survive the contentEditable migration unchanged.

**Acceptance Criteria**:

1. WHILE edit mode is ON THEN a quick pointer press (released before 50ms, or moved beyond the 5px tolerance before the delay elapses) on the surface SHALL NOT start a drag and SHALL fall through as a caret placement (ADR 0002's contract preserved on the editable surface).
2. WHILE edit mode is ON THEN a held press (≥50ms, ≤5px jitter) on a snippet SHALL still start the drag — dragging is always live in both modes (F1); the mouse text-selection sacrifice while both are active is the accepted trade-off (user decision 2026-10-16).
3. WHILE edit mode is ON THEN snippet spans SHALL keep dnd-kit's focusable button semantics (tabIndex, role, instruction linkage): Space/Enter on a FOCUSED chip picks it up for keyboard reordering; Space/Enter with the caret in the root types a space / inserts a line break — verified in installed `@dnd-kit/core` 6.3.1 (the activator preventDefaults its key and only activates when the keydown target IS the activator node); a runtime confirmation plus a chip-level `preventDefault` fallback are prescribed IF the browser leaks the character.
4. WHILE edit mode is ON THEN the drag affordances (grab/grabbing cursors, hover tint, overlay chip, dimmed origin, drop-indicator needle, gap anchors) SHALL keep working on token indexes: gap drops and chip drops land the dragged snippet exactly where the needle marked, translated to token indexes among snippet tokens; the `sorting.*` announcements count snippet tokens (1-based, existing keys).
5. WHILE edit mode is OFF THEN click, hold, pointer drag, and keyboard sorting SHALL behave exactly as today (Task 1 / Task 1.6 contracts unchanged).
6. WHILE either mode is active THEN a mid-drag deletion of the dragged token (source edited elsewhere) SHALL discard the reorder without crashing (fresh id resolution against the live document, as in Task 1).

**Independent Test**: The existing click-never-drags and keyboard suites extended to the edit-ON surface (fake-timer hold-drag; Tab → Space → arrows → Space reorder inside the editable root); helper units for the token-index gap/needle math (the migration of `computeNeedleIndex`/`computeGapMoveIndex` to token indexes); a keydown-target split test (Space on the focused chip picks up; Space with the caret in the root does not).

---

### P1: Parsing and sync of edits ⭐ MVP

**User Story**: As a merger, I want every keystroke to land in the document model immediately — typing, Enter, deletion, paste — so that the blurred twin surface and the copy button always see the truth.

**Why P1**: Roadmap 3.4 — **deviation (b)** replaces "typing inside a snippet splits it between words" with in-snippet integration (user decision 2026-10-16); the sync is what keeps both surfaces and the copy honest.

**Acceptance Criteria**:

1. On every input event in a focused editable surface, the DOM SHALL be parsed by a pure parser into tokens (snippet spans → snippet tokens keyed by their data attributes; text nodes → own-text tokens; `"\n"` runs → line-break tokens; empty artifacts pruned) and dispatched as ONE whole-document sync action.
2. WHEN the user types inside a snippet THEN the typed text SHALL integrate INTO the snippet token — the snippet does NOT split (**deviation b**, user decision 2026-10-16): the integrated text stays inside the colored span, serializes as part of the token, drags together with it, and the token becomes text-frozen ("edited") for reconciliation. The roadmap's "splits between words" wording is superseded; the roadmap line is updated at completion time.
3. WHEN the user types between tokens or at document boundaries THEN the characters SHALL create or extend own-text tokens; document-wide, every character SHALL belong to exactly one token.
4. WHEN a snippet token's text is fully deleted THEN the token SHALL vanish and its source snippet id SHALL be tombstoned (reconciliation story); fully-deleted own text prunes its token — no empty text or line-break-adjacent artifacts persist beyond explicit line-break tokens.
5. WHEN text is pasted THEN formatting SHALL be stripped (plain text from `text/plain` only); multi-line paste SHALL insert line-break tokens at the pasted newlines; a paste with no text data SHALL no-op.
6. WHILE a surface is focused and typing THEN the blurred twin (inline ↔ modal) SHALL re-render live from the model on every sync; WHEN the focused surface unmounts mid-typing (e.g. the modal closes) THEN nothing is lost — the model was synced on every input event.
7. The parser and serializer SHALL be pure exported helpers, unit-tested for round-trips (serialize∘parse and parse∘serialize over representative documents: empty, own-text-only, line breaks at the edges, multiple consecutive line breaks, adjacent snippets with no separator); any DOM the parser does not recognize (stray elements from a text drop) SHALL flatten to its text content — the document degrades to plain text, never to corrupt tokens.
8. Undo/redo SHALL be browser-native, best-effort, only while the surface stays focused; blurring re-renders from the model and resets the native undo stack (documented limitation; no custom undo in v0).

**Independent Test**: Parser/serializer round-trip units over the representative documents; editing workflows (RTL): type inside a snippet → the token's text grows, no new token, edited flag set; delete across a boundary; Enter; multi-line + formatted paste (assert plain output); unmount-mid-typing keeps the model current; unknown-DOM flattening.

---

### P1: Merged-text serialization and copy ⭐ MVP

**User Story**: As a merger, I want the copy button to give me exactly what the preview shows — snippets with their integrated text, my own text, and line breaks — so that the clipboard matches my document.

**Why P1**: Roadmap 3.5 (update merged-text building/copy to serialize the document: own text + newlines for line breaks); the WYSIWYG contract is the app's core promise.

**Acceptance Criteria**:

1. `buildMergedText` SHALL become `serialize(document)`: pure concatenation of token texts (line-break tokens → `"\n"`), no trimming, no implicit separators; an unedited session SHALL copy byte-identically to today's `join(' ')` output.
2. The WYSIWYG invariant SHALL hold at all times: the flow root's `textContent` SHALL equal `serialize(document)` — including mid-drag and mid-typing (the placeholder pseudo-element renders no DOM, so it never pollutes the invariant).
3. Copy gating SHALL follow the gating matrix: edit ON → the copy button is enabled always (even an empty document); edit OFF → enabled iff `serialize(document).length > 0` (today's behavior preserved for unedited sessions).
4. WHEN copy is activated on an empty document (edit ON) THEN the clipboard SHALL receive the current serialized text (the empty string) and the toast SHALL show (agent default, logged).
5. The modal-open trigger SHALL follow the same gate (`editEnabled || serialize(document).length > 0`), superseding today's `snippets.length > 0` while preserving today's OFF+empty behavior.
6. WHEN the document contains only own text (no snippet tokens) THEN copy SHALL serialize it — own-text-only documents are copyable.
7. The existing `copy.button` / `copy.toast` strings and the `CopyMergedTextButton` component SHALL be reused verbatim — no new copy-related i18n keys.

**Independent Test**: serialize units (byte-identity vs the old join for unedited builds; `"\n"` mapping; no trimming at edges; multiple line breaks); the canCopy/canOpen matrix tested across all four quadrants; copy-on-empty writes `""` with the toast; clipboard payload equals `serialize(document)` for own-text-only and mixed documents; the flow `textContent` invariant asserted in the PreviewArea suite (migrated at behavior level).

---

### P1: Editing from an empty document ⭐ MVP

**User Story**: As a merger, I want to start writing in the preview even before selecting any snippet — so that the merged text can begin as my own words.

**Why P1**: User decision (Q7 + F3, 2026-10-16): the empty preview becomes clickable-to-edit; this is the gating story the deviation requires.

**Acceptance Criteria**:

1. WHILE edit mode is OFF and the document is empty THEN the preview SHALL render today's empty state (`preview-empty` with its existing message) with copy and modal-open disabled (today's behavior, unchanged).
2. WHILE edit mode is ON and the document is empty THEN the preview SHALL render the editable root (focusable, with the placeholder hint) INSTEAD of the empty-state block; copy and modal-open SHALL be enabled (user decision F3) — identical inline and in the modal.
3. The placeholder hint SHALL be a non-DOM, non-serialized affordance (recommended: `data-placeholder` + CSS `:empty::before`) carrying `pages.mergeSession.previewArea.editing.placeholder`; it SHALL disappear as soon as content exists and SHALL NOT participate in parsing, serialization, or the textContent invariant.
4. WHEN the user types the first character into an empty document THEN an own-text token SHALL be created — the user can build a document purely from own text, copyable at any moment.
5. WHEN the document becomes empty again (all content deleted) THEN edit ON returns to the placeholder-hint state; toggling edit OFF at any empty moment returns today's empty state and disabled gating.

Gating matrix (applies identically inline and in the modal):

| Mode | Document | Preview renders | Copy button | Modal-open trigger |
| ---- | -------- | --------------- | ----------- | ------------------ |
| Edit OFF | empty | `preview-empty` block (today's message) | disabled | disabled |
| Edit OFF | non-empty | today's read-only sortable flow | enabled | enabled |
| Edit ON | empty | editable root + placeholder hint (no `preview-empty`) | enabled | enabled |
| Edit ON | non-empty | editable root with tokens | enabled | enabled |

**Independent Test**: Table-driven RTL across the four quadrants (inline and modal-scoped): edit OFF + empty shows `preview-empty` with both buttons disabled; edit ON + empty shows the editable root with `data-placeholder` and both buttons enabled; the first keystroke creates an own-text token and the hint disappears; deleting back to empty restores the hint; toggling OFF while empty restores the empty-state block and the disabled gating.

---

### P1: Inline ↔ modal parity while editing ⭐ MVP

**User Story**: As a merger, I want the bigger view to be the same document — edits in either place reflected instantly in the other — so that the two surfaces never diverge.

**Why P1**: Roadmap 3.4's "focused surface owns its DOM, blurred surface re-renders from the model" + roadmap 3.6's inline-modal sync tests; ADR 0003's same-component contract is what makes this one surface.

**Acceptance Criteria**:

1. WHILE the modal is open THEN both instances SHALL render from the one SnippetsContext document (ADR 0003 unchanged); the focused instance owns its DOM; the blurred instance re-renders live during typing — in both directions (typing in the modal updates the inline flow; typing inline updates the modal's).
2. WHILE both instances are mounted THEN the shared edit toggle state applies to both; each instance keeps its own DndContext (Task 1) with dragging always live; duplicate `data-testid`s while the modal is open remain by design (ADR 0003), and the modal's tests scope queries with `within(getByRole("dialog"))`.
3. WHEN edits complete in one surface THEN the other SHALL show identical content on its next render; closing the modal mid-typing SHALL lose nothing (per-input sync).
4. Escape while editing inside the modal SHALL close the dialog (the existing modal contract; content is already synced per keystroke), and the mid-drag Escape guard (`onActiveDragChange`) SHALL keep working unchanged — dragging is always live in both modes.

**Independent Test**: Page-level integration: open the modal, toggle edit inside the rail, type in the modal editor → the inline flow updates live (`within(dialog)` + inline assertions, including the `preview-edit-toggle` duplicate pair reflecting one state); type inline while the modal is open → the dialog's flow updates; Escape mid-typing closes with nothing lost; Escape mid-keyboard-drag still cancels only the drag (existing guard suite passes).

---

### Draft Editing Copy (i18n)

Keys under `pages.mergeSession.previewArea.editing` (accessibility-required labels — the tutorial is intentionally untouched, user decision 2026-10-16; the copy strings `copy.button`/`copy.toast`, the sorting strings, and the empty-state message are reused verbatim):

| Key | en-US | pt-BR |
| --- | ----- | ----- |
| `label` (the editor root's aria-label, relevant while editing is on) | Merged text editor | Editor de texto mesclado |
| `placeholder` (hint inside the empty editor, edit on) | Type here to add your own text | Digite aqui para adicionar seu próprio texto |
| `toggleOn` (toggle aria-label while editing is off — the enabling action) | Enable text editing | Ativar edição de texto |
| `toggleOff` (toggle aria-label while editing is on — the disabling action) | Disable text editing | Desativar edição de texto |

---

### Draft Records Copy (Developer deliverables)

**ADR 0004** — `docs/adr/0004-preview-document-model.md` (title: "The preview is a token document and the focused editable surface owns its DOM"). Decision: SnippetsContext state becomes a single ordered `PreviewToken[]` — snippet tokens, own-text tokens, line-break tokens — where array position IS the merge order (the `order` integer and MOVE_SNIPPET's dense renumbering are retired; ADR 0001's diff-by-id now reconciles snippet tokens inside the document). Every character of the merged output belongs to exactly one token: the implicit join-space becomes a `" "` own-text token, so serialization is pure concatenation and an unedited session copies byte-identically to the old `join(' ')`. Snippet tokens reference their source snippet: unedited tokens track source updates (a resize rewrites their text; source deletion removes them together with one adjacent separator token); tokens the user has typed inside are text-frozen but their existence still follows the source; ids whose tokens the user deleted from the document are tombstoned so later source emissions cannot resurrect them. Editing is gated by a session-level edit toggle (default off). While edit mode is on and a surface is focused, React must not reconcile that surface's token children in response to its own parsed edits: the focused DOM is the source of truth for a pure DOM→tokens parser whose result dispatches as one whole-document sync; the blurred twin re-renders live from the model; non-text model changes (reorders, source-driven reconciliation) re-render the focused surface too, accepting a possible caret reset after a drag. With edit mode off, the surface is exactly the previous read-only sortable flow. Considered options (all rejected): keeping the snippets array plus a parallel overlay of own text/line breaks (two sources of truth for one sequence); rendering the editable flow via `dangerouslySetInnerHTML` with update-skipping (dnd-kit cannot attach refs/listeners to innerHTML content — the chips must stay React elements); granular per-keystroke reducer actions (nothing in v0 consumes the granularity); splitting snippets on typed-inside text per the roadmap wording (user decision 2026-10-16: typed text integrates into the snippet token so it drags and serializes as one unit). Consequences: the copy path and every consumer move to the document in the same release (never two live serializers); space tokens are real content (deleting the space between two snippets leaves them adjacent — correct WYSIWYG); tombstones live for the session and never block new ids; the focused surface briefly renders the pre-sync model after its own keystrokes (it mirrors the DOM instead; model readers like copy always see the synced, current document); ADR 0001's Consequences carry the amendment sentence.

**ADR 0001 amendment** (one sentence appended to `docs/adr/0001-diff-by-id-merge-order.md` Consequences): "Amended 2026-10-16 (Feature 3 Task 3): the merge order now lives in the preview document — an ordered token array where position is the order — so diff-by-id reconciliation applies to snippet tokens within that array, and the MOVE_SNIPPET dense-renumbering exception is retired: moving a token is a plain splice with no renumbering."

**GLOSSARY.md** (Developer deliverable, existing format):
- **Merged Text** (updated): "The serialized preview document — snippet tokens, own text, and line breaks — in merge order; the session's output." _Avoid_: Built text, preview text, result, final text
- **Own Text** (new): "Text typed directly into the preview, not originating from any snippet." _Avoid_: user text, free text, custom text
- **Line Break** (new): "A break typed into the preview document; serializes as a newline in the merged text." _Avoid_: newline (alone), paragraph, row

---

## Edge Cases

- IF edit mode is toggled OFF while a surface is focused mid-typing THEN the focused DOM is parsed and synced first; no keystroke is lost; the surface becomes read-only exactly as today.
- IF the modal closes (Escape, backdrop, rail close) while its editor is focused mid-typing THEN nothing is lost — every input event already synced the document.
- IF a drag completes while the editor is focused THEN the focused surface re-renders from the model (non-text change); the caret usually survives keyed node moves; a reset is accepted and flagged for manual verification.
- IF the user types inside a snippet THEN the text integrates into the token (no split — deviation b); the token becomes text-frozen; later source resizes do not rewrite it, but source deletion still removes it.
- IF the user deletes every character of a snippet token THEN the token vanishes and its id is tombstoned; the source highlight remains in the TextInput (sources are never mutated from the preview); later emissions of that id do not resurrect it.
- IF the user deletes the `" "` token between two snippets THEN the snippets become adjacent — correct WYSIWYG (the space was content).
- IF a source snippet is resized THEN its unedited tokens rewrite in place, even while a surface is focused (a non-text change re-renders it).
- IF a source snippet is deleted THEN its tokens (edited or not) are removed with one adjacent separator token; the tombstone clears.
- IF a snippet is deleted and re-created in a source THEN the re-creation carries a new id (TextInput `generateId`) and appends normally; tombstones never block new ids.
- IF Enter is pressed at the document start/end or multiple times in a row THEN each press creates one line-break token; serialization emits one `"\n"` each, with no trimming anywhere.
- IF multi-line text is pasted THEN formatting is stripped and each newline becomes a line-break token; single-line paste is plain own text; a paste with no `text/plain` data no-ops.
- IF the user presses Space/Enter on a focused snippet chip THEN the keyboard drag picks it up (dnd-kit's activator preventDefaults the key — verified in installed 6.3.1); IF the browser instead reports the editing host as the keydown target THEN the activator declines and typing proceeds — both directions are the intended split; a chip-level preventDefault fallback is prescribed if runtime testing disagrees.
- IF a quick click lands on the editable surface THEN the caret places at the click offset and no drag starts (ADR 0002); IF the pointer holds ≥50ms within 5px THEN the drag activates (dragging always live, F1).
- IF both instances are mounted (modal open) THEN typing in one re-renders the other live; duplicate testids while open are by design (ADR 0003); modal tests scope with `within(getByRole("dialog"))`.
- IF the document is empty and edit is ON THEN the placeholder hint shows (`data-placeholder` + `:empty::before`); IF the browser leaves a stray zero-length text node after select-all-delete while focused THEN the hint may lag until blur (known caveat; the absolutely-positioned overlay is the documented fallback).
- IF the document is empty and edit is OFF THEN today's empty state renders with copy and modal-open disabled.
- IF copy runs on an empty document (edit ON) THEN the clipboard receives the empty string and the toast shows (agent default).
- IF undo is pressed while focused THEN native browser undo acts best-effort; after blur/thaw the native undo stack resets (documented limitation).
- IF the language changes while a surface is focused THEN the token children stay frozen (DOM untouched) while attributes (`aria-label`, `data-placeholder`) update — the caret is unaffected.
- IF exactly one snippet token exists THEN dragging stays inert exactly as today (Task 1 behavior).
- IF content enters the editor outside the keyboard paths (e.g. a text drop) THEN the parser flattens every unrecognized node to its text content — the document degrades to plain text, never to corrupt tokens.
- IF userEvent caret-typing proves unreliable in jsdom THEN the parser/serializer/reducer suites plus manually-dispatched input events are the automated contract; caret feel is verified manually in the dev server (flagged).
- IF either edit-toggle instance is pressed THEN the other reflects the shared state on its next render (toolbar and modal rail never disagree beyond one render).

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| EDIT-01 | The preview document model | Specify | Pending |
| EDIT-02 | The preview document model | Specify | Pending |
| EDIT-03 | The preview document model | Specify | Pending |
| EDIT-04 | The preview document model | Specify | Pending |
| EDIT-05 | The preview document model | Specify | Pending |
| EDIT-06 | The preview document model | Specify | Pending |
| EDIT-07 | Building the document from sources — reconciliation | Specify | Pending |
| EDIT-08 | Building the document from sources — reconciliation | Specify | Pending |
| EDIT-09 | Building the document from sources — reconciliation | Specify | Pending |
| EDIT-10 | Building the document from sources — reconciliation | Specify | Pending |
| EDIT-11 | Building the document from sources — reconciliation | Specify | Pending |
| EDIT-12 | Building the document from sources — reconciliation | Specify | Pending |
| EDIT-13 | The editable surface | Specify | Pending |
| EDIT-14 | The editable surface | Specify | Pending |
| EDIT-15 | The editable surface (focused-surface-owns-DOM, mode-aware) | Specify | Pending |
| EDIT-16 | The editable surface | Specify | Pending |
| EDIT-17 | The editable surface | Specify | Pending |
| EDIT-18 | The editable surface | Specify | Pending |
| EDIT-19 | The editable surface | Specify | Pending |
| EDIT-20 | The edit-text toggle (replaces roadmap 3.3's drag toggle — deviation a) | Specify | Pending |
| EDIT-21 | The edit-text toggle | Specify | Pending |
| EDIT-22 | The edit-text toggle | Specify | Pending |
| EDIT-23 | The edit-text toggle | Specify | Pending |
| EDIT-24 | The edit-text toggle | Specify | Pending |
| EDIT-25 | The edit-text toggle | Specify | Pending |
| EDIT-26 | The edit-text toggle (deviation a recorded; roadmap line updated at completion) | Specify | Pending |
| EDIT-27 | Click = caret, hold = drag | Specify | Pending |
| EDIT-28 | Click = caret, hold = drag (dragging always live — F1) | Specify | Pending |
| EDIT-29 | Click = caret, hold = drag | Specify | Pending |
| EDIT-30 | Click = caret, hold = drag | Specify | Pending |
| EDIT-31 | Click = caret, hold = drag | Specify | Pending |
| EDIT-32 | Click = caret, hold = drag | Specify | Pending |
| EDIT-33 | Parsing and sync of edits | Specify | Pending |
| EDIT-34 | Parsing and sync of edits (in-snippet integration — deviation b; roadmap line updated at completion) | Specify | Pending |
| EDIT-35 | Parsing and sync of edits | Specify | Pending |
| EDIT-36 | Parsing and sync of edits | Specify | Pending |
| EDIT-37 | Parsing and sync of edits | Specify | Pending |
| EDIT-38 | Parsing and sync of edits | Specify | Pending |
| EDIT-39 | Parsing and sync of edits | Specify | Pending |
| EDIT-40 | Parsing and sync of edits | Specify | Pending |
| EDIT-41 | Merged-text serialization and copy | Specify | Pending |
| EDIT-42 | Merged-text serialization and copy | Specify | Pending |
| EDIT-43 | Merged-text serialization and copy | Specify | Pending |
| EDIT-44 | Merged-text serialization and copy (empty-copy agent default) | Specify | Pending |
| EDIT-45 | Merged-text serialization and copy | Specify | Pending |
| EDIT-46 | Merged-text serialization and copy | Specify | Pending |
| EDIT-47 | Editing from an empty document | Specify | Pending |
| EDIT-48 | Editing from an empty document (F3 placeholder + gating) | Specify | Pending |
| EDIT-49 | Editing from an empty document | Specify | Pending |
| EDIT-50 | Editing from an empty document | Specify | Pending |
| EDIT-51 | Editing from an empty document | Specify | Pending |
| EDIT-52 | Inline ↔ modal parity while editing | Specify | Pending |
| EDIT-53 | Inline ↔ modal parity while editing | Specify | Pending |
| EDIT-54 | Inline ↔ modal parity while editing | Specify | Pending |
| EDIT-55 | Inline ↔ modal parity while editing | Specify | Pending |

**ID format:** `EDIT-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified; additionally **Deviated** (implemented with a changed contract — see `implementation.md`) and **Deferred** (not implemented — see `implementation.md`).

**Coverage:** 55 total. 0 Verified, 0 Deviated, 0 Deferred. Roadmap mapping: 3.1 (document model + reorder migration) → EDIT-01–06 (model, move, API, records) and EDIT-07–12 (source reconciliation, incl. tombstones); 3.2 (editable surface) → EDIT-13–19 (surface mechanics + the mode-aware focused-surface contract) and EDIT-47–51 (empty-document editing, incl. the F3 placeholder + gating matrix); 3.3 (click-vs-drag + toggle — **deviation (a)**: the drag on/off toggle is replaced by the edit-text toggle, user decision 2026-10-16) → EDIT-20–26 (the toggle; the deviation is recorded on EDIT-20 and EDIT-26) and EDIT-27–32 (contract verification; dragging always live per F1 on EDIT-28); 3.4 (parsing/sync — **deviation (b)**: typing inside a snippet integrates instead of splitting, user decision 2026-10-16) → EDIT-33–40 (integration on EDIT-34) and EDIT-52–55 (focused/blurred twin sync, incl. inline↔modal); 3.5 (serialization/copy) → EDIT-41–46 (incl. the empty-copy agent default on EDIT-44); 3.6 (tests) → every story's Independent Test under the Q16 behavior-level policy, plus the jsdom caret-typing flag. The roadmap lines 3.3 and 3.4 are updated at completion time to record both deviations. Per-requirement outcomes: `.specs/features/preview-area-tools/tasks/editable-preview-text/implementation.md` (to be created by the developer sub-agent).

---

## Success Criteria

How we know the feature is successful:

- [ ] With edit OFF, the preview behaves exactly as today: sort-only flow, empty state + disabled copy/modal-open when empty, all Task 1 / Task 1.6 / Task 2 contracts intact.
- [ ] The "T" toggle (`Title` icon, `aria-pressed`, translated) sits under the modal-open trigger in the toolbar and in the modal rail under copy, above close; one shared state controls both; default OFF.
- [ ] Edit ON: clicking places the caret; typing inserts own text anywhere; Enter makes a line break; Backspace/Delete behave like a textarea; typing inside a snippet integrates into it (no split — it drags and serializes as one unit); pasted text is plain, multi-line preserved.
- [ ] While typing in one surface, the other (inline ↔ modal) updates live; closing the modal mid-typing loses nothing.
- [ ] Empty + edit ON: placeholder-hint editor, copy and modal-open enabled; the first character creates own text; copy on a still-empty document writes the empty string with the toast; empty + edit OFF: today's empty state and disabled gating.
- [ ] Hold-to-drag (pointer + keyboard) works identically in both modes; a quick click never drags; the drop-indicator needle and gap drops land exactly where marked, on token indexes.
- [ ] Copy output is byte-identical to today for unedited sessions; the flow's `textContent` always equals `serialize(document)`.
- [ ] The four `editing.*` keys ship in both en-US and pt-BR; the tutorial is untouched (6 steps); existing copy/sorting/empty strings are reused verbatim.
- [ ] ADR 0004, the ADR 0001 amendment, and the GLOSSARY updates are delivered by the Developer (drafts in this spec); the roadmap lines 3.3/3.4 are updated at completion time to record both deviations.
- [ ] `npx vitest run`, `npm run lint`, and `npx tsc -b` all pass; existing suites pass at behavior level with only the listed model-migration updates (no suite deleted); the new suites (document model, reconciliation, parser/serializer round-trips, editing workflows, toggle, click-vs-drag, serialization, inline↔modal sync) are green.
