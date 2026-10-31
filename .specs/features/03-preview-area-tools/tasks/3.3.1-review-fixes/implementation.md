# Review Fixes Implementation (automated review `result.json` — 13 findings)

**Implemented:** 2026-10-21
**Spec:** external — `result.json` (repo root): automated review of `develop..feature/preview-area-tools`, run `57792d68`, 13 findings. This task is the fix cycle for that review: the findings themselves are the specification, so no separate `spec.md`/`context.md` was gathered (nothing left ambiguous to grill — every finding came with location, existing code, and suggestion).
**Code:** `artifacts/output-merger.UI/` (+ root `.gitignore`)
**Status:** Implemented — 12 findings applied as suggested, 1 applied partially with evidence (the `.vitest` ignore entry: comment cleaned, entry kept — see decisions); verified by 477 automated tests (1 new regression test), `npx oxlint`, and `npx tsc -b`, all clean.

---

## 1. Deliverables

| File | Role |
| ---- | ---- |
| `.gitignore` | Modified: `result.json` anchored to `/result.json` (root-only match); trailing newline added |
| `artifacts/output-merger.UI/.gitignore` | Modified: review-process metadata removed from the `.vitest` comment (now `# Vitest local output`) |
| `artifacts/output-merger.UI/src/test/setup.ts` | Modified: `scrollIntoView` shim is `vi.fn()` instead of a bare arrow function (assertable/resettable, consistent with the file's other mocks) |
| `artifacts/output-merger.UI/src/utils/env.ts` | Modified: `raw` annotated `unknown` (stops relying on `ImportMetaEnv`'s `any` index signature; the `typeof raw !== 'string'` guard now narrows type-safely) |
| `artifacts/output-merger.UI/src/theme/index.ts` | Modified: new exported `CARD_HEIGHT = '400px'` — single source of the shared card-height contract |
| `artifacts/output-merger.UI/src/components/TextInput/TextInput.styles.ts` | Modified: `height: ${CARD_HEIGHT}` (literal removed) |
| `artifacts/output-merger.UI/src/pages/MergeSession/components/PreviewArea/PreviewArea.styles.ts` | Modified: `height: ${CARD_HEIGHT}` (literal removed) |
| `artifacts/output-merger.UI/src/components/TextInput/TextInput.tsx` | Modified: (a) hook call passes the component-resolved limit — `useTextInput({ ...props, maxCharacters })`; (b) needle-positioning layout effect compensates the scroll offset (origin = viewport rect − current scroll) |
| `artifacts/output-merger.UI/src/components/TextInput/TextInput.hook.tsx` | Modified: signature narrowed to `TextInputProps & { maxCharacters: number }`; the duplicated `= TEXT_INPUT_MAX_CHARACTERS` default removed from the destructure |
| `artifacts/output-merger.UI/src/components/TextInput/TextInput.test.tsx` | Modified: +1 regression test pinning the scroll-compensated needle positioning |
| `artifacts/output-merger.UI/src/pages/MergeSession/components/PreviewCharCount/PreviewCharCount.styles.ts` | Modified: docblock fixed — describes the default `count/limit` render AND the modal's `hideLimit` number-only variant (alignment rationale kept) |
| `artifacts/output-merger.UI/src/pages/MergeSession/components/SortableSegment/SortableSegment.styles.ts` | Modified: nested ternary replaced by a `chipBackground($color?, deepened?)` helper; edit-mode hover keeps the base tint explicitly |
| `artifacts/output-merger.UI/src/pages/MergeSession/components/CopyMergedTextButton/CopyMergedTextButton.hook.tsx` | Modified: false "DOM global `document` stays reachable" rationale replaced with the real purpose (distinguishing the context's document model from the DOM global) |
| `artifacts/output-merger.UI/src/pages/MergeSession/components/TextEditingToggle/TextEditingToggle.hook.tsx` | Modified: dead `t` removed from the hook's return value (no consumer; `ariaLabel` already carries the translation) |
| `artifacts/output-merger.UI/src/pages/MergeSession/components/PreviewModal/PreviewModal.hook.tsx` | Modified: dead `dragActive` removed from the hook's return value (internal state kept — `handleDialogClose` reads it) |

No new components, routes, context/reducer changes, i18n strings (no user-facing text changed), or backend files touched.

---

## 2. Per-finding outcomes

| # | Location | Finding (severity) | Outcome |
| - | -------- | ------------------ | ------- |
| 1 | Root `.gitignore` | Unanchored `result.json` pattern; missing trailing newline (low) | Applied — `/result.json` + newline |
| 2 | UI `.gitignore` | Comment embeds review-process metadata (low) | Applied — comment now `# Vitest local output` |
| 3 | `src/test/setup.ts` | Shim should be `vi.fn()` (low) | Applied |
| 4 | `TextInput.styles.ts` / `TextInput.tsx` | Scrollable view breaks needle positioning — viewport-space rects vs content-space absolute offsets (HIGH) | Applied — origin compensated by `scrollLeft`/`scrollTop` |
| 5 | `TextInput.tsx` / `TextInput.hook.tsx` | `maxCharacters` default resolved in two places, can drift (low) | Applied — component is the single resolution point; hook requires it |
| 6 | `TextInput.styles.ts` + `PreviewArea.styles.ts` | `height: 400px` duplicated in two style files (low) | Applied — shared `CARD_HEIGHT` in `src/theme/index.ts` |
| 7 | `PreviewCharCount.styles.ts` | Docblock contradicts the default `count/limit` render (low) | Applied — both variants described; alignment rationale kept |
| 8 | UI `.gitignore` | `.vitest` entry "never matches anything", remove it (low) | **Rejected with evidence** — see §3 |
| 9 | `SortableSegment.styles.ts` | Nested ternary in hover rule; edit-mode hover is a visual no-op (low) | Applied — `chipBackground` helper; no-op branch now explicit |
| 10 | `CopyMergedTextButton.hook.tsx` | Comment states a false rationale (low) | Applied |
| 11 | `TextEditingToggle.hook.tsx` | Dead `t` in hook return (low) | Applied |
| 12 | `src/utils/env.ts` | `raw` implicitly `any` via `ImportMetaEnv` index signature (low) | Applied — `const raw: unknown` |
| 13 | `PreviewModal.hook.tsx` | Dead `dragActive` in hook return (low) | Applied |

---

## 3. Key implementation decisions (within the findings' latitude)

- **`.vitest` entry kept, comment cleaned (finding 8 rejected, finding 2 applied)**: the review claimed the entry "never matches anything" because Vitest 5 caches under `node_modules/.vite/vitest`. Verified against the actual filesystem: `artifacts/output-merger.UI/.vitest/json/output.json` **exists** (created 2026-10-19 by test-run tooling using the JSON reporter with an output file under `.vitest/`). The entry matches a real, tool-generated directory — removing it would resurface the directory as untracked noise on every tooling run. Only the process-metadata comment was cleaned (per the AGENTS.md comment-discipline rule), and reworded to `# Vitest local output` because the directory holds reporter output, not a cache.
- **Scroll compensation (finding 4)**: char rects come from `getBoundingClientRect()` (viewport space) while the needles are absolutely positioned inside the scrollable `TextViewContainer` (content space). The layout effect now builds `origin = { left: rootRect.left − root.scrollLeft, top: rootRect.top − root.scrollTop }`, so the computed offsets are content-space positions: invariant under scrolling, meaning needles stay glued to their target words while the container scrolls (no re-render needed on scroll — correct, since needles scroll with the content by design). Hit-testing (`caretIndexFromPoint`/`resolveHitSide`) is untouched and keeps using live viewport coordinates, which remain aligned with the needles at any scroll.
- **Single resolution point (finding 5)**: beyond the call-site change (`useTextInput({ ...props, maxCharacters })`), the hook's param type was narrowed to `TextInputProps & { maxCharacters: number }` and its `= TEXT_INPUT_MAX_CHARACTERS` default removed — otherwise the old default would remain as dead-but-meaningful-looking code. Only `TextInput.tsx` calls the hook (verified), and `TEXT_INPUT_MAX_CHARACTERS` remains exported from `TextInput.hook.tsx` (consumed by `TextInput.tsx` and `env.test.ts`).
- **`CARD_HEIGHT` home (finding 6)**: exported from `src/theme/index.ts`, the design-token module every suite and `main.tsx` already import from (`../../theme` from the component, `../../../../theme` from the page component — the codebase's established relative-import depths). A CSS custom property was rejected as heavier: it requires someone to actually set the property at runtime; the constant interpolates the same literal into both templates with zero behavior change (all `height:400px` assertions still pass — stylis output is identical).
- **`chipBackground` helper (finding 9)**: early-return function form (no ternary inside a ternary branch); the `$editing` hover branch deliberately re-uses the base tint — same rendered value as before, but the no-op is now explicit instead of hidden inside a nested ternary. The existing suite's exact-CSS assertions (`background-color:rgba(255, 20, 147, 0.4)` on hover, `rgba(0, 128, 255, 0.3)` base) pass unchanged, proving behavior preservation.

---

## 4. Testing strategy

- **New regression test** (`TextInput.test.tsx`, "compensates the view scroll offset when positioning needles inside the scrollable container"): mocks the view container's `getBoundingClientRect` to `{left: 100, top: 50}` and its `scrollLeft`/`scrollTop` to `10`/`30`, hovers a word, and asserts the needle's inline offsets land at `-30px`/`-20px` — the content-space position of the word-start rect at `(60, 0)` relative to the compensated origin `(100−10, 50−30)`. This pins the exact arithmetic the bug lived in; jsdom's real values are all-zero, which is why the old code passed tests while being wrong at any nonzero scroll.
- **Behavior preservation**: the SortableSegment hover CSS, the fixed-height assertions (`toHaveStyle({ height: '400px' })` and the `height:400px` emitted-CSS checks in `PreviewArea`/`PreviewModal` suites), and every hook-consumer destructure were verified against the existing suites rather than by re-authoring expectations.
- **Verification commands and results** (Git Bash, working dir `artifacts/output-merger.UI`):
  - `npx vitest run` → **19 files, 477/477 passed** (476 before + 1 new)
  - `npx tsc -b` → **clean** (covers app + node + test project references)
  - `npx oxlint` → **clean, exit 0**

---

## 5. Deviations from the review suggestions

- **Finding 8 not applied** (`.vitest` removal) — evidence in §3; finding 2's comment cleanup applied instead, which also removes the metadata the review flagged.
- **Finding 5 extended**: the review suggested only the call-site change; the hook signature was also narrowed so no duplicated default expression remains.
- **Finding 7**: the suggested docblock replacement dropped the (still-accurate) `align-self: stretch` / `text-align: center` rationale; the applied version fixes the inaccurate first sentence while keeping that rationale.

---

## 6. Known gaps / deferred

- **Manual browser check**: the scroll-compensated needle positioning is pinned by the mocked-geometry regression test; the real-browser behavior (long view text, scrolled container, hover/drag needles glued to words) deserves a quick dev-server pass — jsdom has no layout engine, so it cannot be proven end-to-end in the suite.
- The review itself was `partial` (9 of 44 selected items failed with LLM deadline errors — see `result.json` warnings for the affected TextInput/PreviewModal/PreviewCharCount/SortableSegment/page-wiring groups); those items were re-covered here only to the extent the 13 reported findings touched them. A re-run of the review tool would confirm coverage of the failed groups.
- Roadmap: no status change — all Feature 3 line items were already checked; this fix round has no dedicated line item (same conclusion as the `preview-area-adjusts` context: nothing to check off).

---

## 7. Tester verification (pipeline step 3)

**Verdict: PASS** (2026-10-21, independent re-run of `tsc -b`, `oxlint`, `vitest run` — all clean; 477/477). The tester re-derived the scroll-compensation math (solves to content-space coordinates exactly; strict no-op at scroll = 0), confirmed the regression test fails against the pre-fix code on both axes (−40/−50 vs the asserted −30/−20), confirmed both deliberate decisions with filesystem/git evidence (`git check-ignore -v` proves the `.vitest` entry matches the real reporter-output directory), and found no introduced bugs and no duplications.

Non-blocking observations deferred (pre-existing, outside this round's diff):

- `PreviewModal.styles.ts:73` — comment says the modal override keeps "its min-height 400px"; the override replaces the height entirely and the value now lives in `CARD_HEIGHT`. Tidy in a future pass.
- `setup.ts`'s `scrollIntoView` `vi.fn()` accumulates calls across tests (no `clearMocks` config); harmless today — a future test asserting on it should clear first.
- Nothing in `vitest.config.ts` generates `.vitest/json/output.json`; it comes from an ad-hoc/CI invocation. If that reporter run is part of a workflow, its command belongs in an npm script so the artifact's origin is discoverable.
