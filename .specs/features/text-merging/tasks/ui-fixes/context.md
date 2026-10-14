# Merge Session UI Adjustments (Task 6)

**Gathered:** 2026-10-10
**Spec:** `.specs/features/text-merging/tasks/ui-fixes/spec.md`
**Status:** Specified — awaiting implementation

---

## Feature Boundary

UI refinements for Feature 2 Task 6 (roadmap 6.1–6.4), the closing task of Feature 2: an in-page dismissable tutorial banner (title + left-aligned numbered step list, localStorage-persisted dismissal, Help reopen button, en-US + pt-BR copy), guaranteed minimum heights for the source cards and preview area (400px), a stable ActionsBar height (min-height 74px) that survives the Start Merge → hidden transition, and a decoupled PreviewToolbar that sits beside the preview card (right side, top-aligned, copy button topmost) instead of floating over its content. Not Start Over / Add Text (Feature 3), not the third input (Feature 4), not preview editing tools (Feature 5), not an interactive tooltip tour, not backend persistence (V1).

---

## Implementation Decisions

### Scope and delivery

- This grilling session specified Task 6 only (6.1–6.4). Two rounds of questions; all eight frontier questions answered.
- Task 6 is polish on existing components: TextInput, ActionsBar, PreviewArea, PreviewToolbar keep their contracts; only the tutorial adds a new component.

### Tutorial (6.1)

- **Format (user decision; intro text removed by user decision after implementation)**: dismissable banner at the top of the page (below the page subtitle, above the ActionsBar), containing the `tutorial.title` text and a numbered (`<ol>`) step list aligned to the left **below the title**. Not a modal, not a tooltip tour, not a collapsible panel — rejected as heavy for v0.
- **Content (user decision)**: one static list covering the full flow (type/paste texts → Start Merge → drag handles to highlight → snippets appear in preview → copy merged text). Not mode-aware; the steps remain true in both page states.
- **Visibility (user decision)**: shown by default on first visit; dismissable; dismissal persisted in `localStorage`; a small **Help icon button near the page title** reopens it.
- **Copy (user decision)**: agent drafts both en-US and pt-BR texts in the spec (§ Draft Tutorial Copy); user reviews/corrects wording during implementation.
- Page-owned component (precedent from Task 4): `TutorialBanner` under `src/pages/MergeSession/components/` with the standard file split and unit tests.
- Page owns `tutorialVisible` state: lazy-initialized from `localStorage` (no first-paint flash), written on dismiss, cleared-state never crashes (privacy-mode tolerance).

### Minimum heights (6.2)

- `min-height: 400px` (roadmap suggestion, confirmed) applied to the **TextInput cards (root)** — in input AND view mode, so cards do not shrink/jump on the Start Merge mode flip — and to the **PreviewArea card**, on **all breakpoints** (mobile included).
- `min-height` semantics only: cards grow with content (never fixed height).
- Input-mode `<textarea />` elements: user wording was "always have max-height 100%". A percentage max-height against an auto-height parent is inert CSS, so the spec interprets the intent as: **the textarea fills the card's content area and never exceeds the card** (flex-grow / height 100%), making the 400px minimum visible in the typing surface. Flagged in the spec's assumptions table for confirmation during implementation.

### ActionsBar (6.3)

- `min-height: 74px` on `ActionsBarRoot` (= spacing(2) padding ×2 + ~42px standard button height), preserving the current rendered height exactly.
- Rationale: the bar collapses to ~34px today when Start Merge hides on Merge Mode entry; Feature 3's Start Over will reoccupy the slot. `min-height` (not exact height) keeps flexibility for taller future content.

### Decoupled toolbar (6.4)

- **User decision**: the vertical bar moves **outside the preview card entirely** — its own top-aligned element beside the card's right side, no longer overlapping preview content. Copy button stays the topmost child; future tools stack below (Feature 5).
- `PreviewToolbar` keeps its children-composition contract and testids; only positioning styles change (absolute overlay → static sibling beside the card; `PreviewColumn` becomes a flex row, `align-items: flex-start`).
- The `padding-right` workaround in `SegmentFlow` (added in Task 4 to keep text out from under the floating toolbar) is dropped.

### i18n

- All tutorial strings under `pages.mergeSession.tutorial.*` (`.title`, `.step1`–`.step4`, `.dismiss`, `.help`) — en-US and pt-BR. Draft wording in the spec; user reviews during implementation.

### Testing (user decision)

- One page-level integration test for the tutorial lifecycle (renders → dismiss → persisted via localStorage → reopen via Help).
- No new tests for 6.2–6.4 styling changes; existing suites updated only if positioning assertions/testids move (PreviewToolbar's position assertion is expected to change).

### Terminology & records

- No new GLOSSARY.md terms ("Tutorial" is UI chrome, not domain language); no ADR (all decisions are trivially reversible styling/UX choices — the ADR triple test fails on every count).

### Agent's Discretion

- localStorage key: `output-merger.tutorial.dismissed` (value `"true"`), namespaced for future tutorials.
- Help button: MUI `HelpOutline` icon, icon-only, hidden while the banner is visible (the banner carries its own dismiss control); re-dismissal re-writes the same flag.
- Dismiss control: icon-only close (X) icon button, top-right of the banner.
- Banner styling per DESIGN.md Cards (paper surface, 1px border, 0.75rem radius, subtle shadow); the ordered list is `text-align: left` inside the page's centered layout.
- Toolbar keeps z-index removed (no overlap ⇒ irrelevant).
- data-testids: `merge-session-tutorial`, `tutorial-dismiss-button`, `merge-session-help-button`; existing `preview-toolbar`, `preview-copy-button`, `preview-area` preserved.

---

## Specific References

- Roadmap Feature 2 Task 6.1–6.4 (tutorial, textarea min-heights, ActionsBar fixed height, copy button in a decoupled vertical bar).
- Task 4 (preview-area): PreviewToolbar floating contract being revised; SegmentFlow padding-right workaround; CopyMergedTextButton topmost-child placement.
- Task 5 (start-merge): the button-hide transition that collapses the ActionsBar today; `mergeStarted` page state.
- DESIGN.md: Cards, Empty States, z-index contract, "No 3-column equal-width feature layouts" (page grid predates and keeps its 3 working columns), motion deferred.
- GLOSSARY.md: Source, Snippet, Merged Text, Merge Mode (terms used in the tutorial copy).

---

## Deferred Ideas

- Interactive tooltip tour / mode-aware tutorial content — rejected for v0 (may be revisited post-V1 if users still get lost).
- Backend persistence of tutorial dismissal — V1 (Merges CRUD).
- "Start Over" / "Add Text" ActionsBar buttons — Feature 3 (the fixed bar height is built to host them).
- Third source — Feature 4.
- Additional toolbar tools (drag-sort, split, line breaks, add-own-text) — Feature 5.
- Entry animations for the banner per DESIGN.md motion rules — later polish task.
