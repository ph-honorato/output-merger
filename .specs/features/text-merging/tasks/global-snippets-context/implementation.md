# Global Snippets Context Implementation

**Implemented:** 2026-10-07
**Spec:** `.specs/features/text-merging/tasks/global-snippets-context/spec.md`
**Context:** `.specs/features/text-merging/tasks/global-snippets-context/context.md`
**Code:** `artifacts/output-merger.UI/src/context/SnippetsContext/`
**Status:** Implemented — roadmap Feature 2, Task 3 (3.1–3.3) complete; verified by 14 new automated tests (56 total), oxlint, `tsc -b`

---

## 1. Deliverables

| File | Role |
| ---- | ---- |
| `SnippetsContext.tsx` | Provider component: `useReducer` wiring, memoized `setSourceSnippets` |
| `SnippetsContext.hook.tsx` | The context object + `useSnippets` consumer hook (throws outside provider) |
| `SnippetsContext.reducer.ts` | Pure reconciliation reducer (`SET_SOURCE_SNIPPETS`) |
| `SnippetsContext.types.ts` | `OrderedSnippet`, `SnippetsState`, action types, `SnippetsContextValue` |
| `SnippetsContext.test.tsx` | 14 tests: 10 reducer suites, 4 hook-through-provider suites |
| `index.ts` | Barrel: provider, hook, reducer, all types |

Also modified:

- `src/pages/MergeSession/MergeSessionPage.tsx` — provider wraps a new internal `MergeSessionWorkspace` (the only part needing `useSnippets`); both TextInputs wire `onChange` → `setSourceSnippets("text-1"|"text-2", snippets)`
- No i18n changes (no UI text introduced)

---

## 2. Public API (as implemented)

```ts
interface OrderedSnippet extends Snippet {  // Snippet from @components/TextInput
  sourceId: string;  // stable id of the emitting source, e.g. "text-1"
  order: number;    // position in the merge order; incremental, gaps allowed
}

interface SnippetsContextValue {
  snippets: OrderedSnippet[];                      // always sorted by order ascending
  setSourceSnippets: (sourceId: string, snippets: Snippet[]) => void;
}

SnippetsProvider({ children })                     // session-scoped, state discarded on unmount
useSnippets(): SnippetsContextValue                // throws outside SnippetsProvider
snippetsReducer(state, action)                     // pure, exported for unit tests
```

---

## 3. Core mechanics

### Reconciliation (ADR 0001)

`SET_SOURCE_SNIPPETS` reconciles a full per-source array against the current state:

1. Collect the source's previous entries into an id → entry map (matching is scoped per source; ids need only be unique within one TextInput instance).
2. Walk the emitted array in order:
   - known id → entry replaced with the fresh snippet content, **previous `order` kept** (resize);
   - new id → `order = running max + 1` (the running max starts at the global maximum across all sources and increments per new id, so multi-new-id updates get increasing orders in emission order).
3. Entries of that source absent from the update are dropped (delete / clear); all other sources' entries pass through untouched.
4. Result = `[...others, ...reconciled]` sorted by `order` — state is always merge-ordered; consumers never re-sort.

Consequences locked by tests: deletion leaves gaps (no renumbering), the next creation takes `max + 1` (not a count), identical re-dispatches are content-idempotent, and cross-source id collisions are harmless.

### Provider / hook

- `useReducer(snippetsReducer, [])` inside the provider; setter is `useCallback`-memoized (empty deps — dispatch is stable), context value memoized on `[snippets, setSourceSnippets]`.
- `useSnippets` reads the context and throws `useSnippets must be used within a SnippetsProvider` when null.
- Provider unmount discards state (fresh provider starts empty) — no persistence by design (V1).

### Page wiring

`MergeSessionPage` keeps the hero outside the provider; `MergeSessionWorkspace` (internal page component) consumes `useSnippets` and passes `onChange={(snippets) => setSourceSnippets("text-1", snippets)}` / `"text-2"` to the two TextInputs. Stable source ids come from the page; the context never generates them.

---

## 4. Testing strategy

- Reducer tested as a pure function: registration, interleave (A1, B1, A2 → orders 1, 2, 3), resize-keeps-order, delete-leaves-gaps, max+1-after-delete, per-source clear, known-id position independence, idempotency, empty first update, cross-source id collision scoping.
- Hook tested via `renderHook` with `wrapper: SnippetsProvider`: throw outside provider (console.error suppressed via `vi.spyOn`), empty start, end-to-end interleave, stable setter identity across re-renders, state discarded on unmount.
- Verification: `npx vitest run` (56/56 green), `npm run lint` (oxlint, clean), `npx tsc -b` (clean).
- Page-level integration tests deliberately out of scope (user decision from Task 2); SNPCTX-18 verified by inspection.

---

## 5. Deviations from spec.md

| Area | Spec | Implemented | Reason |
| ---- | ---- | ----------- | ------ |
| File structure | 5 files (`SnippetsContext.tsx`, `.reducer.ts`, `.types.ts`, `.test.tsx`, `index.ts`) | 6 files — added `SnippetsContext.hook.tsx` holding the context object + `useSnippets` | oxlint `react(only-export-components)` (fast refresh) forbids component + hook exports in one file; matches the project's `.hook.tsx` convention |

All functional requirements implemented as specified — 18/18 Verified (SNPCTX-01–18).

---

## 6. Known gaps / deferred

- Reorder / move action on the context — Task 4 (drag sort rewrites `order` values).
- PreviewArea consumption — Task 4 (first consumer).
- Source lifecycle (add/remove at runtime, Start Over) — Feature 5.
- Page-level integration tests — deliberately skipped (user decision).
- Persistence — V1 (Merges CRUD).
