# Text Input Specification

## Problem Statement

Merge Session needs a reusable source-text control so a user can type (or paste) up to 500 characters, then mark word-aligned spans as snippets for later merge. The control does not exist yet; Merge Session is title and subtitle only. This specification defines Task 1 of Feature 2 (roadmap 1.1–1.8): input and view modes, needle-based selection, snippet model, callbacks, and color — not page layout, preview, or global snippet context.

## Goals

- [ ] A `TextInput` component supports `input` mode (textarea, 500-character cap) and `view` mode (read-only text with needles and highlights).
- [ ] In view mode the user can create, resize, and remove snippets that are word-stop aligned, non-overlapping (abutting allowed), and emitted through `onChange`.
- [ ] Pointer (hover needle) and touch (press-and-hold nearest needle) create the same snippet model.
- [ ] Snippet records match `{ id, text, startIndex, endIndex, color }` with a default highlight color of `#FF1493` and a `highlightColor` override.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| MergeSession three-column layout, ActionsBar, two wired inputs | Feature 2 Task 2 |
| PreviewArea | Feature 2 Task 3 |
| Global snippets context | Feature 2 Task 4 |
| Start Merge switching page-level mode | Feature 2 Task 5; this spec only defines the `mode` prop the parent will set |
| Third text input | Feature 3 |
| Preview reorder, line breaks, split, user-typed preview text | Feature 4 |
| Native `window.getSelection()` snippet creation | Grilled: needles only |
| Overlapping / stacked / merged snippets | Grilled: overlap forbidden |
| Splitting a snippet from an interior stop | Feature 4; interior stops are hidden |
| Keyboard needle navigation (beyond native textarea in input mode) | Assumed out until a later task |
| Lifting snippet state into React context | Task 4; this component owns snippet state and reports via `onChange` |
| Backend persistence | V1 |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here - nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Character cap unit | JavaScript `string.length` / native `maxLength={500}` (UTF-16 code units, not grapheme clusters) | Matches HTML textarea behavior; grilled as 500 characters | y |
| Snippet ranges | Half-open `[startIndex, endIndex)` in UTF-16 indices; `text === value.slice(startIndex, endIndex)` | Abutting (`end === next.start`) shares no character | y |
| Live drag preview | WHILE a create or resize drag is active, the prospective range is highlighted | User needs feedback before mouseup/touchend | n (agent default) |
| Mouse create gesture | Hover stop → one grab needle; `pointerdown` on that needle + move to another stop + `pointerup` commits (no extra long-press delay) | Long-press is the touch discoverability gesture, not mouse | n (agent default from “hold and drag”) |
| Touch reveal delay | Press-and-hold ~400ms on the text reveals the nearest word-stop needle | Coarse pointers have no hover | n (agent default) |
| Touch needle size | Coarse-pointer needle hit target at least 44 CSS pixels | Finger occlusion | n (agent default) |
| Snippet `id` | UUID (`crypto.randomUUID()` or equivalent unique string) | Roadmap `{id, ...}` | n (agent default) |
| Text props | Parent-controlled `value` and `onValueChange` in input mode | Parent must own the source string for later columns | n (agent default) |
| Snippet props | Uncontrolled internal snippet list; `onChange(snippets)` after every mutation | Task 4 will lift; Task 1 stays a complete component | n (agent default) |
| Default `mode` | `'input'` | Matches compose-then-merge; Task 5 later sets `'view'` | y |
| Empty value in view | Render empty text; show no create needles | No stops to hover | n (agent default) |
| Newlines in view | CSS `white-space: pre-wrap` (or equivalent) so input newlines remain visible | Source text must round-trip visually | n (agent default) |
| Default highlight | `#FF1493` (Aurora magenta from `design.md`) | Roadmap 1.8 default + design token; MUI theme secondary is purple and is not used | y |
| Reverse drag | If the pointer ends at a stop before the origin, the range is normalized so `startIndex < endIndex` | Same snippet regardless of drag direction | n (agent default) |
| IME / paste over cap | Browser `maxLength` truncation; remaining counter shows `500 - value.length` (floor 0) | No extra toast | n (agent default) |
| Counter / needle chrome copy | i18n keys in en-US and pt-BR at implementation time | Project rule for UI text | n (agent default) |

**Open questions:** none - all resolved or logged above (required before the spec is confirmed).

---

