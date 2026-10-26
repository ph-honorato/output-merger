# Review Fixes Implementation (external review `result.json` — 2 findings)

**Implemented:** 2026-10-23
**Spec:** external — `result.json` (repo root): external code review of the completed Case Auto-Fix implementation (roadmap Feature 4 Task 1), 2 findings, both `maintainability`/`low`. Fix-only task following the project's established review-fixes precedent (`.specs/features/preview-area-tools/tasks/review-fixes/`) — no new spec phase; the findings are the specification. The governing spec for every value decision is the locked Case Auto-Fix spec: `.specs/features/preview-area-auto-fix/tasks/case-auto-fix/spec.md` (especially user decision 2026-10-22 Q16 — the "I" guard dropped for BOTH languages — the "identical rule sets today" decision, and the Assumptions table), as implemented in `.specs/features/preview-area-auto-fix/tasks/case-auto-fix/implementation.md`.
**Code:** `artifacts/output-merger.UI/src/`
**Status:** Implemented — both findings applied with the reviewer's MECHANISM; one finding's example VALUES deliberately replaced with the spec-faithful ones (see §3). Zero behavior change for today's identical en/pt rule sets: 520 automated tests pass (515 before + 5 new; one existing copy test extended), `npx tsc -b`, `npm run lint` (oxlint), and `npm run build` all clean.

---

## 1. Deliverables

