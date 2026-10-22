# Preview Area Adjustments

**Gathered:** 2026-10-12
**Spec:** `.specs/features/text-merging/tasks/preview-area-adjusts/spec.md`
**Status:** Specified — awaiting implementation

---

## Feature Boundary

Three presentation adjustments to the MergeSession page's preview column (post-Feature 2 polish — no dedicated roadmap line item; refines the outputs of Task 4 PreviewArea and Task 6.4 toolbar decoupling): (1) below the MUI `md` breakpoint (900px) the `PreviewToolbar` renders **below** the `PreviewArea` as a full-width horizontal row of tool buttons, while from `md` up it keeps today's beside-the-card vertical layout; (2) the PreviewArea empty state is rewritten as a single-sentence tutorial hint ("Select some snippets on the inputs to start"), keeping its centered icon + sentence presentation, in en-US and pt-BR; (3) snippet chip text becomes left-aligned, scoped to the segment flow. Explicitly supersedes the ui-fixes agent-default assumption "Toolbar on mobile: stays beside the card on stacked layouts" (never user-confirmed). Not Start Over / Add Text (Feature 5), not the third input (Feature 4), not preview tools (Feature 3), not empty-state steps/dismiss/persistence, not desktop layout changes, not backend/routing changes.

---

## Implementation Decisions

### Scope and delivery

- Decisions gathered via grilling in the parent session (2026-10-12): all four frontier questions answered (toolbar axis on mobile, empty-state content, empty-state alignment, "mobile" definition).
- Pure styling/copy polish on existing pieces (`PreviewColumn`, `PreviewToolbar`, `PreviewArea`, i18n resources): no new components, no state, no context, no routing, no contract breaks.

### 1. Toolbar below the preview on mobile

