# Preview Area Adjustments Specification

## Problem Statement

The MergeSession preview column is functionally complete (Feature 2, Tasks 4–6: snippets render in merge order, copy works, the toolbar sits beside the card), but three presentation details remain: (1) `PreviewColumn` is a flex row at every breakpoint, so on narrow screens — where the page Grid (`size={{ xs: 12, md: 4 }}`) already gives the preview the full column width — the vertical tool bar still claims a slice of that width beside the preview instead of moving out of the way; (2) the empty state reads "Snippets you select will appear here", which describes the area but never tells a first-time user what to do; (3) snippet chips inherit `text-align: center` from the page `Wrapper`, so multi-line snippet text renders centered and reads unnaturally. This specification defines a small polish task with three adjustments: below the MUI `md` breakpoint (900px) the toolbar moves under the preview as a horizontal button row; the empty state becomes a single-sentence tutorial hint; and snippet text is left-aligned, scoped to the segment flow. It explicitly supersedes the ui-fixes agent-default assumption that the toolbar stays beside the card on mobile. No new components, no state, no contract changes.

## Goals

- [ ] Below the MUI `md` breakpoint (900px) the `PreviewToolbar` renders below the `PreviewArea` as a full-width horizontal row of tool buttons; from `md` up it keeps today's layout (beside the preview card, right side, top-aligned, vertical column).
- [ ] The mobile flip happens at the same `md` breakpoint the page Grid uses, so the toolbar moves below exactly when the preview column becomes full-width.
- [ ] The empty state renders a single-sentence hint ("Select some snippets on the inputs to start"), keeps its centered icon + sentence presentation, and ships in en-US and pt-BR under the existing `pages.mergeSession.previewArea.empty` key.
- [ ] Snippet chip text renders left-aligned, scoped to the segment flow; the empty state's centering and the page's centered chrome are untouched.
- [ ] All existing contracts hold (toolbar composition/testids/card styling/copy button first, empty state disappears on first snippet) and the affected suites are updated rather than broken.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| "Start Over" / "Add Text" buttons | Feature 5; unrelated to the preview column |
| Third text input | Feature 4 |
| New toolbar tools (drag-sort, split, line breaks, add-own-text) | Feature 3; this task only repositions existing tools — the composition contract is preserved so tools can be added without rework |
| Empty-state content beyond the single sentence + hint styling (numbered steps, headline, dismiss control, persistence) | User decision: single sentence only; the Task 6.1 tutorial banner already teaches the full flow |
| Desktop (`md`-and-up) layout changes | User decision: mobile is the target; desktop keeps today's layout exactly |
| Backend/API changes, route changes | UI-only styling/copy task; no backend surface involved |
| Removing `text-align: center` from the page `Wrapper` | Broader blast radius (title, ActionsBar, tutorial rely on it); the left-alignment is scoped to the segment flow instead |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here - nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Mobile toolbar button layout | Horizontal row below the preview area — buttons side-by-side like a classic toolbar | User decision (picked "a" over stacked/vertical alternatives) | y (grilled) |
| Empty-state content | Single sentence only — "Select some snippets on the inputs to start" — styled as a hint; no numbered steps, no headline+steps, no tutorial-banner mirror | User decision (picked "b") | y (grilled) |
| Empty-state alignment | Keep centered — classic empty-state icon + sentence; only snippet text becomes left-aligned | User decision (picked "a") | y (grilled) |
| "Mobile" definition | Below the MUI `md` breakpoint (900px) — the same breakpoint where the page Grid flips the preview column to full width (`Grid size={{ xs: 12, md: 4 }}`) | User decision; the toolbar goes below exactly when the column stops being a side panel; matches DESIGN.md's 900px mobile collapse | y (grilled) |
| Superseded ui-fixes assumption | The ui-fixes row "Toolbar on mobile: stays beside the card on stacked layouts" (agent default, never user-confirmed) is superseded: below `md` the toolbar goes under the area | Direct consequence of this task's grilled decisions; recorded here and in context.md | y (grilled) — supersession is explicit |
| `PreviewColumn` mechanics | Below `md`: `flex-direction: column` + `align-items: stretch` (toolbar = full-width bar under the area); `md`-and-up: today's row + `align-items: flex-start`. Mobile-first base + `theme.breakpoints.up('md')` override | Keeps the 900px flip in one source of truth (the theme) and in sync with the Grid; mechanics are the developer's choice — the spec stays behavioral | n (agent default) |
| Toolbar axis flip | `PreviewToolbarRoot` lays out its buttons in a row below `md`, column from `md` up (same breakpoint); card styling, gap, and padding unchanged | The toolbar owns its own axis; one breakpoint drives both flips | n (agent default) |
| Toolbar contract preserved | Children-composition, `preview-toolbar`/`preview-copy-button` testids, card styling, copy button as first child (topmost on desktop, leftmost on mobile); Feature 3 tools follow it | Continuity with Task 4/5 suites; Feature 3 must not need rework | n (agent default) |
| Toolbar overflow on very narrow screens | Mobile toolbar row wraps (`flex-wrap: wrap`), never overflows horizontally | DESIGN.md "No horizontal overflow"; only reachable once Feature 3 adds tools | n (agent default) |
| Empty-state styling | Existing composition kept: `Preview` icon (`aria-hidden`) + sentence, centered flex, `text.secondary` color; only the copy changes; `preview-empty` testid preserved; still disappears when the first snippet arrives | The current layout already reads as a hint; Task 4 contract (PREVA-04/05) untouched | n (agent default) |
| i18n key & wording | Same key `pages.mergeSession.previewArea.empty` updated in BOTH en-US and pt-BR (draft pt-BR: "Selecione alguns trechos nas entradas para começar"); final wording reviewed during implementation | ui-fixes copy-authorship precedent (agent drafts, user reviews) | n (agent default) — the single-sentence approach itself is y (grilled) |
| Left-alignment scope | `text-align: left` scoped to `SegmentFlow` in `PreviewArea.styles.ts` (preferred over `PreviewAreaRoot`) | Narrowest blast radius: the empty state's centering and the page's centered chrome stay untouched | n (agent default) |
| Testing | Unit tests assert base styles only (jsdom has no layout engine; media queries are not evaluable); `PreviewToolbar`'s `flexDirection: 'column'` assertion flips to the new mobile-first base (row) — `position: static` stays; `PreviewArea`'s empty-state text assertion is updated for the new copy; both responsive behaviors verified manually in the dev server | Same prescription ui-fixes used for its min-height requirements | n (agent default) |
| Glossary / ADR | None — no GLOSSARY.md terms, no ADRs | Styling/UX chrome, trivially reversible; "hint" is not domain language; same conclusion as ui-fixes (ADR triple test fails) | n (agent default) |