| File | Role |
| ---- | ---- |
| `src/utils/previewDocument.ts` | Fix 1: `CaseFixRuleSet` gains `allCapsExceptions: readonly string[]`; `buildCaseFixRuleSet` takes the exception list as its second parameter; both table entries pass `['I']`; `applyCaseFix`'s all-caps guard tests membership (`!ruleSet.allCapsExceptions.includes(firstWord) && isAllCapsWord(firstWord)`) instead of comparing against a hardcoded `'I'` — the engine constant became table data |
| `src/context/SnippetsContext/SnippetsContext.types.ts` | Fix 2: `SnippetsState` gains `caseFixLanguage: string` (the UI language tag the pass derives under); new `SetCaseFixLanguageAction` (`SET_CASE_FIX_LANGUAGE` + `language`) in the action union, following the `SetEditEnabledAction` shape; `SnippetsContextValue` gains `caseFixLanguage` so the copy path reads the store's field |
| `src/context/SnippetsContext/SnippetsContext.reducer.ts` | Fix 2: `initialSnippetsState` seeds `caseFixLanguage: i18n.language` (the one ambient read, at store creation); the reconcile no-op guard and the wrapper pass derive under the STATE's field (`state.caseFixLanguage` / `base.caseFixLanguage`) — no ambient read in any transition, so the reducer is a pure (state, action) function; new `SET_CASE_FIX_LANGUAGE` transition (same-language → the same state reference; different → `{ ...state, caseFixLanguage }`), which the wrapper's whole-document recompute then re-derives under the new language |
| `src/context/SnippetsContext/SnippetsContext.tsx` | Fix 2: the provider subscribes to i18n's `languageChanged` event and dispatches `SET_CASE_FIX_LANGUAGE` with the new tag (so a runtime switch flows through the reducer instead of leaving the model stale); the listener is removed on unmount; the context value exposes `caseFixLanguage` |
| `src/pages/MergeSession/components/CopyMergedTextButton/CopyMergedTextButton.hook.tsx` | Fix 2: the `mergedText` memo keys on the store's `caseFixLanguage` (from `useSnippets`) instead of the ambient `i18n.language` — display and clipboard now derive under one rule-set field |
| `src/utils/previewDocument.test.ts` | Extended 73 → 74 (+1): the rule-content identity test now also covers `allCapsExceptions`; new test pinning both language sets carry exactly `['I']` (the table owns the carve-out). The existing "I" carve-out rows now exercise the table path |
| `src/context/SnippetsContext/SnippetsContext.test.tsx` | Extended 54 → 58 (+4): new "the case-fix language rides in state" suite — a language dispatch updates the field and re-derives a stale-cased document through the pass; a same-language dispatch is reference-identical; a state seeded with a language different from the ambient one derives per the STATE's tag; provider-level — `i18n.changeLanguage` updates the store's field and re-derives the document. The `chipToken` helper moved to module scope (now shared by two suites). The initial-state oracle gained the new field |
| `src/pages/MergeSession/components/CopyMergedTextButton/CopyMergedTextButton.test.tsx` | Modified (13 → 13): the language re-derivation test extended — the harness `DocumentProbe` surfaces the store's language via a `data-case-fix-language` attribute (test-local DOM, no production change), and the test now pins the memo's key (the store field), the display-side re-derive, and the corrected payload across a switch |
| `docs/adr/0005-preview-auto-fix-pass.md` | Amended in place (the established inline style, as in ADR 0004's "(ADR 0001 amendment)" pattern): three mechanism sentences updated — the carve-out is the rule set's `allCapsExceptions` list (not an engine constant); the UI language rides in the store state with the provider's `languageChanged` dispatch re-deriving the document and copy payload; the consequences bullet records the pure-(state, action) reducer and the one-rule-set-for-display-and-clipboard property. The decisions (triggers, guards, policies) are untouched |

No new components, routes, i18n strings, DOM/testid changes in production code, or backend files touched.

---

## 2. Behavior (as implemented)

### Fix 1 — the "I" carve-out is rule-set data (finding: previewDocument.ts, start_line 647)

```ts
// previewDocument.ts — the rule table owns the all-caps exemptions
export interface CaseFixRuleSet {
  locale: string;                       // forwarded to the casing transforms
  allCapsExceptions: readonly string[]; // first words the all-caps guard does
                                        // NOT protect — each follows the general
                                        // contextual rules instead of staying
                                        // frozen in its all-caps form
  sentenceEndChars: readonly string[];  // ['.', '!', '?', '…']
  closingWrapperChars: readonly string[]; // [')', ']', '}', '"', "'", '”', '’', '»']
}

const buildCaseFixRuleSet = (
  locale: string,
  allCapsExceptions: readonly string[],
): CaseFixRuleSet => ({
  locale,
  allCapsExceptions,
  sentenceEndChars: ['.', '!', '?', '…'],
  closingWrapperChars: [')', ']', '}', '"', "'", '”', '’', '»'],
});

// Keyed by the language tag's primary subtag ("en" from "en-US",
// "pt" from "pt-BR" — the i18n instance exposes both forms).
const CASE_FIX_RULE_SETS: Record<string, CaseFixRuleSet> = {
  en: buildCaseFixRuleSet('en-US', ['I']),
  pt: buildCaseFixRuleSet('pt-BR', ['I']),
};
```

```ts
// previewDocument.ts — applyCaseFix's guard (the engine tests membership;
// no language-specific word lives in the engine any more)
const firstWord = firstWordOf(token.text);
if (!ruleSet.allCapsExceptions.includes(firstWord) && isAllCapsWord(firstWord)) {
  continue;
}
```

- Pure refactor: `['I']` membership replaces the `!== 'I'` comparison, so every existing carve-out behavior is byte-identical — mid-sentence "I" → "i", sentence-start "i" → "I", and every other all-caps word (NASA, API, the single initials A/B) stays protected in every context.
- The exception list is the builder's second parameter and each table entry passes its own value, so a future per-language divergence (e.g. pt-BR exempting "E"/"O"/"A") is a one-line TABLE edit (`CASE_FIX_RULE_SETS.pt`) instead of an engine edit — the table genuinely is "the per-language extension point" its docblock claims.

### Fix 2 — the active language rides in store state (finding: SnippetsContext.reducer.ts, start_line 578 + the guard at 136)

```ts
// SnippetsContext.types.ts — the state and the action
export interface SnippetsState {
  tokens: PreviewToken[];
  tombstones: string[];
  editEnabled: boolean;
  caseFixLanguage: string; // the UI language tag the pass derives under
}

export interface SetCaseFixLanguageAction {
  type: 'SET_CASE_FIX_LANGUAGE';
  language: string; // any i18n tag form — the rule table resolves the primary subtag
}
```

```ts
// SnippetsContext.reducer.ts — the one ambient read: the seed
export const initialSnippetsState: SnippetsState = {
  tokens: [],
  tombstones: [],
  editEnabled: false,
  caseFixLanguage: i18n.language,
};

// the reconcile no-op guard — the STATE's language, not the singleton
if (
  tokensEqualCanonicalCase(tokens, state.tokens, state.caseFixLanguage) &&
  sameStringSets(tombstones, state.tombstones)
) {
  return state;
}

// the transition — a no-op-safe, reference-stable update like SET_EDIT_ENABLED
case 'SET_CASE_FIX_LANGUAGE': {
  return action.language === state.caseFixLanguage
    ? state
    : { ...state, caseFixLanguage: action.language };
}

// the wrapper — every non-SYNC transition derives under the state's field
const tokens = applyCaseFix(base.tokens, base.caseFixLanguage);
```

```tsx
// SnippetsContext.tsx — the provider keeps the store current
useEffect(() => {
  const syncCaseFixLanguage = (language: string) => {
    dispatch({ type: 'SET_CASE_FIX_LANGUAGE', language });
  };
  i18n.on('languageChanged', syncCaseFixLanguage);
  return () => {
    i18n.off('languageChanged', syncCaseFixLanguage);
  };
}, []);
```

```ts
// CopyMergedTextButton.hook.tsx — the memo keys on the store's field
const { document: previewDocument, editEnabled, caseFixLanguage } = useSnippets();
const mergedText = useMemo(
  () => serialize(applyCaseFix(previewDocument, caseFixLanguage)),
  [previewDocument, caseFixLanguage],
);
```

- **The languageChanged flow, end to end (dispatch → re-derive):** Header → `useLanguage.changeLanguage` → `i18n.changeLanguage(tag)` → i18n emits `languageChanged` → the provider's listener dispatches `SET_CASE_FIX_LANGUAGE(tag)` → the transition updates `state.caseFixLanguage` (same tag: the same state reference, nothing downstream) → the wrapper — this is a non-SYNC transition, so the whole-document recompute runs `applyCaseFix(base.tokens, base.caseFixLanguage)` → the document re-cases under the new language; because the pass runs on this transition like every other, a stale-cased document (the mid-typing SYNC window) is corrected by the switch itself → the context value updates → consumers re-render; the copy memo, keyed on the same field, re-derives the payload. Display and clipboard can no longer derive under different rule sets.
- Reference semantics hold: a same-language dispatch over a corrected document returns the same state object; a real switch changes only the field today (the content-identical sets make the pass a no-op, so the tokens array keeps its reference — untouched states never churn).
- The reducer is now a pure (state, action) function — the only ambient `i18n.language` read in the state layer is the one-time seed at store creation (module evaluation), which the reviewer's direction explicitly allows. `useLanguage`/`Header` keep their own legitimate i18n usage (the picker itself). `PreviewModal`/`PreviewArea` had no ambient-language reads related to the pass (verified by scan) — nothing to align there.

---

## 3. Key implementation decisions (and the deliberate value deviation)

- **The reviewer's mechanism applied; the reviewer's example values rejected.** The review suggested `allCapsExceptions: ['I']` for en and `[]` for pt. The `[]`-for-pt example contradicts the locked user decision (2026-10-22, Q16): the standalone "I" guard was dropped for BOTH languages — "I" follows the general contextual rules regardless of UI language — and with it gone "the en-US and pt-BR rule sets are identical" is itself a user decision (Q14+Q16, the spec's Assumptions table). Both sets therefore carry `allCapsExceptions: ['I']`, making the fix a pure refactor with zero behavior change (all 515 pre-existing tests pass unmodified except the two listed oracle updates of §4). The spec-faithful values also preserve the spec's CASE-27 requirement (rule-content identity between the language sets).
- **The builder parameter, not a hardcoded builder value:** the exception list is `buildCaseFixRuleSet`'s second parameter with each table entry passing its own value — the per-language knob is visible at the table site, so a future divergence is a one-line edit of the `pt` entry (or a new entry), never an engine edit.
- **The action shape:** `SET_CASE_FIX_LANGUAGE` with a `language` field, mirroring the `SET_EDIT_ENABLED`/`SetEditEnabledAction` conventions — a same-value dispatch returns the same state reference (no-op-safe), and the wrapper treats it like every other non-SYNC action: the pass runs on it, which is what makes a runtime switch close the stale-case window on its own.
- **The seed stays at store creation (module evaluation of `initialSnippetsState`), not per-provider-mount:** the app mounts the provider once at the root and never unmounts it, so the module-load seed plus the `languageChanged` subscription cover every runtime path; a per-mount `useReducer` init function would add machinery for a window that cannot occur. (Tests restore the ambient language after switch tests, so per-file module seeds stay deterministic.)
- **The copy memo reads the field via the context value** (exposed as `caseFixLanguage`) rather than subscribing to i18n again — one source of truth for the derivation, and the `useTranslation` hook remains only for the component's strings.
- **Test-honesty note for (c):** the "derives per the state's language, not the ambient one" reducer test seeds a state whose `caseFixLanguage` differs from `i18n.language` and pins the output against `applyCaseFix(tokens, 'pt-BR')` — the pure pass under the state's own tag. Because today's en/pt rule CONTENT is identical, this pin cannot fail on output differences alone while the sets stay identical; it pins the field-flow contract (the assertion becomes discriminating the day the table diverges). The structural guarantee — no ambient read in any transition — is enforced by the code itself (the reducer imports i18n only for the seed).

---

## 4. Testing strategy

**New tests (+5):**

- **Rule table** (`previewDocument.test.ts`, 73 → 74): both language sets carry exactly `allCapsExceptions: ['I']` (both tag forms), and the en/pt content-identity test now covers the new field. The pre-existing "I" carve-out rows (both transform directions) now exercise the table membership path unchanged.
- **Language rides in state — reducer** (`SnippetsContext.test.tsx`, 54 → 58): a `SET_CASE_FIX_LANGUAGE` dispatch updates the field and re-derives a stale-cased document through the pass (the dispatch closes the stale window); the same language dispatched again over the corrected document is reference-identical; a same-language dispatch over the initial state is reference-identical; a state seeded with `caseFixLanguage: 'pt-BR'` (≠ ambient) derives per the state's tag (the plumbing pin of §3).
- **Language rides in state — provider** (`SnippetsContext.test.tsx`): `i18n.changeLanguage('pt')` → the store's field becomes 'pt' and the stale document re-cases ('hello and more' → 'Hello and more'); restored to 'en-US' (the ambient is set back for the rest of the file, matching the copy suite's hygiene pattern).
- **Copy memo keyed on the store's language** (`CopyMergedTextButton.test.tsx`, 13 → 13 — the existing language test extended): the harness `DocumentProbe` surfaces the store's `caseFixLanguage` (test-local `data-case-fix-language`, no production DOM change); the test asserts the field before/after the switch, the display-side re-derive, and the corrected payload after the switch — the memo's key is observed to be the store's field.

**Deliberate oracle updates (2, both forced by the state-shape addition — no behavior assertions changed):**

| Suite | Update | Reason |
| ----- | ------ | ------ |
| `SnippetsContext.test.tsx` — the initial-state test | `toEqual` gained `caseFixLanguage: i18n.language` | `SnippetsState` gained the field; the seed equals the ambient language at store creation (the test file imports the i18n instance per the @translation alias rule) |
| `SnippetsContext.test.tsx` — case-fix triggers suite | the `chipToken` helper moved from the suite's local scope to module scope | the new language suite needs the same factory; avoids duplicating it (module scope already hosts `ownText`/`lineBreak`) |

**Superseded caveat:** the previous Tester cycle's informational note — "reducer unit suites run under whatever `i18n.language` the module graph initialized with; when the pt-BR rule content ever diverges, those suites must set and restore the language around the divergent cases" — is superseded by this fix: transitions derive from the state's `caseFixLanguage` field, so future divergent-case tests set the STATE's field directly (as the §2 seeded-state test already does) with no ambient-language juggling.

**Totals: 520/520 across 19 files (was 515 across 19; +5).** Per-file: `previewDocument` 73→74, `SnippetsContext.test` 54→58; extended in place: `CopyMergedTextButton` 13; unchanged counts: `SnippetsContext.reducer.test` 31, `PreviewArea` 180, `PreviewModal` 34, `MergeSessionPage` 12.

---

## 5. Verification (2026-10-23, Git Bash, `artifacts/output-merger.UI`)

- `npx vitest run` — **520/520 across 19 files** (baseline re-confirmed at 515/515 before any edit; +5 new).
- `npx tsc -b` — clean.
- `npm run lint` (oxlint) — clean (no findings).
- `npm run build` (`tsc -b && vite build`) — clean; the >500 kB chunk-size note is informational and pre-existing.

---

## 6. Notes for the Tester

- **Zero-behavior-change claims to scrutinize:** (1) Fix 1 is a membership test replacing an equality test with the same singleton value — confirm no other all-caps word silently enters the exception lists (both sets are exactly `['I']`, pinned by the new rule-table test); (2) Fix 2 adds a state field and a transition — confirm no pre-existing assertion depended on the state's exact shape beyond the one listed oracle update, and that no production code path reads `i18n.language` inside a transition any more (a scan for `i18n.language` in `src` should now find only: the reducer's seed, and `useLanguage.ts`'s picker).
- **The languageChanged flow is the new wiring to re-derive by hand:** with the app running, switch the language in the Header while a stale-cased document exists (edit ON, mid-typing) — the preview should re-case on the switch without any other interaction, and copy before/after must produce the same corrected payload (identical outputs today — the flow is plumbing for future divergence).
- **The two same-language reference-identity tests** cover the transition's no-op safety over the empty initial state and over a corrected document; the wrapper's no-op-transition pass behavior means a same-language dispatch over a STALE document still corrects it — that is the established every-transition-except-SYNC contract, not a leak.
- **The `data-case-fix-language` probe attribute** is test-harness DOM (same category as the pre-existing `DocumentProbe`); no production component renders it.
- The ADR amendments are mechanism-only inline edits (three sentences); every decision, trigger, guard, and policy in ADR 0005 is untouched.

---

# Review Round 2 — Spacing Auto-Fix (internal review — 2026-10-25)

**Implemented:** 2026-10-25
**Spec:** internal — the internal review of the completed Spacing Auto-Fix implementation (roadmap Feature 4 Task 2), commissioned by the user after the external review of the spacing task timed out on `src/utils/previewDocument.ts` and returned 0 findings for the other two reviewed files. 7 findings, all `minor`/`low`, no blockers: 5 fixed (1, 2, 3, 4, 6), 2 deferred with documentation (5, 7). Fix-only task per this record's precedent — the findings are the specification; the governing spec for every value decision is the locked Spacing Auto-Fix spec (`.specs/features/preview-area-auto-fix/tasks/spacing-auto-fix/spec.md`), as implemented in its `implementation.md`. The findings' behavior/reachability analyses were reviewer-verified before handoff.
**Code:** `artifacts/output-merger.UI/src/`
**Status:** Implemented — both correctness findings resolved with zero behavior change for every current caller; both test gaps pinned; the false comment corrected; the dead code dropped. 569 automated tests pass (565 before + 4 new; every pre-existing test passed unmodified), `npx tsc -b`, `npm run lint` (oxlint), and `npm run build` all clean.

## 1. Findings and dispositions

| # | Finding (severity) | Disposition |
| - | ----------------- | ----------- |
| 1 | The minted `${rightChipTokenId}:separator` id is not "free": reconciliation mints the same pattern for appended chips and the move-carry path relocates a separator with its object and id intact, so a mint at a glued seam can duplicate a relocated one (reviewer probe: two tokens sharing `src2:bee:separator`). No consequence today — only snippet tokens render `data-token-id`, the parser re-mints own-text ids, and no comparison is id-keyed for own text. The `applySpacingInsertions` docblock claimed the id was free. (minor, correctness + comment) | **Fixed** — the comment corrected to the truthful mechanism; a unit row pins the duplicate shape so any future id-keying fails loudly. The id pattern itself is spec-locked and unchanged |
| 2 | `tokensEqualCanonicalCase` violated its documented contract on un-normalized input: adjacent own-text arrays that settle to identical serialization compared UNEQUAL (the survivor ladder lands the surviving space in different tokens; the pass never merges adjacent runs). Latent only — the wrapper normalizes before the pass — but a contract trap for future callers. (minor, correctness) | **Fixed** — the guard now normalizes both sides before the composed pass, making the contract unconditional; unit rows added for the previously-breaking shape and a genuinely-different pair |
| 3 | NBSP rows missing although the spec's edge-case list names "tabs, non-breaking spaces". The `/\s` predicate matches U+00A0 and the behavior is probe-verified correct (interior collapse, edge strip/carry, NBSP-only material drops) — but nothing pinned it. (minor, test) | **Fixed** — NBSP rows added: interior run collapse, a seam edge carrying the one space as U+0020, a zero-space-seam edge strip, and NBSP-only material dropping at the document edge |
| 4 | Chip trailing-`"\n"` edge stripping is production-reachable (chips keep trailing whitespace including `"\n"`; `trimRangeStart` trims only leading) and unpinned: a non-frozen chip's trailing newline strips at the doc end, before punctuation followers, and beside line-break tokens (the token itself surviving); a frozen chip keeps it. Follows the locked rules — but user-visible and unpinned. (minor, test) | **Fixed** — rows added pinning all four shapes, putting the spec-consistent behavior on record as a decision, not an accident |
| 5 | Naming/micro-duplication in the seam walk: `pending` vs `passed` one letter apart; the drop-all tail triplicated across the walk's exits; the `-1` no-survivor sentinel. (low, maintainability) | **Deferred** — documented in §3 |
| 6 | Dead `?? ['']` fallbacks after always-matching regexes (`/^\s*/` and `/\s*$/` always match, zero-width allowed) — unreachable and misleading. (low, maintainability) | **Fixed** — the three fallbacks dropped |
| 7 | `tokensEqualCanonicalCase` undersells its case+spacing scope (rename candidate `tokensEqualCanonical` — a cross-file change). (low, maintainability) | **Deferred** — documented in §3 |

## 2. What changed per fix

### Fix 1 — the minted id: truthful comment + the duplicate pinned

- `applySpacingInsertions`'s docblock now states the mechanism truthfully: the mint is deterministic, and the id is not unique by construction — reconciliation mints the same pattern for appended chips, a move relocates a separator token with its id intact, so a mint can duplicate a relocated one; inert, because nothing keys own-text tokens by id (the parse re-mints their ids). The false "free because the glue only exists after the original separator was deleted" claim is gone from the code.
- New unit row (the reviewer's probe shape): `applySpacingFix([frozen "End."][chip "src2:bee" "b"][sep "src2:bee:separator"][chip "x"])` → serialized `'End. b x'`, five tokens, with the minted token at index 1 and the relocated separator at index 3 both asserted (structure + text) to carry `tokenId: 'src2:bee:separator'` — the duplicate is the point: any future id-keying of own text fails loudly at this row instead of silently.
- Provenance note: the "free" claim traces to the spec's own SPACING-15 criterion wording (2026-10-23). The spec is a locked, dated record and stays untouched; the code comment is where the mechanism must be truthful, and now is. (The Task 2 implementation record never carried the claim — its §2 phrasing already said only "deterministic".)

### Fix 2 — the canonical comparison: unconditional contract

```ts
export function tokensEqualCanonicalCase(
  a: PreviewToken[],
  b: PreviewToken[],
  languageTag?: string,
): boolean {
  return tokensEqual(
    applyAutoFix(normalizeTextTokens(a), languageTag),
    applyAutoFix(normalizeTextTokens(b), languageTag),
  );
}
```

- Both sides are normalized (adjacent own-text runs merged) BEFORE the composed pass, making the docblock's "differ only in pass-correctable case or spacing compare equal" unconditional: the pass resolves seams per token shape, so differently shaped documents can settle to the same serialization with the surviving space carried by different tokens. The docblock now documents the normalization step at the definition site.
- Behavior-neutral for every current caller (the wrapper normalizes before the pass; `normalizeTextTokens` returns the same reference for already-normalized input, so normalized callers pay ~nothing — the reviewer verified the composition pure/idempotent/reference-stable/O(n)). Empirically confirmed: all 565 pre-existing tests passed unmodified after the change.
- New unit rows: `[own "a  "][own "b"]` vs `[own "a"][own " b"]` → equal (both directions — the previously-breaking pair), and `[own "a"][own "c"]` → still unequal.

### Fix 3 — NBSP rows (the `/\s` identity made visible)

- New `it` in the collapse-and-edges describe: `a\u00A0\u00A0b` → `a b` (interior NBSP run collapses to one U+0020); `[chip "A"][own "\u00A0b"]` → `A b` (an NBSP edge run carries the seam's one space as U+0020); `[own "a\u00A0"][chip ",x"]` → `a,x` (an NBSP edge strips at a zero-space seam); `[chip "A"][own "\u00A0"]` → the NBSP-only material token drops at the document edge (the chip survives); `[own "\u00A0\u00A0"]` → the empty document.

### Fix 4 — chip trailing-newline edge rows (a decision on record)

- New `it` in the line-breaks describe, pinning: `[chip "A\n"]` → `'A'` (the doc-end trim strips a non-frozen chip's trailing newline); `[chip "A\n"][own ",x"]` → `'A,x'` (the zero-space seam before a punctuation follower strips it); `[chip "A\n"][line-break]` → `'A\n'` with the line-break TOKEN count preserved (the chip's edge newline strips, the token does not); `[chip "A\n" frozen]` → `'A\n'` (a frozen chip's edge survives every trim). Pinning rationale: the strips follow the locked rules (edges-are-seams with the `/\s` identity; "line breaks preserved" governs line-break tokens, not newlines inside chip text) and are production-reachable and user-visible — the rows make the behavior a recorded decision rather than an accident of the `/\s` predicate.

### Fix 6 — dead fallbacks dropped

- The three `?? ['']` fallbacks in `decomposeSpacingSlice` are gone: `/^\s*/` and `/\s*$/` always match (zero-width allowed), so the extractions index the exec result directly (`/\s*$/.exec(text)![0]`), with a one-line comment above the pair stating why the index is safe. `tsc -b` and oxlint both accept the non-null assertions (no such precedent existed in the codebase — the reducer's equivalent always-match sites use dead-branch ternaries — but the finding asked for the dead code to go, and the assertion is the minimal honest form).

## 3. Deferred findings (documented, not applied)

- **Finding 5 — seam-walk naming/micro-duplication** (`pending` vs `passed` one letter apart; the triplicated drop-all tail; the `-1` no-survivor sentinel). Deferred per the reviewer's rationale: the seam walk is the pass's hardest-to-verify code — its determinism and idempotence are what the canonical comparison and the oracle sweeps depend on — and the zero-core transparency fix already touched it once; a cosmetic rename/refactor risks behavior drift for zero observable gain. If ever applied, it deserves its own round verified against the full reducer oracle sweep.
- **Finding 7 — `tokensEqualCanonicalCase` name undersells case+spacing** (rename candidate `tokensEqualCanonical`). Deferred: the rename is a cross-file change (utils export + the reducer import + the three suites importing it), and the updated docblock (this round's Fix 2 rewrite) states the case+spacing scope at the definition site; the reducer's call site comment already says "canonical through the composed auto-fix pass (case and spacing)".

## 4. Verification (2026-10-25, Git Bash, `artifacts/output-merger.UI`)

- `npx vitest run` — **569/569 across 19 files** (was 565; +4 new, all in `previewDocument.test.ts`: the duplicate-mint pin, the normalized-comparison rows, the NBSP rows, the chip-trailing-newline rows). Every one of the 565 pre-existing tests passed WITHOUT modification — the constraint's tripwire; a failure would have meant a fix was wrong.
- `npx tsc -b` — clean.
- `npm run lint` (oxlint) — clean.
- `npm run build` (`tsc -b && vite build`) — clean; the >500 kB chunk-size note is informational and pre-existing.

## 5. Notes for the Tester

- **Fix 2 is the one to re-derive by hand**: the guard now composes `normalizeTextTokens` → `applyAutoFix` on both sides. Confirm the no-op guard behavior is unchanged on normalized inputs (the spacing-only re-emission tests and the provider render-count pin all passed unmodified) and that the `normalizeTextTokens` reference-identity fast path keeps the already-normalized callers at ~zero cost.
- **Fix 1's new row deliberately asserts id DUPLICATION** — the row must not be "fixed" by uniquifying the mint; the id pattern is spec-locked and the duplicate's inertness (nothing id-keys own text) is the pinned fact.
- **Fix 4's rows put a user-visible behavior on record**: confirm you read edges-are-seams + the `/\s` identity the same way (chip-text newlines strip as edge whitespace; line-break tokens survive; frozen chips keep everything).
- **Fix 6's non-null assertions** are a new idiom for this codebase (the pre-existing always-match sites used dead-branch ternaries) — flag if you'd rather see the `replace`-slice idiom instead.
- Findings 5 and 7 are documented in §3; if you want them applied, give them their own round (the seam-walk rename especially deserves the full oracle sweep).
