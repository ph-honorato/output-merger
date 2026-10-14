# Preview Area Text Flow Specification

## Problem Statement

Task 4 delivered the preview as a wrapping flex flow of tinted chip spans; preview-area-adjusts refined it (left-aligned text, responsive toolbar, tutorial-hint empty state). Two issues remain, both in the segment flow, and the user reports their solutions are close and should help each other: (1) **long-word overflow (user report)** — a word wider than the preview card makes the snippet overflow to the right. Root cause: `SegmentFlow` is a flex container, so each chip is an independently sized flex item; a single long word cannot wrap within its item, so the chip's content pushes it past the card's right edge (the card's `overflow: auto` then presents the result as horizontal scrolling instead of a broken word). The correct behavior is to break the word. (2) **Chips → continuous text (user request)** — snippets currently render as separated boxes (spans with `padding: 2px 6px; border-radius: 4px` inside a `display: flex; flex-wrap: wrap; gap` flow), while the Merged Text the copy tool produces is continuous text: `buildMergedText` joins the snippet texts with single spaces. The user wants the preview to render as **continuous plain text, with each individual snippet highlighted in the same color as its origin input**. The two fixes are mechanically one change: the flow stops being a flex container and becomes a plain block text flow of inline highlight spans — mirroring TextInput's committed-highlight look (`Highlight`: no padding, no radius, `box-decoration-break: clone`) and matching the clipboard output exactly (WYSIWYG). This specification supersedes Task 4's chip presentation (PREVA's "side by side" display form) while preserving its substance — one segment per snippet, merge order, snippet text, 0.3-alpha source tint — and preserves all preview-area-adjusts outputs (PVADJ left-alignment stays; empty state, toolbar, and responsive layout are untouched). Process deviation: the user was not grilled for this task and authorized assumed specs — every design decision below is an agent default flagged for the user's post-implementation review; the two problem statements themselves are user reports.

## Goals

