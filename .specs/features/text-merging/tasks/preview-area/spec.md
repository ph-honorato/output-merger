# Preview Area Specification

## Problem Statement

The merge session aggregates snippets in the global snippets context (Task 3), but column 3 still renders the invisible placeholder stub created in Task 2. The user cannot see which snippets they selected, in what order, or from which source, and cannot extract the merged text. This specification defines Task 4 of Feature 2 (roadmap 4.1–4.4): a read-only preview of the merge-ordered snippets with source color highlighting, a floating vertical toolbar on its right side, and a copy tool that writes the Merged Text to the clipboard with toast feedback — not user text editing (deferred, see Out of Scope), not drag-sorting/splitting/line-break tools (Feature 3), not Start Merge (Task 5).

## Goals

- [ ] `PreviewArea` (page sub-component) renders one colored segment per context snippet, in merge order, as a wrapping flow.
- [ ] An empty state (icon + descriptive text) renders while no snippets exist.
- [ ] A floating vertical `PreviewToolbar` sits at the right side of the preview area, composed of icon buttons (extensible via children) with hover feedback.
- [ ] `CopyMergedTextButton` (the first toolbar action) writes the space-joined Merged Text to the clipboard: disabled at zero snippets, toast on success, silent on failure.
- [ ] The invisible stub in `src/components/PreviewArea/` is deleted (replaced by the real page-owned component).

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| User text editing / editing model (free typing, caret behavior, atomic islands vs free-form) | Deferred by user decision: north star is "the user edits text however they want" plus snippet reordering; the model will be discussed at Feature 3. Task 4 must not block it (see Forward Direction below) |
| Drag-sort / snippet reordering | Feature 3 |
| Splitting snippets, line breaks, add-own-text tools | Feature 3; their necessity will be re-discussed (typing may replace tools) |
| Start Merge mode switching | Feature 2 Task 5 |
| Third text input | Feature 5 |
| Persistence | V1 (Merges CRUD) |
| Placement under `src/components/` (reusable) | User decision: preview pieces are page-owned, under `src/pages/MergeSession/components/` |

### Forward Direction (not a decision, deliberately unlocked)