- **Button layout below the area (user decision)**: horizontal row — buttons side-by-side like a classic toolbar (user picked option "a"); the bar becomes a full-width strip under the preview area.
- **"Mobile" definition (user decision)**: below the MUI `md` breakpoint (900px) — exactly where the page Grid already flips the preview column to full width (`Grid size={{ xs: 12, md: 4 }}`), so the toolbar goes below precisely when the column stops being a side panel. Matches DESIGN.md's "Mobile collapse: all multi-column layouts collapse below 900px".
- (agent's discretion) `PreviewColumn` flips to `flex-direction: column` with `align-items: stretch` below `md` (children take the full column width); from `md` up it keeps today's row with `align-items: flex-start`. Mobile-first base styles with an `md`-and-up override via MUI `theme.breakpoints` keeps the 900px value in one source of truth (the theme) — exact mechanics are the developer's choice; the spec stays behavioral.
- (agent's discretion) `PreviewToolbarRoot` flips its own axis the same way: buttons in a row below `md`, vertical column from `md` up; card styling (paper, border, radius, shadow), padding, and gap unchanged.
- (agent's discretion) the mobile toolbar row wraps (`flex-wrap: wrap`) instead of overflowing if it ever runs out of width — future-proofing for Feature 3's tools (today only the copy button exists). DESIGN.md: no horizontal overflow on mobile collapse.
- (agent's discretion) contracts preserved: children-composition, `preview-toolbar` / `preview-copy-button` testids, card styling, and the copy button as the first child — topmost on desktop, leftmost in the mobile row. Feature 3 tools will stack after it on desktop and follow it in the mobile row.
- **Supersedes ui-fixes**: the ui-fixes spec's agent-default assumption "Toolbar on mobile: stays beside the card on stacked layouts" (marked "n (agent default)", never user-confirmed) is superseded by this task's user-confirmed behavior.

### 2. Empty state as a tutorial hint

- **Content (user decision)**: single sentence only — "Select some snippets on the inputs to start" — styled as a hint. No numbered steps, no headline+steps, no mirroring the 4-step tutorial banner (options rejected; the Task 6.1 banner already teaches the full flow).
- **Alignment (user decision)**: keep centered — classic empty-state look (icon + sentence centered in the area). Only snippet text becomes left-aligned.
- (agent's discretion) the hint look already exists, so only the copy changes: keep the `Preview` icon (`aria-hidden`), the centered flex composition, and the `text.secondary` color.
- (agent's discretion) same i18n key `pages.mergeSession.previewArea.empty` is updated in BOTH `en-US.json` and `pt-BR.json` (suggested pt-BR: "Selecione alguns trechos nas entradas para começar"); final wording is reviewed during implementation (ui-fixes copy-authorship precedent: agent drafts, user reviews). Note for the review: GLOSSARY.md prefers "Source" over "input/entry" as the domain term — the en-US draft follows the user's picked phrasing; aligning it is the reviewer's call.
- (agent's discretion) `preview-empty` testid preserved; the empty state still disappears when the first snippet arrives (Task 4 contract, PREVA-04/05).

### 3. Left-aligned snippet text

- (agent's discretion on mechanics; the defect is the user's report) snippet chip text inherits `text-align: center` from the page `Wrapper`; the fix scopes `text-align: left` to the `SegmentFlow` in `PreviewArea.styles.ts` — the narrowest blast radius. The alternative (`PreviewAreaRoot`) was rejected as broader than needed: it would drag the empty state's centered sentence along.
- Multi-line snippets read left-aligned inside their chips; wrapping behavior (`white-space: pre-wrap`, `flex-wrap: wrap`) is unchanged.

### Testing

- (agent's discretion) jsdom has no layout engine and cannot evaluate media queries: unit tests assert base styles only. With a mobile-first base the `PreviewToolbar` suite's `flexDirection: 'column'` assertion must flip to the new base (row); the `position: static` assertion stays.
- (agent's discretion) `PreviewArea` suite: the empty-state test is updated for the new copy; a base-style assertion (`text-align: left` on the segment flow) is jsdom-resolvable and should be added (same pattern as the existing `toHaveStyle` assertions).
- (agent's discretion) the responsive behaviors (toolbar below/row at <900px; beside/column at ≥900px) are verified manually in the dev server — same prescription ui-fixes used for its min-height requirements.

### Terminology & records

- No GLOSSARY.md terms and no ADRs, same conclusion as ui-fixes: these are styling/UX chrome choices, trivially reversible; "hint" is UI chrome, not domain language; the ADR triple test fails on every count.

---

## Specific References

- Roadmap: no dedicated line item — post-Feature 2 polish from user review of the implemented page; refines Task 4 outputs (PreviewArea, empty state) and Task 6.4 (toolbar placement). Features 3–5 remain future. No roadmap status change expected from this task (nothing to check off).
- Precedent spec: `.specs/features/text-merging/tasks/ui-fixes/spec.md` + `implementation.md` — the toolbar-decoupling contract this task makes responsive; the superseded mobile assumption (assumptions table, "Toolbar on mobile"); the manual dev-server verification precedent; the copy-authorship precedent (agent drafts, user reviews).
- Task 4 spec: `.specs/features/text-merging/tasks/preview-area/spec.md` — PreviewArea/PreviewToolbar contracts (children composition, `preview-toolbar`/`preview-copy-button`/`preview-empty`/`preview-snippet` testids, empty ⇄ populated behavior PREVA-04/05, copy disabled at zero snippets).
- DESIGN.md: Layout ("Mobile collapse: all multi-column layouts collapse below 900px (MUI `md` breakpoint). No horizontal overflow."), Empty States ("Icon-based composition with descriptive text" — action button deliberately omitted here), Cards (toolbar card styling).
- GLOSSARY.md: Source, Snippet, Merge Mode (terms referenced by the hint copy; "hint" itself is chrome, not glossary material).
- Code: `artifacts/output-merger.UI/src/pages/MergeSession/MergeSessionPage.styles.ts` (`PreviewColumn`, `Wrapper`'s `text-align: center`), `MergeSessionPage.tsx` (`Grid size={{ xs: 12, md: 4 }}` composition), `components/PreviewToolbar/PreviewToolbar.styles.ts` + `PreviewToolbar.test.tsx`, `components/PreviewArea/PreviewArea.styles.ts` + `PreviewArea.tsx` + `PreviewArea.test.tsx`, `src/i18n/resources/en-US.json` / `pt-BR.json` (`pages.mergeSession.previewArea.empty`).

---

## Deferred Ideas

- Collapsing the mobile toolbar into a menu — unnecessary with one tool; revisit when Feature 3 raises the tool count.
- Mirroring the tutorial banner inside the empty state (headline + steps) — rejected by user decision (single sentence); the Task 6.1 banner already covers the full flow.
- An action button inside the empty state (DESIGN.md's "icon + text + action button" composition) — nothing to action yet; Start Merge lives in the ActionsBar.
- Removing `text-align: center` from the page `Wrapper` globally — broader refactor; the left-alignment is scoped to the segment flow instead.
- Animating the responsive flip (DESIGN.md motion rules) — later polish task.
- "Start Over" / "Add Text" ActionsBar buttons — Feature 5.
- Third source — Feature 4.
- Additional toolbar tools (drag-sort, split, line breaks, add-own-text) — Feature 3.
