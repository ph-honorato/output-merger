# Case Auto-Fix (Feature 4, Task 1)

**Gathered:** 2026-10-22
**Spec:** `.specs/features/preview-area-auto-fix/tasks/case-auto-fix/spec.md`
**Status:** Specified — awaiting implementation

---

## Feature Boundary

Snippet capitalization follows its merged context in the preview (inline and modal), for Feature 4 Task 1 only (roadmap Task 1.1–1.4): a pure case-fix pass in the preview document utils — a predecessor classifier (sentence start = document start, after `.` `!` `?` `…` — NOT `:`, or after a line break; chips glued to non-whitespace text left alone; look-back past separator/whitespace tokens) with capitalize-at-sentence-start / lowercase-after-mid-sentence rules over the first letter of the first word of SNIPPET tokens only, plus guards (all-caps first word including single letters — EXCEPT the exact word "I", mixed-case first word, non-letter first character, empty tokens, frozen/edited tokens); rule sets keyed by the active UI language (identical content for en-US/pt-BR today); central wiring in the exported `snippetsReducer` wrapper on every transition except `SYNC_DOCUMENT` — idempotent, reference-stable, whole-document recompute — covering creation (`SET_SOURCE_SNIPPETS`, running after reconciliation's source-text rewrite and the eager normalization) and sorts (`MOVE_TOKEN` / `MOVE_TOKEN_TO_LANDING`: the moved chip and every chip whose predecessor changed); the copy path (`CopyMergedTextButton.hook.tsx`) applies the pass to a transformed COPY of the tokens before `serialize()` so the clipboard is always fully corrected without mutating the document; the reconciliation no-op comparison becomes case-aware while the edited-detection and focused-surface comparisons stay exact (which is what makes a manual case override freeze the chip and survive); frozen chips are never re-corrected — hand edits are final; ADR 0005 drafted in the spec (the Developer writes `docs/adr/0005-preview-auto-fix-pass.md`); the roadmap Task 1.1/1.2 lines are annotated at completion; and the test suites (unit rule/guard tables + create/sort/manual-override/copy integration, existing oracle suites at behavior level). Two roadmap amendments recorded with user decision date 2026-10-22 (both roadmap lines updated at completion time): (a) Task 1.1's "capitals that were already mid-sentence in the source" guard is dropped — no source-context guard, corrections apply purely from merged context, wrong corrections ("Paris" → "paris") are fixed by hand; (b) Task 1.1's standalone "I" guard is dropped — "I"/"i" follows the general contextual rules (supersedes the Round 1 Q5a acceptance of that guard). NOT the spacing pass (Task 2, separate spec), NOT modifying the source TextInputs, NOT an undo/review UI (deferred — recorded as the unchecked Feature 4 "Task 3: Undo auto-corrections" placeholder in `roadmap.md`, added in this specs phase), NOT a per-input language picker or content-language detection, NOT abbreviation handling, NOT own-text/line-break casing, NOT new i18n strings or GLOSSARY changes, and NOT writing docs/adr during the specs phase (Developer deliverable).

---

## Implementation Decisions

### Grilling record and scope

- Three rounds, 16 answers, all dated 2026-10-22: Round 1 (Q1–Q11) settled scope, triggers, classification rules, transform scope, lexical guards, visibility, tests, records; Round 2 (Q12–Q15) settled the source-case guard, hand-edit finality, language rules, and the comparison policy; Round 3 (Q16, relayed directly) settled the standalone "I" rule.
- **User decision (2026-10-22, Q1)**: Task 1 only — the spacing pass is Task 2 with its own spec.

### The pass, its rules, and its guards (Task 1.1)

- **User decision (2026-10-22, Q3)**: predecessor classification — sentence end iff the predecessor's last meaningful character (after stripping trailing whitespace, then trailing closing quotes/brackets/parentheses) is `.` `!` `?` or `…` (NOT `:`); document start and line breaks are sentence starts; look back past separator/whitespace tokens to the last meaningful content; chips glued (no whitespace boundary) to non-whitespace text are left alone; no abbreviation handling in v0 (deferred).
- **User decision (2026-10-22, Q4)**: transform scope — ONLY the first letter of the first word of SNIPPET tokens; own text, line breaks, and the source inputs are never touched.
- **User decision (2026-10-22, Q5a, as superseded in part by Q16)**: lexical guards — all-caps first word including single letters (with the "I" carve-out below), mixed-case first word ("iPhone", "eBay", "McDonald's"), non-letter first character, empty tokens, frozen (edited) tokens.
- **User decision (2026-10-22, Q16, verbatim)**: "Ok, ignore this rule then. 'i' should only became 'I' if it is on beggning of a snippet, and the snippet needs this correction. Example: placed after a '.'" — the standalone "I" guard is dropped entirely (both languages), superseding Q5a's acceptance of it; "I"/"i" follows the general contextual rules ("I" → "i" mid-sentence — wrong by English orthography, accepted and fixed by hand per the Q12 philosophy; "i" → "I" at a sentence start).
- Derived from the Q16 quote (agent interpretation, flagged): the all-caps guard must NOT protect the exact first word "I" — the general contextual rules apply instead — while other single letters ("A", "B", "C") stay protected (which also keeps the existing oracle suites byte-identical).
- **User decision (2026-10-22, Q5b/Q12, verbatim)**: "The correction will only apply if its the first letter of the first word of the snippet. On those cases, user will need to fix by hand later. We can actually think later of adding a third task to this feature, for user undo this auto corrections. But we will think about this later." — NO source-context guard: the pass never consults how the text was cased in its source; proper names cut from mid-sentence sources can be lowercased mid-merge ("Paris" → "paris"); wrong corrections are fixed by hand.
- Agent default: pass location and exports — pure functions in `src/utils/previewDocument.ts` (the `serialize`/`tokensEqual` home), named freely; the classifier and rules are data (a rule table), not scattered conditionals.

### Wiring and triggers (Task 1.2)

- **User decision (2026-10-22, Q2)**: central — the pass runs in the exported `snippetsReducer` wrapper on EVERY transition except `SYNC_DOCUMENT`; whole-document recompute (the moved chip and every predecessor-changed chip are covered by construction); idempotent and reference-stable (nothing changes → the same state object returns).
- Agent default: the pass runs after reconciliation's source-text rewrite AND after the wrapper's eager `normalizeTextTokens`, so it only ever sees canonical token shapes; corrections never run mid-typing (the `SYNC_DOCUMENT` skip), so the visible case can be stale until the next trigger — accepted in Q7.
- **User decision (2026-10-22, Q9/Q13)**: hand edits are final — frozen (`edited === true`) chips are NEVER re-corrected, no matter how much sorting happens around them; sorts still re-correct all non-edited chips (the moved one + predecessor-changed ones); accepted side effect: later typing in the same chip is also never auto-corrected.
- **User decision (2026-10-22, Q8/Q15)**: the mixed comparison policy — (1) the reconciliation no-op comparison becomes case-aware (a case-only emission difference is "no change": pass-canonical forms are compared); (2) edited-detection (`syncParsedDocument`'s `previous.text !== token.text`) stays EXACT so deliberate case retyping freezes the chip; (3) the focused-surface self-recognition comparison (`tokensEqualIgnoringEdited`) stays EXACT so a correction is never mistaken for the surface's own typing.
- Agent default: the case-aware guard's mechanism (canonical-form comparison vs run-pass-then-compare) is Developer latitude; the pinned observable is a reference-identical state (no re-render, no focused-surface remount) for case-only re-emissions.
- ADR 0004 interplay (verified in the code): a pass-induced model change while edit-ON+focused is a non-text change → the surface re-freezes + renderEpoch remount — the accepted caret reset.

### Copy path (Task 1.3)

- **User decision (2026-10-22, Q7/Q9 consequence)**: the visible document IS corrected at the trigger points, and the clipboard is ALWAYS fully corrected — copy applies the pass to a transformed COPY of the tokens before `serialize()`; the context document is never mutated by copy.
- Agent default: the `mergedText` memo in `CopyMergedTextButton.hook.tsx` (`serialize(previewDocument)` today) becomes the corrected serialization, keyed on the document and the UI language; the one component serves the toolbar and the modal rail (ADR 0003), so both copy buttons get the fix for free.

### Visibility and language

- **User decision (2026-10-22, Q7)**: all three consequences accepted — letters visibly flip on sort across sentence boundaries; a sort while edit-ON+focused re-renders the surface (caret reset, the ADR 0004 trade-off); after typing, the visible case can be stale until the next trigger while copy always corrects the clipboard.
- **User decision (2026-10-22, Q14)**: the rule set is keyed by the UI language (en-US / pt-BR) — structure only; Q16 makes today's sets identical (the "I" guard was the only candidate differentiator).
- Agent default: casing transforms may use the UI language tag for locale-aware `toLocaleUpperCase`/`toLocaleLowerCase` — no behavioral difference for en-US/pt-BR today.
- Agent default: NO new i18n strings — the pass is model-level and UI-invisible; the language key is consumed, not added to.

### Tests and records (Task 1.4 / Q10–Q12)

- **User decision (2026-10-22, Q10)**: existing oracle suites keep passing at the behavior level with only listed, deliberate assertion updates; new suites — unit rule/guard tables in the `previewDocument.test.ts` area + integration (create, sort both sides, manual override survives, copy output) in `CopyMergedTextButton.test.tsx` / `PreviewArea.test.tsx` / the reducer suites.
- **User decision (2026-10-22, Q11)**: ADR 0005 drafted in the spec now (triggers, guards, case-aware reconciliation, the no-source-context amendment, UI-language-keyed rule sets) — written to `docs/adr/` by the Developer; NO GLOSSARY changes.
- **User decision (2026-10-22, Q12)**: the future undo task is recorded in BOTH places — the unchecked Feature 4 "Task 3: Undo auto-corrections" placeholder in `roadmap.md` (added in this specs phase) and this spec's Deferred Ideas.

### Agent's Discretion

- Export names and internal decomposition of the pass in `previewDocument.ts` (e.g., `applyCaseFix`, `classifyTokenContext`) — the semantics are pinned, the names are free.
- The rule-table shape, as long as it is keyed by the UI language tag and content-identical for en-US/pt-BR today.
- The case-aware no-op guard mechanism (canonical-form comparison vs run-pass-then-compare) — the observable (reference-identical state) is pinned.
- `toLocaleUpperCase`/`toLocaleLowerCase` (with the i18n tag) vs plain ASCII casing — no difference today; locale-aware recommended.
- Test placement within the listed suites; no new testids; no UI/DOM changes.

---

## Specific References

UI paths are relative to `artifacts/output-merger.UI/`.

- `src/utils/previewDocument.ts` — the pure pass, predecessor classifier, guard/rule tables, and the case-canonical comparison helper land here beside `serialize` / `tokensEqual` / `tokensEqualIgnoringEdited` / `normalizeTextTokens`.
- `src/utils/previewDocument.test.ts` — the rule/guard table units (classification × transform × guard, including the "I" carve-out rows and the exact-"I" general-rule rows), idempotence and canonical-comparison units.
- `src/context/SnippetsContext/SnippetsContext.reducer.ts` — the exported `snippetsReducer` wrapper (transition → eager `normalizeTextTokens` → pass, skipping `SYNC_DOCUMENT`); `reconcileSourceSnippets`'s `tokensEqual` no-op guard becomes case-aware; `syncParsedDocument`'s `previous.text !== token.text` edited-detection stays exact; `MOVE_TOKEN` / `MOVE_TOKEN_TO_LANDING` need no per-case wiring (the central wrapper covers them); the `SnippetToken.edited` flag is the frozen marker the pass always skips.
- `src/context/SnippetsContext/SnippetsContext.reducer.test.ts` + `SnippetsContext.test.tsx` — trigger/reference-stability suites, the manual-override-survives suite, the re-emission reference-identity suite, and the listed oracle-suite assertion updates.
- `src/pages/MergeSession/components/CopyMergedTextButton/CopyMergedTextButton.hook.tsx` — the `mergedText` memo (`serialize(previewDocument)` today) applies the pass to a copied token array; keyed on the document + UI language; never mutates context state.
- `src/pages/MergeSession/components/CopyMergedTextButton/CopyMergedTextButton.test.tsx` — corrected-clipboard, no-mutation, and stale-visible-case integration.
- `src/pages/MergeSession/components/PreviewArea/PreviewArea.test.tsx` — sort-both-sides visible flips; the focused-surface re-render on pass-induced change flows through ADR 0004's existing non-text-change path (mechanism unchanged).
- `src/pages/MergeSession/MergeSessionPage.tsx` — the creation flow (TextInput `onChange` → `setSourceSnippets` → `SET_SOURCE_SNIPPETS`); referenced, unchanged.
- `src/i18n/` — consumed for the language key (`i18n.language`); NO new strings.
- `docs/adr/0005-preview-auto-fix-pass.md` — Developer deliverable; the draft is in the spec's Draft Records Copy section.
- `roadmap.md` — the Feature 4 "Task 3: Undo auto-corrections" placeholder is added in this specs phase; the Task 1.1/1.2 lines are annotated at completion (the two dropped guards + the mixed-comparison nuance), following the established deviation-note pattern.
- Prior records: ADR 0001 (diff-by-id — the reconciliation the pass hooks after), ADR 0002 (hold-to-drag — untouched), ADR 0003 (the same PreviewArea inline + modal — why one copy fix covers both), ADR 0004 (document model + focused-surface contract — the non-text-change semantics and the accepted caret reset); `.specs/features/preview-area-tools/tasks/editable-preview-text/` (the model, freeze mechanics, and comparison helpers this pass builds on).
- Note: `PREVIEW_DOCUMENT_MAX_LENGTH` / `clampDocumentToLimit` — the pass is case-only (it never changes token length), so the document-cap paths are unaffected.

---

## Deferred Ideas

- Undo/review auto-corrections — the unchecked Feature 4 "Task 3: Undo auto-corrections" placeholder in `roadmap.md` (user decision 2026-10-22, "we will think about this later").
- Abbreviation-aware sentence boundaries ("Dr.", "e.g.", pt-BR "Sr.") — none in v0; a period always classifies a sentence end.
- Per-language rule-set divergence, a per-input language picker, or content-language detection — the UI-language keying is the structural extension point; a real detection mechanism is the prerequisite.
- Source-context guard (remembering how the text was cased in its source) — rejected by user decision 2026-10-22 (Q12); revisit only on explicit user request.