## Implicit-Requirement Dimensions

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | 500 UTF-16 code units; word-stop alignment; overlap reject |
| Failure / partial-failure states | Invalid create/resize is silent (no snippet, resize snaps back). No network. |
| Idempotency / retry / duplicate handling | N/A because there is no request/retry. Click-delete of a missing id is a no-op. |
| Auth boundaries & rate limits | N/A because the component is local UI with no API. |
| Concurrency / ordering | Single pointer gesture at a time. `onChange` order is mutation order. |
| Data lifecycle / expiry | Snippets live until delete, overlap-reject leaves them, or `mode` becomes `input` (clears all). No TTL. |
| Observability | N/A because V0 has no metrics/logging requirement for this control. |
| External-dependency failure | N/A because no external services. |
| State-transition integrity | `input` ↔ `view` via parent `mode`. Snippets exist only while `mode === 'view'`. Entering `input` clears snippets and SHALL emit `onChange([])`. |

---

## User Stories

### P1: Compose source text in input mode ⭐ MVP

**User Story**: As a merger, I want to type or paste up to 500 characters in a textarea so that I can provide source text for later highlighting.

**Why P1**: Roadmap 1.1; nothing else works without a source string.

**Acceptance Criteria**:

1. WHILE `mode` is `input` the TextInput SHALL render a textarea whose `value` is the `value` prop and SHALL not render snippet highlights or create needles.
2. WHEN the user changes the textarea THEN the TextInput SHALL call `onValueChange` with the new string and SHALL not call `onChange` with a new snippet list solely because of typing.
3. IF the user types or pastes so the string would exceed 500 UTF-16 code units THEN the TextInput SHALL keep `value.length` at most 500.
4. WHILE `mode` is `input` the TextInput SHALL display a remaining-count equal to `500 - value.length`.
5. The TextInput SHALL use `input` as the default `mode` when the parent omits `mode`.

**Independent Test**: Render `<TextInput />` with no mode prop, type 501 characters, assert textarea length is 500, remaining count is 0, and no snippet `onChange` from typing.

---

### P1: Read source text in view mode ⭐ MVP

**User Story**: As a merger, I want to see the same source text without a textarea so that I can mark snippets on a stable string.

**Why P1**: Roadmap 1.2; needles require a non-textarea presentation.

**Acceptance Criteria**:

1. WHILE `mode` is `view` the TextInput SHALL not render a textarea and SHALL render the `value` string with newline characters preserved visually (`pre-wrap` or equivalent).
2. WHEN the parent changes `mode` from `view` to `input` THEN the TextInput SHALL discard every snippet and SHALL call `onChange` with an empty array.
3. WHEN the parent changes `mode` from `input` to `view` THEN the TextInput SHALL show zero snippets until the user creates one.
4. IF `value` is empty WHILE `mode` is `view` THEN the TextInput SHALL render no create needles.

**Independent Test**: Mount with `mode="view"` and a multiline `value`; assert no textarea, newlines visible, then switch to `input` and assert `onChange([])`.

---

### P1: Word stops ⭐ MVP

**User Story**: As a merger, I want needles only at Unicode word and punctuation stops so that snippets snap to readable tokens, not arbitrary characters.

**Why P1**: Roadmap 1.3; every create/resize lands on these stops.

**Acceptance Criteria**:

1. The TextInput SHALL treat a word stop as the start or end UTF-16 index of a token, where a token is either a maximal run of Unicode letters or decimal numbers (plus combining marks on those characters) or a single punctuation character, and SHALL not treat whitespace as a token.
2. WHEN `value` is `Hello, world` THEN the TextInput SHALL expose word stops at indices `0, 5, 6, 7, 12` (tokens `Hello` `[0,5)`, `,` `[5,6)`, `world` `[7,12)`).
3. WHILE `mode` is `view` and the pointer is a fine pointer (mouse), WHEN the pointer hovers a word stop that is not interior to an existing snippet THEN the TextInput SHALL show exactly one grab needle at that stop and SHALL not show grab needles at other stops.

**Independent Test**: Unit-test the stop list for `Hello, world` and for strings with punctuation and extra spaces; in view mode hover a stop and assert a single needle.

---

### P1: Create a snippet by dragging a needle ⭐ MVP

**User Story**: As a merger, I want to pick up a needle at a word stop and drag it across other words so that releasing the pointer creates a highlighted snippet.

**Why P1**: Roadmap 1.3–1.4; core selection mechanic.

**Acceptance Criteria**:

