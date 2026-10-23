# Case Auto-Fix Specification

## Problem Statement

The preview document (ADR 0004) glues user-selected snippets into new contexts: a chip cut from one position lands between different neighbors, and the casing it arrived with regularly reads wrong for the merge — a lowercase-starting chip placed after a period, a capitalized chip dropped mid-sentence, a proper name ("Paris") that sat mid-sentence in its source and stays capitalized mid-merge. Roadmap Feature 4 Task 1 (1.1–1.4) asks for case auto-fix: a pure case-fix pass with a predecessor classifier (document start, `.` `!` `?` `…` — not `:`, line break, mid-sentence), capitalize/lowercase rules, and guards, wired into snippet creation/reconciliation and sort, applied on the copy path (the copied text is always the corrected version), with unit rule/guard tables and integration tests — text inputs never modified. Three grilling rounds (2026-10-22, 16 answers) amend the roadmap lines as user decisions: **(1)** no source-context guard — roadmap Task 1.1's "capitals that were already mid-sentence in the source" guard is dropped; corrections apply purely from merged context, proper names can be lowercased mid-merge, wrong corrections are fixed by hand, and the undo idea is recorded as the deferred Feature 4 "Task 3: Undo auto-corrections" placeholder in `roadmap.md` (added in this specs phase); **(2)** the standalone "I" guard (also in Task 1.1's original list) is dropped — "I"/"i" follows the general contextual rules, superseding the Round 1 acceptance of that guard; with it gone, the en-US and pt-BR rule sets are identical, keyed structurally by the UI language (Q14); **(3)** the comparison policy is mixed (Task 1.2's "case-aware comparisons" resolved): reconciliation's no-op comparison becomes case-aware, while edited-detection and the focused-surface comparison stay exact — which is what makes a manual case override freeze the chip and survive later sorts (Q13: hand edits are final). Facts verified in the code shape the wiring: the exported `snippetsReducer` wrapper is the single seam after `snippetsReducerTransition` and the eager `normalizeTextTokens`; `reconcileSourceSnippets` rewrites every unedited snippet token's text from each source emission, so the pass must run after it; `syncParsedDocument` sets the `edited` flag via the strict `previous.text !== token.text` comparison (stays strict); the copy path lives in `CopyMergedTextButton.hook.tsx`'s `mergedText` memo (`serialize(previewDocument)` today) and its one component serves the toolbar and the modal rail (ADR 0003); `SnippetToken.edited === true` is the frozen marker the pass must always skip; a pass-induced model change while edit-ON+focused flows through ADR 0004's non-text-change path (surface re-freeze + renderEpoch remount, accepted caret reset).

## Goals

- [ ] Task 1.1 (as amended): a pure, exported case-fix pass in `src/utils/previewDocument.ts` — a predecessor classifier (sentence start = document start, after `.` `!` `?` `…` (NOT `:`), or after a line break; chips glued to non-whitespace text left alone; look-back past separator/whitespace tokens, stripping trailing whitespace then trailing closing quotes/brackets/parentheses) with capitalize-at-sentence-start / lowercase-mid-sentence rules over the first letter of the first word of snippet tokens only, plus guards (all-caps first word including single letters — EXCEPT the exact word "I"; mixed-case first word; non-letter first character; empty tokens; frozen/edited tokens); the roadmap's "standalone 'I'" and "capitals that were already mid-sentence in the source" guards are DROPPED (user decisions 2026-10-22; both roadmap lines annotated at completion); rule sets keyed by the active UI language (identical content for en-US/pt-BR today).
- [ ] Task 1.2 (as amended): central wiring in the exported `snippetsReducer` wrapper — the pass runs on EVERY transition except `SYNC_DOCUMENT`, after the transition's source-text rewrite and the eager normalization; whole-document recompute (the moved snippet and every predecessor-changed token covered by construction); idempotent and reference-stable; frozen tokens always skipped; reconciliation's no-op comparison becomes case-aware (pass-canonical forms) so case-only re-emissions are reference-identical no-ops, while `SYNC_DOCUMENT`'s edited-detection and the focused-surface comparison stay exact.
- [ ] Task 1.3: the copy path (`CopyMergedTextButton.hook.tsx`) applies the pass to a transformed COPY of the tokens before `serialize()` — the clipboard is always fully corrected (inline + modal) and the context document is never mutated; the visible document keeps ADR 0004's WYSIWYG invariant.
- [ ] Task 1.4: tests — unit rule/guard tables (classification × transform × guard, including the "I" carve-out and reference-stability rows) in the `previewDocument.test.ts` area + integration (create, sort both sides, manual override survives, copy output) in `CopyMergedTextButton.test.tsx` / `PreviewArea.test.tsx` / the reducer suites; existing oracle suites pass at the behavior level with only listed, deliberate assertion updates.
- [ ] ADR 0005 drafted in this spec (triggers, guards, case-aware reconciliation, the no-source-context and no-"I"-guard amendments, UI-language-keyed rule sets); written to `docs/adr/0005-preview-auto-fix-pass.md` by the Developer; roadmap Task 1.1/1.2 lines annotated at completion; the Feature 4 "Task 3: Undo auto-corrections" placeholder recorded in `roadmap.md` (added in this specs phase); NO GLOSSARY changes and no new i18n strings.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| The spacing pass (roadmap Task 2.1–2.3) | Task 1 only (user decision 2026-10-22, Q1); spacing gets its own spec |
| Source-context guard — remembering how the text was cased in the source (roadmap Task 1.1's "capitals that were already mid-sentence in the source") | Dropped — user decision 2026-10-22 (Q12): corrections apply purely from merged context; wrong corrections ("Paris" → "paris") are fixed by hand |
| Undo/review UI for auto-corrections | Deferred — user decision 2026-10-22 (Q12); recorded as the unchecked Feature 4 Task 3 placeholder in `roadmap.md` and in the spec's Deferred Ideas |
| Per-input language picker / content-language detection | Deferred — rule sets are keyed by the UI language (Q14); a real content-language mechanism is the prerequisite |
| Abbreviation-aware sentence boundaries ("Dr.", "e.g.", "Sr.") | No abbreviation dictionary in v0 (user decision 2026-10-22, Q3); a period always classifies a sentence end |
| Own-text / line-break token casing | Transform scope is snippet tokens' first letter of the first word only (Q4) |
| Modifying the source TextInputs | Sources are the snippets' origin and are never mutated (Feature 4's own preamble) |
| Correcting mid-typing (running the pass on SYNC_DOCUMENT) | Rejected (Q2): corrections would rewrite the focused surface between keystrokes, fighting the editor (ADR 0004); the copy path closes the stale window |
| New i18n strings, GLOSSARY changes, DOM/testid changes | None — the pass is model-level and UI-invisible (user decision 2026-10-22, Q11) |
| Persistence of correction history | The undo idea is deferred; v0 stores no correction records |
| Writing docs/adr during the specs phase | ADR 0005 is drafted in this spec; the Developer writes the file |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here - nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Scope | Task 1 (case) only; the spacing pass is Task 2 with its own spec | User decision Q1, 2026-10-22 | y (grilled 2026-10-22) |
| Sentence-boundary classification | Sentence end iff the predecessor's last meaningful char — after stripping trailing whitespace then trailing closing quotes/brackets/parentheses — is `.` `!` `?` or `…` (NOT `:`); document start and line breaks are sentence starts; look back past separator/whitespace tokens to the last meaningful content | User decision Q3, 2026-10-22 | y (grilled 2026-10-22) |
| Glued chips | Chips glued (no whitespace boundary) to non-whitespace text are left alone | User decision Q3 — mid-word casing is context-free | y (grilled 2026-10-22) |
| Transform scope | ONLY the first letter of the first word of SNIPPET tokens; own text, line breaks, and source inputs are never touched | User decision Q4, 2026-10-22 | y (grilled 2026-10-22) |
| Lexical guards | All-caps first word incl. single letters (with the "I" carve-out below), mixed-case first word (iPhone, eBay, McDonald's), non-letter first char, empty tokens, frozen (edited) tokens | User decision Q5a, 2026-10-22 (the standalone-"I" member superseded by Q16) | y (grilled 2026-10-22) |
| Standalone "I" guard dropped; "I" follows the general rules | "I" → "i" mid-sentence (wrong by English orthography — accepted, fixed by hand); "i" → "I" at a sentence start. Verbatim: "Ok, ignore this rule then. 'i' should only became 'I' if it is on beggning of a snippet, and the snippet needs this correction. Example: placed after a '.'" | User decision Q16, 2026-10-22 (Round 3, relayed) — supersedes the Q5a acceptance | y (grilled 2026-10-22) |
| "I" carve-out in the all-caps guard | The all-caps guard does NOT protect the exact first word "I" (general contextual rules apply); other single letters ("A", "B") stay protected — keeping the existing oracle suites byte-identical | Derived from the Q16 verbatim quote (agent interpretation, flagged) | y (derived 2026-10-22) |
| No source-context guard | The pass never consults the source's original casing; proper names cut from mid-sentence sources can be lowercased mid-merge ("Paris" → "paris"); wrong corrections are fixed by hand. Verbatim: "The correction will only apply if its the first letter of the first word of the snippet. On those cases, user will need to fix by hand later. We can actually think later of adding a third task to this feature, for user undo this auto corrections. But we will think about this later." | User decision Q5b/Q12, 2026-10-22 — drops roadmap Task 1.1's "capitals that were already mid-sentence in the source" guard (roadmap line annotated at completion) | y (grilled 2026-10-22) |
| Frozen chips never re-corrected | `edited === true` tokens are skipped on every trigger, forever; sorts still re-correct all non-edited chips (the moved one + predecessor-changed ones); later typing in the same chip is also never auto-corrected | User decision Q9/Q13, 2026-10-22 — hand edits are final; resolves the Q9-vs-Q5b/roadmap contradiction in the roadmap's favor | y (grilled 2026-10-22) |
| Central wiring | The pass runs in the exported `snippetsReducer` wrapper on every transition except `SYNC_DOCUMENT`; whole-document recompute; idempotent; reference-stable | User decision Q2, 2026-10-22 — one seam, no per-call-site drift | y (grilled 2026-10-22) |
| Pass ordering | The pass runs after reconciliation's source-text rewrite AND after the wrapper's eager `normalizeTextTokens` (canonical shapes only) | Agent default — verified wiring facts; without this the pass would see pre-reconcile text and non-canonical token shapes | n (agent default) |
| Mixed comparison policy | (1) reconciliation's no-op comparison case-aware (compares pass-canonical forms); (2) edited-detection (`previous.text !== token.text`) EXACT; (3) focused-surface self-recognition (`tokensEqualIgnoringEdited`) EXACT | User decision Q8/Q15, 2026-10-22 — recognize own corrections, recognize user intent, never fight the editor | y (grilled 2026-10-22) |
| Case-aware guard mechanism | Canonical-form comparison vs run-pass-then-compare is Developer latitude; the pinned observable: a case-only re-emission returns the reference-identical state (no re-render, no focused-surface remount) | Agent default | n (agent default — flagged) |
| Copy-time correction | Copy applies the pass to a transformed COPY of the tokens before `serialize()`; the context document is never mutated; the clipboard is always fully corrected even when the visible document is stale | User decision Q7/Q9, 2026-10-22 (policy); the token-array-copy mechanism in the `mergedText` memo is an agent default | y (policy) / n (mechanism, agent default) |
| UI-language-keyed rule sets | The rule set is selected by the active UI language (i18n tag); the en-US and pt-BR sets are IDENTICAL today (the "I" guard was the only differentiator and was dropped) | User decision Q14 + Q16, 2026-10-22 | y (grilled 2026-10-22) |
| Locale-aware casing | Casing transforms may use `toLocaleUpperCase`/`toLocaleLowerCase` keyed by the UI language tag; a missing/unknown tag falls back to the default rule set (identical content today) | Agent default — no behavioral difference for en-US/pt-BR today | n (agent default) |
| Visibility consequences | Letters visibly flip on sort across sentence boundaries; a sort while edit-ON+focused re-renders the surface (caret reset — ADR 0004 trade-off); after typing, the visible case can be stale until the next trigger while copy always corrects | User decision Q7, 2026-10-22 — all three accepted | y (grilled 2026-10-22) |
| Undo auto-corrections | Deferred — recorded in BOTH places: the unchecked Feature 4 "Task 3: Undo auto-corrections" placeholder in `roadmap.md` (added in this specs phase) and this spec's Deferred Ideas | User decision Q12, 2026-10-22 ("we will think about this later") | y (grilled 2026-10-22) |
| Abbreviation handling | None in v0 — a period always classifies a sentence end ("Dr." capitalizes the next chip) | User decision Q3, 2026-10-22 (deferred) | y (grilled 2026-10-22) |
| Test policy | Existing oracle suites pass at the behavior level with only listed, deliberate assertion updates; new suites: unit rule/guard tables + integration (create, sort both sides, manual override survives, copy output) | User decision Q10, 2026-10-22 | y (grilled 2026-10-22) |
| Records | ADR 0005 drafted in this spec (Developer writes `docs/adr/0005-preview-auto-fix-pass.md`); NO GLOSSARY changes; roadmap Task 1.1/1.2 lines annotated at completion | User decision Q11, 2026-10-22 | y (grilled 2026-10-22) |
| Pass location | Pure functions in `src/utils/previewDocument.ts` (the `serialize`/`tokensEqual` home); export names are Developer latitude | Agent default — the established pure-utils home | n (agent default) |
| No UI surface | No new i18n strings, no DOM/testid changes, no styling — the pass is model-level and invisible | Agent default (nothing UI-facing was requested) | n (agent default) |

**Open questions:** none - all resolved or logged above (rows "Pass ordering", "Case-aware guard mechanism", "Copy-time correction (mechanism)", "Locale-aware casing", "Pass location", and "No UI surface" are agent defaults, flagged for confirmation during implementation review).

---

## Implicit-Requirement Dimensions

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | Empty tokens, whitespace-only tokens, single-character first words, digit/punctuation-leading tokens, and cased-letter-free tokens all no-op safely; the pass never changes token length (case-only), so `PREVIEW_DOCUMENT_MAX_LENGTH` / `clampDocumentToLimit` paths are unaffected; the classifier reads only the document's own tokens |
| Failure / partial-failure states | The pass is a pure recompute — no partial application is possible; clipboard failure paths keep today's catch/no-toast behavior; the pass never throws on unicode content (it only inspects first words and predecessor characters) |
| Idempotency / retry / duplicate handling | Re-running the pass yields content-identical tokens; a no-change pass returns the previous state object (reference-identical); duplicate re-emissions of the same snippets are no-ops via the case-aware guard |
| Auth boundaries & rate limits | N/A because there is no API |
| Concurrency / ordering | Single user, single tab; one reducer serializes every action; the pass runs inside that serialization (the wrapper) and on the copy memo — no reordering of corrections is possible |
| Data lifecycle / expiry | The corrected document is in-memory session state; no correction history is stored (the undo idea is deferred); persistence is V1 |
| Observability | N/A because V0 has no metrics/logging requirement |
| External-dependency failure | No new dependency; i18n provides the language tag (a missing/unknown tag falls back to the default rule set — identical content today) |
| State-transition integrity | The document is fully corrected after every trigger except mid-typing (the SYNC_DOCUMENT skip — the stale window); copy always corrects the payload; the frozen invariant (edited tokens untouched) holds on every path; the WYSIWYG invariant `flow.textContent === serialize(document)` keeps holding (both sides change together at triggers) |

---

## User Stories

### P1: Creation-time context correction ⭐ MVP

**User Story**: As a merger, I want each snippet's casing to fit its landing spot the moment it enters the preview, so the growing merged text reads correctly without manual polishing.

**Why P1**: Roadmap Task 1.1 (the pass + classifier) and Task 1.2's creation wiring; creation is the first trigger and where the classifier's contract lives.

**Acceptance Criteria**:

1. WHEN a source emission creates snippet tokens (`SET_SOURCE_SNIPPETS`: initial build or appends) THEN the case-fix pass SHALL classify each snippet token's merged context and transform the first letter of its first word — capitalized at a sentence start, lowercased mid-sentence — subject to the guards of the Guards story.
2. The classifier SHALL define a sentence start as: the document start; a line-break token as the immediate predecessor; or a predecessor whose last meaningful character — after stripping trailing whitespace, then trailing closing quotes/brackets/parentheses — is `.`, `!`, `?`, or `…` (NOT `:`), looking back past separator/whitespace tokens to the last meaningful content.
3. WHEN a snippet token is glued (no whitespace boundary) to preceding non-whitespace text THEN its casing SHALL be left alone.
4. WHEN reconciliation rewrites an unedited token's text from its source (resize or re-emission) THEN the pass SHALL re-derive that token's casing from merged context (the pass runs after the rewrite and after eager normalization).
5. The pass SHALL modify only snippet tokens' first letter of the first word; own-text tokens, line-break tokens, and the source TextInputs SHALL never be modified.

**Independent Test**: Pure-pass unit tables in the `previewDocument.test.ts` area — every classification × transform combination (document start; after each of `.` `!` `?` `…`; after `:`; after a line break; mid-sentence; glued; closing-wrapper stripping rows). Reducer/provider integration — creating a snippet after a `.`-ending predecessor capitalizes it; mid-sentence creation lowercases it; a resize re-emission re-corrects the rewritten text; own-text and line-break tokens are byte-unchanged.

---

### P1: Sort-time context correction ⭐ MVP

**User Story**: As a merger, I want chips to re-fit their casing whenever I reorder them, so the merged text stays correct no matter how many times I sort.

**Why P1**: Roadmap Task 1.2 (sort wiring: the moved snippet and the tokens whose predecessor changed).

**Acceptance Criteria**:

1. WHEN a sort completes (`MOVE_TOKEN` or `MOVE_TOKEN_TO_LANDING`) THEN the pass SHALL re-run over the whole document, correcting the moved chip and every chip whose predecessor changed — letters may visibly flip across sentence boundaries (accepted, user decision 2026-10-22 Q7).
2. Chips landing at a sentence start (after `.`, `!`, `?`, `…`, a line break, or the document start) SHALL be capitalized; chips landing mid-sentence or glued to non-whitespace text SHALL follow the mid-sentence/glued rules.
3. WHILE a chip is frozen (user-edited) THEN the sort path SHALL skip it exactly like every other trigger (Frozen-chips story).
4. IF a sort changes no chip's context (e.g. a move the reducer no-ops) THEN the pass SHALL return a reference-identical state.

**Independent Test**: Reducer suites — drag a mid-sentence chip to after a `.` and its first letter capitalizes; the chip now preceding the vacated slot re-classifies; both move actions and the landing paths covered; a no-op move returns the same state reference. `PreviewArea.test.tsx` integration asserts the rendered chip text flips after a drag (inline and, scoped, inside the modal).

---

### P1: Copy-time correction (inline + modal) ⭐ MVP

**User Story**: As a merger, I want the clipboard to always carry the fully corrected text even when the visible preview is momentarily stale, so what I paste elsewhere is right.

**Why P1**: Roadmap Task 1.3 (the pass on the copy path before serialization, without mutating the visible document); the SYNC_DOCUMENT skip makes this the guarantee that closes the stale-case window.

**Acceptance Criteria**:

1. WHEN copy is activated (the one `CopyMergedTextButton`, in the toolbar or the modal rail) THEN the clipboard payload SHALL be the serialization of the pass-corrected token array.
2. The copy path SHALL apply the pass to a transformed copy of the tokens; the context document SHALL NOT be mutated by copying.
3. WHILE the visible document holds stale casing (mid-typing, since `SYNC_DOCUMENT` skips the pass) THEN the clipboard SHALL still be fully corrected — payload and visible text may differ only in pass-correctable case.
4. The copy gating (`canCopy`), toast, i18n strings, and button behavior SHALL be unchanged.
5. The corrected copy result SHALL follow the active UI language's rule set (identical content for en-US/pt-BR today) and re-derive when the language changes.

**Independent Test**: `CopyMergedTextButton.test.tsx` — the clipboard equals the corrected serialization while the visible document asserts as stale-cased; the context document's tokens (content and references) are unchanged after copy; copy with the modal open (`within(getByRole("dialog"))`) yields the same corrected payload; a language switch re-derives the memo.

---

### P1: Frozen chips and the surviving manual override ⭐ MVP

**User Story**: As a merger, I want my hand fixes to be final — once I retype a chip's casing, no later sort or re-emission should undo it — so correcting the auto-corrector is a one-time job.

**Why P1**: Roadmap Task 1.1/1.2's frozen-token guard and Task 1.4's explicit "manual override survives" test; user decision 2026-10-22 (Q13) resolved the Q9-vs-Q5b contradiction in the roadmap's favor.

**Acceptance Criteria**:

1. WHILE a snippet token's `edited` flag is true THEN the pass SHALL skip it on every trigger — creation, sort, copy — for the token's lifetime (only token removal clears the state).
2. WHEN the user retypes a corrected chip's casing (e.g. "paris in spring" → "Paris in spring") THEN the exact edited-detection comparison in `SYNC_DOCUMENT` SHALL mark the token edited (a case-only text difference IS a real difference there — user decision 2026-10-22 Q15).
3. WHEN the user later types more text into an already-edited chip THEN those additions SHALL also never be auto-corrected (accepted side effect, user decision 2026-10-22 Q13).
4. The roadmap's "manual override survives" integration test SHALL assert the hand-fixed casing survives repeated sorts and source re-emissions.

**Independent Test**: Reducer + RTL suites — auto-correct → hand-edit via a dispatched sync → repeated `MOVE_TOKEN` and `SET_SOURCE_SNIPPETS` cycles assert the token text and `edited` flag are untouched; a case-only sync diff sets `edited` (the comparison-#2 exactness table row); a source resize rewrites unedited tokens only.

---

### P1: Guards (lexical, the "I" carve-out, and the no-source-context rule) ⭐ MVP

**User Story**: As a merger, I want the pass to protect words whose casing carries meaning — acronyms, brands, initials — and to stay out of the source's business, so the fix helps more than it harms.

**Why P1**: Roadmap Task 1.1's guard list as amended by two user decisions 2026-10-22 (the dropped standalone-"I" guard and the dropped source-context guard — both roadmap lines annotated at completion).

**Acceptance Criteria**:

1. WHEN the first word is all-caps (every cased character uppercase — "NASA", "API", single letters "A", "B") THEN the token SHALL be left alone — EXCEPT when the first word is exactly "I": the general contextual rules apply instead ("I" → "i" mid-sentence; "i" → "I" at a sentence start) (user decision 2026-10-22, Q16 — carve-out derived from the verbatim quote).
2. WHEN the first word is mixed-case ("iPhone", "eBay", "McDonald's") THEN the token SHALL be left alone.
3. WHEN the first character is not a letter (digits, punctuation) THEN the token SHALL be left alone.
4. WHEN the token's text is empty or whitespace-only THEN it SHALL be left alone.
5. WHILE a token is frozen (`edited === true`) THEN it SHALL be left alone (Frozen-chips story).
6. The pass SHALL NOT consult the source's original casing: proper names cut from mid-sentence sources MAY be lowercased mid-merge ("Paris" → "paris") — accepted; wrong corrections are fixed by hand; the undo idea is deferred (the Feature 4 Task 3 placeholder) (user decision 2026-10-22, Q12 — drops roadmap Task 1.1's source-case guard).
7. The standalone "I" guard SHALL NOT exist in either language's rule set (user decision 2026-10-22, Q16 — supersedes the Round 1 Q5a acceptance); with it gone, the en-US and pt-BR rule sets are identical.

**Independent Test**: Table-driven guard units — every guard's positive/negative rows; the exact-"I" rows ("I" mid-sentence → "i"; "I" after "." stays; "i" at document start → "I"); the all-caps single-letter rows ("A", "B" untouched everywhere); the accepted-wrongness rows ("Paris" mid-sentence → "paris"); empty/non-letter rows.

---

### P1: UI-language-keyed rule sets ⭐ MVP

**User Story**: As a merger, I want the correction rules to be language-aware plumbing, so per-language rules can arrive later without rework.

**Why P1**: User decision 2026-10-22 (Q14: "UI language picks rules"); Q16 emptied the only per-language difference, making this structural.

**Acceptance Criteria**:

1. The rule set SHALL be selected by the active UI language (the i18n language tag) at every pass invocation — document triggers and the copy path.
2. The en-US and pt-BR rule sets SHALL be identical in content (the dropped "I" guard was the only candidate differentiator).
3. Casing transforms MAY use locale-aware `toLocaleUpperCase`/`toLocaleLowerCase` with the UI language tag (agent default; no behavioral difference for en-US/pt-BR today); a missing/unknown tag falls back to the default rule set.
4. NO new i18n strings, UI, or DOM changes SHALL ship with the pass.

**Independent Test**: Rule-table lookup units keyed by language tag; an integration row asserting identical outputs under both languages; the copy memo re-derives on language change; a scan asserting no new translation keys and no DOM changes.

---

### P1: The mixed comparison policy (case-aware re-emissions) ⭐ MVP

**User Story**: As a merger, I want the app to recognize its own corrections when sources re-send their snippets, while still recognizing MY case edits as mine — so nothing churns and nothing overrides me.

**Why P1**: Roadmap Task 1.2's "make reconciliation comparisons case-aware" as resolved by user decision 2026-10-22 (Q15: only comparison #1 case-tolerant; #2 and #3 exact).

**Acceptance Criteria**:

1. WHEN a source re-emission's snippet texts differ from the stored token texts only in case (the stored text being pass-corrected) THEN reconciliation's no-op guard SHALL treat it as unchanged — comparing pass-canonical forms — and return a reference-identical state: no re-render, no focused-surface remount.
2. The edited-detection comparison (`SYNC_DOCUMENT`: `previous.text !== token.text`) SHALL stay exact — a case-only difference marks the token edited (that is how manual overrides freeze; Frozen-chips story).
3. The focused-surface self-recognition comparison (`tokensEqualIgnoringEdited`) SHALL stay exact — a pass-induced case change counts as a real change: the focused surface re-renders from the model, is never mistaken for the surface's own typing, and no stale-case chip is falsely frozen by the next keystroke's whole-document parse.
4. WHILE edit mode is ON and a surface is focused WHEN a pass-induced model change re-renders it THEN the accepted caret reset (ADR 0004's non-text-change path) applies.

**Independent Test**: Reducer suites — re-emit identical snippets with case-only differences after correction and assert `next === state` (reference identity) and zero re-renders (render-count assertions); the comparison-policy table rows (a case-only sync diff → edited; a case-only model-vs-DOM diff → re-render, not echo).

---

### P1: Idempotence and reference stability ⭐ MVP

**User Story**: As a merger, I want the pass to be invisible when it has nothing to do — no flickers, no wasted renders — so the preview stays calm.

**Why P1**: User decision 2026-10-22 (Q2: central, idempotent); reference stability is what keeps the case-aware reconciliation (Mixed-comparison story) and ADR 0004's focused-surface contract coherent.

**Acceptance Criteria**:

1. The pass SHALL run centrally in the `snippetsReducer` wrapper on EVERY transition except `SYNC_DOCUMENT` — creation, both move actions, `SET_EDIT_ENABLED`, no-ops — as a whole-document recompute (no per-trigger scoping logic).
2. IF the pass changes nothing THEN the previous state object SHALL be returned (reference-identical).
3. Running the pass over an already-corrected document SHALL yield content-identical tokens (idempotence).
4. The pass SHALL run after reconciliation's source-text rewrite and after the wrapper's eager `normalizeTextTokens`, so it only ever sees canonical token shapes.

**Independent Test**: Action-type × document-shape reducer sweeps (including `SET_EDIT_ENABLED` and a no-op move) asserting reference stability; double-application idempotence units over representative documents (empty, own-text-only, all-frozen, glued, capped/clamped).

---

### Draft Records Copy (Developer deliverables)

**ADR 0005** — `docs/adr/0005-preview-auto-fix-pass.md` (title: "Snippet casing follows merged context via a central, idempotent case-fix pass"). Status: **Proposed** (drafted 2026-10-22 in this spec; the Developer writes the file at implementation time).

Snippets are cut from arbitrary positions in their sources and glued into new contexts in the preview document, so the casing they arrive with is regularly wrong for the merge: a chip beginning lowercase can land at a sentence start, and a sentence-started chip can land mid-sentence. We decided snippet casing follows the merged context: a pure case-fix pass in the preview document utils recomputes the whole document — classifying each snippet token by its predecessor (document start; after sentence-ending `.`, `!`, `?`, or `…`, ignoring trailing whitespace and closing quotes/brackets; after a line break; mid-sentence; or glued to non-whitespace text, which is left alone) — and transforms only the first letter of the first word: capitalized at sentence starts, lowercased mid-sentence. Guards skip all-caps first words including single letters — except the exact word "I", which follows the general rules — mixed-case first words (brands like "iPhone"), non-letter first characters, empty tokens, and user-edited ("frozen") tokens. The pass is wired centrally in the snippetsReducer wrapper after every transition except SYNC_DOCUMENT (so it always sees canonical shapes after reconciliation's source-text rewrite and eager normalization, and so corrections never fight the focused editor mid-typing), and on the copy path, where it applies to a transformed copy of the tokens before serialization: the clipboard is always fully corrected while the document is corrected only at triggers. There is no source-context guard: the pass never consults how the text was cased in its source — proper names cut from mid-sentence sources can be lowercased mid-merge; wrong corrections are fixed by hand, and a deferred undo task exists as roadmap Feature 4 Task 3. Rule sets are keyed by the active UI language (identical content for en-US and pt-BR today). The comparison policy is mixed: reconciliation's no-op guard is case-aware (case-only re-emissions produce reference-identical state), while edited-detection and the focused-surface self-recognition comparison stay exact — which is precisely what makes a manual case override freeze the chip and survive later sorts.

Considered options (all rejected unless chosen):

- **Per-trigger wiring at each call site (creation, sort, copy)** — three call sites drift; the moved chip's neighbors (whose predecessors changed) are easy to miss; the wrapper is one seam and the whole-document recompute makes coverage structural.
- **Remembering the source's original casing per token (roadmap Task 1.1's "capitals that were already mid-sentence in the source" guard)** — dropped by user decision 2026-10-22: corrections apply purely from merged context; the user prefers hand-fixing wrong corrections to source-tracking complexity.
- **A standalone "I" guard (roadmap Task 1.1's original list)** — dropped by user decision 2026-10-22: "I" follows the general contextual rules (mid-sentence "I" → "i" — wrong by English orthography, accepted and fixed by hand); with it gone, the en-US and pt-BR rule sets are identical.
- **Running the pass on SYNC_DOCUMENT too** — corrections would rewrite the focused surface between keystrokes, fighting the editor (ADR 0004); the copy path already guarantees a fully corrected clipboard for the stale window.
- **All comparisons exact** — every case-only source re-emission would flip corrected tokens back to source case and re-correct them: reference-unstable churn and needless focused-surface remounts.
- **All comparisons case-tolerant** — a deliberate case retyping would no longer freeze the chip (manual overrides would never stick) and corrections would be mistaken for the editor's own typing (false freezes).
- **A central pass in the reducer wrapper (skip SYNC_DOCUMENT) + the copy-path copy — chosen.**

Consequences:

- Triggers: every reducer transition except SYNC_DOCUMENT (creation via SET_SOURCE_SNIPPETS; sorts via MOVE_TOKEN / MOVE_TOKEN_TO_LANDING) plus the copy path; copy never mutates the document.
- Frozen chips are never re-corrected — hand edits are final (roadmap Task 1.4's "manual override survives" test); the accepted side effect: text typed later into an edited chip is never auto-corrected either.
- The visible document can hold stale casing after typing until the next trigger; the clipboard is always fully corrected.
- A pass-induced model change while edit is ON and the surface is focused is a non-text change: the focused surface re-freezes/re-renders and the caret may reset (the accepted ADR 0004 trade-off).
- Proper names get lowercased mid-merge ("Paris" → "paris") and mid-sentence "I" becomes "i" — both wrong-by-orthography outputs are accepted; users fix them by hand; a deferred undo task is recorded as roadmap Feature 4 Task 3.
- Roadmap Task 1.1's guard list is amended at completion: "standalone 'I'" and "capitals that were already mid-sentence in the source" are dropped (user decisions 2026-10-22); Task 1.2's case-aware-comparison wording resolves to the mixed policy (reconcile no-op case-aware; edited-detection and focused-surface comparisons exact).
- Rule sets are keyed by the UI language — a structural extension point awaiting a content-language mechanism (the per-input picker idea is deferred).
- Abbreviations are not handled: a period always classifies a sentence end ("Dr." capitalizes the next chip).

---

## Edge Cases

- IF a source re-emission differs from the stored tokens only in case THEN the case-aware no-op guard returns the reference-identical state — no re-render, no focused-surface remount.
- IF the user retypes only the casing of a chip ("paris" → "Paris") THEN the exact sync comparison marks it edited — the chip freezes and survives all later triggers.
- IF a sort happens while edit mode is ON and the surface is focused THEN pass-induced changes re-render the focused surface and the caret may reset (accepted — ADR 0004's non-text-change path).
- IF copy runs while the visible document holds stale casing THEN the clipboard still receives the fully corrected serialization (the payload may differ from the visible text only in case).
- IF a chip lands glued to non-whitespace text (e.g. own text "re" + chip "run") THEN its casing is left alone, even after a sort.
- IF the predecessor's text ends with trailing whitespace and/or closing quotes/brackets/parentheses THEN classification strips them before checking `.`, `!`, `?`, `…` (`"He said. "` → sentence end; `"The end."` → sentence end once the quote strips; `"(see above)"` → mid-sentence).
- IF the predecessor ends with `:` THEN the successor chip classifies mid-sentence (a colon is not a sentence end).
- IF a chip follows a line-break token THEN it classifies as a sentence start regardless of what precedes the break.
- IF the first word is exactly "I" THEN the all-caps guard does not apply: mid-sentence "I" → "i" (wrong by English orthography — accepted, fixed by hand); at a sentence start "i" → "I".
- IF the first word is a single uppercase letter other than "I" ("A", "B") THEN the all-caps guard protects it everywhere; IF it is a single lowercase letter ("a") THEN the general rules apply ("a" → "A" at a sentence start; unchanged mid-sentence).
- IF the first character is not a letter ("123 results", "(Note") THEN the token is untouched.
- IF the first word is mixed-case ("iPhone", "eBay", "McDonald's") or all-caps ("NASA") THEN the token is untouched.
- IF a proper name is cut from a mid-sentence source and lands mid-sentence THEN it is lowercased ("Paris" → "paris") — accepted (no source-context guard); the user fixes it by hand and that fix is final.
- IF the token is empty or whitespace-only THEN it is untouched.
- IF an edited chip's source snippet is resized THEN reconciliation keeps its text frozen (edited tokens are never rewritten) and the pass skips it too.
- IF an abbreviation ("Dr.", "e.g.") precedes a chip THEN the period still classifies a sentence end and the chip is capitalized (no abbreviation dictionary in v0 — deferred).
- IF the pass runs on `SET_EDIT_ENABLED` or on a reducer no-op THEN it returns the reference-identical state (idempotence).
- IF the UI language changes THEN the keyed rule set re-derives on the next trigger and the copy memo re-derives — content identical today, so nothing visibly changes.
- IF the document is empty or holds no snippet tokens THEN the pass is a reference-identical no-op.
- IF both copy buttons are mounted (modal open) THEN both produce the same corrected payload from the one document (ADR 0003's shared-state pattern).

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| CASE-01 | Creation-time context correction | Specify | Pending |
| CASE-02 | Creation-time context correction | Specify | Pending |
| CASE-03 | Creation-time context correction | Specify | Pending |
| CASE-04 | Creation-time context correction | Specify | Pending |
| CASE-05 | Creation-time context correction | Specify | Pending |
| CASE-06 | Sort-time context correction | Specify | Pending |
| CASE-07 | Sort-time context correction | Specify | Pending |
| CASE-08 | Sort-time context correction | Specify | Pending |
| CASE-09 | Sort-time context correction | Specify | Pending |
| CASE-10 | Copy-time correction (inline + modal) | Specify | Pending |
| CASE-11 | Copy-time correction (inline + modal) | Specify | Pending |
| CASE-12 | Copy-time correction (inline + modal) | Specify | Pending |
| CASE-13 | Copy-time correction (inline + modal) | Specify | Pending |
| CASE-14 | Copy-time correction (inline + modal) | Specify | Pending |
| CASE-15 | Frozen chips and the surviving manual override | Specify | Pending |
| CASE-16 | Frozen chips and the surviving manual override (comparison #2 exact — Q15) | Specify | Pending |
| CASE-17 | Frozen chips and the surviving manual override (accepted side effect — Q13) | Specify | Pending |
| CASE-18 | Frozen chips and the surviving manual override (roadmap's "manual override survives" test) | Specify | Pending |
| CASE-19 | Guards (the "I" carve-out — Q16, derived) | Specify | Pending |
| CASE-20 | Guards | Specify | Pending |
| CASE-21 | Guards | Specify | Pending |
| CASE-22 | Guards | Specify | Pending |
| CASE-23 | Guards | Specify | Pending |
| CASE-24 | Guards (no source-context guard — Q12; roadmap amendment) | Specify | Pending |
| CASE-25 | Guards (standalone "I" guard dropped — Q16; roadmap amendment) | Specify | Pending |
| CASE-26 | UI-language-keyed rule sets (Q14) | Specify | Pending |
| CASE-27 | UI-language-keyed rule sets (identical content — Q16) | Specify | Pending |
| CASE-28 | UI-language-keyed rule sets (locale-aware casing — agent default) | Specify | Pending |
| CASE-29 | UI-language-keyed rule sets (no new i18n strings) | Specify | Pending |
| CASE-30 | The mixed comparison policy (comparison #1 case-aware — Q15) | Specify | Pending |
| CASE-31 | The mixed comparison policy (comparison #2 exact — Q15) | Specify | Pending |
| CASE-32 | The mixed comparison policy (comparison #3 exact — Q15) | Specify | Pending |
| CASE-33 | The mixed comparison policy (focused caret reset — ADR 0004) | Specify | Pending |
| CASE-34 | Idempotence and reference stability (central wiring — Q2) | Specify | Pending |
| CASE-35 | Idempotence and reference stability | Specify | Pending |
| CASE-36 | Idempotence and reference stability | Specify | Pending |
| CASE-37 | Idempotence and reference stability (pass ordering — agent default) | Specify | Pending |

**ID format:** `CASE-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified; additionally **Deviated** (implemented with a changed contract — see `implementation.md`) and **Deferred** (not implemented — see `implementation.md`).

**Coverage:** 37 total. 0 Verified, 0 Deviated, 0 Deferred. Roadmap mapping: 1.1 (pass + classifier + guards, **as amended**) → CASE-01–05 (classification/transform) and CASE-19–25 (guards; the two dropped-guard amendments recorded on CASE-24 — source-context guard, user decision 2026-10-22 — and CASE-25 — standalone "I" guard, user decision 2026-10-22; the "I" carve-out on CASE-19, derived from the Q16 quote); 1.2 (wiring + case-aware comparisons, **nuanced**) → CASE-06–09 (sort), CASE-15–18 (frozen/manual override), CASE-30–33 (the mixed comparison policy), CASE-34–37 (central wiring/idempotence); 1.3 (copy path) → CASE-10–14; 1.4 (tests) → every story's Independent Test under the Q10 behavior-level oracle policy. Both roadmap lines are annotated at completion time to record the amendments and the comparison nuance. Per-requirement outcomes: `.specs/features/preview-area-auto-fix/tasks/case-auto-fix/implementation.md` (to be created by the developer sub-agent).

---

## Success Criteria

How we know the feature is successful:

- [ ] A snippet created or resized mid-sentence reads lowercase-first; after `.`, `!`, `?`, `…`, a line break, or at the document start it reads capitalized; glued chips and every guard row are untouched.
- [ ] Sorting re-corrects the moved chip and predecessor-changed chips; letters visibly flip across sentence boundaries; a no-op sort renders nothing (reference-identical state).
- [ ] Copy (toolbar and modal) always writes the fully corrected serialization, even while the visible document holds stale case; the context document is never mutated by copy.
- [ ] A hand-fixed chip keeps its casing through repeated sorts and re-emissions ("manual override survives"); text typed later into an edited chip is never auto-corrected.
- [ ] Exactly "I" follows the general contextual rules in both languages (the all-caps carve-out); "A"/"B" stay protected; "Paris" can become "paris" mid-sentence — accepted and hand-fixable.
- [ ] A case-only source re-emission is a reference-identical no-op (no re-render); a case-only user retyping freezes the chip; a correction while edit-ON+focused re-renders the surface (the accepted caret reset).
- [ ] Rule sets are keyed by the UI language with identical content today; no new i18n strings, no GLOSSARY changes, no DOM/testid changes.
- [ ] ADR 0005 is written by the Developer (draft in this spec); the roadmap Task 1.1/1.2 lines are annotated at completion; the Feature 4 "Task 3: Undo auto-corrections" placeholder exists in `roadmap.md` (added in this specs phase).
- [ ] `npx vitest run`, `npm run lint`, and `npx tsc -b` pass; existing oracle suites stay green at the behavior level with only the listed assertion updates; the new unit rule/guard tables + create/sort/override/copy integration suites are green.
