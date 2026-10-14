# Preview Area Implementation

**Implemented:** 2026-10-08
**Spec:** `.specs/features/text-merging/tasks/preview-area/spec.md`
**Context:** `.specs/features/text-merging/tasks/preview-area/context.md`
**Code:** `artifacts/output-merger.UI/src/pages/MergeSession/components/`
**Status:** Implemented — roadmap Feature 2, Task 4 (4.1–4.4) complete; verified by 17 new automated tests (70 total), oxlint, `tsc -b`

---

## 1. Deliverables

All under `artifacts/output-merger.UI/src/pages/MergeSession/components/` (page-owned, per user decision):

| Folder | Role |
| ------ | ---- |
| `PreviewArea/` | Card rendering the merge-ordered context snippets as tinted segments; icon+text empty state; pure `withAlpha` helper (in `.hook.tsx`) |
| `PreviewToolbar/` | Floating vertical layout bar (absolute right, vertically centered, z-index 1); composes `children`; owns no actions |
| `CopyMergedTextButton/` | Icon-only copy button + MUI Snackbar toast; pure `buildMergedText` helper (in `.hook.tsx`) |

Each folder follows the AGENTS.md 6-file split (`.tsx`, `.hook.tsx`, `.styles.ts`, `.types.ts`, `.test.tsx`, `index.ts`).

Also modified:

- `src/pages/MergeSession/MergeSessionPage.tsx` — column 3 is now `S.PreviewColumn` (positioned wrapper) composing `<PreviewArea />` + `<PreviewToolbar><CopyMergedTextButton /></PreviewToolbar>`
- `src/pages/MergeSession/MergeSessionPage.styles.ts` — new `PreviewColumn` (relative, full column height) as the toolbar's positioning anchor
- `src/i18n/resources/en-US.json`, `pt-BR.json` — 3 new keys under `pages.mergeSession.previewArea.*` (`.empty`, `.copy.button`, `.copy.toast`)
- `src/components/index.ts` — removed `export * from "./PreviewArea"`

Deleted:

- `src/components/PreviewArea/` — the invisible Task 2 stub (component, hook, styles, types, index, 3 tests), replaced by the page-owned component (roadmap 4.1)

---

## 2. Public API (as implemented)

```ts
// PreviewArea
PreviewAreaProps { className?: string }
usePreviewArea(): { t, snippets }          // composes i18n + useSnippets
withAlpha(hex, alpha): string              // pure: '#rrggbb'|'#rgb' → rgba(); passthrough on non-hex

// PreviewToolbar
PreviewToolbarProps { children?: ReactNode; className?: string }   // pure layout, no actions

// CopyMergedTextButton
CopyMergedTextButtonProps { className?: string }
buildMergedText(snippets: OrderedSnippet[]): string               // pure: texts joined by single space, merge order
useCopyMergedTextButton(): { t, canCopy, handleCopy, toastOpen, handleToastClose }
```

---

## 3. Core mechanics

- **Display**: `useSnippets()` already returns merge-ordered entries (ADR 0001), so the segment flow is a plain `map` — no local ordering state, keeping the component malleable for the future editable surface (spec: Forward Direction).
- **Segment tint**: `withAlpha(snippet.color, 0.3)` inline style — same alpha as TextInput's committed highlights; segment flow reserves right padding (`spacing(4)`) so text never flows under the floating toolbar.
- **Toolbar**: absolute inside `S.PreviewColumn` (the page wrapper is the offset parent), vertically centered via `top: 50% + translateY(-50%)`, `z-index: 1`. Hover feedback is MUI `IconButton`'s default background fill — the toolbar adds no hover logic of its own.
- **Copy flow**: click → `navigator.clipboard.writeText(buildMergedText(snippets))` → `.then` opens the toast, `.catch` (or absent clipboard) is a silent no-op; the click never throws. Toast: MUI `Snackbar`, bottom-center, `autoHideDuration` 2500ms, content `S.ToastMessage` with the i18n'd text.
- **Empty state**: zero snippets → MUI `Preview` icon (aria-hidden) + `pages.mergeSession.previewArea.empty` text; cleared the moment the first snippet lands.

---

## 4. Testing strategy

- All three suites use a `SnippetsProvider` harness: a `Harness` component seeds the context via `setSourceSnippets` inside `useEffect` (deps `[updates, setSourceSnippets]` — a no-deps effect infinite-loops because the reducer returns a fresh array identity per dispatch).
- PreviewArea (6): root, empty state + clear-on-arrival, interleaved order `A1, B1, A2`, tint `rgba(0, 128, 255, 0.3)`, `withAlpha` pure cases.
- PreviewToolbar (4): root, children, absolute position, column orientation.
- CopyMergedTextButton (7): aria-label, disabled-at-zero, enabled-with-snippets, `writeText('Hello Alpha')` space-join, toast appears, rejected-write silent (no toast, no throw), `buildMergedText` pure cases.
- Clipboard mocked per-suite via `Object.defineProperty(navigator, 'clipboard', …)`.
- Verification: `npx vitest run` (70/70 green), `npm run lint` (oxlint, clean), `npx tsc -b` (clean).

---

## 5. Deviations from spec.md

None — all 13 requirements implemented as specified (PREVA-01–13, Verified).

---

## 6. Known gaps / deferred

- User text editing and the editing model (atomic islands vs free-form) — deliberately undecided; Feature 5 discussions (user north star: edit text however they want + reorder snippets).
- Drag-sort snippet reordering — Feature 5 (the per-snippet segment units are its natural drag anchors).
- Split-snippet / line-break / add-own-text tools — Feature 5; necessity to be re-discussed (typing may replace tools).
- Future toolbar buttons — added per feature as children of `PreviewToolbar`.
- Persistence — V1.