- [ ] A word wider than the preview card breaks at the card's right edge and wraps onto the next line — the card shows no horizontal overflow (the segment flow is a plain block text container with `overflow-wrap: break-word`).
- [ ] Snippets render as continuous plain text — no chip padding/radius, no inter-chip gaps — each snippet an inline highlight in its origin input's color, visually identical to TextInput's committed highlights (tint painted on every line fragment of a multi-line snippet).
- [ ] The flow's rendered text equals `buildMergedText(snippets)` exactly (single-space-joined snippet texts — the same string the copy tool writes to the clipboard), so the preview is what the user copies (WYSIWYG).
- [ ] All existing contracts hold: merge-order rendering, 0.3-alpha source tints, testids (`preview-area`, `preview-segment-flow`, `preview-snippet`, `preview-empty`), PVADJ left-alignment, the empty ⇄ populated transition, and the untouched empty state/toolbar; the affected suites gain tests rather than break.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Changing `buildMergedText` / join semantics (e.g., trimming snippet edge spaces) | Copy semantics are Task 4's grilled contract and this task's WYSIWYG anchor; the double spaces at snippet edges are by-design; a join change is a separate, deliberate decision |
| Copy tool behavior (button, toast, clipboard handling) | Unchanged; the preview aligns to the clipboard, not the other way around |
| Feature 5 tools (drag-sort, split, line breaks, add-own-text) | Feature 5; the per-snippet inline spans are deliberately preserved as its natural anchors |
| Empty state (copy, styling, alignment) | PVADJ-06..09 outputs, just implemented; untouched |
| Toolbar placement (mobile row / desktop column) | PVADJ-01..05 outputs; untouched |
| i18n (any string, either language) | No text is added or changed; the preview renders user content, not UI copy — the AGENTS.md translation rule is not triggered |
| Backend/API changes, route changes | UI-only styling/JSX task; no backend surface involved |
| Removing `text-align: left` from the flow | PVADJ-10..12 contract; the flow stays left-aligned |
| Typographic niceties (hyphenation, ligatures, justification) | Not requested; browser/locale-dependent; out of scope |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here - nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Problem: long-word overflow | A word wider than the preview card must break at the card edge instead of overflowing to the right | The user reports the overflow as a bug and prescribes the corrected behavior ("break the word") | y (user report) |
| Problem: chips → continuous text | Snippets render as continuous plain text, each individual snippet highlighted in the same color as its origin input | The user's behavior-change request; chips visually insert separations that do not exist in the copied Merged Text | y (user report) |
| Word-breaking mechanism | `overflow-wrap: break-word` on `SegmentFlow` | Breaks only when a word alone cannot fit the line; inherited into the segments; with the flex context gone, the intrinsic-sizing traps that blocked shrinking are gone too | n (agent default — user review pending) |
| `break-word` vs `anywhere` | `break-word` | `anywhere` additionally affects intrinsic min-content sizing and can cause premature breaks; breaking should be the last resort; a defensive `min-width: 0` is developer latitude, not a requirement | n (agent default — user review pending) |
| Flow container mechanics | `SegmentFlow` becomes a plain block text container: drop `display: flex`/`flex-wrap`/`align-content`/`gap`; keep `white-space: pre-wrap` and `text-align: left` (declare `display: block` explicitly so the base-style assertion targets an emitted rule) | The flex layout is both the overflow's root cause (each chip = an independently sized flex item) and the chip-separation mechanic; a block flow makes segments inline content that wraps naturally; PVADJ-10..12 preserved | n (agent default — user review pending) |
| Segment visual language | Plain inline highlight mirroring TextInput's `Highlight`: remove `padding`/`border-radius`; add `box-decoration-break: clone` + `-webkit-box-decoration-break: clone`; keep the `withAlpha(snippet.color, 0.3)` tint, `palette.text.primary` color, and `white-space: pre-wrap` | A snippet must look the same in the input and in the preview; TextInput's radius-less, padding-less `Highlight` with the same 0.3-alpha tint is the established in-app precedent for "highlighted text" | n (agent default — user review pending) |
| "Same color as its origin input" meaning | The snippet's stored `color` tinted at 0.3 alpha — the same value TextInput renders for committed highlights and the preview already uses today | No color-assignment change exists to make; origin-input color is already carried per snippet as `snippet.color` | n (agent default — user review pending) |
| Space separator & WYSIWYG | One space text node between adjacent snippets (`{' '}` or equivalent — mechanics are the developer's choice); the flow's rendered text equals `buildMergedText(snippets)`; `buildMergedText` is NOT modified | The copy tool's join (`texts.join(' ')` — Task 4's grilled single-space separator) is the anchor: the preview must show what the user copies; aligning the preview avoids touching copy semantics | n (agent default — user review pending) |
| Double spaces at snippet edges | By-design: a snippet ending (or starting) with a space yields a double space in the flow — identical to today's clipboard output | WYSIWYG parity outranks typographic deduplication in this task; changing the join is out of scope | n (agent default — user review pending) |
| Testids & transitions preserved | `preview-area`, `preview-segment-flow`, `preview-snippet`, `preview-empty` unchanged (no renames); empty ⇄ populated transition unchanged | Continuity with the PREVA/PVADJ suites and Feature 5's per-snippet anchors; nothing about the fixes requires new handles | n (agent default — user review pending) |
| Testing strategy | jsdom cannot verify layout: automated coverage = WYSIWYG `textContent` test (importing `buildMergedText` from the CopyMergedTextButton hook — helper-import precedent exists) + flow base-style assertions (`display: block`, `overflow-wrap: break-word` via `toHaveStyle`); the actual word-breaking, the chip-look removal, and multi-line tint fragments verified manually in the dev server | Same prescription ui-fixes/preview-area-adjusts used for layout-dependent behavior; asserting absent styles (`padding: 0`) is fragile and deliberately not prescribed | n (agent default — user review pending) |
| Supersession handling | PREVA's chip presentation superseded (side-by-side independent units → continuous inline highlights — user-driven); roadmap 4.3 stays checked (satisfied in spirit: merge order + per-snippet source-color highlight); the supersession note is recorded in the specs, not the roadmap | Presentation refinement of an already-delivered item; reopening the roadmap checkbox would misrepresent Feature 2's delivered state | n (agent default — user review pending) |
| Glossary / ADR | None — no GLOSSARY.md terms, no ADRs | UI chrome, trivially reversible; no domain language introduced; same conclusion as ui-fixes/preview-area-adjusts (ADR triple test fails on every count) | n (agent default — user review pending) |

**Open questions:** none blocking implementation. Process deviation: the user authorized assumed specs and will review after implementation ("I'll see then if it is correct"), so every `n` row above is a review point rather than a question. Highest-attention review rows: the segment visual language (continuous-text look) and the by-design double spaces at snippet edges.

---

