# Merge order is maintained by diffing snippet ids in the snippets reducer

The `TextInput` component emits the full snippet array for a single source on every mutation, which by itself cannot reconstruct global creation order when snippets interleave across sources (A1, B1, A2). We decided the global snippets context reconciles each incoming per-source array by diffing snippet ids: unseen ids append to the merge sequence (`order = max + 1`), known ids update in place (resizes keep their order), and missing ids are removed (order gaps, no renumbering). This preserves the user's selection order without changing the `TextInput` contract or adding timestamps.

## Considered Options

- **Add `createdAt` timestamps to snippets** — rejected: changes the already-shipped `TextInput` contract for a concern the context can own.
- **Recompute the sequence from scratch on every update** — rejected: loses the interleave between sources, so "user selection order" would be violated.
- **Diff by id, scoped per source** — chosen: ids are unique within a source (`generateId`), so cross-source id collisions cannot corrupt the sequence.

## Consequences

- Snippet ids must remain stable and unique within their source for the entry's lifetime; consumers may rely on id-based updates.
- Deletion leaves gaps in `order` values; consumers must sort and never renumber.
- Exception (Feature 3 Task 1): an explicit user reorder (`MOVE_SNIPPET`) renumbers the whole sequence to a dense 1..n after the move — the sole sanctioned renumbering writer; every other update keeps gaps.
- Amended 2026-10-16 (Feature 3 Task 3): the merge order now lives in the preview document — an ordered token array where position is the order — so diff-by-id reconciliation applies to snippet tokens within that array, and the MOVE_SNIPPET dense-renumbering exception is retired: moving a token is a plain splice with no renumbering.