**Open questions:** none - all resolved or logged above (the empty-state wording is agent-drafted and flagged for the standard implementation-review pass, per the ui-fixes copy-authorship precedent).

---

## Implicit-Requirement Dimensions

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | N/A — no new user input; the only content change is a static i18n sentence |
| Failure / partial-failure states | N/A — no storage, network, or clipboard surface touched; Task 4's silent clipboard no-op and Task 6's throwing-storage tolerance are unchanged |
| Idempotency / retry / duplicate handling | N/A — pure presentation; rendering derives from the snippets context |
| Auth boundaries & rate limits | N/A because there is no API |
| Concurrency / ordering | Merge-order rendering unchanged; the responsive flip is pure CSS with no JS state |
| Data lifecycle / expiry | N/A — no local data created or consumed by these adjustments |
| Observability | N/A because v0 has no metrics/logging requirement |
| External-dependency failure | N/A — no external dependency added; `navigator.clipboard` behavior unchanged from Task 4 |
| State-transition integrity | empty ⇄ populated driven purely by the context (unchanged); toolbar position derives from the viewport, not application state |
| i18n completeness | The empty-state key is updated in en-US AND pt-BR in the same change (AGENTS.md rule); no string ships in one language only; live language switch updates the hint |
| Breakpoint synchronization | The mobile/desktop flip uses the theme's `md` (900px) — the same breakpoint the page Grid uses (`Grid size={{ xs: 12, md: 4 }}`) — so the toolbar moves below exactly when the preview column stops being a side panel; DESIGN.md fixes mobile collapse at 900px |
| Accessibility | No semantic change: the toolbar stays a flex container of icon buttons with their existing aria-labels; the empty-state icon remains `aria-hidden`; the hint is real text (readable, translatable) |