## Implicit-Requirement Dimensions

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | N/A — no new user input; snippet text is trusted context data (Task 3 contract); long content is a rendering concern, handled by word-breaking |
| Failure / partial-failure states | N/A — no storage, network, or clipboard surface touched; Task 4's silent clipboard no-op is unchanged |
| Idempotency / retry / duplicate handling | N/A — pure presentation; rendering derives from the snippets context |
| Auth boundaries & rate limits | N/A because there is no API |
| Concurrency / ordering | Merge-order rendering unchanged; no local state added |
| Data lifecycle / expiry | N/A — no local data created or consumed |
| Observability | N/A because v0 has no metrics/logging requirement |
| External-dependency failure | N/A — no external dependency added; `navigator.clipboard` behavior unchanged from Task 4 |
| State-transition integrity | empty ⇄ populated driven purely by the context (unchanged); the first snippet still replaces the empty state; the flow renders with no intermediate states |
| i18n completeness | N/A — no strings added or changed; the flow renders user content, not UI copy |
| WYSIWYG consistency | The flow's rendered text SHALL equal `buildMergedText(snippets)` exactly — the same string the copy tool writes to the clipboard — so the preview, the clipboard, and (via the TextInput visual parity) the inputs all tell the same story |
| Accessibility | Text remains real text: segments are inline spans with real text content (screen-reader readable); the color tints are decorative background styling only; no ARIA roles added or needed; per-snippet granularity is preserved (each snippet is its own span) |

---

## User Stories

### P1: Long words break inside the preview card ⭐ MVP

**User Story**: As a merger, I want a word wider than the preview card to break at the card's edge, so that my whole merged text stays visible inside the card without horizontal scrolling.

**Why P1**: Direct user report (bug); content wider than the card is unreachable without scrolling and violates the project's no-horizontal-overflow principle.

**Acceptance Criteria**:

1. WHILE any word in the preview content is wider than the preview card's content box THEN the word SHALL break at the card's right edge and continue on the following line, instead of extending past it — the segment flow SHALL declare `overflow-wrap: break-word`.
2. The word-breaking SHALL apply inside segments: segments SHALL inherit the flow's `overflow-wrap` (an inherited property), so a long word inside any snippet breaks within that segment (a defensive `min-width: 0` is the developer's latitude, not a requirement).
3. WHILE the preview contains a long word or a long URL THEN the preview card SHALL produce no horizontal overflow caused by snippet content (no horizontal scrolling of `preview-area`).
4. Ordinary text SHALL wrap exactly as before this task: breaking SHALL occur only when a word alone cannot fit the line (`break-word`, not `anywhere`), and normal inter-word wrapping, merge order, and left-alignment are unchanged.

**Independent Test**: jsdom has no layout engine — the suite asserts the base style (`overflow-wrap: break-word` on `preview-segment-flow` via `toHaveStyle`, same pattern as the existing left-align assertion). The actual breaking is verified manually in the dev server (same prescription as the previous tasks): select a long unbroken word or paste a long URL into a source and snippet it; it wraps inside the card; the card shows no horizontal overflow.

---

### P1: Snippets render as continuous text with source-color highlights ⭐ MVP

**User Story**: As a merger, I want the preview to read as one continuous piece of text with each snippet highlighted in its origin input's color, so that the preview shows the merged output as it will actually read and copy — not as a collection of separated chips.

**Why P1**: Direct user report (behavior change request); the chips visually insert separations that do not exist in the copied output, and the preview's job is to preview the Merged Text.

**Acceptance Criteria**:

