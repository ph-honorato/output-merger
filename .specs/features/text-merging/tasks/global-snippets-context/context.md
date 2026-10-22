# Global Snippets Context

**Gathered:** 2026-10-07
**Spec:** `.specs/features/text-merging/tasks/global-snippets-context/spec.md`
**Status:** Implemented — see `implementation.md`

---

## Feature Boundary

Global snippet state for Feature 2 Task 3 (roadmap 3.1–3.3) only: a React Context + useReducer store holding one flat ordered list of snippet entries `{ ...Snippet, sourceId, order }`, reconciled from each source's full-array `onChange` emissions, exposed via `useSnippets`, and wired into `MergeSessionPage`'s two TextInputs with stable source ids. Not PreviewArea consumption (Task 4), not reorder actions (Task 4 / Feature 3), not Start Merge (Task 5), not source lifecycle (Feature 5), not persistence (V1).

---

## Implementation Decisions

### Scope and delivery

- This grilling session specified Task 3 only (3.1–3.3).
- Documentation artifacts follow the `.specs` pattern of the text-input task; implementation and `implementation.md` close the session.
- No visible UI change; the context is verified by unit tests.

### Data model

- Flat ordered list of entries — one sequence, exactly what Task 4's PreviewArea consumes.
- Entry type `OrderedSnippet` extends the TextInput `Snippet` (imported from `@components/TextInput`, not duplicated) with `sourceId` and `order`.
- Reducer keeps the state sorted by `order` at all times; consumers never re-sort.

### Order maintenance (ADR 0001)

- TextInput emits the full array for one source per mutation, which cannot express inter-source chronology.
- The reducer diffs by id, scoped per source: unseen ids append (`order = max + 1`, emission order for multiples), known ids update in place (resize keeps order), missing ids are removed.
- Deletion leaves gaps — no renumbering; Task 4's drag sort rewrites `order` values.
- Ids only need uniqueness within a source; cross-source collisions are harmless because matching is scoped.

### Source identity

- The page assigns stable ids `"text-1"` / `"text-2"` and passes them with every update: `setSourceSnippets(sourceId, snippets)`.
- `sourceId` is stored on each entry for provenance (color rendering in Task 4 does not need it — `color` is captured per snippet already).

### Placement and structure

- Provider lives inside `MergeSessionPage` (session-scoped; v1 re-scopes per session route).
- First context in the codebase: `src/context/SnippetsContext/` with `SnippetsContext.tsx`, `.reducer.ts`, `.types.ts`, `.test.tsx`, `index.ts` — establishes `src/context/` for future contexts.

### Consumption

- `useSnippets()` returns `{ snippets, setSourceSnippets }`; throws a descriptive error outside the provider.
- Setter is memoized; state is the always-sorted list.
- Reorder/move action deliberately deferred to Task 4 (YAGNI); `order` values are the contract.

### Agent's Discretion

- New ids append at sequence end regardless of emitted-array position (TextInput appends; defensive).
- Multiple new ids in one update assign orders in emission order.
- Identical re-dispatch is content-idempotent.
- No i18n keys (no UI text introduced).
- `useSnippets` outside provider throws.
- No runtime validation of `sourceId` or snippet shape (trusted page + TextInput contract).

### Declined / Undiscussed Gray Areas → Assumptions

- Timestamps on snippets to recover chronology — rejected (changes the Task 1 contract).
- Recomputing the sequence from scratch on each update — rejected (loses interleave).
- Explicit `order` vs implicit array position — explicit chosen; array position alone gives Task 4 nothing stable to rewrite.

---

## Specific References

- Roadmap Feature 2 Task 3.1–3.3 (context with order property, update on creation, wire TextInput onChange).
- ADR 0001 (`docs/adr/0001-diff-by-id-merge-order.md`) — diff-by-id merge order maintenance.
- Text-input implementation.md §9: "Snippet state is component-owned" — this task lifts the aggregation without changing TextInput ownership.
- GLOSSARY.md terms: Merge Session, Source, Snippet, Merge Order.

---

## Deferred Ideas

- PreviewArea consumption and reorder/move action (Task 4).
- Drag-sort editing of merge order (Feature 3 preview tools).
- Source lifecycle management for Start Over / Add Text (Feature 5).
- Third source (Feature 5) — scales by adding a stable sourceId.
- Persistence of snippets and merge sessions (V1).
