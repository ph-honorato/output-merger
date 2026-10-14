# Merge Session UI Adjustments Specification

## Problem Statement

The Merge Session page is functionally complete (Tasks 1–5) but has four usability gaps: (1) a first-time user has no onboarding and must discover the needle-drag snippet selection by trial; (2) the source cards and preview area have no guaranteed height — columns collapse to their content height and jump when Start Merge flips modes; (3) the ActionsBar collapses from ~74px to ~34px when the Start Merge button hides on Merge Mode entry, shifting the whole grid; (4) the `PreviewToolbar` floats over the preview card's content (vertically centered, absolute) while the roadmap calls for a decoupled vertical bar at the preview's right with the copy button at its top. This specification defines Task 6 of Feature 2 (roadmap 6.1–6.4), the last task of Feature 2: a dismissable in-page tutorial with persisted dismissal and a Help reopen button, 400px minimum heights, a stable 74px ActionsBar, and a decoupled top-aligned toolbar.

## Goals

- [ ] A dismissable tutorial banner renders at the top of the page (below the subtitle, above the ActionsBar): title and a left-aligned numbered list of the four flow steps.
- [ ] Dismissal is persisted in `localStorage`; a Help icon button near the page title reopens the banner.
- [ ] All tutorial strings exist in en-US and pt-BR under `pages.mergeSession.tutorial.*`.
- [ ] TextInput cards and the PreviewArea card have `min-height: 400px` in both modes and on all breakpoints, growing with content; the input-mode textarea fills its card and never exceeds it.
- [ ] The ActionsBar has `min-height: 74px` and its rendered height does not change when the Start Merge button hides.
- [ ] The PreviewToolbar renders beside the preview card (right side, top-aligned, outside the card's border box) with the copy button as the topmost child; the SegmentFlow right-padding workaround is removed.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Interactive tooltip tour / component-highlighting walkthrough | User decision: heavy for v0; static numbered list chosen instead |
| Mode-aware tutorial content (input vs Merge Mode variants) | User decision: one static full-flow list; steps remain true in both states |
| Backend persistence of tutorial dismissal | V1 (Merges CRUD); v0 uses localStorage |
| "Start Over" / "Add Text" buttons | Feature 5; the fixed-height bar is built to host them |
| Third text input | Feature 4 |
| Additional toolbar tools (drag-sort, split, line breaks, add-own-text) | Feature 3; toolbar keeps its children-composition contract so tools stack below copy |
| Banner entry animations (DESIGN.md motion rules) | Deferred polish task |
| Fixed (non-growing) heights anywhere | User decision: `min-height` semantics — cards grow with content |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here - nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Tutorial format | Dismissable banner at top of page: title + left-aligned `<ol>` of 4 steps below the title | User decision ("numbered list aligned to left, under the main text"); intro text removed by user decision after implementation (2026-10-13); zero new dependencies, testable, i18n-friendly | y (grilled; intro removal — user decision) |
| Banner placement | Below the page subtitle, above the ActionsBar | "Top of the page" recommendation accepted; reads before the working area | n (agent default) |
| Tutorial content | Static full-flow list: type texts → Start Merge → drag handles to highlight → snippets in preview → copy | User decision; not mode-aware | y (grilled) |
| Dismissal persistence | `localStorage`, key `output-merger.tutorial.dismissed`, value `"true"` | User decision (persist across reloads); no backend in v0 | y (grilled) — key name is agent default |
| Reopen affordance | Icon-only Help button near the page title, aria-label `tutorial.help`; hidden while the banner is visible | User decision (Help button); placement/visibility are agent defaults | y (grilled) — placement n (agent default) |
| First-visit behavior | No flag ⇒ banner renders; flag read lazily on mount (no first-paint flash) | Avoids annoying returning users; avoids flash-of-tutorial | n (agent default) |
| localStorage failure | Absent/throwing storage is tolerated: treated as not-dismissed; writes swallowed | Privacy mode / embedded contexts; no crash over a tutorial | n (agent default) |
| Tutorial copy authorship | Agent drafts en-US + pt-BR in this spec (§ Draft Tutorial Copy); user reviews during implementation | User decision | y (grilled) |
| Min-height value & scope | 400px on TextInput cards (input AND view mode) and on the PreviewArea card, all breakpoints, grows with content | User decision; view-mode inclusion prevents the card shrink/jump on the Start Merge flip | y (grilled) |
| Textarea sizing | Input-mode `<textarea />` fills the card's content area and never exceeds the card (flex-grow / height 100%) | User wording was "max-height 100%"; a percentage max-height against an auto-height parent is inert CSS, so the intent is interpreted as fill-the-card | n (interpreted — confirm at implementation) |
| ActionsBar height | `min-height: 74px` (= spacing(2) padding ×2 + ~42px button height) | User decision; preserves current rendered height exactly, stays flexible for Feature 5 | y (grilled) |
| Toolbar decoupling | Toolbar moves outside the preview card: static sibling beside its right side, top-aligned; copy topmost; children-composition and testids preserved; SegmentFlow `padding-right` dropped; toolbar `z-index` removed | User decision ("outside the card entirely... no longer overlapping"); exact flex mechanics are agent default | y (grilled) — mechanics n (agent default) |
| Toolbar on mobile | Stays beside the card on stacked layouts (bar is ~48px wide) | Toolbar must remain reachable; no special-case hiding | n (agent default) |
| Component ownership | `TutorialBanner` as page sub-component under `src/pages/MergeSession/components/` with standard file split | Task 4 precedent: page-owned pieces live there, not `src/components/` | n (agent default) |
| i18n namespace | `pages.mergeSession.tutorial.*` (`.title`, `.step1`–`.step4`, `.dismiss`, `.help`) | Task 4 precedent: page-owned components use the page namespace | n (agent default) |
| Testing | One page-level test for the tutorial lifecycle; no new tests for 6.2–6.4; existing suites updated only if positioning/testids move | User decision | y (grilled) |
| data-testids | `merge-session-tutorial`, `tutorial-dismiss-button`, `merge-session-help-button`; existing `preview-toolbar`, `preview-copy-button`, `preview-area` preserved | Continuity with Task 4/5 suites | n (agent default) |
| Glossary / ADR | None | "Tutorial" is UI chrome, not domain language; all decisions trivially reversible | y (grilled) |

**Open questions:** none - all resolved or logged above (the textarea-sizing interpretation is flagged for confirmation during implementation review).

---

## Implicit-Requirement Dimensions

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | None; tutorial strings are static i18n; localStorage value is presence-checked, not parsed for meaning |
| Failure / partial-failure states | localStorage unavailable/throwing ⇒ tutorial shows each visit, writes swallowed, no crash |
| Idempotency / retry / duplicate handling | Repeated dismiss/reopen cycles re-write the same flag; rendering derives from one boolean |
| Auth boundaries & rate limits | N/A because there is no API |
| Concurrency / ordering | Single user, single tab in v0; a second tab's dismissal applies on next mount (no cross-tab sync) |
| Data lifecycle / expiry | Dismissal flag lives until the user clears browser storage; v1 may move it server-side |
| Observability | N/A because V0 has no metrics/logging requirement |
| External-dependency failure | localStorage is the only external surface and is wrapped defensively |
| State-transition integrity | Banner visible ⇄ hidden driven purely by `tutorialVisible` (mount-initialized from storage, dismiss → false, Help → true); page mode (input/Merge Mode) never affects it |

---

## User Stories

### P1: Tutorial banner ⭐ MVP

**User Story**: As a first-time merger, I want a short tutorial at the top of the page telling me how the merge flow works, so that I can use the session without trial and error.

**Why P1**: Roadmap 6.1; the needle-drag interaction is undiscoverable without it.

**Acceptance Criteria**:

1. WHILE no dismissal flag exists THEN the page SHALL render a tutorial banner below the page subtitle and above the ActionsBar.
2. The banner SHALL display the `pages.mergeSession.tutorial.title` text.
3. The banner SHALL display an ordered list of the four steps (`step1`–`step4`) aligned to the left, below the title.
4. The banner SHALL render a dismiss control (icon-only close button, aria-label `pages.mergeSession.tutorial.dismiss`); WHEN it is clicked THEN the banner SHALL disappear.

**Independent Test**: Render the page with cleared localStorage: banner visible under the subtitle with title and 4 steps in an `<ol>`; click the dismiss control: banner gone.

---

### P1: Dismissal persists across visits ⭐ MVP

**User Story**: As a returning merger, I want the tutorial to stay dismissed, so that it does not re-explain what I already know.

**Why P1**: Roadmap 6.1; without persistence the banner becomes noise.

**Acceptance Criteria**:

1. WHEN the dismiss control is clicked THEN `localStorage` SHALL be written with the dismissal flag (key `output-merger.tutorial.dismissed`, value `"true"`).
2. WHEN the page mounts with the flag set THEN the banner SHALL NOT render.
3. IF `localStorage` is absent or its access throws THEN the page SHALL treat the tutorial as not dismissed and SHALL NOT crash.

**Independent Test**: Dismiss the banner; assert the flag in localStorage; remount the page: banner absent; simulate a throwing localStorage: banner renders, no error.

---

### P1: Reopen via Help button ⭐ MVP

**User Story**: As a merger who dismissed the tutorial too early, I want a Help button to bring it back, so that I can re-read the steps any time.

**Why P1**: Roadmap 6.1; dismissal must not be a dead end in v0.

**Acceptance Criteria**:

1. WHILE the banner is hidden THEN an icon-only Help button with aria-label `pages.mergeSession.tutorial.help` SHALL render near the page title.
2. WHEN the Help button is clicked THEN the banner SHALL render again.
3. WHILE the banner is visible THEN the Help button SHALL be hidden (the banner carries its own dismiss control).
4. IF the banner is re-dismissed after reopening THEN the dismissal flag SHALL be written again and persist to the next mount.

**Independent Test**: Dismiss; Help button appears; click Help: banner renders and Help hides; dismiss again: flag still `"true"`.

---

### P1: Tutorial translations ⭐ MVP

**User Story**: As a pt-BR or en-US user, I want the tutorial in my language, so that I can follow the steps.

**Why P1**: AGENTS.md i18n rule; every user-facing string ships in both languages.

**Acceptance Criteria**:

1. All tutorial keys (`title`, `step1`–`step4`, `dismiss`, `help`) SHALL exist in both `en-US.json` and `pt-BR.json` under `pages.mergeSession.tutorial.*`.
2. WHEN the language is switched THEN all tutorial texts SHALL update to the active language.

**Independent Test**: Assert the keys exist in both resource files; render in pt-BR: steps in Portuguese; switch to en-US: steps in English.

---

### Draft Tutorial Copy (i18n)

Keys under `pages.mergeSession.tutorial` (user reviews/corrects wording during implementation):

| Key | en-US | pt-BR |
| --- | ----- | ----- |
| `title` | How it works | Como funciona |
| `step1` | Type or paste your texts into the input fields. | Digite ou cole seus textos nos campos de entrada. |
| `step2` | Click "Start Merge" to lock your texts and start selecting. | Clique em "Iniciar Merge" para travar seus textos e começar a seleção. |
| `step3` | Drag the handles that appear over the text to highlight the parts you want. | Arraste os marcadores que aparecem sobre o texto para destacar as partes desejadas. |
| `step4` | Your snippets appear in the preview. Copy the merged text when you are done. | Seus trechos aparecem na prévia. Copie o texto mesclado quando terminar. |
| `dismiss` | Dismiss tutorial | Fechar tutorial |
| `help` | Show tutorial | Mostrar tutorial |

---

### P1: Minimum heights for cards and preview ⭐ MVP

**User Story**: As a merger, I want the source cards and the preview to have a substantial minimum height, so that the columns look balanced and do not jump.

**Why P1**: Roadmap 6.2; today the cards collapse to content height and shrink further on the Start Merge mode flip.

**Acceptance Criteria**:

1. Each TextInput card root SHALL have `min-height: 400px` in input mode AND in view mode.
2. The PreviewArea card root SHALL have `min-height: 400px`.
3. The minimum heights SHALL apply on all breakpoints, mobile included.
4. The cards SHALL grow when their content exceeds 400px (min-height, never fixed height).
5. The input-mode `<textarea />` SHALL fill its card's content area and SHALL NOT exceed the card's bounds.

**Independent Test**: Manual dev-server verification: empty inputs and preview render ~400px tall cards on desktop and mobile; typing past 400px grows the card; flipping to Merge Mode keeps card heights; no jsdom layout assertions (jsdom does not compute layout).

---

### P1: Stable ActionsBar height ⭐ MVP

**User Story**: As a merger, I want the ActionsBar to keep its height when buttons appear or disappear, so that the page does not jump.

**Why P1**: Roadmap 6.3; the bar collapses from ~74px to ~34px when Start Merge hides, shifting the whole grid.

**Acceptance Criteria**:

1. The ActionsBar root SHALL have `min-height: 74px` (spacing(2) padding ×2 + standard button height).
2. WHEN the Start Merge button hides on Merge Mode entry THEN the ActionsBar's rendered height SHALL NOT change.
3. The bar SHALL remain free to grow for taller future content (min-height, not exact height).

**Independent Test**: Manual verification alongside the existing page test (start-merge flow); measure the bar before/after Start Merge in the dev server — identical height.

---

### P1: Decoupled vertical toolbar beside the preview ⭐ MVP

**User Story**: As a merger, I want the copy tool in a slim vertical bar beside my preview, so that it never covers my merged text.

**Why P1**: Roadmap 6.4; today the floating toolbar overlaps preview content and is vertically centered instead of top-aligned.

**Acceptance Criteria**:

1. The `PreviewToolbar` SHALL render beside the preview card's right side, top-aligned with the card, outside the card's border box, overlapping no preview content.
2. The `CopyMergedTextButton` SHALL be the topmost toolbar child; additional tools stack below.
3. The toolbar SHALL keep its children-composition contract (the page composes one child per tool) and its existing data-testids (`preview-toolbar`, `preview-copy-button`).
4. The `SegmentFlow` right-padding workaround SHALL be removed (nothing floats over the content anymore).
5. The toolbar's overlap-era `z-index` SHALL be removed.

**Independent Test**: Update the PreviewToolbar unit suite's positioning assertions (no longer absolute/centered); render the page: toolbar beside the card, copy topmost; long snippet text runs to the card's right edge with no padding gap and no overlap. Manual visual verification for the layout.

---

## Edge Cases

- IF `localStorage` is unavailable (privacy mode, embedded webview) THEN the tutorial renders on every visit and dismissal is a session-only hide; nothing crashes.
- IF the user dismisses in one language and reopens via Help after switching languages THEN all tutorial texts SHALL render in the active language (i18n is orthogonal to the flag).
- IF the user opens two tabs and dismisses in one THEN the other tab is unaffected until its next mount (no cross-tab sync in v0).
- IF the tutorial is dismissed THEN the page layout shifts up once — accepted one-time reflow (banner is above the working area).
- IF the banner text wraps on narrow screens THEN the step list SHALL remain left-aligned and wrap without horizontal overflow.
- IF the preview is empty THEN the toolbar SHALL still render beside the card with the copy button disabled (Task 4 contract unchanged).
- IF the toolbar renders on a stacked mobile layout THEN it SHALL remain beside the preview card (never hidden or repositioned).
- IF the user re-dismisses the tutorial after reopening THEN the flag is rewritten identically (idempotent).

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| UIFX-01 | Tutorial banner | Specify | Pending |
| UIFX-02 | Tutorial banner | Specify | Pending |
| UIFX-03 | Tutorial banner | Specify | Pending |
| UIFX-04 | Tutorial banner | Specify | Pending |
| UIFX-05 | Dismissal persists across visits | Specify | Pending |
| UIFX-06 | Dismissal persists across visits | Specify | Pending |
| UIFX-07 | Dismissal persists across visits | Specify | Pending |
| UIFX-08 | Reopen via Help button | Specify | Pending |
| UIFX-09 | Reopen via Help button | Specify | Pending |
| UIFX-10 | Reopen via Help button | Specify | Pending |
| UIFX-11 | Reopen via Help button | Specify | Pending |
| UIFX-12 | Tutorial translations | Specify | Pending |
| UIFX-13 | Tutorial translations | Specify | Pending |
| UIFX-14 | Minimum heights for cards and preview | Specify | Pending |
| UIFX-15 | Minimum heights for cards and preview | Specify | Pending |
| UIFX-16 | Minimum heights for cards and preview | Specify | Pending |
| UIFX-17 | Minimum heights for cards and preview | Specify | Pending |
| UIFX-18 | Minimum heights for cards and preview | Specify | Pending |
| UIFX-19 | Stable ActionsBar height | Specify | Pending |
| UIFX-20 | Stable ActionsBar height | Specify | Pending |
| UIFX-21 | Stable ActionsBar height | Specify | Pending |
| UIFX-22 | Decoupled vertical toolbar beside the preview | Specify | Pending |
| UIFX-23 | Decoupled vertical toolbar beside the preview | Specify | Pending |
| UIFX-24 | Decoupled vertical toolbar beside the preview | Specify | Pending |
| UIFX-25 | Decoupled vertical toolbar beside the preview | Specify | Pending |
| UIFX-26 | Decoupled vertical toolbar beside the preview | Specify | Pending |

**ID format:** `UIFX-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified; additionally **Deviated** (implemented with a changed contract — see `implementation.md`) and **Deferred** (not implemented — see `implementation.md`).

**Coverage:** 26 total. 0 Verified, 0 Deviated, 0 Deferred. Roadmap mapping: 6.1 → UIFX-01–13 (banner 01–04, persistence 05–07, Help reopen 08–11, translations 12–13); 6.2 → UIFX-14–18; 6.3 → UIFX-19–21; 6.4 → UIFX-22–26. Per-requirement outcomes: `.specs/features/text-merging/tasks/ui-fixes/implementation.md` (to be created by the developer sub-agent).

---

## Success Criteria

How we know the feature is successful:

- [ ] Fresh visit (cleared storage): tutorial banner renders under the subtitle with the title and the four left-aligned steps; dismissing hides it and writes the flag; reload keeps it hidden; the Help button reopens it; re-dismissal persists again.
- [ ] Tutorial texts read correctly in both en-US and pt-BR; switching languages updates them live.
- [ ] Input cards and the preview render ~400px tall in both modes and on mobile, growing with content; the mode flip causes no height jump; the textarea fills its card.
- [ ] The ActionsBar keeps identical height before and after Start Merge hides the button.
- [ ] The toolbar sits beside the preview card (right, top-aligned), copy button topmost, no content overlap, no residual right padding inside the segment flow.
- [ ] `npx vitest run`, `npm run lint`, and `npx tsc -b` all pass (tutorial lifecycle page test included; PreviewToolbar suite updated for new positioning).