1. The segment flow SHALL render as a plain block text container — `display: block` — dropping the chip-separation mechanics (`flex-wrap`, `align-content`, `gap`); `white-space: pre-wrap` and `text-align: left` SHALL remain (the PVADJ-10..12 left-alignment contract is preserved).
2. Snippets SHALL render as inline content of one continuous flow — exactly one segment per snippet, in merge order, with no box styling separating them.
3. Each segment SHALL be a plain inline highlight mirroring TextInput's `Highlight`: no padding and no border-radius; background = the snippet's `color` at 0.3 alpha (`withAlpha(snippet.color, 0.3)`); text color = palette text primary; `white-space: pre-wrap`; and `box-decoration-break: clone` with `-webkit-box-decoration-break: clone` so a segment wrapped across lines paints its tint on every fragment.
4. Adjacent snippets SHALL be separated by exactly one space so the flow's rendered text SHALL equal `buildMergedText(snippets)` — the exact string the copy tool writes to the clipboard. `buildMergedText` SHALL NOT be modified. IF a snippet's text already ends with a space THEN the resulting double space is by-design (identical to today's clipboard output).
5. The data-testids `preview-area`, `preview-segment-flow`, `preview-snippet`, and `preview-empty` SHALL be preserved with no renames, and the empty ⇄ populated transition SHALL remain unchanged (the first snippet still replaces the empty state).
6. Everything outside the segment flow SHALL remain unchanged: the empty state (centered icon + hint, PVADJ-06..09), the toolbar placement (mobile row below / desktop column beside, PVADJ-01..05), and the page chrome.

**Independent Test**: Existing merge-order, tint, and left-align tests survive unchanged (each segment's own `textContent` is unaffected by the separator nodes). Add: a WYSIWYG test asserting the flow's `textContent` equals `buildMergedText` of the dispatched snippets (imported from the CopyMergedTextButton hook — the same helper-import precedent its own suite uses); flow base-style assertions (`display: block`, `overflow-wrap: break-word` via `toHaveStyle` on `preview-segment-flow`). The chip-look removal and multi-line tint fragments are verified visually in the same manual dev-server pass.

---

## Edge Cases

- IF a single snippet is wider than the card THEN it SHALL break at the card edge exactly like any multi-snippet flow (the one-snippet case is the minimal reproduction of the bug).
- IF the preview contains a very long URL THEN it SHALL break at the card's right edge (no spaces exist to wrap on; `break-word` is the safety net).
- IF a word is exactly as wide as the card's content box THEN no break SHALL be forced (breaking happens only when a word alone cannot fit the line).
- IF a snippet's text contains internal newlines THEN they SHALL render as line breaks (`white-space: pre-wrap` kept on the flow and the segments), and the single-space separator SHALL apply only between adjacent snippets — snippet-internal whitespace is the snippet's own content, copied verbatim.
- IF a snippet's text ends (or starts) with a space THEN the flow SHALL show the resulting double space — matching the clipboard output exactly (by-design WYSIWYG parity; join semantics untouched).
- IF a snippet's text is empty THEN the flow SHALL still match `buildMergedText` (the separator spaces around the empty segment render exactly as the join produces them).
- IF a segment wraps across multiple lines THEN every line fragment SHALL carry the tint (`box-decoration-break: clone`), so highlights leave no unpainted gaps at line boundaries — the same behavior as TextInput's highlights.
- IF the preview is empty on a mobile viewport THEN the empty state and the below-`md` toolbar row SHALL render exactly as after preview-area-adjusts (nothing in this task touches them).
- IF the content contains long CJK/ideographic runs THEN `overflow-wrap: break-word` SHALL act as the safety net (browsers break CJK between characters by default; the rule guarantees the card edge holds regardless).

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| PVTF-01 | Long words break inside the preview card | Specify | Pending |
| PVTF-02 | Long words break inside the preview card | Specify | Pending |
| PVTF-03 | Long words break inside the preview card | Specify | Pending |
| PVTF-04 | Long words break inside the preview card | Specify | Pending |
| PVTF-05 | Continuous text with source-color highlights | Specify | Pending |
| PVTF-06 | Continuous text with source-color highlights | Specify | Pending |
| PVTF-07 | Continuous text with source-color highlights | Specify | Pending |
| PVTF-08 | Continuous text with source-color highlights | Specify | Pending |
| PVTF-09 | Continuous text with source-color highlights | Specify | Pending |
| PVTF-10 | Continuous text with source-color highlights | Specify | Pending |

**ID format:** `PVTF-NN` (continues the per-task prefix convention: `PREVA-NN` preview-area, `UIFX-NN` ui-fixes, `PVADJ-NN` preview-area-adjusts).

**Status values:** Pending → In Design → In Tasks → Implementing → Verified; additionally **Deviated** (implemented with a changed contract — see `implementation.md`) and **Deferred** (not implemented — see `implementation.md`).

**Coverage:** 10 total. 0 Verified, 0 Deviated, 0 Deferred. Fix mapping: long words break inside the preview card → PVTF-01–04; continuous text with source-color highlights → PVTF-05–10. Supersedes the chip-presentation aspects of PREVA-01..03 (one segment per snippet, merge order, snippet text, and the 0.3-alpha source tint are preserved; the separated-chips presentation is replaced). Preserves PVADJ-10..12 (left-alignment). Per-requirement outcomes: `.specs/features/text-merging/tasks/preview-area-text-flow/implementation.md` (to be created by the developer sub-agent).

---

## Success Criteria

How we know the feature is successful:

- [ ] Dev server: a word (or URL) wider than the preview card breaks at the card's right edge and wraps onto the next line; the card shows no horizontal overflow — with a single snippet or many.
- [ ] Dev server: snippets read as one continuous paragraph, each snippet carrying its origin input's color tint — the same highlight look as in the inputs; multi-line snippets tint every line fragment.
- [ ] The preview's visible text is exactly what the copy tool puts on the clipboard (single spaces between snippets, including the by-design double spaces at snippet edges).
- [ ] The empty state (hint sentence, centered), the toolbar (below on mobile, beside on desktop), and the page chrome are unchanged from preview-area-adjusts.
- [ ] `npx vitest run`, `npm run lint`, and `npx tsc -b` all pass (PreviewArea suite gains the WYSIWYG test and the flow base-style assertions; the existing merge-order/tint/left-align tests are untouched and green).
