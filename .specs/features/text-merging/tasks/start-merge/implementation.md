# Start Merge Logic Implementation

**Implemented:** 2026-10-08
**Spec:** `.specs/features/text-merging/tasks/start-merge/spec.md`
**Context:** `.specs/features/text-merging/tasks/start-merge/context.md`
**Code:** `artifacts/output-merger.UI/src/pages/MergeSession/`
**Status:** Implemented — roadmap Feature 2, Task 5 (5.1–5.2) complete; verified by 4 new page tests (74 total), oxlint, `tsc -b`

---

## 1. Deliverables

| File | Role |
| ---- | ---- |
| `src/pages/MergeSession/MergeSessionPage.tsx` | Modified: `mergeStarted` + `sourceTexts` state, button gating/hiding, `mode` propagation, `onTextChange` wiring |
| `src/pages/MergeSession/MergeSessionPage.test.tsx` | New: the page's first test suite — 4 tests covering gating and the mode transition |

No other code changed: no i18n keys, no new components, no context/reducer changes, no snippet-path code (Task 5.2 was already delivered by Tasks 1/3/4).

---

## 2. Behavior (as implemented)

```tsx
// inside MergeSessionWorkspace
const [mergeStarted, setMergeStarted] = useState(false);
const [sourceTexts, setSourceTexts] = useState<Record<string, string>>({});

const canStartMerge = Object.values(sourceTexts).some(
  (text) => text.trim().length > 0
);
```

- **Gating**: each TextInput's `onTextChange` feeds `sourceTexts[sourceId]`; Start Merge is enabled iff at least one entry has `trim().length > 0`. Whitespace-only never enables.
- **Transition**: clicking the enabled button sets `mergeStarted = true` — both sources receive `mode={mergeStarted ? 'view' : 'input'}`; textareas unmount (view mode), text survives (uncontrolled TextInput state; only typing clears snippets, per its contract).
- **Button hiding**: `{mergeStarted ? null : <S.StartMergeButton … />}` — the ActionsBar remains rendered as the reserved slot for Feature 5's Start Over.
- **One-way**: no path back to input mode in v0; page unmount discards state.

---

## 3. Testing strategy

- `MergeSessionPage.test.tsx` renders the full page (i18n + MUI + styled-components providers; the page brings its own `SnippetsProvider`) and covers: initial state (two textareas, disabled button), enabling on text, whitespace-only staying disabled, and the full transition (button gone, no textareas, `text-input-view` preserves "Hello world", empty source shows `text-input-empty`, ActionsBar and preview intact).
- Needle-drag mechanics, context reconciliation, and preview rendering are not re-tested at page level — they remain covered by the TextInput (34), SnippetsContext (14), and PreviewArea/CopyButton/Toolbar (17) suites.
- Verification: `npx vitest run` (74/74 green), `npm run lint` (oxlint, clean), `npx tsc -b` (clean).

---

## 4. Deviations from spec.md

None — all 9 requirements implemented/verified as specified (STMRG-01–09).

---

## 5. Known gaps / deferred

- Start Over (reset) and back-to-input toggling — Feature 5; the ActionsBar slot is waiting.
- Entry animations on the mode flip (DESIGN.md motion) — later polish.
- Manual end-to-end check of the needle → preview flow in the dev server — recommended before closing Feature 2 (mechanics covered by automated suites).
- Persistence — V1.