1. WHILE `mode` is `view` and a fine pointer, WHEN the user `pointerdown`s the visible grab needle, moves to a different word stop, and `pointerup`s THEN the TextInput SHALL append one snippet whose `startIndex` and `endIndex` are those two stops, ordered so `startIndex < endIndex`, whose `text` equals `value.slice(startIndex, endIndex)`, and whose `color` equals the effective highlight color.
2. WHILE a create drag is active the TextInput SHALL highlight the prospective `[start, end)` range before commit.
3. IF create `pointerup` occurs on the same word stop as `pointerdown` THEN the TextInput SHALL not add a snippet.
4. IF the committed range would share one or more characters with an existing snippet THEN the TextInput SHALL not add a snippet and SHALL show no error toast or inline error.
5. WHEN a snippet is committed THEN the TextInput SHALL highlight that range in the effective highlight color and SHALL show resize needles at both `startIndex` and `endIndex`.
6. WHILE `mode` is `view`, the TextInput SHALL not create snippets from native DOM text selection.

**Independent Test**: In view mode, drag from stop 0 to stop 5 on `Hello, world`; assert one snippet `{ text: "Hello", startIndex: 0, endIndex: 5 }`; drag 0→0; assert still one snippet; drag a range that covers an existing snippet; assert still one snippet and no error node.

---

### P1: Resize, multiple snippets, and delete ⭐ MVP

**User Story**: As a merger, I want several non-overlapping snippets I can resize from both ends or remove by clicking the highlight so that I can correct my selection.

**Why P1**: Roadmap 1.5–1.6 plus grilled delete.

**Acceptance Criteria**:

1. WHILE `mode` is `view` the TextInput SHALL allow more than one snippet in the same `value` provided their half-open ranges do not share a character (abutting `endIndex === other.startIndex` is allowed).
2. WHEN the user drags a snippet’s start or end resize needle to another word stop and releases THEN the TextInput SHALL update that snippet’s `startIndex`, `endIndex`, and `text` to the new ordered range if the range has positive length and does not overlap another snippet.
3. IF a resize drop would overlap another snippet or would have zero length THEN the TextInput SHALL keep the snippet’s previous range (snap back) and SHALL show no error toast or inline error.
4. WHILE a snippet highlight is shown, the TextInput SHALL not show create needles on word stops strictly interior to that snippet (`startIndex < stop < endIndex`); resize needles remain at the ends.
5. WHEN the user clicks or taps the highlighted body of a snippet (not a needle) THEN the TextInput SHALL remove that snippet.
6. WHEN a needle is dragged the TextInput SHALL not treat that gesture as a delete.

**Independent Test**: Create `[0,5)` and `[7,12)` on `Hello, world`; assert both exist; resize first end to 6 (`Hello,`); click the first highlight; assert only `[7,12)` remains; attempt resize of `[7,12)` to overlap a restored first snippet and assert snap-back.

---

### P1: Callback, identity, and color ⭐ MVP

**User Story**: As a parent page, I want every snippet mutation as an array plus a color I can override so that later preview and context layers can consume a stable contract.

**Why P1**: Roadmap 1.7–1.8.

**Acceptance Criteria**:

1. WHEN snippets are created, resized, deleted, or cleared by a mode change THEN the TextInput SHALL call `onChange` with the full current array of snippet objects.
2. The TextInput SHALL give each new snippet an `id` that is a unique string among snippets currently in the array.
3. The TextInput SHALL include `id`, `text`, `startIndex`, `endIndex`, and `color` on every snippet object it emits.
4. WHEN the parent omits `highlightColor` THEN new snippets SHALL use `color` `#FF1493`.
5. WHEN the parent passes `highlightColor` THEN new snippets SHALL use that `color` value.

**Independent Test**: Spy `onChange`; create two snippets; delete one; assert each call receives the full array; assert default color `#FF1493` then rerender with `highlightColor="#0080FF"` and create another snippet with that color.

---

### P1: Touch parity ⭐ MVP

**User Story**: As a merger on a phone, I want to create and edit snippets with a finger so that hover-only needles do not block mobile use.

**Why P1**: Grilled: touch is in Task 1 scope; Merge Session stacks on small viewports.

**Acceptance Criteria**:

1. WHERE the pointer is coarse (touch), WHEN the user press-and-holds on the view text THEN the TextInput SHALL reveal one grab needle at the nearest word stop that is not interior to an existing snippet.
2. WHILE `mode` is `view` on a coarse pointer, only the revealed or snippet-end needles SHALL be draggable; pointer movement on the rest of the text SHALL not start a create/resize gesture (the text may scroll).
3. WHEN the user taps a snippet highlight body (not a needle) THEN the TextInput SHALL remove that snippet.
4. WHEN a touch create or resize drag ends on a valid pair of word stops THEN the TextInput SHALL commit or update the snippet with the same rules as a fine pointer (normalize, overlap silent reject, abutting allowed).

**Independent Test**: Simulate touch: press-and-hold near index 0, drag to stop 5, release; assert snippet `Hello`; tap the highlight; assert `onChange([])`; verify a drag that does not start on a needle does not create a snippet.