---

## User Stories

### P1: Toolbar below the preview on mobile ⭐ MVP

**User Story**: As a merger on a narrow screen, I want the tool buttons in a horizontal bar below the preview, so that the preview keeps the full column width and the tools sit where I can reach them.

**Why P1**: Direct user request; below `md` the page Grid already stacks the preview full-width, and the side toolbar both squeezes the preview and looks like a stray element.

**Acceptance Criteria**:

1. WHILE the viewport is narrower than the MUI `md` breakpoint (900px) THEN the `PreviewToolbar` SHALL render below the `PreviewArea`, not beside it.
2. WHILE below `md` THEN the toolbar's tool buttons SHALL lay out in a single horizontal row (side by side), with the copy button as the leftmost button.
3. WHILE below `md` THEN the toolbar bar SHALL stretch to the full width of the preview column.
4. WHILE the viewport is `md` and wider THEN the toolbar SHALL keep today's desktop layout: beside the preview card's right side, top-aligned, with the buttons stacked in a vertical column.
5. The toolbar SHALL keep its children-composition contract, card styling, and data-testids (`preview-toolbar`, `preview-copy-button`), with the copy button as the first child — so Feature 3 tools stack below it on desktop and follow it in the mobile row without further layout work.

**Independent Test**: Manual dev-server verification on both sides of 900px (resize or device emulator; jsdom cannot evaluate media queries): below `md` the toolbar renders under the area as a full-width row with the copy button leftmost; at `md`+ it is beside the card's right side, vertical, top-aligned. Unit suites assert base styles only (the `PreviewToolbar` `flexDirection` assertion updated to the mobile-first base).

---

### P1: Empty state as a tutorial hint ⭐ MVP

**User Story**: As a first-time merger with an empty preview, I want the empty state to tell me what to do next, so that I know the session starts by selecting snippets.

**Why P1**: Direct user request; the empty state is the first thing a first-time user sees in the preview column, and today it describes the area instead of teaching the next action.

**Acceptance Criteria**:

1. WHILE zero snippets exist THEN the empty state SHALL render the updated `pages.mergeSession.previewArea.empty` copy — a single sentence reading "Select some snippets on the inputs to start" — and SHALL render no numbered steps and no headline beyond that sentence.
2. The empty state SHALL keep its hint presentation: icon + sentence, centered in the preview area, secondary text color.
3. WHEN the first snippet arrives THEN the empty state SHALL disappear and the snippet flow SHALL render (Task 4 contract unchanged).
4. The updated `pages.mergeSession.previewArea.empty` value SHALL exist in both `en-US.json` and `pt-BR.json`; WHEN the active language changes THEN the empty-state text SHALL update accordingly.

**Independent Test**: Render `PreviewArea` with an empty context: `preview-empty` present with the new sentence and no `preview-snippet`; dispatch one snippet: empty state gone, one segment rendered (existing unit test updated for the new copy); assert the key's value in both resource files (both-language completeness check, same pattern as the TutorialBanner suite).

---

### Draft Empty-State Copy (i18n)

The user picked the single-sentence content; the final wording is reviewed/corrected during implementation (ui-fixes copy-authorship precedent). Note for the review: GLOSSARY.md prefers "Source" as the domain term — the draft follows the user's picked phrasing; aligning it is the reviewer's call.

| Key | en-US | pt-BR |
| --- | ----- | ----- |
| `pages.mergeSession.previewArea.empty` | Select some snippets on the inputs to start | Selecione alguns trechos nas entradas para começar |

---

### P1: Left-aligned snippet text ⭐ MVP

**User Story**: As a merger, I want snippet text left-aligned, so that multi-line snippets read like text instead of centered captions.

**Why P1**: Direct user report; centered multi-line snippet text is a reading defect in the preview's core content.

**Acceptance Criteria**:

1. Snippet chip text SHALL render left-aligned, including WHEN a snippet's text spans multiple lines.
2. The left-alignment SHALL be scoped to the segment flow (`SegmentFlow`); WHILE zero snippets exist THEN the empty state's icon and hint sentence SHALL remain centered.
3. Centered page chrome outside the segment flow — page title, ActionsBar contents — SHALL remain exactly as before this task.

