# Preview Area Text Flow

**Gathered:** 2026-10-12
**Spec:** `.specs/features/text-merging/tasks/preview-area-text-flow/spec.md`
**Status:** Specified — awaiting implementation

---

## Feature Boundary

Two related fixes to the MergeSession preview's segment flow (post-Feature 2 polish — no dedicated roadmap line item; refines Task 4's PreviewArea presentation on top of preview-area-adjusts): (1) **long-word overflow bug** — a word wider than the preview card makes the snippet overflow to the right; the correct behavior is to break the word; (2) **chips → continuous text** — snippets currently render as separated boxes (spans with `padding: 2px 6px; border-radius: 4px` inside a `display: flex; flex-wrap: wrap; gap` flow) and should instead render as **continuous plain text, with each individual snippet highlighted in the same color as its origin input**. The user reports the two solutions are close and should help each other — they are: both fixes replace the same flex/chip mechanics with one plain block text flow of inline highlight spans (the flex layout is simultaneously the overflow's root cause and the chip-separation mechanic).

**Process deviation (explicit):** the standard pipeline's grilling pass did **not** run for this task — the user's instruction was "You can assume the specs and go for the implementation, I'll see then if it is correct." Every design decision below is therefore an **agent default pending the user's post-implementation review** (flagged `n (agent default — user review pending)` in the spec's assumptions table); the two problem statements themselves are user reports. Not a `buildMergedText`/copy-semantics change, not Feature 5 tools (drag-sort, split, line breaks, add-own-text), not empty-state or toolbar changes (preview-area-adjusts outputs are preserved), not i18n/backend/routing changes.

---

## Implementation Decisions

### Scope and delivery

- **Process deviation (explicit)**: no grilling pass — the user authorized assumed specs and will review after implementation. All decisions below are agent defaults pending that review; the problem statements (the overflow bug, the continuous-text request) are the user's reports.
- Pure styling/JSX polish on existing pieces (`PreviewArea.styles.ts` + the segment rendering in `PreviewArea.tsx`): no new components, no state, no context, no routing, no i18n strings, no contract breaks (all testids preserved).

### 1. Long-word overflow fix (word-breaking)

- **Defect (user report); mechanics agent default**: root cause — `SegmentFlow` is `display: flex`, so each chip is a flex item sized independently of its siblings; a single long word cannot wrap *within* its item, so the chip's content pushes the chip past the preview card's right edge (`PreviewAreaRoot` has `overflow: auto`, so today the result reads as horizontal scrolling instead of a broken word).
- (agent default) `SegmentFlow` becomes a **plain block text container**: drop `display: flex`, `flex-wrap`, `align-content`, and `gap` (the chip-separation mechanics — also the presentation change below); keep `white-space: pre-wrap`; keep `text-align: left` (preserves the PVADJ-10..12 left-alignment contract); add `overflow-wrap: break-word` so long words break at the card edge instead of overflowing. Declaring `display: block` explicitly (rather than only omitting `flex`) is the prescribed mechanic so the base-style assertion targets an emitted rule, not a UA default — the two are equivalent.
- (agent default) `overflow-wrap` is an **inherited** property, so the segments inherit the breaking — no per-segment rule required. A defensive `min-width: 0` is developer latitude, not a requirement.
- (agent default) **`break-word` over `anywhere`**: breaking should only happen when a word alone cannot fit the line; `anywhere` additionally affects intrinsic min-content sizing and can cause premature breaks. With the flex context gone, the intrinsic-sizing traps that made flex items refuse to shrink are gone anyway.

### 2. Continuous-flow presentation (chips → text)

- **Request (user report); visual language agent default**: `Segment` stops being a chip — remove `padding: 2px 6px` and `border-radius: 4px` (the box look); keep it an inline span with the `withAlpha(snippet.color, 0.3)` background tint; add `box-decoration-break: clone; -webkit-box-decoration-break: clone;`; keep `color: palette.text.primary` and `white-space: pre-wrap`.
- (agent default) **Visual-language parity with TextInput**: TextInput renders snippet highlights as plain inline spans — `S.Highlight` (`box-decoration-break: clone; -webkit-box-decoration-break: clone;`) with an inline `style={{ backgroundColor: withAlpha(segment.color, segment.alpha ?? 0.3) }}` — no padding, no radius, no border. The preview's segments mirror this exact visual language so a snippet looks the same in the input and in the preview.
- (agent default) **"Same color as its origin input"** maps to the snippet's stored `color` tinted at 0.3 alpha — the same value TextInput renders for committed highlights and the same value the preview already uses. No color-assignment change is involved.
- (agent default) **Merge-order rendering is untouched**: one segment per snippet, in merge order, each carrying its own tint (roadmap 4.3 stays satisfied in spirit — snippets render in merge order, each highlighted with its source color; the presentation is now continuous inline text rather than separated chips).

