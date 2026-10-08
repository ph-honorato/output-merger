# Global Snippets Context Specification

## Problem Statement

Merge Session has two wired `TextInput` sources, but each owns its snippet list privately and reports it through `onChange` as a full per-source array. Nothing aggregates them. The PreviewArea (Task 4) must render all snippets side by side in the merge sequence, and that sequence must default to user selection order. This specification defines Task 3 of Feature 2 (roadmap 3.1–3.3): a global snippets context (React Context + useReducer) holding one flat, ordered list of snippet entries, updated from every source, consumed through `useSnippets` — not preview rendering (Task 4), not reorder actions (Task 4 / Feature 5), not Start Merge (Task 5).

## Goals

- [ ] A `SnippetsContext` stores a flat ordered list of `OrderedSnippet` entries — each `Snippet` extended with `sourceId` and `order`.
- [ ] `setSourceSnippets(sourceId, snippets)` reconciles a full per-source array: new ids append to the merge sequence (`order = max + 1`), known ids update in place, missing ids are removed.
- [ ] Merge order defaults to user selection order: chronological creation across all sources, preserved through resizes and deletes.
- [ ] `useSnippets()` exposes the always-sorted list plus a memoized setter; `MergeSessionPage` wires both TextInputs into the context with stable source ids.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| PreviewArea consumption of the context | Feature 2 Task 4 |
| Reorder / move action on the context | Feature 2 Task 4 / Feature 5 (drag sort); `order` values are the contract |
| Start Merge mode switching | Feature 2 Task 5 |
| Adding/removing sources at runtime (Start Over, Add Text) | Feature 3; the context tolerates but does not manage source lifecycle |
| Third text input | Feature 4 (scales by adding a third stable sourceId) |
| Text ownership (`onTextChange` wiring) | Sources stay unwired for text; only snippets flow through the context |
| Persistence of snippets | V1 (Merges CRUD) |
| Renumbering `order` after deletions | Grilled: gaps are deliberate (ADR 0001) |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here - nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Data model | Flat ordered list of `{ ...Snippet, sourceId, order }` | A single sequence is exactly what Task 4 consumes ("snippets side by side") | y (grilled) |
| Order maintenance | Reducer diffs by id, scoped per source (ADR 0001) | TextInput emits full per-source arrays; diffing preserves global creation order without contract changes | y (grilled) |
| `order` semantics | Explicit `number`; insertion = current max + 1; deletes leave gaps; Task 4 rewrites via drag sort | Roadmap "order property (default: user selection order)" | y (grilled) |
| Source identity | Page assigns stable ids (`"text-1"`, `"text-2"`); `sourceId` stored on every entry | Provenance for debugging and later features | y (grilled) |
| Provider placement | Inside `MergeSessionPage` | Session-scoped state; v1 re-scopes per session route | y (grilled) |
| Location & structure | `src/context/SnippetsContext/` — `SnippetsContext.tsx`, `.reducer.ts`, `.types.ts`, `.test.tsx`, `index.ts` | First context in the codebase; establishes `src/context/` | y (grilled) |
| Type dependency | `Snippet` imported from `@components/TextInput`; context adds `OrderedSnippet` | Single source of truth, no duplicate model | y (grilled) |
| Visible outcome | None; verified by unit tests only | First consumer is Task 4 | y (grilled) |
| Diff scoping | Ids need only be unique within one source; cross-source id collisions cannot corrupt the sequence because matching happens only against that source's previous entries | TextInput guarantees per-instance uniqueness via `generateId` | n (agent default) |
| New ids position | Appended at sequence end regardless of position in the emitted array | TextInput appends new snippets at array end; defensive only | n (agent default) |
| Multiple new ids in one update | Orders assigned in emission order | TextInput emits at most one new snippet per mutation | n (agent default) |
| State ordering | Reducer keeps state sorted by `order` at all times | Consumers never re-sort | n (agent default) |
| Hook misuse | `useSnippets` outside the provider throws a descriptive error | Standard React Context practice | n (agent default) |
| Idempotency | Re-dispatching an identical array leaves the sequence content unchanged | Diff by id is naturally idempotent | n (agent default) |
| i18n | No keys added (no UI text introduced) | Project i18n rule applies to UI text only | n (agent default) |

**Open questions:** none - all resolved or logged above (required before the spec is confirmed).

