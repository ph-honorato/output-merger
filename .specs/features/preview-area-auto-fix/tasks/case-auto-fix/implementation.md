# Case Auto-Fix Implementation

**Implemented:** 2026-10-23
**Spec:** `.specs/features/preview-area-auto-fix/tasks/case-auto-fix/spec.md`
**Context:** `.specs/features/preview-area-auto-fix/tasks/case-auto-fix/context.md`
**Code:** `artifacts/output-merger.UI/src/`
**Status:** Implemented — Feature 4, Task 1 (roadmap 1.1–1.4) complete; verified by 38 new automated tests (515 total across 19 files; was 477), oxlint, `tsc -b`, `vite build`. No requirement deviated from the spec. The two roadmap amendments the spec bakes in (the dropped standalone-"I" guard and the dropped source-context guard — user decisions 2026-10-22, Q16/Q12) are implemented exactly as specified, and the mixed comparison policy (Q15) resolves Task 1.2's "case-aware comparisons" wording as specified. The existing oracle suites pass at the behavior level with the deliberate, listed assertion updates of §4 (the Q10 policy): the case pass visibly re-cases mid-sentence chips ("Alpha Beta Gamma" now renders "Alpha beta gamma"), so every serialized-text expectation over pass-corrected documents was updated to the corrected casing — mechanically, with each expected value derived from the classifier rules, not copied from received output. The judgment calls (export names, the rule-table shape and tag resolution, the run-pass-then-compare guard mechanism, the reducer's i18n read, the single-character length valve, the glued/strip ordering) are recorded in §3. **Tester cycle (2026-10-23):** approved — code, the full suite, `tsc -b`, and oxlint all green, no bugs, security findings, or duplications, and no code changes required; the records findings (the roadmap Task 1.1–1.4 checkoff and the Task 1.1/1.2 deviation annotations) were resolved at completion time and are recorded with the informational notes in §8.

---

## 1. Deliverables

