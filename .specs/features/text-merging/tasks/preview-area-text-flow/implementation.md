# Preview Area Text Flow Implementation

**Implemented:** 2026-10-12
**Spec:** `.specs/features/text-merging/tasks/preview-area-text-flow/spec.md`
**Context:** `.specs/features/text-merging/tasks/preview-area-text-flow/context.md`
**Code:** `artifacts/output-merger.UI/src/pages/MergeSession/components/PreviewArea/`
**Status:** Implemented — both fixes (long-word breaking + chips → continuous text) complete; verified by 107 automated tests (2 new), oxlint, `tsc -b`, `vite build`; actual word-breaking and the continuous-highlight look pending the manual dev-server pass the spec prescribes (jsdom limitation)

---

## 1. Deliverables

| File | Role |
| ---- | ---- |
| `src/pages/MergeSession/components/PreviewArea/PreviewArea.styles.ts` | Modified: `SegmentFlow` is a plain block text container — explicit `display: block`, added `overflow-wrap: break-word`, dropped `flex-wrap`/`align-content`/`gap` (and `display: flex`), kept `white-space: pre-wrap` + `text-align: left` (PVADJ-10..12). `Segment` is a plain inline highlight — `padding: 2px 6px` + `border-radius: 4px` removed, `box-decoration-break: clone; -webkit-box-decoration-break: clone;` added (mirroring TextInput's `Highlight`), `color: text.primary` + `white-space: pre-wrap` kept; the 0.3-alpha tint stays as the inline style in the tsx |
| `src/pages/MergeSession/components/PreviewArea/PreviewArea.tsx` | Modified: `Fragment` import added; the snippet map renders exactly one space text node between adjacent segments (`{index > 0 ? ' ' : null}` inside a keyed `Fragment`) so the flow's rendered text equals `buildMergedText(snippets)` (WYSIWYG with the copy tool). `data-testid="preview-snippet"`, the inline `withAlpha(snippet.color, 0.3)` background, and all other testids/JSX unchanged; `buildMergedText` itself NOT touched |
| `src/pages/MergeSession/components/PreviewArea/PreviewArea.test.tsx` | Modified: +2 tests — (a) flow base styles: `display: block` + `overflow-wrap: break-word` on `preview-segment-flow` plus the inherited `overflow-wrap` on a `preview-snippet` segment; (b) WYSIWYG: flow `textContent` === `buildMergedText(...)` for snippets dispatched across two sources (imported from the CopyMergedTextButton hook), including a trailing-space snippet that locks the by-design double space. All 9 existing tests untouched |

No changes to `PreviewArea.hook.tsx`, `PreviewArea.types.ts`, `CopyMergedTextButton`, `SnippetsContext`, `TextInput`, i18n resources, routes, or backend files; `spec.md` untouched.

---

## 2. Behavior (as implemented)

- **Long words break inside the card (story 1)**: the segment flow stopped being a flex container — each snippet is no longer an independently sized flex item that a single long word could push past the card's right edge. It is now a plain block text flow with `overflow-wrap: break-word`, an inherited property, so a word wider than the card's content box breaks at the edge and continues on the next line, inside any segment:

  ```ts
  // PreviewArea.styles.ts
  export const SegmentFlow = styled.div`
    display: block;            // was: display: flex
    overflow-wrap: break-word;  // new — the word-breaking safety net
    white-space: pre-wrap;      // unchanged
    text-align: left;           // unchanged (PVADJ-10..12)
  `;
  // dropped: flex-wrap: wrap; align-content: flex-start; gap: spacing(1)
  ```

- **Snippets render as continuous text with source-color highlights (story 2)**: segments are plain inline highlight spans in one continuous flow — no chip padding, no radius, no inter-chip gaps — mirroring TextInput's committed-highlight look exactly (same `box-decoration-break: clone` pair, same 0.3-alpha tint, same radius-less/padding-less shape), so a snippet looks the same in the input and in the preview, and a segment wrapped across lines paints its tint on every fragment:

  ```ts
  // PreviewArea.styles.ts
  export const Segment = styled.span`
    box-decoration-break: clone;         // new — mirrors TextInput's Highlight
    -webkit-box-decoration-break: clone;  // new
    color: ${({ theme }) => (theme as StyledTheme).palette.text.primary};
    white-space: pre-wrap;
  `;
  // dropped: padding: 2px 6px; border-radius: 4px
  // background stays the inline style in the tsx: withAlpha(snippet.color, 0.3)
  ```

- **WYSIWYG with the clipboard**: exactly one space text node is rendered between adjacent snippets — none before the first or after the last — so the flow's rendered text equals `buildMergedText(snippets)`, the exact string the copy tool writes:

  ```tsx
  // PreviewArea.tsx
  {snippets.map((snippet, index) => (
    <Fragment key={snippet.id}>
      {index > 0 ? ' ' : null}
      <S.Segment
        data-testid="preview-snippet"
        style={{ backgroundColor: withAlpha(snippet.color, 0.3) }}
      >
        {snippet.text}
      </S.Segment>
    </Fragment>
  ))}
  ```

  The flow's `white-space: pre-wrap` renders the space node as a real space; snippet-internal whitespace (including newlines) remains the snippet's own content, copied verbatim. A snippet ending with a space yields a double space — by-design, identical to today's clipboard output.

- **Everything else unchanged**: `PreviewAreaRoot` and `EmptyState` styles have zero diffs; the empty state (centered icon + hint, PVADJ-06..09), the toolbar placement (PVADJ-01..05), the page chrome, and the empty ⇄ populated transition behave exactly as after preview-area-adjusts.

---

## 3. Key implementation decisions (agent defaults, within spec latitude)

- **Separator mechanics**: a keyed `Fragment` per snippet with `{index > 0 ? ' ' : null}` as its first child — the key moved from `S.Segment` to the `Fragment` (React requires the key on the outermost mapped element). A string expression child renders as a real text node, so the flow's `textContent` is `'Hello' + ' ' + 'brave ' + …` = the single-space join `buildMergedText` produces; no separator exists before the first or after the last snippet, and separators sit *between* segments, so each segment's own `textContent` (what the merge-order test asserts) is unaffected.
- **Explicit `display: block`** (not merely omitting `flex`): the spec's own flag — the prescribed base-style assertion must target an emitted rule, not the UA default. `div` would compute `display: block` either way; declaring it makes `toHaveStyle({ display: 'block' })` a meaningful assertion on authored CSS.
- **Defensive `min-width: 0` — deliberately NOT added** (spec latitude, documented per the brief): the flow is a *cross-axis* flex item of the column-direction `PreviewAreaRoot`; per the flexbox spec the automatic minimum size applies only along the main axis (height here), so `min-width: auto` already computes to 0 and the extra rule would be a no-op today. Block layout plus the inherited `overflow-wrap` fully own the breaking. Keeping the rule set minimal.
- **`break-word`, not `anywhere`**: breaking is the last resort — `anywhere` additionally affects intrinsic min-content sizing and can cause premature breaks; the spec prescribes `break-word`, and with the flex context gone the intrinsic-sizing traps that blocked shrinking are gone too.
- **Segment mirrors TextInput's `Highlight` exactly**: the `box-decoration-break` pair comes first (same declaration order as `TextInput.styles.ts`), then the kept `color`/`white-space`; the tint stays in the tsx as the inline `withAlpha(snippet.color, 0.3)` — the same value TextInput renders for committed highlights. No color-assignment change was needed: origin-input color is already carried per snippet.
- **Cross-suite helper import**: the WYSIWYG test imports `buildMergedText` from `../CopyMergedTextButton/CopyMergedTextButton.hook` — the same helper-import precedent this suite already uses (`withAlpha` from `PreviewArea.hook`) and the CopyMergedTextButton suite uses for the same function. `buildMergedText` itself is untouched.
- **WYSIWYG expected-array construction**: dispatches follow the existing merge-order test's creation-order pattern; per `SnippetsContext.reducer.ts`, reconciliation preserves existing ids' orders within a source and assigns incrementing global `order` to new snippets, so dispatching a1 → b1 → a2 → b2 (interleaved across two sources) yields orders 1–4 and the expected array is `[a1(1), b1(2), a2(3), b2(4)]`. One snippet (`'brave '`) ends with a trailing space so the by-design double-space edge case is locked inside the equality.

---

## 4. Testing strategy

- **PreviewArea suite (+2 tests, 9 untouched)**:
  - New: `lays out the segment flow as a block text container that breaks long words` — `toHaveStyle({ display: 'block' })` and `toHaveStyle({ overflowWrap: 'break-word' })` on `preview-segment-flow`, plus the inherited `overflow-wrap: break-word` on the first `preview-snippet` segment (computed-style inheritance; jsdom 30 resolves it — verified before writing the assertion, see below).
  - New: `renders the flow text exactly as buildMergedText produces it` — snippets dispatched across two sources in creation order; the flow's `textContent` is asserted equal to `buildMergedText` of the expected merge-ordered list; the `'brave '` snippet makes the by-design double space part of the equality.
  - Untouched and green: merge-order test (each segment's own `textContent` is unaffected by the separator nodes), tint test (inline `backgroundColor: rgba(0, 128, 255, 0.3)` unchanged), left-align test (`text-align: left` still on the flow), both empty-state tests + the i18n resource test, the language-switch test, the empty ⇄ populated transition test, the root-presence test, and the `withAlpha` unit test.
- **Stale-assertion sweep**: grepped the UI `src` for the old chip styling (`flexDirection`, `flex-wrap`/`flexWrap`, `gap`, `padding`, `borderRadius` in test files) — the only hit is PreviewToolbar's own `flexDirection: 'row'` (the toolbar's mobile-first base, unrelated to the flow, still valid); `MergeSessionPage.test.tsx` holds only a trivial `preview-area` presence assertion. No unrelated coverage deleted; no other suite needed changes.
- **jsdom limitations (source-verified before relying on them)**: jsdom has no layout engine — actual word-breaking, the chip-look removal, and multi-line tint fragments are not unit-verifiable and are deliberately the spec's prescribed manual dev-server pass. What jsdom *can* resolve was verified first: jsdom 30 replaced cssstyle with a real cascade engine, and its generated property data lists `overflow-wrap` as `inherited: yes` with syntax `normal | break-word | anywhere` — so both the declared flow assertion and the inherited segment assertion are genuine computed-style checks, not tautologies.
- **Verification commands and results** (Git Bash, working dir `artifacts/output-merger.UI`):
  - `npx vitest run` → **10 test files, 107/107 passed** (105 before this task; +2 new)
  - `npm run lint` (oxlint) → **clean, no findings**
  - `npx tsc -b` → **clean**
  - `npm run build` (`tsc -b && vite build`) → **clean** (1.49s; only the pre-existing >500 kB chunk-size advisory)
- No dev server was started; the word-breaking and highlight-look behaviors are deferred to the tester per the spec's Independent Tests.

---

## 5. Per-requirement outcomes

"Verified" = jsdom-evaluable behavior asserted by the automated suite. "Implemented" = code-complete and statically verified (diff / build), pending the manual dev-server pass the spec prescribes for layout/visual behavior.

| ID | Outcome | Note |
| -- | ------ | ---- |
| PVTF-01 | Verified | `overflow-wrap: break-word` asserted on `preview-segment-flow` (`toHaveStyle`, declared-rule form — PVADJ-10 precedent); the actual break at the card edge is the manual pass |
| PVTF-02 | Verified | Inherited `overflow-wrap: break-word` asserted on a `preview-snippet` segment via computed-style inheritance (jsdom 30 resolves inherited properties — source-verified); `min-width: 0` latitude not exercised (see decisions); the actual in-segment break is the manual pass |
| PVTF-03 | Implemented | No-horizontal-overflow is layout behavior (no jsdom layout engine); code-complete: block flow + inherited `break-word` break words at the content edge; `PreviewAreaRoot`'s `overflow: auto` untouched |
| PVTF-04 | Implemented | `break-word` (not `anywhere`) asserted via PVTF-01's check; merge order + left-alignment unit-green (existing tests); "ordinary text wraps exactly as before" is visual — manual pass |
| PVTF-05 | Verified | `display: block` and `text-align: left` asserted on the flow; `flex-wrap`/`align-content`/`gap` dropped and `white-space: pre-wrap` kept (diff-verified; absence assertions deliberately not prescribed by the spec) |
| PVTF-06 | Verified | Merge-order test untouched and green — one segment per snippet in merge order, each segment's own `textContent` = its snippet text (separators sit between segments); box-styling removal diff-verified |
| PVTF-07 | Implemented | 0.3-alpha tint still unit-verified (untouched tint test); padding/radius removal + `box-decoration-break: clone` pair diff-verified mirroring TextInput's `Highlight`; multi-line fragment tint painting is visual — manual pass |
| PVTF-08 | Verified | New WYSIWYG test: flow `textContent` === `buildMergedText` for snippets across two sources, including a trailing-space snippet (by-design double space); `buildMergedText` diff-verified untouched |
| PVTF-09 | Verified | All four testids preserved (no renames) — existing queries all resolve; empty ⇄ populated transition test untouched and green |
| PVTF-10 | Verified | `PreviewAreaRoot`/`EmptyState` styles zero-diff; empty-state tests untouched and green; PreviewToolbar + MergeSessionPage suites green with zero modifications; page chrome untouched |

Totals: 7 Verified, 3 Implemented, 0 Deviated, 0 Deferred — all 10 requirements accounted for.

---

## 6. Deviations from spec.md

None. All spec'd mechanics, contracts, and testing prescriptions were followed (supersession of PREVA's chip presentation; PVADJ-10..12 left-alignment preserved; testids and empty ⇄ populated transition preserved; `buildMergedText` untouched). Three latitude notes, not deviations: (a) the defensive `min-width: 0` was **not** added — the spec explicitly makes it "developer latitude, not a requirement", and it would be a no-op in the current layout (cross-axis flex item; rationale in section 3); (b) the WYSIWYG test includes a trailing-space snippet so the by-design double-space edge case is locked inside the prescribed equality — within the test's construction freedom; (c) the base-style test additionally asserts the inherited `overflow-wrap` on the first segment — one assertion beyond the prescribed pair, but it is the jsdom-resolvable half of story 1's AC 2 (inheritance into segments) and was source-verified against jsdom 30's cascade engine before use.

---

## 7. Known gaps / deferred

- **Manual long-word verification for the tester** (dev server): a long unbroken word or a long URL pasted into a source and snippeted (single snippet and multi-snippet) breaks at the card's right edge and wraps onto the next line; `preview-area` shows no horizontal scrolling. jsdom cannot verify layout — the spec's prescribed manual pass.
- **Visual continuous-text verification** (same manual pass): snippets read as one continuous paragraph with per-snippet source-color tints — the same highlight look as in the inputs; no chip padding/radius/gaps; multi-line snippets paint the tint on every line fragment (`box-decoration-break: clone`).
- **User's post-implementation review rows flagged in the spec** (process deviation — no grilling pass; every agent default is a review point): highest attention — the segment visual language (continuous-text look) and the by-design double spaces at snippet edges; also the `break-word` choice and the explicit `display: block` mechanic.
- **Pre-existing build advisory**: vite's >500 kB chunk-size warning is unrelated to this task (no bundling changes made).