### 3. Separator & WYSIWYG

- **WYSIWYG anchor (existing contract, not a new decision)**: `buildMergedText` in `CopyMergedTextButton.hook.tsx` is `snippets.map((s) => s.text).join(' ')` — the copy tool joins snippet texts with a single space (Task 4's grilled "Merged Text separator: single space" decision, asserted today by the CopyMergedTextButton suite as `'Hello Alpha world'`). The preview must render exactly this so the preview is what the user copies.
- (agent default) `PreviewArea.tsx` renders a **single space text node between adjacent snippets** (`{' '}` or equivalent — e.g. `{index < snippets.length - 1 ? ' ' : null}` inside a Fragment; the exact mechanics are the developer's choice) so the flow's rendered text equals `buildMergedText(snippets)` exactly.
- (agent default) **`buildMergedText` itself is NOT modified** — the preview is aligned to the clipboard, not the other way around.
- (agent default, by-design consequence): IF a snippet's text already ends with a space THEN the joined text contains a double space — identical to what the copy tool produces today. Documented as by-design (WYSIWYG parity), not a bug to fix in this task; changing the join semantics is out of scope.

### Testing

- (agent default) jsdom has no layout engine — actual word-breaking cannot be verified by unit tests. Prescribed automated coverage in `PreviewArea.test.tsx`:
  - **WYSIWYG test**: assert the flow's `textContent` equals `buildMergedText` of the dispatched snippets — import from `CopyMergedTextButton.hook` (helper-import precedent exists: suites already import `withAlpha` from `PreviewArea.hook` and `buildMergedText` from `CopyMergedTextButton.hook`).
  - **Flow base-style assertions**: `display: block` and `overflow-wrap: break-word` via `toHaveStyle` on `preview-segment-flow` (same pattern as the existing left-align assertion).
  - **Existing tests survive unchanged**: the merge-order test asserts each segment's *own* `textContent` (separator nodes sit between segments, not inside them); the tint test asserts the segment's inline background; the left-align test asserts `text-align: left` on the flow — none depend on the chip styles.
- (agent default) The chip-look removal (no padding/radius) and multi-line tint fragments (`box-decoration-break`) have no jsdom-resolvable assertion prescribed — asserting absent styles via `toHaveStyle` is fragile; they are verified by code diff plus the manual dev-server pass.
- (agent default) **Manual dev-server verification** (same prescription as ui-fixes/preview-area-adjusts for layout behavior): a long word / long URL wraps inside the card with no horizontal overflow; snippets read as one continuous paragraph with per-snippet tints; multi-line snippets paint the tint on every line fragment.
- Blast radius (grep-verified): only `PreviewArea`'s suite and a trivial `preview-area` presence assertion in `MergeSessionPage.test.tsx` reference the flow/segments/testids — no other suite needs updates.

### Supersessions, records & roadmap

- **Supersedes Task 4's chip presentation**: PREVA's grilled assumption "Display form: Wrapping flow of segments, one per snippet, each an independent colored unit" (side-by-side chips) is superseded — segments become inline highlight units in a continuous text flow. The supersession is user-driven (their behavior-change request); the specific rendering interpretation (inline spans mirroring TextInput's `Highlight`) is an agent default pending review. PREVA-01..03's substance is preserved: one segment per snippet, merge order, snippet text, source color at 0.3 alpha.
- **Preserves PVADJ**: `text-align: left` stays on `SegmentFlow` (PVADJ-10..12, just implemented); the empty state (PVADJ-06..09), the toolbar placement (PVADJ-01..05), and all responsive behavior are untouched by this task.
- **Roadmap 4.3** ("Display snippets side by side with source color highlighting") stays checked — satisfied in spirit (merge order + per-snippet source-color highlight); this is a presentation refinement of an already-delivered item, so the supersession note lives here and in the spec, not in a roadmap status change.
- **DESIGN.md**: does not document the preview chip look or highlight guidance — it covers cards/buttons/inputs; "Base corner radius: 4px" applies to cornered components (the current `Segment`'s 4px radius echoed it). No DESIGN.md supersession: highlights are not corner components, and TextInput's radius-less `Highlight` is the in-app precedent; DESIGN.md's "Mobile collapse: … No horizontal overflow" actively supports the overflow fix.
- **Records**: no i18n changes (no strings added or changed — the AGENTS.md translation rule is not triggered), no new components, no roadmap changes, no GLOSSARY.md terms, no ADRs — UI chrome, trivially reversible; same conclusion as ui-fixes/preview-area-adjusts (the ADR triple test fails on every count).

---

## Specific References

- **WYSIWYG anchor**: `artifacts/output-merger.UI/src/pages/MergeSession/components/CopyMergedTextButton/CopyMergedTextButton.hook.tsx` — `buildMergedText(snippets)` = `snippets.map((snippet) => snippet.text).join(' ')`; consumed by the copy button's `handleCopy`; asserted by `CopyMergedTextButton.test.tsx` ('copies the space-joined merged text on click' → `'Hello Alpha world'`; 'builds the merged text as a single-space join'). NOT modified by this task.
- **Highlight precedent**: `artifacts/output-merger.UI/src/components/TextInput/TextInput.styles.ts` — `Highlight` is a bare `styled.span` with only `box-decoration-break: clone; -webkit-box-decoration-break: clone;` (no padding, no radius, no border); `TextInput.tsx` renders highlights as plain inline spans with `style={{ backgroundColor: withAlpha(segment.color, segment.alpha ?? 0.3) }}`.
- **Flex-overflow root cause**: in a flex container each chip is a flex item sized independently; a word wider than the card cannot wrap within its item, so the item extends past the card's content box — `overflow: auto` on `PreviewAreaRoot` then presents the overflow as horizontal scrolling instead of breaking the word.
- **PreviewArea code**: `src/pages/MergeSession/components/PreviewArea/PreviewArea.styles.ts` — `PreviewAreaRoot` (flex column, `flex: 1 1 auto; min-width: 0; min-height: 400px; overflow: auto`), `SegmentFlow` (`display: flex; flex-wrap: wrap; align-content: flex-start; gap: spacing(1); white-space: pre-wrap; text-align: left`), `Segment` (`padding: 2px 6px; border-radius: 4px; color: text.primary; white-space: pre-wrap`); `PreviewArea.tsx` (maps snippets to `S.Segment` with `data-testid="preview-snippet"` and inline `withAlpha(snippet.color, 0.3)` background; `preview-area`/`preview-empty`/`preview-segment-flow` testids); `PreviewArea.hook.tsx` (`withAlpha` export); `PreviewArea.test.tsx` (merge-order, tint, and left-align tests that must survive unchanged).
- **Precedent specs**: `.specs/features/text-merging/tasks/preview-area/spec.md` — the chip-presentation contract this task supersedes (assumptions: display form "side by side" y-grilled; segment tint `snippet.color` at 0.3 alpha y-grilled; Merged Text separator single space y-grilled; PREVA-01..03). `.specs/features/text-merging/tasks/preview-area-adjusts/spec.md` + `implementation.md` — the left-alignment contract preserved here (PVADJ-10..12) and the untouched empty-state/toolbar outputs (PVADJ-01..09); also the manual dev-server verification precedent for layout-dependent behavior.
- **DESIGN.md**: Layout ("Mobile collapse: all multi-column layouts collapse below 900px … No horizontal overflow"), Shapes ("Base corner radius: 4px" — scoped to cornered components; not chip/highlight guidance).
- **Roadmap**: 4.3 checked (Feature 2 complete); this task is a presentation refinement under that item — no roadmap status change expected.
- **AGENTS.md**: UI changes confined to `artifacts/output-merger.UI`; per-suite unit-test pattern (page sub-components); i18n rule not triggered (no strings); git operations only on explicit user instruction.

---

## Deferred Ideas

- Trimming snippet edge spaces in the join (avoiding the by-design double spaces) — would change clipboard semantics (Task 4's grilled single-space separator and this task's WYSIWYG anchor); a separate deliberate change if the user wants it after review.
- `overflow-wrap: anywhere` — more aggressive breaking that also affects min-content sizing; revisit only if `break-word` proves insufficient with real content.
- Hyphenation (`hyphens: auto`) — typographic nicety, browser/locale-dependent; out of scope.
- Rendering the merged text as a single flat text node — would drop per-snippet tinting and Feature 5's natural per-snippet anchors; rejected.
- Copy-from-preview affordances (`user-select` policies, select-all) — not requested; copying goes through the toolbar's copy tool.
- Snippet reordering/splitting/line breaks/add-own-text — Feature 5.
- "Start Over" / "Add Text" — Feature 3; third input — Feature 4.