---

## Implicit-Requirement Dimensions

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | `sourceId` is a non-empty string trusted from the page; snippet shape trusted from the TextInput contract; no validation performed |
| Failure / partial-failure states | N/A because the context is local synchronous state with no I/O |
| Idempotency / retry / duplicate handling | Identical re-dispatch is content-idempotent (new array reference, same entries) |
| Auth boundaries & rate limits | N/A because there is no API |
| Concurrency / ordering | React dispatch order is single-threaded; one action type; state always sorted by `order` |
| Data lifecycle / expiry | Entries live until their source update removes them or the provider unmounts; no TTL, no persistence |
| Observability | N/A because V0 has no metrics/logging requirement |
| External-dependency failure | N/A because no external services |
| State-transition integrity | Provider mount → empty list; a per-source reconciliation mutates only that source's entries plus the global order counter |

---

## User Stories

### P1: Register snippets from a source ⭐ MVP

**User Story**: As a source, I want my emitted snippet array recorded in the global context so that my snippets join the merge sequence.

**Why P1**: Roadmap 3.1–3.2; without registration there is no context state at all.

**Acceptance Criteria**:

1. WHEN `setSourceSnippets(sourceId, snippets)` is called THEN the context SHALL record exactly one entry per emitted snippet, each carrying the snippet's `id`, `text`, `startIndex`, `endIndex`, `color` plus the `sourceId` and a merge `order`.
2. WHEN an emitted snippet id has no matching entry for that source THEN the context SHALL assign it `order = max(order of all entries) + 1`, and WHEN several new ids arrive in one update THEN the context SHALL assign increasing orders in emission order.
3. IF the source was never registered before THEN the context SHALL treat every emitted snippet as new.

**Independent Test**: Reducer: dispatch a first update for `"text-1"` with two snippets; assert two entries with `order` 1 and 2 and `sourceId === "text-1"`.

---

### P1: Preserve user selection order across sources ⭐ MVP

**User Story**: As a merger, I want snippets ordered by when I selected them regardless of which source they came from so that the preview reflects my intent.

**Why P1**: Roadmap 3.1 "order property (default: user selection order)"; the core value of the context.

**Acceptance Criteria**:

1. WHEN snippet A1 is created in source 1, then B1 in source 2, then A2 in source 1 THEN the context SHALL expose the sequence `[A1, B1, A2]` with `order` values 1, 2, 3.
2. The context SHALL expose snippets sorted by `order` ascending at all times.
3. WHEN a known snippet id appears at a different position in the emitted array THEN its entry SHALL keep its assigned `order`.

**Independent Test**: Reducer: interleave updates for `"text-1"` and `"text-2"`; assert the flat sequence and `order` values match creation chronology, and re-emit a known id first in the array without sequence change.

---

### P1: Update and remove without reordering ⭐ MVP

**User Story**: As a merger, I want resizes and deletes to change content only, never the sequence, so that my ordering work is never disturbed.

**Why P1**: Roadmap 3.2; TextInput resizes (id kept, range changed) and deletes (id gone) must reconcile without side effects.

**Acceptance Criteria**:

1. WHEN a known snippet id arrives with changed `text`, `startIndex`, or `endIndex` (resize) THEN the context SHALL update that entry's content and SHALL keep its `order`.
2. WHEN a snippet id is absent from the source's update (deleted) THEN the context SHALL remove that entry and SHALL keep every surviving entry's `order` unchanged (gaps allowed).
3. WHEN a new snippet is created after a deletion THEN its `order` SHALL be `max + 1` over the surviving entries, not a count.
4. WHEN the same array is dispatched twice THEN the sequence content SHALL be unchanged (idempotent).

**Independent Test**: Reducer: create three interleaved snippets, resize one, delete the middle, create one more; assert contents updated, `order` values 1, 3, 4 preserved/assigned, no renumbering.

---

### P1: Clear a source's snippets ⭐ MVP

**User Story**: As a source, I want my cleared array (`onChange([])`, e.g. text edit) to remove only my snippets so that other sources are untouched.

**Why P1**: TextInput clears its snippets when its text is edited; the context must scope removal per source.

**Acceptance Criteria**:

1. WHEN `setSourceSnippets(sourceId, [])` is called THEN the context SHALL remove every entry of that source.
2. WHEN a source is cleared THEN the context SHALL keep every other source's entries and their `order` values unchanged.
3. WHEN a snippet is created after a clear THEN its `order` SHALL be `max + 1` over the remaining entries.

