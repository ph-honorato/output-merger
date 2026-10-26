# Spacing Auto-Fix Implementation

**Implemented:** 2026-10-24
**Spec:** `.specs/features/preview-area-auto-fix/tasks/spacing-auto-fix/spec.md`
**Context:** `.specs/features/preview-area-auto-fix/tasks/spacing-auto-fix/context.md`
**Code:** `artifacts/output-merger.UI/src/`
**Status:** Implemented — Feature 4, Task 2 (roadmap 2.1–2.3) complete; verified by 45 automated tests added under this task (565 total across 19 files; was 520), oxlint, `tsc -b`, `vite build`. No requirement deviated from the spec. The spec's amendments to the roadmap wording (the `?` addition to the before-set, the insertion policy beyond the removal-only reading, edges-as-seams, the composed case → spacing → case order) are implemented exactly as specified, all user decisions dated 2026-10-23. The existing oracle suites pass at the behavior level with the deliberate, listed assertion updates of §4 (the R1-Q13 policy) — every updated expectation derived from the pass's rules, never copied from received output. The judgment calls (export names, the in-place canonical-comparison extension, the two-stage removal/insertion structure, the survivor preference, the SPACING-02 example reading, the landing-suite string normalizer) are recorded in §3. ADR 0005 is amended in place per the spec's Draft Records Copy (dated 2026-10-23, inline pattern, Task 1 text untouched). The roadmap completion — the Feature 4 Task 2 + 2.1–2.3 checkoffs and the Task 2.1/2.2 annotations — was applied by the orchestrator post-approval, per the spec's Records requirement (SPACING-40; recorded as the `roadmap.md` row in §1). **Tester cycle (approved, 2026-10-24):** the first review found one minor in-scope issue — a zero-core chip (an emptied chip, reachable through the limit clamp) defeated the document-edge trims — fixed by making zero-core chips seam-transparent in the removal-stage walk (never dropped, never the surviving material) with 3 regression rows, all 562 pre-existing tests passing unmodified; the re-check returned **EVERYTHING OK** (the fix verified against every diagnosis point with the Tester's own harness; both flagged scoping choices accepted with independent reachability analyses; 565/565, `tsc -b`, oxlint, and the build green). See §8.

---

## 1. Deliverables

| File | Role |
| ---- | ---- |
| `src/utils/previewDocument.ts` | New spacing-fix section beside the case pass: `SPACING_PUNCTUATION_CHARS` (the shared module constant — the before-set AND the insertion trigger set: `.` `,` `!` `?` `;` `:` `…` `)`) and `SPACING_OPENING_PAREN` (the lone opposite — no space after `(`, never a trigger); `SpacingSlice` + `decomposeSpacingSlice` (per-token seam decomposition: atoms vs pure seam material — whitespace-only own-text tokens — vs seam-transparent zero-core chips; frozen chips keep their FULL text as the core with unstrippable edges; non-frozen chips expose their trailing-whitespace edge as strippable seam material; own text splits into strippable edge runs + a core); `resolveSpacingInterior` (own-text interior runs: dropped before a before-set char or after `(`, else collapsed to exactly one U+0020); `applySpacingFix` (the whole-document removal stage — seam targets ZERO before a before-set-initial atom / after a `(`-ending atom / beside a line break, exactly ONE otherwise, with the deterministic survivor preference; zero-core chips passed over like material so seams and document-edge trims resolve across them — never dropped, never the survivor; document-edge trims; emptied own-text tokens dropped; line-break tokens never added or removed; pure, reference-stable); the inner `applySpacingInsertions` (the insertion stage — one space at zero-whitespace seams after a trigger-ending token, own-text-side placement, non-frozen chip-edge append, else `${rightChipTokenId}:separator` minting; removal wins conflicts; never before a line break or at the document end; document-order evaluation against the document limit — over-budget insertions skipped, user content never clamped); `applyAutoFix(tokens, languageTag)` (the composed pass: case → spacing → case — one application reaches the settled document); and `tokensEqualCanonicalCase` extended in place (both sides now canonicalize through `applyAutoFix`). |
| `src/context/SnippetsContext/SnippetsContext.reducer.ts` | Modified: the exported `snippetsReducer` wrapper's central pass becomes the composed `applyAutoFix(base.tokens, base.caseFixLanguage)` — still on EVERY transition except `SYNC_DOCUMENT`, after the source-text rewrite and the eager `normalizeTextTokens`, whole-document recompute, idempotent, reference-stable (the no-change path returns the previous state object). `reconcileSourceSnippets`'s no-op guard call site is unchanged; the comparison behind it (`tokensEqualCanonicalCase`) now canonicalizes case AND spacing, so a spacing-only re-emission is the reference-identical no-op. The comment blocks updated to describe the composed mechanism. `syncParsedDocument`'s exact edited-detection (`previous.text !== token.text`) and the move logic UNTOUCHED. |
| `src/pages/MergeSession/components/CopyMergedTextButton/CopyMergedTextButton.hook.tsx` | Modified: the `mergedText` memo becomes `serialize(applyAutoFix(previewDocument, caseFixLanguage))` — the settled, composed-pass output, keyed on the document AND the store's language field; the pass runs over a transformed copy, so the context document is never mutated by copying; the one component serves the toolbar and the modal rail, so both copy buttons get the composed fix. Gating, toast, i18n strings, and button behavior unchanged. |
| `src/utils/previewDocument.test.ts` | Extended 74 → 103 (+29): removal-rule tables (all 8 before-set chars inside own text; every seam kind — own-text edge, separator token, non-frozen chip edge; the `(` rows; chip interiors + the frozen-edge-before-punctuation pin); line-break tables (both-sides literal trim, separator adjacency, token preservation through trims, frozen edge before a line break, multi-line chip interiors); collapse + document-edge tables (interior runs incl. tabs, multi-space seam material with the survivor preference, doc-edge trims over own text/separators/chip edges, frozen-edge survival at the doc end, emptied-token drops, whitespace-only documents → the empty document); zero-core-chip rows (the seam-transparent fix regressions: the trailing/leading emptied-chip trims, the all-whitespace zero-core edge strip, the line-break-adjacent resolution across an emptied chip, the composed-pass variants, idempotence + reference stability with the chip never dropped); frozen-chip boundary corrections (frozen text/edges byte-identical while the own side and separators around them correct); insertion tables (8 triggers × 3 seam kinds; own-text-side placement with frozen chips on either side; the minted `${rightChipTokenId}:separator` — id equality, no double-mint, re-mint determinism after a re-deletion; never before a line break / at the doc end; `(` never triggers; removal-wins conflicts; interior integrity — `3.14`/`example.com`/`e.g.`/single-run glue; the limit-skip — at-limit skip, one-below fire, two-seams-room-for-one document order, removals freeing room within one application); reference stability + idempotence (same-reference no-ops over clean/frozen/glued/empty docs, untouched token references + input purity, double-application content-identity incl. the minted-separator and at-limit representatives); composed-pass fixpoint rows (`[chip "Hello,"][chip "World"]` → `"Hello, world"` in ONE application, applied-to-own-output reference-stability, pre-spacing classifications preserved, newly-glued punctuation chips un-cased, the pinned glue shapes); and the `tokensEqualCanonicalCase` spacing rows. |
| `src/context/SnippetsContext/SnippetsContext.test.tsx` | Extended 58 → 68 (+10): new `spacing-fix triggers` suite — creation corrections (the chip-edge + separator collapse; the separator drop before a punctuation-initial chip); the SYNC stale-spacing window with the next-trigger settle through a no-op move (+ the reference-identity once corrected); stale spacing corrected through BOTH move actions (a real MOVE_TOKEN reorder carrying a separator, and a MOVE_TOKEN_TO_LANDING text-split drop whose boundary runs settle); the SET_CASE_FIX_LANGUAGE re-derivation (spacing stage language-independent); frozen-chip boundary corrections through a trigger (text + edges untouched); the pinned glue shapes byte-identical through a trigger (`Alphamytext`, `mytext XBeta`, `Hello,,more`). New `spacing-aware reconciliation` suite — the spacing-only source re-emission as the reference-identical no-op (+ a genuine difference still transitioning); the exact edited-detection freezing a spacing-only retyping (the frozen edge then surviving the doc-end trim); the provider-level render-count pin (the spacing-only re-emission: same document reference, zero re-renders). |
| `src/context/SnippetsContext/SnippetsContext.reducer.test.ts` | Modified (31 → 31): the listed oracle updates (§4) — the trailing-gap regression seam `'\nA bee '` → `'\nA bee'` with a whitespace-tolerant multiset; the 400-document randomized sweep's multiset guards (1-move + two-move) and the non-inert pin made case- and spacing-tolerant; the MOVE_TOKEN_TO_LANDING exhaustive oracle's expectations wrapped in the test-local `spacingSettled` string normalizer, the `multisetDelta` guard's `removed` allowing spaces, and the non-chip origin guard compared against the wrapper's own no-op-trigger output. The exhaustive MOVE_TOKEN oracle, the landing join-parity oracle, the delegation test, and the guards/inert pins pass byte-identically where their documents are clean. |
| `src/pages/MergeSession/components/CopyMergedTextButton/CopyMergedTextButton.test.tsx` | Extended 13 → 15 (+2): the stale-spacing copy (a mid-typing document with a punctuation-ending chip glued to word content plus doubled/trailing spaces — the clipboard receives the settled `Hello, world tail end` while the visible document asserts as stale-spaced before and after); the no-mutation pin over a spacing-correcting copy (the token array, object references, and content unchanged). |
| `src/pages/MergeSession/components/PreviewArea/PreviewArea.test.tsx` | Extended 180 → 183 (+3): new `spacing-fix pass — visible corrections (inline)` suite — the creation-time chip-edge + separator collapse with WYSIWYG parity (`Brave today`); the deliberately glued seam surviving a trigger (the commit + the toggle run the composed pass; `Alphamytext` stays byte-identical); the keyboard-sort settle (a stale mid-typing document corrected through a Ctrl+Space drop's whole-document recompute, with the needle walk and WYSIWYG parity asserted; the new suite installs its own landing-x/chip rect keys — no existing rect table needed re-keying). The three pinned glued-seam oracles (`mytext XBeta`, `Alphamytext`, `Alphatext Xbeta`) marked as deliberate spacing oracles inline. Existing oracle assertions updated (§4): the WYSIWYG double-space seam collapse + the word-boundary landing doc-start trims. |
| `src/pages/MergeSession/components/PreviewModal/PreviewModal.test.tsx` | Extended 34 → 35 (+1): the dialog-scoped stale-spacing copy — both surfaces render stale spacing, the rail copy inside `within(getByRole('dialog'))` writes the settled payload, and nothing mutates (both surfaces stay stale). |
| `docs/adr/0005-preview-auto-fix-pass.md` | Amended in place per the spec's Draft Records Copy (dated 2026-10-23): (a) the new spacing-stage mechanism paragraph inserted after the "…capitalized at sentence starts, lowercased mid-sentence." sentence (the truncated tail completed consistently with the spec's fixpoint framing); (b) the wiring sentence now reads "The composed auto-fix pass is wired centrally…" and the comparison-policy sentence's guard clause now reads "compares the composed pass's canonical forms (case and spacing — pass-correctable re-emissions produce reference-identical state)"; (c) seven new Considered Options bullets (the rejected never-insert / interior-insertion / insert-any-glue / spacing-first / no-final-case options, the deferred per-language table, and the chosen composed-pass line); (d) six new Consequences bullets. The title and every Task 1 decision text are untouched. |
| `roadmap.md` | Completed at task checkoff (2026-10-24, post-Tester-approval, applied by the orchestrator per the spec's Records requirement): Feature 4 Task 2 and subtasks 2.1–2.3 checked off, with the Task 2.1 annotation (the before-set gains `?` — a roadmap omission — plus `…` aligned with the case pass's sentence enders and `)` per the roadmap's own rule; the insertion extension beyond the removal-only wording; glue preservation; document-edge trims — user decisions 2026-10-23) and the Task 2.2 annotation (the case → spacing → case composition and its one-application fixpoint; frozen chips' text and edges untouched while the seams around them are corrected; the composed-pass canonical comparison), both pointing to ADR 0005 and this task's spec folder. |

Referenced and UNCHANGED (per the spec): `PreviewArea.hook.tsx` (the length-gate memo keeps measuring the model), `src/components/TextInput/*` (the facts source), `tokensEqualIgnoringEdited` (the focused-surface comparison stays exact), no i18n resource file, no GLOSSARY, no routes, no DOM/testid change in production code. `MergeSessionPage.test.tsx` (12 → 12) needed no oracle updates — its seeded documents are clean single-space documents, as the spec expected.

---

## 2. Behavior (as implemented)

```ts
// previewDocument.ts — the rule constants (module constants, no per-language table)
const SPACING_PUNCTUATION_CHARS: readonly string[] = [
  '.', ',', '!', '?', ';', ':', '…', ')',
];
const SPACING_OPENING_PAREN = '(';
```

One shared constant serves both the no-space-before rule and the insertion trigger set (the rule-constant shape was agent latitude; the content is pinned); `(` is the lone opposite.

```ts
// previewDocument.ts — the seam target + the survivor decision
const resolveSeam = (previous: number, next: number, pending: number[]) => {
  const leftSlice = slices[previous];
  const rightSlice = slices[next];
  const zero =
    leftSlice.isLineBreak ||
    rightSlice.isLineBreak ||
    (rightSlice.core.length > 0 &&
      SPACING_PUNCTUATION_CHARS.includes(rightSlice.core[0])) ||
    (leftSlice.core.length > 0 &&
      leftSlice.core[leftSlice.core.length - 1] === SPACING_OPENING_PAREN);
  const unstrippable =
    (leftSlice.core.length > 0 &&
      isWhitespaceChar(leftSlice.core[leftSlice.core.length - 1])) ||
    (rightSlice.core.length > 0 && isWhitespaceChar(rightSlice.core[0]));
  if (zero || unstrippable) {
    stripSeamMaterial(previous, next, pending, -1);
    return;
  }
  let survivor = -1;
  if (tokens[next].kind === 'text' && rightSlice.leftStrippable !== '') {
    leftRun[next] = ' ';                       // the follower own text's leading run
    survivor = next;
  } else if (tokens[previous].kind === 'text' && leftSlice.rightStrippable !== '') {
    rightRun[previous] = ' ';                  // the predecessor own text's trailing run
    survivor = previous;
  } else if (pending.length > 0) {
    leftRun[pending[0]] = ' ';                // the separator at a chip↔chip seam
    survivor = pending[0];
  } else if (leftSlice.rightStrippable !== '') {
    rightRun[previous] = ' ';                  // a non-frozen chip's trailing edge —
    survivor = previous;                      // only when it is the seam's only material
  }
  stripSeamMaterial(previous, next, pending, survivor);
};
```

- **Atoms, material, and transparency**: chips, line-break tokens, and own-text tokens with content are atoms; whitespace-only own-text tokens are pure seam material between them; a ZERO-CORE chip (empty, or nothing but its trailing edge) is seam-transparent — passed over like material so seams and the document-edge trims resolve across it, but never dropped and never the surviving material (a real chip with a real id; only its strippable edge goes with the surrounding seam). A non-frozen chip's trailing-whitespace edge decomposes into strippable seam material (chip interiors are never rewritten); a frozen chip keeps its FULL text as the core — its edges are unstrippable seam material that satisfies a seam by itself (every strippable neighbor goes, and the frozen edge survives the document-end and line-break trims: frozen wins).
- **Seam targets**: ZERO spaces before a before-set-initial atom, after a `(`-ending atom, or beside a line break (both sides, literally); exactly ONE space otherwise. The surviving material is picked by the deterministic preference above — the serialized observable ("exactly one space") is what the canonical comparison and the tests pin.
- **Document edges**: the first atom's strippable leading run and all material before it are trimmed; the last atom's strippable trailing run and all material after it are trimmed. A whitespace-only document drops to the empty document; a trailing line-break token survives (line-break tokens are never added or removed).
- **Emptied own-text tokens are dropped**; chips are never dropped; `edited === true` chips are byte-untouched, text and edges.

```ts
// previewDocument.ts — the insertion stage (fires only at zero-whitespace seams)
if (
  left.kind === 'line-break' || right.kind === 'line-break' ||
  left.text.length === 0 || right.text.length === 0 ||
  isWhitespaceChar(left.text[left.text.length - 1]) ||
  isWhitespaceChar(right.text[0]) ||
  !SPACING_PUNCTUATION_CHARS.includes(left.text[left.text.length - 1]) ||
  SPACING_PUNCTUATION_CHARS.includes(right.text[0]) ||   // removal wins conflicts
  length + 1 > PREVIEW_DOCUMENT_MAX_LENGTH               // document-order budget
) { index += 1; continue; }
...
if (right.kind === 'text') {        // chip → own text: prepend to the follower
  working[index + 1] = { ...right, text: ` ${right.text}` };
} else if (left.kind === 'text') {  // own text → chip: append to the predecessor
  working[index] = { ...left, text: `${left.text} ` };
} else if (!left.edited) {         // chip ↔ chip: the non-frozen preceding edge
  working[index] = { ...left, text: `${left.text} ` };
} else {                           // frozen preceding chip: mint the separator
  working.splice(index + 1, 0, makeSeparatorToken(`${right.tokenId}:separator`));
}
```

- Insertion fires at all three token-boundary seams, never inside token interiors (decimals, URLs, `"e.g."` are safe), never before a line break or at the document end, and never when the follower starts with a before-set character (the removal rule wins — `"Hello,,more"` stays zero-space). The space lives in the own-text side whenever one exists (a frozen chip on either side is no obstacle — chip leading edges are never touched); at chip↔chip seams it appends to the non-frozen preceding chip's edge, else a `${rightChipTokenId}:separator` token is minted (the reconciliation id pattern — deterministic, and re-mints reproduce the same id after a re-deletion; the inserted space makes the seam non-glued, so it never double-mints).
- Each insertion consumes one serialized character against `PREVIEW_DOCUMENT_MAX_LENGTH`; over-budget insertions are skipped, evaluated in document order — user content is never trimmed to make room. Removals and rewrites only shrink or preserve length, so only insertions are gated.
- **Pass structure**: the removal stage (interiors, seams, document edges, drops) completes first; the insertion stage then evaluates seams in document order against the post-removal serialized length (see §3 for the fixpoint rationale).

```ts
// previewDocument.ts — the composed pass and the extended canonical comparison
export function applyAutoFix(tokens, languageTag?) {
  return applyCaseFix(applySpacingFix(applyCaseFix(tokens, languageTag)), languageTag);
}

export function tokensEqualCanonicalCase(a, b, languageTag?) {
  return tokensEqual(applyAutoFix(a, languageTag), applyAutoFix(b, languageTag));
}
```

- The first case stage runs on the exact pre-spacing structure (every Task 1 classification preserved); the final case stage re-cases only the chips the insertions un-glued — spacing only adds and strips whitespace, so a predecessor's last meaningful character never changes and sentence-start/mid-sentence classifications are invariant; glued → skip never reverses an earlier correction. ONE application reaches the settled document: `[chip "Hello,"][chip "World"]` → `"Hello, world"` in a single dispatch (the insertion un-glues `World`; the final case stage lowercases it). Pure and reference-stable like its stages.

```ts
// SnippetsContext.reducer.ts — the wrapper's central pass (the call site, unchanged shape)
if (action.type === 'SYNC_DOCUMENT') {
  return next === state ? state : base;        // the mid-typing skip, untouched
}
const tokens = applyAutoFix(base.tokens, base.caseFixLanguage);
if (tokens === base.tokens) {
  return next === state ? state : base;        // nothing changed → same reference
}
return { ...base, tokens };
```

```ts
// SnippetsContext.reducer.ts — reconcileSourceSnippets' no-op guard (call site unchanged)
if (
  tokensEqualCanonicalCase(tokens, state.tokens, state.caseFixLanguage) &&
  sameStringSets(tombstones, state.tombstones)
) {
  return state;
}
```

- The guard now canonicalizes BOTH sides through the composed pass (case and spacing): a re-emission whose snippet texts differ from the stored tokens only in pass-correctable spacing — the source re-sends `"wordA "` while the stored chip was edge-stripped — is "no change": the reference-identical state, no re-render, no focused-surface remount. A genuine text difference still transitions. The minted-separator determinism makes the canonical forms agree structurally on re-emissions of glued seams.
- `syncParsedDocument`'s exact edited-detection (`previous.text !== token.text`) is untouched: a deliberate spacing retyping inside a chip freezes it (that is how manual spacing overrides stick); the focused-surface self-recognition comparison (`tokensEqualIgnoringEdited`) is untouched and stays exact.

```ts
// CopyMergedTextButton.hook.tsx — the copy path
const mergedText = useMemo(
  () => serialize(applyAutoFix(previewDocument, caseFixLanguage)),
  [previewDocument, caseFixLanguage],
);
```

- The clipboard always carries the settled serialization — even while the visible document holds stale spacing or case (the SYNC skip's window); copying never mutates the context document (pure pass over a transformed copy); the memo re-derives on document or language change; the one component serves the toolbar and the modal rail (ADR 0003), so both copy buttons get the composed fix.

---

## 3. Key implementation decisions (agent defaults, within spec latitude)

- **Export names** (context.md latitude): `applySpacingFix`, `applyAutoFix` — beside `applyCaseFix` in the pure-utils home. The spacing stage takes no language tag at all (the rules are language-independent module constants — the documented extension point).
- **The canonical-comparison mechanism** (the spec's flagged latitude: "Extend `tokensEqualCanonicalCase` vs. a sibling helper"): extended IN PLACE — `tokensEqualCanonicalCase` now runs both sides through `applyAutoFix`. One exported helper keeps serving the reducer's guard (a sibling would have left the case-canonical export dead in production code); the reducer call site is textually unchanged, and the helper's unit rows (case-only + the new spacing-only equality, genuine-difference detection) pin the new semantics. The pinned observable — a spacing-only re-emission returns the reference-identical state — is tested directly at the reducer level and through the provider with a render-count pin.
- **The two-stage pass structure** (the "Composed-pass internal structure" latitude, at the spacing stage): the removal stage completes before the insertion stage evaluates. Rationale: the one-application fixpoint. The length budget for every insertion is the post-removal serialized length — a removal anywhere in the document can afford an insertion evaluated earlier in document order. A strictly sequential interleave (removal and insertion applied in one document-order sweep) would let a later removal afford an earlier skipped insertion only on the SECOND application — breaking idempotence and the one-application contract. Pinned by the "removals free room within one application" unit row and the idempotence rows (a skipped seam re-evaluates, not re-fires, at the next trigger).
- **The survivor preference** (the spec's recommended order, adopted): the following own text's leading run first, else the preceding own text's trailing run, else the first whitespace-only own-text token (the separator at chip↔chip seams), else a non-frozen chip's trailing edge — "only when it is the seam's only material". The serialized observable ("exactly one space") is what the canonical comparison depends on; the surviving-token choice was Developer latitude.
- **Chip leading edges are never strippable** (R2-Q3's placement principle, applied to removal too): a hand-built chip with leading whitespace keeps it. Production chips never have any (TextInput's `trimRangeStart` trims leading whitespace at creation), so the case is unit-test-only robustness.
- **The SPACING-02 example reading**: the AC's formal EARS rule — "WHEN whitespace exists at a seam immediately after an atom whose last character is `(` THEN the pass SHALL reduce the seam to zero spaces" — is implemented and tested with well-formed inputs: `[own 'foo( '][own 'bar)']` → `'foo(bar)'`, and the second example verbatim (`chip "foo("` + separator + chip → the separator is removed). The first example, read literally (`own "foo ("` + `own "bar)"` → `"foo(bar)"`), has NO seam whitespace after the `(` (its space sits before the `(`), and `(` is not in the pinned before-set — the literal reading would require removing spaces before `(`, contradicting the pinned set. The formal rule governs; flagged for the Tester's review.
- **`spacingSettled`** (the reducer suite's landing-oracle wrapper): a test-local, string-level reference of the spacing rules — whitespace adjacent to a line break trimmed on both sides (line breaks themselves never removed), leading/trailing document whitespace trimmed, every remaining run of two or more collapsed to one space. The landing documents carry no punctuation, so the zero-space rules and the insertion stage never fire on them and the normalizer needs no cases for those. The same spirit as the suite's existing `expectedLanding` string-level reference: an oracle independent of the reducer's token mechanics.
- **The multiset guards' whitespace tolerance** strips NON-NEWLINE whitespace only (`/[^\S\n]/`), case-insensitively: the pass may add or remove spaces and tabs but never line-break tokens — a dropped `\n` still fails every guard. This keeps the tolerance exactly as wide as the pass's own edits.
- **The exhaustive-oracle non-chip origin guard**: an inert landing on an UNSETTLED seeded document no longer returns the raw seed (no-op transitions run the wrapper's pass — Task 1's carried wiring), so the guard now compares the result against the wrapper's own no-op-trigger output (a bounds-guarded move) — pinning "the move contributed nothing" while acknowledging the settle.
- **The ADR draft tail**: the spec's (a) paragraph was truncated at "…so one application of the composed pas…"; completed as "…reaches the settled document — in the reducer wrapper and on the copy path alike," consistently with the spec's fixpoint framing (the Task 1 precedent for truncated Draft Records Copy tails).

---

## 4. Testing strategy

**New suites (+45 tests; 520 → 565 across 19 files):**

- **Pure pass units** (`previewDocument.test.ts`, 74 → 103; +29): the removal tables (each before-set character × the interior; every seam kind — own-text edge, separator token, non-frozen chip edge; the `(` rows in both directions; chip interiors + the frozen edge before a punctuation-initial follower); the line-break tables (both-sides trim, separator adjacency, token counts preserved, frozen-edge survival, multi-line chip interiors untouched); the collapse + document-edge tables (interior runs ≥ 2 incl. tabs → one U+0020; multi-space seam material with each survivor branch; doc-edge trims over own text, leading material, trailing chip edge + token, trailing line break preserved; frozen-edge survival at the doc end; emptied tokens dropped; whitespace-only documents → `[]`); the zero-core-chip regressions (the seam-transparency fix: `[own "a "][chip ""]` → `'a'` with the chip surviving, the doc-start mirror, the all-whitespace zero-core edge strip, the line-break-adjacent resolution across an emptied chip, the `applyAutoFix` variants, idempotence + reference stability with the chip's object reference preserved); the frozen boundary corrections; the insertion tables (8 triggers × 3 seam kinds = 24 rows; the split placement with frozen chips on both sides; minting — id equality, no double-mint, re-mint determinism; never before a line break / at the doc end; `(` never a trigger; removal-wins conflicts; interior integrity + the single-run escape hatch; the limit-skip — at-limit skip, one-below fire, two-seams-room-for-one in document order, removals freeing room within one application); reference stability + idempotence (same-reference no-ops, untouched references + input purity, double-application content-identity over representative documents incl. the minted and at-limit shapes); the composed-pass fixpoint rows; the `tokensEqualCanonicalCase` spacing rows.
- **Reducer/provider suites** (`SnippetsContext.test.tsx`, 58 → 68; +10): the trigger matrix — creation (both correction kinds), the SYNC stale window + the no-op-move settle + reference-identity, both move actions over stale-spacing documents, `SET_CASE_FIX_LANGUAGE` re-derivation, frozen boundary corrections, the glue-shape pins; the reconciliation suite — the spacing-only re-emission (reference-identical, then a genuine difference transitions), the exact edited-detection freeze (the frozen edge surviving the doc-end trim), the provider render-count pin.
- **Copy integration** (`CopyMergedTextButton.test.tsx`, 13 → 15; +2): the stale-spacing copy; the no-mutation pin over a spacing-correcting copy.
- **Modal integration** (`PreviewModal.test.tsx`, 34 → 35; +1): the dialog-scoped stale-spacing copy (both surfaces stale, the in-dialog copy settled, nothing mutated).
- **Preview integration** (`PreviewArea.test.tsx`, 180 → 183; +3): the creation flip with WYSIWYG parity; the glue-through-trigger pin; the keyboard-sort settle (the drop's whole-document recompute correcting a stale mid-typing document, with the needle walk and parity asserted).

**Deliberate oracle assertion updates (the R1-Q13 behavior-level policy — every expectation re-derived from the pass's rules):**

| Suite | Updates | Reason |
| ----- | ------- | ------ |
| `SnippetsContext.reducer.test.ts` (31 → 31) | The trailing-gap regression seam expects `'\nA bee '` → `'\nA bee'`, and its multiset guard strips non-newline whitespace (case-insensitively) before comparing | The move replants the carried separator correctly; the document now ends with a whitespace-only own-text token, and the document-end trim drops it (R1-Q8) — derived: the last atom is the moved chip, the trailing pending material goes. The guard tolerates exactly the pass's whitespace/case edits while content and `\n` counts stay pinned |
| `SnippetsContext.reducer.test.ts` | The 400-document randomized sweep's multiset guards (1-move and every-7th two-move) compare case-insensitively over everything except line breaks (non-newline whitespace stripped); the non-inert pin accepts "the chip's position changed OR the serialization differs only in case or whitespace" | The pass corrects stale spacing anywhere in the seeded documents (interior collapses like the `'  '` own text, chip-edge strips like `'C '`, doc-edge and line-break trims) and may insert spaces at glued punctuation seams; insertions add only spaces, so the stripped comparison still pins content exactly |
| `SnippetsContext.reducer.test.ts` | The MOVE_TOKEN_TO_LANDING exhaustive oracle compares `serialize(next.tokens)` against `spacingSettled(expectedLanding(...))`; the `multisetDelta` guard's `removed` now requires only-spaces (was exactly `[]`); the non-chip origin guard compares against a bounds-guarded no-op move's result | The wrapper runs the whole-document recompute after every landing — inert landings on the seeded documents settle too ('multi-space runs' collapses, 'padded multi-word'/'three chips with words'/'text edges' results start at the document edge and trim). The move still plants at most two spaces (the `added` pins unchanged); the pass may remove misplaced ones, never content. The landing suite's specific "keeps >=1 space" and verbatim-zero-delta rows are clean single-space documents and pass unchanged |
| `SnippetsContext.reducer.test.ts` | "the plain-move carry is deterministic": `' helloBA'` → `'helloBA'` (×2 assertions) | The merged own text starts the document after the move and its leading run trims at the document edge (R1-Q8); no seam ends in a trigger character, so the glue stays and nothing is inserted — derived, not copied |
| `SnippetsContext.reducer.test.ts` | "source deletion…" retitled ("…pops no separator from a merged text token (the trailing space settles at the document-edge trim)") and expects `'x '` → `'x'` (serialization + token text) | The delete path still never mistakes the merged own text for a reconciliation separator (the pinned divergence); the trailing space the user saw now trims at the document end (R1-Q8) — both merge histories settle to the same one-token result |
| `PreviewArea.test.tsx` (180 → 183) | The WYSIWYG invariant literal `'Hello brave  world today'` → `'Hello brave world today'`; the comment updated | The 'brave ' chip's trailing edge plus the separator held two spaces of seam material; the seam collapses to exactly one (SPACING-07) with the separator as the surviving material — the parity assertions themselves unchanged in kind |
| `PreviewArea.test.tsx` | The word-boundary landing drags: `' text alpha entered_by_user beta'` → `'text alpha entered_by_user beta'` (×2 assertions in two tests), `' text entered_by_user alpha beta'` → `'text entered_by_user alpha beta'`, `' text entered_by_user betaAlpha'` → `'text entered_by_user betaAlpha'` | After each drag the own text starts the document and its leading run trims at the document edge (R1-Q8); the interior seams are single-spaced and survive — derived from the trim rule |

**Rect-mock re-keying**: only the NEW keyboard-sort test installs its own landing-x table and an `'alpha'` chip key (the post-drop casing). No existing rect table needed re-keying — every updated assertion changed only whitespace, and the chips' rendered casing/text resolves in the existing tables.

Every oracle protection remains asserted — against the corrected behavior: the multiset (case- and spacing-tolerant, `\n`-guarded), id uniqueness, join parity on clean documents, WYSIWYG (`flow.textContent === serialize(document)`), reference semantics (inert ⇒ same reference), the glue-preservation pins (`Alphamytext`, `mytext XBeta`, `Xbeta`/`Alphatext Xbeta` — marked deliberate inline and pinned through a trigger), and the announcement/needle/a11y assertions unchanged in kind.

---

## 5. Per-requirement outcomes

| ID | Outcome | Note |
| -- | ------ | ---- |
| SPACING-01 | Verified | Before-set removal wherever the space lives: the 8-char interior table + the seam-kind units (own-text edge, separator token, non-frozen chip edge) + the reducer/PreviewArea integration |
| SPACING-02 | Verified | After `(`: the seam/interior rows incl. the chip-ending-`(` separator drop (the AC example's first row reads as prose-rule-only — see §3) |
| SPACING-03 | Verified | Literal both-sides trim beside line breaks; line-break tokens never added or removed (counts pinned through the trims) |
| SPACING-04 | Verified | Chip-boundary firing: separators before punctuation-initial chips drop; chip edges strip; own edges before chips strip |
| SPACING-05 | Verified | The amended set (`?` + `…` + `)`; `(` the lone opposite); chip interiors never rewritten (unit-pinned byte-identical) |
| SPACING-06 | Verified | Interior runs ≥ 2 → exactly one U+0020 (tabs included; single spaces stay) |
| SPACING-07 | Verified | Multi-space seam material → exactly one, deterministic survivor preference (each branch unit-pinned) |
| SPACING-08 | Verified | Document-edge trims (own text, leading material, trailing chip edge + token); the `'\nA bee'` reducer oracle; the trims resolve across zero-core chips (§8 fix) |
| SPACING-09 | Verified | Emptied own-text tokens dropped; tombstones unaffected (state-level; the tombstone suites pass untouched) |
| SPACING-10 | Verified | A trailing line-break token survives the document-end trim (`'word\n'`) |
| SPACING-11 | Verified | Trigger + guard conditions: zero-whitespace seam, word-content follower, not a line break, not the document end |
| SPACING-12 | Verified | All three seam kinds (chip→own, own→chip, chip↔chip) × all 8 trigger characters (24-row table) |
| SPACING-13 | Verified | Never inside interiors (`3.14`/`example.com`/`e.g.`/single-run `"Hello,world"`); non-punctuation glue stays (`Alphamytext`) |
| SPACING-14 | Verified | Removal wins conflicts: `"Hello,,more"` stays zero-space (unit + reducer + the glue-shape pins) |
| SPACING-15 | Verified | Split placement (own-text side both directions; non-frozen chip edge) + `${rightChipTokenId}:separator` minting (id equality, no double-mint, re-mint determinism) |
| SPACING-16 | Verified | Limit-skip in document order; never clamps user content; removals free room within one application; skipped seams re-evaluate at the next trigger (idempotence rows) |
| SPACING-17 | Verified | Frozen chips' text AND edges never rewritten (byte-identical object pins; `edited` preserved) |
| SPACING-18 | Verified | Boundary corrections around frozen chips: own-side material strips (`Stop !`), separators drop before punctuation-initial frozen chips, redundant separators drop when the frozen edge provides the one space |
| SPACING-19 | Verified | Frozen-preceding chip↔chip insertion mints the `${rightChipTokenId}:separator` token |
| SPACING-20 | Verified | Frozen-edge survival at the document end and before line breaks (frozen wins over the trims) |
| SPACING-21 | Verified | Non-trigger glue stays glued in every context (units + the reducer glue-shape pins + the PreviewArea deliberate oracles) |
| SPACING-22 | Verified | Interior integrity + the single-own-text-run escape hatch (`"Hello,world"` typed as one run survives every trigger) |
| SPACING-23 | Verified | Newly-glued punctuation-initial chips stay un-cased (`The end...`); the pinned seams byte-identical through triggers |
| SPACING-24 | Verified | Central wiring on every transition except SYNC_DOCUMENT, no-ops included (the trigger matrix: creation, both moves, the toggle, the language dispatch, the no-op move) |
| SPACING-25 | Verified | First case stage on the pre-spacing structure; the final case stage settles insertion-un-glued chips (`Hello, world` in ONE application); applied-to-own-output reference-stable |
| SPACING-26 | Verified | Reference stability + idempotence: same-reference no-ops, untouched token references, input purity, double-application content-identity (incl. the minted and at-limit representatives) |
| SPACING-27 | Verified | Language-independent module constants; `SET_CASE_FIX_LANGUAGE` re-runs the composed pass (spacing stage an idempotent no-op) |
| SPACING-28 | Verified | Canonical output shape: no adjacent own-text runs on normalized input (inserted/prepended material joins existing own text or is flanked by chips/minted separators), no empty own-text tokens, line-break tokens untouched |
| SPACING-29 | Verified | SYNC_DOCUMENT keeps the mid-typing skip entirely (the stale-window tests; the wrapper's guard) |
| SPACING-30 | Verified | Copy (toolbar + modal rail) writes the settled composed-pass serialization (copy + modal suites) |
| SPACING-31 | Verified | Copy runs over a transformed copy; the context document never mutated (both no-mutation pins: array, object references, content) |
| SPACING-32 | Verified | Stale visible spacing → settled clipboard (inline + dialog-scoped; payload and visible text differ only in pass-correctable spacing/case) |
| SPACING-33 | Verified | `canCopy`, toast, i18n strings, button behavior unchanged (existing gating suites pass); the memo re-derives on document or language change |
| SPACING-34 | Verified | The guard canonicalizes through the composed pass: a spacing-only re-emission is the reference-identical no-op, zero re-renders (reducer + provider render-count tests) |
| SPACING-35 | Verified | Edited-detection stays exact: a spacing-only retyping inside a chip freezes it (and the frozen edge then survives the trims) |
| SPACING-36 | Verified | `tokensEqualIgnoringEdited` untouched and still exact (code untouched; the focused-surface suites pass) |
| SPACING-37 | Verified | Visibility consequences accepted: corrections flip at triggers; a pass-induced model change while edit-ON+focused flows through the existing non-text-change re-freeze/remount path (exercised by the keyboard-sort settle test; the caret reset is the accepted ADR 0004 trade-off) |
| SPACING-38 | Verified | ADR 0005 amended in place, dated 2026-10-23, per the established inline pattern — the Draft Records Copy applied (mechanism paragraph, sentence updates, options, consequences); the title and Task 1 decision text untouched |
| SPACING-39 | Verified | No i18n resource file touched, no GLOSSARY change, no routes, no DOM/testid change in production code (records scan) |
| SPACING-40 | Verified | The roadmap Feature 4 Task 2 + 2.1–2.3 checkoff and the Task 2.1/2.2 annotations applied by the orchestrator on 2026-10-24, post-Tester-approval, per the spec's Records requirement (recorded as the `roadmap.md` row in §1) |

**40 total: 40 Verified, 0 Deviated, 0 Deferred.**

---

## 6. Deviations from spec.md

None. Every requirement is implemented as written; the spec's amendments to the roadmap wording (the `?` addition, the insertion policy, edges-as-seams, the composed order) land exactly as specified. The judgment calls are the spec's flagged agent-default latitudes (§3) — none changes a pinned observable. Two interpretation notes, documented for the record:

- **The SPACING-02 example's first row** (`own "foo ("` + `own "bar)"` → `"foo(bar)"`): read literally the input carries no seam whitespace after the `(` (its space sits before it), and `(` is not in the pinned before-set, so the literal expected output contradicts the pinned set. The AC's formal EARS rule governs and is implemented/tested with well-formed inputs; the second example is applied verbatim (§3).
- **The ADR draft's truncated tail** was completed consistently with the spec's fixpoint framing (the Task 1 precedent for Draft Records Copy truncations).

User decisions implemented verbatim (all dated 2026-10-23, from the spec/context grilling record):

- **R1-Q1** — Task 2 (spacing, 2.1–2.3) only; undo and per-language divergence stay deferred placeholders.
- **R1-Q2** — "Edges are seams": the pass mutates document structure — rewrites own-text token text, removes separator tokens, drops emptied own-text tokens, treats a non-frozen chip's trailing-whitespace edge as seam material; chip interiors never rewritten; tombstones snippet-id-only (none needed).
- **R1-Q3** — frozen = the chip's own text only, edges included; all spacing around frozen chips still corrected; the accepted frozen-wins consequences pinned.
- **R1-Q4 + R2-Q4** — the composed pass case → spacing → case, in the wrapper AND the copy memo; one application reaches the settled document.
- **R1-Q5** — "Insert after punctuation" (the user's divergence from the recommended never-insert option).
- **R1-Q6 + R2-Q2** — the 8-character set `.` `,` `!` `?` `;` `:` `…` `)`; `(` the lone opposite; removal wins seam conflicts; abbreviation-blindness accepted.
- **R1-Q7** — literal trim of ALL whitespace adjacent to line breaks, both sides; line-break tokens never added or removed.
- **R1-Q8** — trim both document edges; the `'\nA bee '` seam reads `'\nA bee'`.
- **R1-Q9** — the extended comparison policy: the reconcile guard canonicalizes through the composed pass; edited-detection and the focused-surface comparison stay exact; the visibility consequences accepted.
- **R1-Q11** — module constants, no per-language table; `SET_CASE_FIX_LANGUAGE` re-runs the composed pass.
- **R1-Q12** — ADR 0005 amended in place per the spec's Draft Records Copy; no new i18n strings; no GLOSSARY changes.
- **R1-Q13** — the oracle policy: existing suites pass at the behavior level with the listed, deliberate assertion updates (§4); the new suites per the spec's test plan.
- **R2-Q1** — insertion at all token-boundary seams; "the pass fixes seams between materials; glue inside one material is the user's"; interiors never touched by insertion; the single-run escape hatch.
- **R2-Q3** — the split placement policy: own-text side whenever one exists; the non-frozen preceding chip's edge at chip↔chip; else the minted `${rightChipTokenId}:separator`.
- **R2-Q4 (limit half)** — over-budget insertions skipped in document order; user content never clamped; the length-gate memo in `PreviewArea.hook` keeps measuring the model (unchanged).
- **Task 1's Q2 carried** — central wiring on every transition except SYNC_DOCUMENT, after the source-rewrite and eager normalization, no-op transitions included; idempotent; reference-stable.

**Verification (2026-10-24, Git Bash, `artifacts/output-merger.UI`; re-run after the §8 fix round):**

- `npx vitest run` — **565/565 across 19 files** (was 520; +45 new — 42 at first delivery, +3 fix-round regressions). Per-file: `previewDocument` 74→103, `SnippetsContext.test` 58→68, `CopyMergedTextButton` 13→15, `PreviewModal` 34→35, `PreviewArea` 180→183; unchanged counts: `SnippetsContext.reducer.test` 31, `MergeSessionPage` 12 (clean single-space seeds — no updates needed, as the spec expected).
- `npx tsc -b` — clean.
- `npm run lint` (oxlint) — clean.
- `npm run build` (`tsc -b && vite build`) — clean; the >500 kB chunk-size note is informational and pre-existing.

---

## 7. Known gaps / deferred

Manual dev-server items for the Tester (jsdom-invisible):

- **The visible flips' feel**: a sort or toggle visibly collapses doubled seams, strips chip edges, and inserts spaces at glued punctuation — confirm the flips read as intended (no flicker beyond the dnd-kit overlay) and that a correction while edit-ON+focused resets the caret as accepted (ADR 0004's non-text-change path).
- **The frozen-edge survival**: hand-edit a chip to end with a space, then sort — the frozen edge should survive the document end and line breaks while the seams around it still correct.
- **The stale window**: with edit ON, type messy spacing (spaces before punctuation, doubled runs, a glued `"Hello,world"` seam), then copy — the clipboard should carry the settled text while the flow still shows the typed form, until the next trigger (a sort, another emission, the toggle) corrects the surface.
- **pt-BR**: switch the UI language and repeat a creation/sort/copy — identical outputs today (the spacing rules are language-independent constants; the case stage's en/pt rule contents are identical).

Deferred by spec (not gaps): undo/review UI for auto-corrections (Feature 4 Task 3 placeholder); bracket/quote-pair spacing rules; per-language spacing tables; abbreviation-aware exemptions ("Dr." fires the insertion, mirroring the case pass); persistence of correction history (V1); the roadmap checkoff + the Task 2.1 `?` annotation (the orchestrator, at completion).

Notes for the Tester:

- The hard contracts are each pinned by dedicated tests: the one-application fixpoint (the composed unit row + the reducer/provider trigger rows), reference stability + idempotence + the deterministic mint (the same-reference no-ops, the double-application rows, the re-mint row), the SYNC skip + the exact edited-detection (code untouched + the freeze test + the stale-window tests), and the limit-skip (the at-limit/one-below/two-seams/removals-free-room rows + the never-clamp semantics).
- **Scrutinize the two-stage limit budget** (§3): removals free room BEFORE insertions evaluate — this is what keeps one application at the fixpoint; the alternative (a sequential interleave) would leave documents one insertion short until a second trigger. The unit row "removals free room within one application" pins it; worth a second look that you agree the fixpoint reading is the right one.
- **Scrutinize the SPACING-02 example reading** (§3 + §6): the formal rule is implemented; the example's first row, read literally, contradicts the pinned before-set.
- `spacingSettled` in the reducer suite is a deliberate test-local, string-level reference of the spacing rules (the same independence discipline as `expectedLanding`), not a duplicate of the production pass.
- The multiset tolerance strips non-newline whitespace only — line-break counts remain guarded everywhere.
- The PreviewArea keyboard-sort test installs its own rect keys; no production DOM/testid changed anywhere, and `PreviewArea.hook.tsx`'s length-gate memo is untouched (the pass never clamps; the gate keeps measuring the model).
- The reducer test file's exhaustive MOVE_TOKEN oracle, the landing join-parity oracle, and the delegation/guards/inert pins pass without value changes wherever their documents are clean — only the seven listed update groups (§4) changed.

---

## 8. Tester cycle (fix round and approval, 2026-10-24)

- **Finding (minor, in scope): a zero-core chip defeated the document-edge trims.** Reproduce: `applySpacingFix([own "a "][chip ""])` → `"a "` (expected `"a"` per the locked "trim both edges" decision, SPACING-08's spirit); same through `applyAutoFix` (the copy/wrapper path). Root cause: `decomposeSpacingSlice` made every chip an atom regardless of text — a zero-core chip let the seam `[own "a "][chip ""]` resolve to one space carried by the own text's trailing run, and positioned the doc-end trim on the chip's empty `rightStrippable`, so the trailing space survived; same at the document start for a leading zero-core chip. Reachability: `clampDocumentToLimit` can fully empty a trailing chip (the model self-heals on the next SYNC — the parse prunes emptied chips), so the shape was real but transient. The case was spec-unconsidered; the fix follows the already-locked trim decision — no new user decision needed.
- **Fix**: zero-core chips (a chip whose core is empty — an emptied chip, or a non-frozen chip that is nothing but its trailing edge) are now seam-TRANSPARENT in the removal-stage seam walk: `decomposeSpacingSlice` marks them (`isTransparent`), and the walk passes over them like material — so seams and the document-edge trims resolve across them — while a dedicated `stripPassed` step carries their strippable edge with the surrounding seam's material (like any pending whitespace). The transparency constraints hold structurally: a transparent chip is never pushed into the `pending` bucket (so it is never dropped and never the survivor — the surviving space always lives elsewhere), its object is kept (an emptied chip's final text equals its original, so it keeps its reference), and frozen zero-core chips behave identically (a frozen chip's core is its full text, so only an EMPTY frozen chip is transparent — transparency rewrites nothing). No other slice classification changed: all non-zero-core behavior is byte-identical, which the untouched 562-test suite confirms.
- **Regression rows** (`previewDocument.test.ts`, a dedicated `applySpacingFix — zero-core chips (seam-transparent)` describe, +3): the flagged shape `[own "a "][chip ""]` → `'a'` with the chip surviving (kind/id/text pinned); the doc-start mirror; the all-whitespace zero-core chip's edge stripping to `''` (the chip kept); the line-break-adjacent trim resolving across an emptied chip (`'A\n'`); the `applyAutoFix` variants (the flagged shape + a trailing chip edge trimming through a following zero-core chip); idempotence + reference stability (the second application is the same reference; the emptied chip keeps its object reference through the fix).
- **Verification after the fix**: `npx vitest run` — **565/565 across 19 files** (all 562 pre-existing tests passed WITHOUT modification — no existing test had pinned the buggy behavior); `npx tsc -b`, `npm run lint` (oxlint), `npm run build` — all clean.
- **Re-check (2026-10-24): EVERYTHING OK — approved.** The fix was verified against every diagnosis point using the Tester's own harness; no existing test was modified; 565/565, `tsc -b`, and oxlint green. Both scoping choices flagged in the fix report were ACCEPTED, each with an independent reachability analysis: (1) the insertion stage keeps its pairwise empty-token skip — a glued punctuation seam across an emptied chip is production-unreachable (the clamp's emptied-chip window is closed by the very next SYNC, whose parse prunes the chip so the insertion fires at the following trigger); (2) the no-survivor one-space seam over an all-whitespace zero-core chip is production-impossible (snippets are maximal non-whitespace runs), and its zero-space settle is consistent with the glue-preservation semantics.
- **Out of scope, logged and deferred (pre-existing baseline code, per the Tester's separate observation + precision note)**: the `clampDocumentToLimit` doc comment says "the peel continues with the token before it" past an exhausted chip while the loop actually `break`s on a zero-cut — and the demonstrated deviation is more than a comment/loop mismatch: the docblock's own invariant `serialize(result).length <= limit` fails when an emptied chip cannot absorb the overflow (probe: clamping a 5-character own text + a 3-character chip to limit 4 returns a 5-character result — the peel stops at the exhausted chip instead of continuing into the preceding own text). Whoever picks the backlog item must fix the peel to continue past the exhausted chip, not just the comment. The helper is untouched by this task (its "a chip is never removed" behavior is pinned by its own suite); left as-is per the task constraints and flagged for the orchestrator's backlog.