The user's stated goal for later features: the preview becomes editable text ("however they want") while snippets remain reorderable units. Task 4 therefore builds a **dumb, data-driven read-only display** (map over context snippets, no display-only state beyond the toast) so a future editor can replace the content rendering without touching the context, the toolbar, or the copy tool. No editing model is locked here.

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here - nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Display form | Wrapping flow of segments, one per snippet, each an independent colored unit | "Side by side"; per-snippet units give future drag-sort natural anchors | y (grilled) |
| Segment tint | `snippet.color` at 0.3 alpha, text in palette primary | Consistent with TextInput's committed highlight styling | y (grilled) |
| Merged Text separator | Single space between snippet texts | Word-aligned fragments may lack edge whitespace; concatenation jams words | y (grilled) |
| Copy tool shape | Floating vertical toolbar with multiple icon buttons; copy is the first | User decision (replaces the single "sideway button") | y (grilled) |
| Hover feedback | Icon-button hover background fill (MUI default) | "Basic user visual return" per user | y (grilled) |
| Copy feedback | Toast: "Text copied to clipboard" / "Texto copiado para área de transferência" | User-supplied copy, MUI Snackbar | y (grilled) |
| Empty state | Icon + i18n text, no action button | DESIGN.md Empty States; nothing to action yet | y (grilled) |
| Icon system | `@mui/icons-material` (installed) | DESIGN.md's "Lucide, Heroicons" read as template text; MUI icons are the installed system | y (grilled) |
| Domain term | "Merged Text" for the copied output string | GLOSSARY.md; roadmap said "full built text" | y (grilled) |
| Ownership & location | Page sub-components under `src/pages/MergeSession/components/` | User decision (SRP: not reusable components) | y (grilled) |
| Context consumption | Each preview piece consumes `useSnippets()` directly | User decision; page passes no snippet props | y (grilled) |
| i18n namespace | `pages.mergeSession.previewArea.*` (`.empty`, `.copy.button`, `.copy.toast`) | User decision; page-owned components use the page namespace | y (grilled) |
| Stub fate | `src/components/PreviewArea/` deleted with its barrel export | Task 4.1 "replacing the placeholder stub" | y (grilled) |
| Unit tests | One suite per page sub-component; no page-level integration test | Standing user rule | y (grilled) |
| Toolbar position | Absolutely positioned inside the preview column, right edge, vertically centered | "Floating... right side"; page wrapper provides the relative anchor | n (agent default) |
| Toolbar z-index | 1 (above base content; DESIGN.md's contract reserves 100+ for nav/overlay/modal/toast) | Floating control over content | n (agent default) |
| Toast placement & timing | Bottom-center, auto-hide 2500ms | MUI Snackbar defaults are acceptable | n (agent default) |
| Clipboard failure | Silent no-op (no toast, no error UI) | Non-secure contexts/permission denials are rare; no error infrastructure in v0 | n (agent default) |
| Merged Text builder | Pure exported `buildMergedText(snippets)` in the copy button's hook file | Single consumer today; moves if Feature 3 needs it elsewhere | n (agent default) |
| Empty-state icon | MUI `Preview` icon | Neutral, thematic | n (agent default) |
| Content/toolbar overlap | Segment flow gets right padding so text never flows under the floating toolbar | Readability | n (agent default) |
| data-testids | `preview-area`, `preview-snippet`, `preview-toolbar`, `preview-copy-button`, `preview-copy-toast` | Stub continuity (`preview-area` kept) | n (agent default) |

**Open questions:** none - all resolved or logged above (required before the spec is confirmed).

---

## Implicit-Requirement Dimensions

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | None; context data is trusted (Task 3 contract) |
| Failure / partial-failure states | Clipboard write failure is a silent no-op |
| Idempotency / retry / duplicate handling | Copy is naturally idempotent; repeated clicks re-write the same Merged Text |
| Auth boundaries & rate limits | N/A because there is no API |
| Concurrency / ordering | Display derives from the always-sorted context list; no local ordering state |
| Data lifecycle / expiry | No local data beyond the transient toast flag; unmount clears it |
| Observability | N/A because V0 has no metrics/logging requirement |
| External-dependency failure | `navigator.clipboard` may be absent (non-secure context): silent failure |
| State-transition integrity | empty ⇄ populated driven purely by context; toast open ⇄ closed driven by copy click + auto-hide |

---

## User Stories

### P1: Render snippets in the merge order ⭐ MVP

**User Story**: As a merger, I want every snippet I selected shown in the preview in merge order, tinted with its source color, so that I can see my merged output taking shape.

**Why P1**: Roadmap 4.2–4.3; the preview's core purpose.

**Acceptance Criteria**:

1. WHILE one or more snippets exist in the context THEN `PreviewArea` SHALL render exactly one segment per snippet, in merge order.
2. WHEN a segment renders THEN it SHALL display that snippet's `text`.
3. WHEN a segment renders THEN its background SHALL be the snippet's `color` at 0.3 alpha.

**Independent Test**: Provide two interleaved sources (A1, B1, A2) through a `SnippetsProvider`; assert three segments in order with texts A1, B1, A2 and tinted backgrounds.

---

### P1: Empty state ⭐ MVP

**User Story**: As a merger, I want a clear placeholder before I select anything so that the preview column does not look broken.

**Why P1**: Roadmap 4.1; the preview is the first thing the user sees.

**Acceptance Criteria**:

1. WHILE zero snippets exist THEN `PreviewArea` SHALL render an icon plus the `pages.mergeSession.previewArea.empty` text and SHALL render no segments.
2. WHEN the first snippet arrives THEN the empty state SHALL disappear and the segment SHALL render.

**Independent Test**: Render with an empty context: empty text visible, no `preview-snippet`; dispatch one snippet: segment appears, empty text gone.

---

### P1: Floating preview toolbar ⭐ MVP

**User Story**: As a merger, I want a floating vertical toolbar on the preview's right side holding icon tools so that actions sit next to the content they act on.

**Why P1**: Roadmap 4.4's "sideway copy tool" generalizes into an extensible toolbar (user decision).

**Acceptance Criteria**:

1. The `PreviewToolbar` SHALL float vertically at the right side of the preview area (absolute position, vertically centered) and SHALL render above the preview content.
2. The `PreviewToolbar` SHALL accept `children` (one per tool), composed by the page — the toolbar owns no actions of its own.
3. WHILE a toolbar icon button is hovered THEN it SHALL show a background fill feedback.

**Independent Test**: Render the toolbar with a stub icon child; assert `preview-toolbar` is position-absolute, column-oriented, and contains the child; assert the icon button has hover styling (MUI default).

---

### P1: Copy Merged Text with toast ⭐ MVP

**User Story**: As a merger, I want one click to copy the full Merged Text so that I can use my merged output elsewhere.

**Why P1**: Roadmap 4.4; the session's payoff.

**Acceptance Criteria**:

1. WHEN the copy button is clicked WHILE snippets exist THEN it SHALL call `navigator.clipboard.writeText` with the Merged Text: snippet `text` values joined by a single space in merge order.
2. The copy button SHALL be disabled WHILE zero snippets exist.
3. WHEN the clipboard write resolves THEN a toast SHALL show the `pages.mergeSession.previewArea.copy.toast` text and SHALL auto-hide after ~2.5s.
4. IF the clipboard write rejects or the clipboard API is absent THEN the click SHALL be a silent no-op (no toast, no error UI).
5. The copy button SHALL be icon-only with the `pages.mergeSession.previewArea.copy.button` aria-label.

**Independent Test**: Mock the clipboard; render with two snippets; click; assert `writeText` called with `"A B"` (space-joined) and the toast text appears; render with zero snippets; assert the button is disabled.

---

## Edge Cases

- IF the clipboard API is absent (non-secure context) THEN copy SHALL be a silent no-op.
- IF the snippet list changes WHILE the toast is visible THEN the toast SHALL be unaffected (transient feedback only).
- IF a snippet's text contains leading/trailing whitespace THEN it SHALL be copied verbatim (only the between-snippet separator is added; no trimming).

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| PREVA-01 | Render snippets in the merge order | Specify | Verified |
| PREVA-02 | Render snippets in the merge order | Specify | Verified |
| PREVA-03 | Render snippets in the merge order | Specify | Verified |
| PREVA-04 | Empty state | Specify | Verified |
| PREVA-05 | Empty state | Specify | Verified |
| PREVA-06 | Floating preview toolbar | Specify | Verified |
| PREVA-07 | Floating preview toolbar | Specify | Verified |
| PREVA-08 | Floating preview toolbar | Specify | Verified |
| PREVA-09 | Copy Merged Text with toast | Specify | Verified |
| PREVA-10 | Copy Merged Text with toast | Specify | Verified |
| PREVA-11 | Copy Merged Text with toast | Specify | Verified |
| PREVA-12 | Copy Merged Text with toast | Specify | Verified |
| PREVA-13 | Copy Merged Text with toast | Specify | Verified |

**ID format:** `PREVA-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified; additionally **Deviated** (implemented with a changed contract — see `implementation.md`) and **Deferred** (not implemented — see `implementation.md`).

**Coverage:** 13 total. 13 Verified, 0 Deviated, 0 Deferred. Roadmap mapping: 4.1 → PREVA-01–05 (+ stub deletion, see `implementation.md`); 4.2 → PREVA-01; 4.3 → PREVA-02–03; 4.4 → PREVA-06–13. Per-requirement outcomes: `.specs/features/text-merging/tasks/preview-area/implementation.md`.

---

## Success Criteria

How we know the feature is successful:

- [ ] Selecting snippets across both inputs shows them in the preview in selection order, each tinted with its source color; the empty state shows at startup.
- [ ] The floating toolbar shows the copy tool; one click writes the space-joined Merged Text to the clipboard and shows the toast.
- [ ] The copy tool is disabled until the first snippet exists.
- [ ] `npx vitest run`, `npm run lint`, and `npx tsc -b` all pass; the invisible stub is gone.