**Independent Test**: Reducer: two sources with snippets; clear `"text-1"`; assert only `"text-2"` entries remain with original orders; create in `"text-1"` again and assert max+1.

---

### P1: Consume via useSnippets ⭐ MVP

**User Story**: As a consumer (PreviewArea in Task 4), I want a hook exposing the merge-ordered snippets and a stable setter so that re-renders and wiring are predictable.

**Why P1**: Roadmap 3.1/3.3; the context's public contract.

**Acceptance Criteria**:

1. `useSnippets()` SHALL throw a descriptive error when called outside a `SnippetsProvider`.
2. On provider mount the exposed `snippets` SHALL be an empty list.
3. The exposed `setSourceSnippets` reference SHALL be stable across re-renders (memoized).
4. WHEN the provider unmounts THEN the state SHALL be discarded (a fresh provider starts empty).
5. `MergeSessionPage` SHALL wire both TextInputs' `onChange` to `setSourceSnippets` with stable source ids `"text-1"` and `"text-2"` (verified by inspection; page-level tests intentionally out of scope).

**Independent Test**: Hook: `renderHook` outside provider asserts throw; inside provider asserts empty list, stable setter identity across re-render, and an end-to-end dispatch reflecting in the exposed list.

---

## Edge Cases

- IF a new source's first update is an empty array THEN the context SHALL remain unchanged.
- IF two sources emit snippets whose ids collide THEN the sequence SHALL be unaffected because reconciliation matches only against the emitting source's own entries.
- IF a new id appears mid-array of an emitted update THEN it SHALL still be appended at the sequence end (TextInput never does this; defensive).
- IF `setSourceSnippets` is dispatched with an identical array THEN the sequence content SHALL be unchanged.

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| SNPCTX-01 | Register snippets from a source | Specify | Verified |
| SNPCTX-02 | Register snippets from a source | Specify | Verified |
| SNPCTX-03 | Register snippets from a source | Specify | Verified |
| SNPCTX-04 | Preserve user selection order across sources | Specify | Verified |
| SNPCTX-05 | Preserve user selection order across sources | Specify | Verified |
| SNPCTX-06 | Preserve user selection order across sources | Specify | Verified |
| SNPCTX-07 | Update and remove without reordering | Specify | Verified |
| SNPCTX-08 | Update and remove without reordering | Specify | Verified |
| SNPCTX-09 | Update and remove without reordering | Specify | Verified |
| SNPCTX-10 | Update and remove without reordering | Specify | Verified |
| SNPCTX-11 | Clear a source's snippets | Specify | Verified |
| SNPCTX-12 | Clear a source's snippets | Specify | Verified |
| SNPCTX-13 | Clear a source's snippets | Specify | Verified |
| SNPCTX-14 | Consume via useSnippets | Specify | Verified |
| SNPCTX-15 | Consume via useSnippets | Specify | Verified |
| SNPCTX-16 | Consume via useSnippets | Specify | Verified |
| SNPCTX-17 | Consume via useSnippets | Specify | Verified |
| SNPCTX-18 | Consume via useSnippets | Specify | Verified (inspection) |

**ID format:** `SNPCTX-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified; additionally **Deviated** (implemented with a changed contract — see `implementation.md`) and **Deferred** (not implemented — see `implementation.md`).

**Coverage:** 18 total. 18 Verified (SNPCTX-18 by inspection), 0 Deviated, 0 Deferred. Roadmap mapping: 3.1 → SNPCTX-01–06, 14–18; 3.2 → SNPCTX-01–03, 07–13; 3.3 → SNPCTX-18. Per-requirement outcomes: `.specs/features/text-merging/tasks/global-snippets-context/implementation.md`.

---

## Success Criteria

How we know the feature is successful:

- [ ] Wiring test: a snippet created in input 1, then input 2, then input 1 again is exposed as a flat sequence with `order` 1, 2, 3.
- [ ] Deleting a snippet leaves the survivors' `order` values untouched and the next creation takes `max + 1`.
- [ ] A cleared source removes only its own entries.
- [ ] The page renders exactly as before (no visual change) — `npx vitest run`, `npm run lint`, and `npx tsc -b` all pass.