| File | Role |
| ---- | ---- |
| `src/utils/previewDocument.ts` | New case-fix pass section beside `serialize`/`tokensEqual`/`normalizeTextTokens`: `CaseFixRuleSet` (the language-keyed rule table — the locale tag forwarded to the casing transforms, the sentence-end chars `. ! ? …`, the closing-wrapper chars `) ] } " ' ” ’ »`), `caseFixRuleSetFor` (rule-table lookup: the tag's primary subtag resolves the set — `en-US`/`en` → en, `pt-BR`/`pt` → pt; unknown/missing → the default set), `TokenCaseContext` + `classifyTokenContext` (the predecessor classifier — document start; a line-break predecessor; the look-back past separator/whitespace-only/empty tokens, stripping trailing whitespace and closing wrappers as one loop before reading the last meaningful char against the sentence-end table; `glued` when the directly-abutting character is non-whitespace), `firstWordOf`/`isAllCapsWord`/`hasInteriorUppercase` (the guard primitives), `applyCaseFix` (the whole-document pass — the first letter of the first word of non-edited SNIPPET tokens only: `toLocaleUpperCase(ruleSet.locale)` at a sentence start, `toLocaleLowerCase` mid-sentence; glued and guarded tokens untouched; single-character replacements only; pure, reference-stable, idempotent), and `tokensEqualCanonicalCase` (both sides run through the pass before the exact content comparison — the case-canonical comparison helper). |
| `src/context/SnippetsContext/SnippetsContext.reducer.ts` | Modified: (1) `reconcileSourceSnippets`'s no-op guard compares pass-canonical forms — `tokensEqualCanonicalCase(tokens, state.tokens, i18n.language)` — so a re-emission whose snippet texts differ from the stored tokens only in pass-correctable case returns the reference-identical state; (2) the exported `snippetsReducer` wrapper runs the pass centrally on EVERY transition except `SYNC_DOCUMENT`, after the transition's source-text rewrite and the eager `normalizeTextTokens`, no-op transitions included (a state entering the transition with stale casing — left by a mid-typing sync — is corrected by the next trigger, whatever it is), returning the same state object when nothing changes; `SYNC_DOCUMENT` keeps the mid-typing skip entirely (the eager normalization still runs there). `syncParsedDocument`'s exact edited-detection (`previous.text !== token.text`) and its exact `tokensEqual` no-op guard are UNTOUCHED. Imports the i18n singleton to read the active UI language tag at each dispatch. |
| `src/pages/MergeSession/components/CopyMergedTextButton/CopyMergedTextButton.hook.tsx` | Modified: the `mergedText` memo serializes the case-fixed document — `serialize(applyCaseFix(previewDocument, i18n.language))` — keyed on the document AND the UI language (a language switch re-derives). The pass runs over a transformed copy of the tokens, so the context document is never mutated by copying; the one component serves the toolbar and the modal rail, so both copy buttons get the fix. |
| `src/utils/previewDocument.test.ts` | Extended 52 → 73 (+21): the rule-table lookup units (tag resolution for both forms of both tags, the unknown/missing fallback, the en-US/pt-BR rule-content identity, identical pass outputs under both language tags); the classification × transform table (24 rows: document start; after each of `. ! ? …`; after `:` — NOT a sentence end; after a line break; mid-sentence; the closing-wrapper strip rows incl. the interleaved whitespace/closer strip; the look-back past separator and multiple whitespace-only tokens; only-whitespace-precedes; glued rows incl. glued-after-a-period chip, glued-after-a-closing-quote, and glued-to-own-text); the exported-classifier units; the guard tables (all-caps NASA/API and the single initials A/B in both contexts; the exact-"I" carve-out rows in both directions; mixed-case iPhone/eBay/McDonald's; non-letter first chars; empty/whitespace-only; frozen tokens on both transform sides; the accepted-wrongness Paris rows; the single lowercase `a`; the length-preservation valve `ß`/`İ`); reference-stability rows (the same-reference no-op over guarded/frozen/own-only/empty documents; untouched-token object-reference preservation + input purity; double-application idempotence + the serialized-length invariant over representative documents); and the `tokensEqualCanonicalCase` units. |
| `src/context/SnippetsContext/SnippetsContext.test.tsx` | Extended 45 → 54 (+9): new `case-fix triggers` suite — creation-time capitalization after a `.`-ending predecessor and creation-time mid-sentence lowercasing; the resize re-emission re-deriving the rewritten token's casing; the SYNC stale window (the mid-typing sync keeps stale case) with the next-trigger correction through a NO-OP move and the reference-identity once corrected; the same-value `SET_EDIT_ENABLED` no-op running the pass; both move actions (`MOVE_TOKEN` and `MOVE_TOKEN_TO_LANDING`) re-fitting the moved chip and the predecessor-changed chips; the manual-override-survives suite (auto-correct → hand-fix via a parsed sync → repeated sorts and source re-emissions keep the text and the `edited` flag). New `case-aware reconciliation` suite — the case-only re-emission as the reference-identical no-op (with a genuine text difference still transitioning); the exact edited-detection marking a case-only retyping edited. Provider-level: the render-count pin (a case-only re-emission keeps the document reference and re-renders zero times). Existing oracle assertions updated (§4). |
| `src/context/SnippetsContext/SnippetsContext.reducer.test.ts` | Modified (31 → 31): the randomized edited-document sweep's character-multiset guards (1-move and every-7th two-move) now compare case-insensitively, and the non-inert pin allows "the chip's position changed OR the serialization differs only in letter case"; the trailing-gap regression seam expects `'\nA bee '` (the moved `Bee` chip re-fits mid-sentence) with the case-insensitive multiset. The exhaustive MOVE oracle (chips `A`..`E` — all-caps-protected single letters) and the whole landing oracle (edited/frozen chips) pass byte-identically, unchanged. |
| `src/pages/MergeSession/components/CopyMergedTextButton/CopyMergedTextButton.test.tsx` | Extended 10 → 13 (+3): the corrected-payload-while-stale test (a mid-typing SYNC seeds a lowercase document-start chip; the clipboard receives `Hello and more tail` while the visible document asserts as stale-cased before and after); the no-mutation pin (the context document's token array, object references, and content unchanged by a copy); the language re-derivation test (`changeLanguage('pt')` → the same corrected payload, the memo re-derived; restored to en-US). The harness gained a hidden `DocumentProbe` (renders `serialize(document)` and hands the token array to the test) — test-local DOM, no production change. The unedited-session copy oracle updated: `'Hello Alpha'` → `'Hello alpha'` (the copy now writes the case-fixed serialization; the test title updated from "byte-identical to the old join" to the corrected-serialization contract). |
| `src/pages/MergeSession/components/PreviewArea/PreviewArea.test.tsx` | Extended 176 → 180 (+4): new `case-fix pass — creation and sort flips (inline)` suite — creation-time capitalization after `.`; creation-time mid-sentence lowercasing; the sort-flip round trip (a drag to the leading gap capitalizes the moved chip and lowercases the displaced one; a drag back to the trailing gap flips both letters back — the probe and the flow assert the WYSIWYG parity on each step); the frozen chip's hand-fixed casing surviving a pointer sort to the document start. Existing oracle assertions and the textContent-keyed rect mocks updated (§4). |
| `src/pages/MergeSession/components/PreviewModal/PreviewModal.test.tsx` | Extended 33 → 34 (+1): the dialog-scoped stale-copy test — both surfaces render stale case, the rail copy inside `within(getByRole('dialog'))` writes the fully corrected payload, and nothing mutates (both surfaces stay stale). The harness gained a `document` option (syncDocument seeding) mirroring the copy suite's pattern. Existing oracle assertions updated (§4). |
| `src/pages/MergeSession/MergeSessionPage.test.tsx` | Modified (12 → 12): oracle assertion updates — the seeded lowercase sources now render with the document-start chip capitalized (`beta gamma beta` → `Beta gamma beta`, the reorder `beta beta gamma` → `Beta beta gamma`, the typed `beta gamma beta!` → `Beta gamma beta!`), and the per-test rect mock gained both casings of both chip texts. |
| `docs/adr/0005-preview-auto-fix-pass.md` | New: the ADR from the spec's Draft Records Copy (title, paragraph, considered options, consequences verbatim; the paragraph's truncated tail completed consistently with the spec's mixed-comparison framing), following the `docs/adr/0001`–`0004` format. |
| `roadmap.md` | Completed at task checkoff (2026-10-23, post-Tester-approval, applied by the orchestrator per the spec's Records requirement): Feature 4 Task 1.1–1.4 checked off, and the Task 1.1/1.2 lines annotated — Task 1.1 records the two dropped guards (the standalone "I" and the "capitals that were already mid-sentence in the source", user decisions 2026-10-22); Task 1.2 records the mixed comparison policy (the reconcile no-op guard case-aware; the edited-detection and focused-surface comparisons exact). The Feature 4 "Task 3: Undo auto-corrections" placeholder was already recorded in the specs phase. |

Records delivered alongside (project root): `docs/adr/0005-preview-auto-fix-pass.md` and the `roadmap.md` completion annotations (the table row above). No GLOSSARY change; no i18n resource change; no DOM/testid change in production code; no route change; no backend file touched.

---

## 2. Behavior (as implemented)

```ts
// previewDocument.ts — the rule table and its lookup
export interface CaseFixRuleSet {
  locale: string;                       // forwarded to the casing transforms
  sentenceEndChars: readonly string[];  // ['.', '!', '?', '…']
  closingWrapperChars: readonly string[]; // [')', ']', '}', '"', "'", '”', '’', '»']
}

const CASE_FIX_RULE_SETS: Record<string, CaseFixRuleSet> = {
  en: buildCaseFixRuleSet('en-US'),
  pt: buildCaseFixRuleSet('pt-BR'),
};

export function caseFixRuleSetFor(languageTag: string | undefined): CaseFixRuleSet {
  if (!languageTag) return DEFAULT_CASE_FIX_RULE_SET;
  const primary = languageTag.split('-')[0];
  return CASE_FIX_RULE_SETS[primary] ?? DEFAULT_CASE_FIX_RULE_SET;
}
```

```ts
// previewDocument.ts — the predecessor classifier
export function classifyTokenContext(
  tokens: PreviewToken[],
  index: number,
  ruleSet: CaseFixRuleSet = DEFAULT_CASE_FIX_RULE_SET,
): TokenCaseContext {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const predecessor = tokens[cursor];
    if (predecessor.kind === 'line-break') {
      return 'sentence-start';
    }
    const text = predecessor.text;
    if (cursor === index - 1 && text.length > 0) {
      const lastChar = text[text.length - 1];
      if (!isWhitespaceChar(lastChar)) {
        return 'glued';
      }
    }
    // Strip trailing whitespace and closing wrapper characters until
    // the last meaningful character stands at the end.
    let end = text.length;
    while (
      end > 0 &&
      (isWhitespaceChar(text[end - 1]) ||
        ruleSet.closingWrapperChars.includes(text[end - 1]))
    ) {
      end -= 1;
    }
    if (end === 0) {
      continue; // whitespace-only/empty token: keep looking back
    }
    const lastMeaningful = text[end - 1];
    return ruleSet.sentenceEndChars.includes(lastMeaningful)
      ? 'sentence-start'
      : 'mid-sentence';
  }
  return 'sentence-start'; // only whitespace (or nothing) precedes
}
```

```ts
// previewDocument.ts — the pass core (guards, transform, reference stability)
export function applyCaseFix(
  tokens: PreviewToken[],
  languageTag?: string,
): PreviewToken[] {
  const ruleSet = caseFixRuleSetFor(languageTag);
  let result: PreviewToken[] | null = null;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!isSnippetToken(token) || token.edited) {
      continue;                                   // frozen tokens: always skipped
    }
    const firstChar = token.text[0];
    if (firstChar === undefined || !isLetterChar(firstChar)) {
      continue;                                   // empty / non-letter first char
    }
    const context = classifyTokenContext(tokens, index, ruleSet);
    if (context === 'glued') {
      continue;                                   // no whitespace boundary before it
    }
    const firstWord = firstWordOf(token.text);
    if (firstWord !== 'I' && isAllCapsWord(firstWord)) {
      continue;                                   // all-caps guard (the "I" carve-out is
    }                                             // the guard's own clause)
    if (hasInteriorUppercase(firstWord)) {
      continue;                                   // mixed-case (iPhone, eBay, McDonald's)
    }
    const fixed =
      context === 'sentence-start'
        ? firstChar.toLocaleUpperCase(ruleSet.locale)
        : firstChar.toLocaleLowerCase(ruleSet.locale);
    if (fixed.length !== 1 || fixed === firstChar) {
      continue;                                   // never a longer mapping (ß → SS)
    }
    if (result === null) {
      result = [...tokens];
    }
    result[index] = { ...token, text: fixed + token.text.slice(1) };
  }
  return result ?? tokens;                        // unchanged document → same reference
}
```

```ts
// SnippetsContext.reducer.ts — the central wiring (the exported wrapper)
export const snippetsReducer = (state, action) => {
  const next = snippetsReducerTransition(state, action);
  let base = next;
  if (next !== state) {
    const tokens = normalizeTextTokens(next.tokens);
    if (tokens !== next.tokens) {
      base = { ...next, tokens };
    }
  }
  if (action.type === 'SYNC_DOCUMENT') {
    return next === state ? state : base;         // the mid-typing skip
  }
  const tokens = applyCaseFix(base.tokens, i18n.language);
  if (tokens === base.tokens) {
    return next === state ? state : base;          // nothing changed → same reference
  }
  return { ...base, tokens };
};
```

```ts
// SnippetsContext.reducer.ts — reconcileSourceSnippets' case-aware no-op guard
if (
  tokensEqualCanonicalCase(tokens, state.tokens, i18n.language) &&
  sameStringSets(tombstones, state.tombstones)
) {
  return state;
}
```

```ts
// CopyMergedTextButton.hook.tsx — the copy path
const { t, i18n } = useTranslation();
const mergedText = useMemo(
  () => serialize(applyCaseFix(previewDocument, i18n.language)),
  [previewDocument, i18n.language],
);
```

- **Classification** (Task 1.1): a sentence start is the document start, a line-break predecessor, or a predecessor whose last MEANINGFUL character — after peeling trailing whitespace and closing wrappers as one loop (the spec's `"He said. "` example requires peeling the closing quote and then the whitespace inside it) — is `.`, `!`, `?`, or `…`. A colon classifies mid-sentence. The look-back walks past separator/whitespace-only/empty tokens to the last meaningful content; a line break found on the walk is a sentence start. A chip whose directly-abutting predecessor character is non-whitespace is GLUED and left alone — including a chip glued right after a closing quote or a period-ending chip (no whitespace boundary exists for the classifier to read).
- **Transform**: only the FIRST letter of the FIRST word of snippet tokens, via `toLocaleUpperCase`/`toLocaleLowerCase` with the rule set's locale. Own-text and line-break tokens are never touched; the source TextInputs are never consulted.
- **Guards**: frozen (`edited === true`) tokens skipped on every trigger; empty/non-letter-first tokens skipped; glued tokens skipped; all-caps first words (every cased char uppercase, at least one cased char — NASA, API, the single letters A/B) skipped with the carve-out that the exact first word "I" follows the general contextual rules ("I" → "i" mid-sentence, "i" → "I" at a sentence start); interior-uppercase first words (iPhone, eBay, McDonald's) skipped.
- **Length preservation**: the replacement must be a single character — a casing mapping that expands ("ß" → "SS", "İ" → "i̇") is skipped. Astral-plane first letters are skipped by the non-letter guard (the first UTF-16 code unit of a surrogate pair is not a letter). Token lengths — and therefore `PREVIEW_DOCUMENT_MAX_LENGTH`/`clampDocumentToLimit` — are unaffected.
- **Wiring** (Task 1.2): the pass runs in the exported `snippetsReducer` wrapper on every transition except `SYNC_DOCUMENT` — creation, both move actions, `SET_EDIT_ENABLED`, and no-op transitions — as a whole-document recompute, after the transition's source-text rewrite and the eager normalization. A no-op transition on a stale-cased state still corrects it; a no-op transition on a corrected state returns the reference-identical state.
- **Comparison policy** (Task 1.2, Q15): reconciliation's no-op guard compares pass-canonical forms (a case-only re-emission is "no change" — reference-identical state, no re-render, no focused-surface remount); `syncParsedDocument`'s edited-detection (`previous.text !== token.text`) stays EXACT (a case-only retyping freezes the chip — that is how manual overrides stick); the focused-surface self-recognition (`tokensEqualIgnoringEdited`, in the hook) stays EXACT and untouched.
- **Copy path** (Task 1.3): the clipboard payload is the serialization of the pass-corrected token array — always fully corrected, even while the visible document holds stale case (the SYNC skip's window); copying never mutates the context document (pure pass over a transformed copy); the memo re-derives on document or language change. Gating, toast, i18n strings, and button behavior unchanged.
- **No source-context guard** (Q12): the pass never consults the source's original casing — "Paris" cut from a mid-sentence source is lowercased mid-merge; the undo idea stays the deferred Feature 4 Task 3 placeholder.
- **Language keying** (Q14): the rule set is selected by the active UI language tag at every invocation — the reducer reads the i18n singleton's `language` per dispatch; the copy memo keys on `i18n.language`. The en-US and pt-BR rule contents are identical today.

---

## 3. Key implementation decisions (agent defaults, within spec latitude)

- **Export names** (context.md latitude): `applyCaseFix`, `classifyTokenContext`, `caseFixRuleSetFor`, `tokensEqualCanonicalCase`, `CaseFixRuleSet`, `TokenCaseContext`.
- **Rule-table shape**: keyed by the language tag's PRIMARY subtag (`en` from `en-US`, `pt` from `pt-BR`), each set carrying its full locale tag for the casing transforms. The i18n instance exposes both tag forms — `init` sets `en-US`/`pt-BR`, `changeLanguage` switches to `en`/`pt` — so primary-subtag resolution handles every form the app produces; an unknown or missing tag falls back to the default (en) set. The en-US/pt-BR rule CONTENT is identical (only the locale field differs).
- **Case-aware guard mechanism** (the spec's flagged latitude): run-pass-then-compare — `tokensEqualCanonicalCase` runs both sides through the pass (idempotent, so an already-canonical array returns itself) and then compares exactly. The pinned observable (the reference-identical state for case-only re-emissions) is tested directly, both at the reducer level and through the provider with a render-count pin.
- **The reducer's language read**: the reducer signature is fixed by `useReducer`, so the wrapper reads the active tag from the i18n singleton at each dispatch — "the active UI language at every pass invocation" without threading a language through every action. The copy hook reads `i18n.language` through `useTranslation`, which also makes the memo reactive to language changes.
- **The single-character length valve**: `fixed.length !== 1` skips the transform — the case-only contract (token lengths never change) is enforced in the pass rather than assumed of the locale data. This also means a few genuinely cased characters are left as-authored (the ß/İ rows); protecting the length invariant was the pinned contract.
- **Glued-before-strip ordering**: the glued check reads the DIRECTLY-abutting character; the closing-wrapper strip exists only inside the whitespace-boundary look-back. Consequence (unit-pinned): a chip glued directly after `"The end."` is left alone — there is no whitespace boundary, so the sentence-end classification never applies.
- **The iterative strip**: trailing whitespace and closing wrappers peel as ONE loop until neither matches. The spec's literal "strip whitespace, then closers" order cannot satisfy its own `"He said. "` example (quote after the space); the loop does, and the `Ready?)` row pins it.
- **Classification reads the input array** (pre-correction texts): the classification inspects only predecessor characters' identity (whitespace/wrapper/sentence-end membership), never their case, so classification is identical on corrected or original text — one left-to-right sweep, no fixpoint iteration.
- **Test placement**: the dialog-scoped copy/flip assertions live in `PreviewModal.test.tsx` — the suite that owns the dialog (the only place `within(getByRole('dialog'))` can run); the spec's copy-story independent test demands that scoping. All other new suites live in the spec-listed files.
- **Test infrastructure (no behavior change)**: the textContent-keyed rect mocks gained the re-cased keys (chips render lowercase mid-sentence / capitalized at document starts after moves) — `SEGMENT_RECTS` (`beta`/`gamma`), the words-doc layout override (`beta`), the page/modal per-test mocks (both casings of both chip texts), and the long-text needle test's rect lookup folds case. This continues the established rect-mock re-keying pattern; no production DOM/testid changed.

---

## 4. Testing strategy

**New suites (+38 tests):**

- **Pure pass units** (`previewDocument.test.ts`, 52 → 73; +21): the rule-table lookup (tag forms, fallback, content identity, identical outputs under both tags); the classification × transform table (every classification branch × both transform directions, the wrapper-strip rows, the look-back rows, the glued rows); the exported-classifier probes; every guard's positive/negative rows incl. the exact-"I" rows in both directions and the all-caps single-letter rows; reference stability (same-reference no-ops, untouched-token references + input purity, double-application idempotence + the length invariant); the case-canonical comparison.
- **Reducer/provider suites** (`SnippetsContext.test.tsx`, 45 → 54; +9): the trigger matrix — creation (after-`.` capitalization, mid-sentence lowercase), resize re-derivation, the SYNC stale window + the next-trigger correction through a no-op move, the same-value `SET_EDIT_ENABLED` no-op, both move actions re-fitting moved and predecessor-changed chips, the manual override surviving repeated sorts and re-emissions; the case-only re-emission reference-identity (plus a genuine difference transitioning); the exact edited-detection on a case-only retyping; the provider-level render-count pin (zero re-renders, same document reference).
- **Copy integration** (`CopyMergedTextButton.test.tsx`, 10 → 13; +3): the corrected payload while the visible document asserts stale; the no-mutation pin (array, object references, content); the language re-derivation.
- **Preview integration** (`PreviewArea.test.tsx`, 176 → 180; +4): creation-time both-direction corrections; the sort-flip round trip with WYSIWYG parity assertions on each step; the frozen chip surviving a pointer sort.
- **Modal integration** (`PreviewModal.test.tsx`, 33 → 34; +1): the dialog-scoped stale copy (both surfaces stale, the in-dialog copy corrected, nothing mutated).

**Deliberate oracle assertion updates (the Q10 behavior-level policy — every expectation re-derived from the classifier rules):**

| Suite | Updates | Reason |
| ----- | ------- | ------ |
| `SnippetsContext.reducer.test.ts` (31 → 31) | The 400-document randomized sweep's multiset guards (1-move and two-move) compare case-insensitively; the non-inert pin accepts "position changed OR case-only serialization change"; the trailing-gap seam expects `'\nA bee '` with the case-insensitive multiset | The pass may re-case a chip's first letter to fit its merged context — the multiset protection targets content relocation, not letter case; a reference change on an inert-position move can now be the pass correcting stale casing (by design), so the "real change" pin allows exactly position-or-case. The exhaustive single-letter oracle and the landing oracle pass byte-identically (all-caps-protected and frozen chips respectively) |
| `SnippetsContext.test.tsx` (45 → 54) | Join-parity/reorder expectations updated: `Hello Alpha world` → `Hello alpha world`; `Hello Alpha` → `Hello alpha` (×2 incl. the id-collision test); `["Hello","Alpha","world"]` → `["Hello","alpha","world"]`; the deletion test `world` → `World` (the surviving chip lands at the document start — capitalized); the MOVE suite orders/serializations (`Beta alpha gamma`, `Alpha gamma beta`, `Beta gamma alpha`, `Beta alpha`, `Beta alpha and more`); the provider reorder `Alpha Hello world` → `Alpha hello world` | The seeded mid-sentence chips now read lowercase-first; a chip landing at the document start reads capitalized. The `World` case is the pass working on the deletion path (the second chip becomes the document's first content) |
| `CopyMergedTextButton.test.tsx` (10 → 13) | The unedited-session copy payload `Hello Alpha` → `Hello alpha`; the test title now states the case-fixed-serialization contract | The clipboard writes the corrected serialization; the old "byte-identical to the old join" claim is superseded by the corrected-join reality |
| `PreviewModal.test.tsx` (33 → 34) | The shared-content/copy/keyboard-sort/limit expectations updated (`Alpha beta gamma` ×4, `Hello alpha`, `["Alpha","beta","gamma"]` ×3, `["Beta","alpha","gamma"]`, `Alpha text beta entered_by_user gamma` ×2, the 2000-char template + its length-math comments) | The seeded mid-sentence chips render re-cased; the length math is case-invariant so only the literals changed |
| `PreviewArea.test.tsx` (176 → 180) | The seeded-document expectations across the sorting/needle/editing/caret/limit suites (`Alpha Beta Gamma` → `Alpha beta gamma` ×14, the array orders, the gap/scaffold probes `Alpha … beta` variants, the seam `AlphaBeta` → `Alphabeta`, the redirect probes `textBeta` → `textbeta` etc., `Betax ` → `betax `, `chip.textContent === "Alpha"` lookups → `"alpha"`); `SEGMENT_RECTS` + the words-doc layout override + the long-text rect lookup gained the re-cased keys | Mid-sentence chips render lowercase-first; the textContent-keyed rect mocks must resolve the re-cased chips for the drag geometry to keep working (the established rect-mock re-keying pattern). The `mytext|`+chip seam test's `XBeta` stays capitalized — that chip sits glued after own text, so the glued rule protects it; only the genuinely mid-sentence chips changed |
| `MergeSessionPage.test.tsx` (12 → 12) | `beta gamma beta` → `Beta gamma beta` (×2), `beta beta gamma` → `Beta beta gamma` (×2), `beta gamma beta!` → `Beta gamma beta!`; the rect mock gained both casings | The seeded lowercase sources render with the document-start chip capitalized (and after the modal reorder, the moved chip mid-sentence) |

Every oracle protection remains asserted — against the corrected behavior: the multiset (case-insensitive), id uniqueness, old-join parity (on the corrected texts), WYSIWYG (`flow.textContent === serialize(document)`), reference semantics (inert ⇒ same reference), and the announcement/needle/a11y assertions are unchanged in kind.

**Totals: 515/515 across 19 files (was 477 across 19; +38).** Per-file: `previewDocument` 52→73, `SnippetsContext.test` 45→54, `CopyMergedTextButton` 10→13, `PreviewArea` 176→180, `PreviewModal` 33→34; unchanged counts with oracle updates only: `SnippetsContext.reducer.test` 31, `MergeSessionPage` 12.

---

## 5. Per-requirement outcomes

| ID | Outcome | Note |
| -- | ------ | ---- |
| CASE-01 | Verified | Creation pass: reducer triggers suite (after-`.` capitalization, mid-sentence lowercase) + the unit classification table |
| CASE-02 | Verified | Classifier definition: sentence start = doc start / line break / last-meaning char `. ! ? …` after the whitespace∪wrapper strip, look-back past separator/whitespace tokens (24-row unit table) |
| CASE-03 | Verified | Glued chips left alone (glued rows incl. glued-after-period and glued-after-closing-quote) |
| CASE-04 | Verified | Resize re-emission re-derives the rewritten token's casing (reducer test); the pass runs after the rewrite + eager normalization |
| CASE-05 | Verified | Only snippet first-letters transform; own text/line breaks byte-unchanged (units incl. input purity); sources never consulted |
| CASE-06 | Verified | Both move actions re-run the whole document (reducer suite + the PreviewArea flip round trip) |
| CASE-07 | Verified | Sentence-start chips capitalized; mid-sentence/glued follow their rules (units + integration) |
| CASE-08 | Verified | Frozen chips skipped on the sort path (reducer + PreviewArea frozen-survives tests) |
| CASE-09 | Verified | A no-context-change sort returns the reference-identical state (no-op move + SET_EDIT_ENABLED reference tests; the exhaustive oracle's inert rows) |
| CASE-10 | Verified | Copy (toolbar and modal rail) writes the corrected serialization (copy + modal suites) |
| CASE-11 | Verified | Copy runs the pass over a transformed copy; the context document is never mutated (the no-mutation pin: array + object references + content) |
| CASE-12 | Verified | Stale visible case → the clipboard still fully corrected (copy + modal stale tests; payload differs from the visible text only in pass-correctable case) |
| CASE-13 | Verified | `canCopy`, toast, strings, button behavior unchanged (existing gating suites pass) |
| CASE-14 | Verified | The copy follows the active language's rule set and re-derives on language change (identical content today — pinned) |
| CASE-15 | Verified | Frozen tokens skipped on every trigger for the token's lifetime (the manual-override-survives suite: repeated sorts + re-emissions) |
| CASE-16 | Verified | The exact edited-detection marks a case-only retyping edited (comparison-#2 exactness test) |
| CASE-17 | Verified | Text typed later into an edited chip is never auto-corrected (the frozen guard + the SYNC skip by construction; the freeze itself is pinned) |
| CASE-18 | Verified | The hand-fixed casing survives repeated sorts and source re-emissions (reducer + PreviewArea suites) |
| CASE-19 | Verified | The exact-"I" carve-out lives inside the all-caps guard (`firstWord !== 'I' && isAllCapsWord`); "I" → "i" mid-sentence, "i" → "I" at a sentence start (unit rows both directions) |
| CASE-20 | Verified | Mixed-case first words protected in every context (iPhone/eBay/McDonald's rows) |
| CASE-21 | Verified | Non-letter first characters untouched (123, "(Note" rows) |
| CASE-22 | Verified | Empty/whitespace-only tokens untouched |
| CASE-23 | Verified | Frozen (`edited === true`) tokens always skipped, both transform sides |
| CASE-24 | Verified | No source-context guard: "Paris" → "paris" mid-merge accepted (unit rows) |
| CASE-25 | Verified | No standalone "I" guard exists in either set; the rule contents are identical (rule-table tests) |
| CASE-26 | Verified | The rule set is selected by the active UI language at every invocation (the reducer reads the tag per dispatch; the copy memo keys on it) |
| CASE-27 | Verified | en-US/pt-BR rule content identical (rule-table test + identical outputs) |
| CASE-28 | Verified | Locale-aware `toLocaleUpperCase`/`toLocaleLowerCase` with the rule set's locale; unknown/missing tags fall back to the default set |
| CASE-29 | Verified | No new i18n strings (no resource file touched) |
| CASE-30 | Verified | Reconciliation's no-op guard case-aware: a case-only re-emission returns the reference-identical state, zero re-renders (reducer + provider render-count tests) |
| CASE-31 | Verified | The edited-detection comparison stays exact (code untouched; the case-only retyping freezes) |
| CASE-32 | Verified | `tokensEqualIgnoringEdited` untouched and still exact (code untouched; the focused-surface suites pass) |
| CASE-33 | Verified | A pass-induced model change while edit-ON+focused flows through the existing non-text-change re-freeze/remount path (mechanism unchanged; the focused-surface suites pass; the caret reset is the accepted trade-off) |
| CASE-34 | Verified | Central wiring on every transition except SYNC_DOCUMENT, no-ops included (the no-op-move and same-value-toggle corrections pinned) |
| CASE-35 | Verified | Nothing changes ⇒ the previous state object returns (reference tests across triggers) |
| CASE-36 | Verified | Idempotence: double application content-identical and reference-stable (units over representative documents) |
| CASE-37 | Verified | Pass ordering: after the transition's source-text rewrite and the eager normalization (the wrapper's sequence; the SYNC-stale-then-correct test observes the ordering) |

**37 total: 37 Verified, 0 Deviated, 0 Deferred.**

---

## 6. Deviations from spec.md

None. Every requirement implemented as written; the two spec-baked roadmap amendments and the mixed comparison policy land exactly as specified. The judgment calls are the spec's flagged agent-default latitudes (§3) — none change a pinned observable.

User decisions implemented verbatim (all dated 2026-10-22, from the spec/context grilling record):

- **Q1** — Task 1 (case) only; the spacing pass is Task 2.
- **Q2/Q3** — central wiring in the wrapper on every transition except the mid-typing sync; the classifier contract (`. ! ? …`, not `:`; the strip; the look-back; glued left alone; no abbreviation handling).
- **Q4** — transform scope: only the first letter of the first word of snippet tokens.
- **Q5a/Q16** — the guard list with the standalone-"I" guard dropped: "Ok, ignore this rule then. 'i' should only became 'I' if it is on beggning of a snippet, and the snippet needs this correction. Example: placed after a '.'" — the carve-out derived from it lives inside the all-caps guard; other single letters stay protected.
- **Q5b/Q12** — no source-context guard: "The correction will only apply if its the first letter of the first word of the snippet. On those cases, user will need to fix by hand later. We can actually think later of adding a third task to this feature, for user undo this auto corrections. But we will think about this later." — wrong corrections are hand-fixed; the undo idea stays the deferred Feature 4 Task 3 placeholder (already recorded in `roadmap.md` in the specs phase).
- **Q7/Q9/Q13** — the visibility consequences accepted; hand edits final; later typing into an edited chip also never corrected.
- **Q8/Q15** — the mixed comparison policy: reconcile no-op case-aware; edited-detection and focused-surface comparisons exact.
- **Q10** — the oracle policy: existing suites pass at behavior level with the listed, deliberate assertion updates (§4).
- **Q11** — ADR 0005 written by the Developer from the spec's draft; no GLOSSARY changes.
- **Q14** — the rule set keyed by the UI language; identical content for en-US/pt-BR today.

**Verification (2026-10-23, Git Bash, `artifacts/output-merger.UI`):**

- `npx vitest run` — **515/515 across 19 files** (was 477; +38 new).
- `npx tsc -b` — clean.
- `npm run lint` (oxlint) — clean.
- `npm run build` (`tsc -b && vite build`) — clean; the >500 kB chunk-size note is informational and pre-existing.

---

## 7. Known gaps / deferred

Manual dev-server items for the Tester (jsdom-invisible):

- **The visible flips' feel**: a drag across a sentence boundary visibly re-cases the moved chip and its displaced neighbor mid-animation — confirm the flip reads as intended (no flicker beyond the dnd-kit overlay itself) and that a sort while edit-ON + focused resets the caret as accepted (the non-text-change path).
- **The stale window**: with edit ON, type a lowercase word into a chip at a sentence start, then copy — the clipboard should carry the corrected case while the flow still shows the typed case, until the next trigger (a sort, another emission, the toggle) corrects the surface.
- **pt-BR rule set**: switch the UI language and repeat a creation/sort/copy — identical outputs today (content-identical sets); the language keying is plumbing for future divergence.

Deferred by spec (not gaps): the spacing pass (Feature 4 Task 2, own spec); undo/review UI for auto-corrections (Feature 4 Task 3 placeholder); abbreviation-aware sentence boundaries ("Dr." always capitalizes the next chip); per-input language picker / content-language detection; persistence of correction history (V1).

Notes for the Tester:

- The four hard contracts are each pinned by dedicated tests: reference stability (reducer + provider render-count), the SYNC skip (the stale-window tests + the wrapper's guard), the exact edited-detection (code untouched + the case-only-retyping freeze test), and the length valve (ß/İ unit rows + the idempotence length invariant).
- The oracle updates of §4 are the full list of existing-assertion changes; every changed literal is the classifier's derivation, not a copied received value (two of my own first-draft expectations were wrong the other way and were corrected BEFORE finalization — the `One.`-predecessor and displaced-chip re-classification cases, both now pinned the right way around).
- The `XBeta` seam expectation in PreviewArea was intentionally left capitalized (the glued rule protects that chip) — worth a second look that I read the glued rule right.
- The reducer's i18n import is the one new module-level dependency in the state layer; the pure utils stay i18n-free (the tag is a parameter).

---

## 8. Tester cycle (approval, 2026-10-23)

- **Verdict:** all green — the implementation code, the full suite (515/515 across 19 files), `tsc -b`, and oxlint; no bugs, no security findings, no code duplications. No code changes were required by the review.
- **Records findings, resolved at completion:** (1) the roadmap completion deliverable — the Feature 4 Task 1.1–1.4 checkoff and the Task 1.1/1.2 deviation annotations (the two dropped guards; the mixed comparison policy) — was applied by the orchestrator on 2026-10-23 post-approval, per the spec's Records requirement, and is recorded as the `roadmap.md` row in §1; (2) the missing §1 deliverables row for that annotation was added in this record update. The Feature 4 "Task 3: Undo auto-corrections" placeholder was confirmed already recorded (added in the specs phase); no GLOSSARY or i18n items existed.
- **Informational notes (accepted, no action):**
  - **Test hygiene for future rule-set divergence:** the reducer unit suites run under whatever `i18n.language` the file's module graph initialized with (the en-US-content default today); when the pt-BR rule content ever diverges, those suites must set and restore the language around the divergent cases.
  - **`PreviewArea.hook.tsx`'s own `mergedText` memo** (`serialize(document)`) bypasses the pass, but it feeds only the length gate — case-invariant, no output path reads it; left as-is.
  - **Minor coverage items accepted:** the composed case-only-re-emission-onto-stale-cased-state reducer row, an at-the-2000-limit idempotence representative, and the CASE-33 caret-reset feel (jsdom-invisible — the focused-surface non-text-change mechanism is unchanged and inherited; listed for manual dev-server verification in §7).