---

## Edge Cases

- IF `value` contains only whitespace THEN the TextInput SHALL expose no word stops and SHALL not create snippets.
- IF `onChange` or `onValueChange` is omitted THEN the TextInput SHALL still update its internal snippet list (and controlled `value` still requires `onValueChange` for typing to persist — parent must pass it when using input mode).
- WHEN two snippets abut THEN both SHALL remain.
- WHEN `value` is replaced by the parent WHILE `mode` is `view` THEN the TextInput SHALL clear all snippets and call `onChange([])` because stored indices would be invalid.

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| TXTIN-01 | P1: Compose source text | Specify | Deviated |
| TXTIN-02 | P1: Compose source text | Specify | Deviated |
| TXTIN-03 | P1: Compose source text | Specify | Verified |
| TXTIN-04 | P1: Compose source text | Specify | Deviated |
| TXTIN-05 | P1: Compose source text | Specify | Verified |
| TXTIN-06 | P1: Read source text in view mode | Specify | Verified |
| TXTIN-07 | P1: Read source text in view mode | Specify | Deviated |
| TXTIN-08 | P1: Read source text in view mode | Specify | Verified |
| TXTIN-09 | P1: Read source text in view mode | Specify | Deviated |
| TXTIN-10 | P1: Word stops | Specify | Deviated |
| TXTIN-11 | P1: Word stops | Specify | Deviated |
| TXTIN-12 | P1: Word stops | Specify | Verified |
| TXTIN-13 | P1: Create a snippet by dragging a needle | Specify | Verified |
| TXTIN-14 | P1: Create a snippet by dragging a needle | Specify | Verified |
| TXTIN-15 | P1: Create a snippet by dragging a needle | Specify | Verified |
| TXTIN-16 | P1: Create a snippet by dragging a needle | Specify | Verified |
| TXTIN-17 | P1: Create a snippet by dragging a needle | Specify | Deviated |
| TXTIN-18 | P1: Create a snippet by dragging a needle | Specify | Verified |
| TXTIN-19 | P1: Resize, multiple snippets, and delete | Specify | Verified |
| TXTIN-20 | P1: Resize, multiple snippets, and delete | Specify | Verified |
| TXTIN-21 | P1: Resize, multiple snippets, and delete | Specify | Deviated |
| TXTIN-22 | P1: Resize, multiple snippets, and delete | Specify | Verified |
| TXTIN-23 | P1: Resize, multiple snippets, and delete | Specify | Deferred |
| TXTIN-24 | P1: Resize, multiple snippets, and delete | Specify | Deviated |
| TXTIN-25 | P1: Callback, identity, and color | Specify | Verified |
| TXTIN-26 | P1: Callback, identity, and color | Specify | Verified |
| TXTIN-27 | P1: Callback, identity, and color | Specify | Verified |
| TXTIN-28 | P1: Callback, identity, and color | Specify | Deviated |
| TXTIN-29 | P1: Callback, identity, and color | Specify | Verified |
| TXTIN-30 | P1: Touch parity | Specify | Deferred |
| TXTIN-31 | P1: Touch parity | Specify | Deviated |
| TXTIN-32 | P1: Touch parity | Specify | Deferred |
| TXTIN-33 | P1: Touch parity | Specify | Deviated |

**ID format:** `TXTIN-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified; additionally **Deviated** (implemented with a changed contract — see `implementation.md` §7) and **Deferred** (not implemented — see `implementation.md` §9).

**Coverage:** 33 total. 17 Verified, 13 Deviated, 3 Deferred. Roadmap mapping: 1.1 → TXTIN-01–05; 1.2 → TXTIN-06–09; 1.3 → TXTIN-10–12, TXTIN-13; 1.4 → TXTIN-13–18; 1.5 → TXTIN-20–21, TXTIN-24; 1.6 → TXTIN-19, TXTIN-22–23; 1.7 → TXTIN-25–27; 1.8 → TXTIN-28–29; touch (grilled) → TXTIN-30–33. Per-requirement outcomes: `.specs/features/text-input/implementation.md`.

---

## Success Criteria

How we know the feature is successful:

- [ ] A tester can compose ≤500 characters in input mode, switch the `mode` prop to `view`, create two abutting snippets with needles, resize one end, delete one by clicking the highlight, and see `onChange` fire with the full array each time.
- [ ] Overlapping create/resize never persists a colliding range and never shows an error message.
- [ ] A touch press-and-hold plus needle drag produces the same snippet shape as mouse hover-and-drag.
- [ ] No MergeSession layout, preview, or global context is required to demo the component in isolation.