**Independent Test**: Render `PreviewArea` with a long multi-line snippet; assert the segment flow's computed `text-align: left` (base style; jsdom-resolvable like the existing `toHaveStyle` assertions); render with an empty context and confirm the empty state's centered composition is untouched.

---

## Edge Cases

- IF the preview is empty on a mobile viewport THEN the toolbar SHALL still render below the (empty) preview area as a horizontal row, with the copy button disabled (Task 4 contract unchanged).
- IF the toolbar row ever exceeds the column width (only possible once Feature 3 adds tools) THEN its buttons SHALL wrap within the bar rather than overflow horizontally (DESIGN.md: no horizontal overflow on mobile).
- IF a snippet's text wraps across multiple lines THEN every line SHALL start at the chip's left edge (`text-align: left` inherits into each chip; `white-space: pre-wrap` unchanged).
- IF the active language changes WHILE the empty state is visible THEN the hint sentence SHALL render in the active language (i18n is orthogonal to layout).
- IF the viewport crosses the 900px boundary THEN the toolbar position/axis SHALL flip purely via CSS — no JS state, no remount; automated tests do not cover the media-query behavior (jsdom limitation), hence the manual verification.
- IF the toolbar moves below the area on mobile THEN the existing `PreviewColumn` gap provides the vertical spacing between the preview card and the bar (no extra spacing rules needed).
- IF Feature 3 later adds tools THEN they compose as additional toolbar children and follow the copy button (row on mobile, stacked on desktop) with no further layout changes.

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| PVADJ-01 | Toolbar below the preview on mobile | Specify | Pending |
| PVADJ-02 | Toolbar below the preview on mobile | Specify | Pending |
| PVADJ-03 | Toolbar below the preview on mobile | Specify | Pending |
| PVADJ-04 | Toolbar below the preview on mobile | Specify | Pending |
| PVADJ-05 | Toolbar below the preview on mobile | Specify | Pending |
| PVADJ-06 | Empty state as a tutorial hint | Specify | Pending |
| PVADJ-07 | Empty state as a tutorial hint | Specify | Pending |
| PVADJ-08 | Empty state as a tutorial hint | Specify | Pending |
| PVADJ-09 | Empty state as a tutorial hint | Specify | Pending |
| PVADJ-10 | Left-aligned snippet text | Specify | Pending |
| PVADJ-11 | Left-aligned snippet text | Specify | Pending |
| PVADJ-12 | Left-aligned snippet text | Specify | Pending |

**ID format:** `PVADJ-NN` (continues the per-task prefix convention: `PREVA-NN` preview-area, `UIFX-NN` ui-fixes).

**Status values:** Pending → In Design → In Tasks → Implementing → Verified; additionally **Deviated** (implemented with a changed contract — see `implementation.md`) and **Deferred** (not implemented — see `implementation.md`).

**Coverage:** 12 total. 0 Verified, 0 Deviated, 0 Deferred. Adjustment mapping: toolbar below the preview on mobile → PVADJ-01–05; empty state as a tutorial hint → PVADJ-06–09; left-aligned snippet text → PVADJ-10–12. Per-requirement outcomes: `.specs/features/text-merging/tasks/preview-area-adjusts/implementation.md` (to be created by the developer sub-agent).

---

## Success Criteria

How we know the feature is successful:

- [ ] Dev server below 900px: the tool buttons sit under the preview area in a full-width horizontal row, copy button leftmost, card styling intact — with an empty or populated preview alike.
- [ ] Dev server at 900px and up: the toolbar is beside the preview card's right side, vertical, top-aligned — unchanged from today.
- [ ] The empty preview shows the icon + single-sentence hint centered, in en-US and pt-BR; switching languages updates it live; it disappears when the first snippet arrives.
- [ ] Multi-line snippet text reads left-aligned inside its chips; the empty state and the page title/ActionsBar centering are unchanged.
- [ ] `npx vitest run`, `npm run lint`, and `npx tsc -b` all pass (PreviewToolbar base-style assertion and PreviewArea empty-state copy assertion updated to the new contracts).
