# Text Input Implementation

**Implemented:** 2026-10-06
**Spec:** `.specs/features/text-input/spec.md`
**Context:** `.specs/features/text-input/context.md`
**Code:** `artifacts/output-merger.UI/src/components/TextInput/`
**Status:** Implemented — roadmap Feature 2, Task 1 (1.1–1.8) complete; verified by 34 automated tests, oxlint, `tsc -b`

---

## 1. Deliverables

| File | Role |
| ---- | ---- |
| `TextInput.tsx` | Component: input/view rendering, token spans, needles |
| `TextInput.hook.tsx` | All state and interaction logic; exports pure helpers `tokenize`, `withAlpha`, `generateId`, `trimRangeStart`, `computeNeedlePosition`, and the `useTextInput` hook |
| `TextInput.styles.ts` | styled-components (Header pattern: `DefaultTheme & Theme` cast, MUI palette tokens, design.md card styling) |
| `TextInput.types.ts` | `Snippet`, `TextInputMode`, `TextInputProps` |
| `TextInput.test.tsx` | 34 tests: 22 component behaviors, 5 pure-helper suites |
| `index.ts` | Barrel: component + type exports |

Also modified:

- `src/components/index.ts` — `export * from "./TextInput"` (available via `@components`)
- `src/i18n/resources/en-US.json`, `pt-BR.json` — 6 new `textInput.*` keys
- `src/test/setup.ts` — `ResizeObserver` mock replaced with a constructable ES class (vitest 5 + MUI 9 `TextareaAutosize` crashed with the old `vi.fn` mock)

---

## 2. Public API (as implemented)

```ts
interface Snippet {
  id: string;          // `snippet-<base36 timestamp>-<base36 random>`
  text: string;        // sourceText.substring(startIndex, endIndex)
  startIndex: number;  // inclusive, word-aligned
  endIndex: number;    // exclusive, word-aligned
  color: string;       // captured at creation time
}

interface TextInputProps {
  mode?: 'input' | 'view';        // default 'input'; parent-owned (Task 5 wires 'view' after Start Merge)
  initialText?: string;           // uncontrolled after mount
  color?: string;                 // highlight color, default '#0080FF'
  maxCharacters?: number;         // default 500
  label?: string;
  id?: string;
  onTextChange?: (text: string) => void;
  onChange?: (snippets: Snippet[]) => void;  // full array on every mutation
}
```

---

## 3. Core mechanics

### Tokenization and boundaries

- `tokenize(text)` splits with `text.split(/(\s+)/)` (capture group kept) producing alternating word/whitespace tokens, each with its char offset and `isWord` flag.
- A **word boundary** is the start char of any word, plus a final boundary at `text.length`. Snippets are always word-aligned half-open `[startIndex, endIndex)` ranges.
- `getBoundaryFromEvent` resolves the hovered word and picks start vs end boundary by cursor half: `(offsetX ?? 0) < offsetWidth / 2` → word start, else word end. In jsdom (no layout) this deterministically resolves to the word END boundary — tests rely on that.

### Drag state machine (hook)

```
drag =
  | { type: 'create'; anchor: number; current: number }
  | { type: 'resize'; snippetId: string; edge: 'start' | 'end'; boundary: number }
  | null
```

- `pointermove` (idle): hovering a free word sets `hoverBoundary` (single hover needle); hovering a highlighted word sets `hoverSnippetId` (two snippet needles). Moving over a needle element is ignored (prevents the needle from erasing its own hover state — the flicker bug).
- `pointerdown`: on a snippet needle → resize drag for that edge; on the hover needle **or any free word** → create drag anchored at the resolved boundary. Pointerdown on a highlighted word body does nothing.
- `pointerup`: committed via a `window` listener (registered only while dragging) so drags end even if the pointer leaves the container.
- All needles get `pointer-events: none` while dragging so they never block word hit-testing.

### Commit rules

- **Create**: range = `[min(anchor, current), max(anchor, current))`, start trimmed past leading whitespace (`trimRangeStart`). Zero width → no snippet, no callback. Otherwise append `{ id: generateId(), text, startIndex, endIndex, color }` and call `onChange` with the full array.
- **Resize**: boundary clamped to the opposite edge and against neighbor snippets (`clampResizeBoundary`); start edge additionally trimmed past whitespace. If the range collapses (`start === end`) the snippet is **removed**; otherwise `text` is recomputed. `onChange` always fires with the full array.
- **Overlap prevention** (silent, no errors): create drags clamp at the nearest existing snippet edge (`s.startIndex >= anchor` when dragging right; largest `s.endIndex <= anchor` when dragging left); resize clamps against neighbors. Pointerdown on a word inside a snippet never starts a create.
- **Text edit**: typing truncates to `maxCharacters`, calls `onTextChange`, and clears all snippets (indices invalidated) → `onChange([])` if any existed.

### Needle positioning — `computeNeedlePosition`

Pure function mapping a boundary char index to `{ left, top }` from a map of word span boxes:

- word-start boundary → the word's left edge (`offsetLeft`)
- word-end / text-end boundary → the **preceding word's right edge** (`offsetLeft + offsetWidth`)
- fallback: first word's left edge

The initial implementation positioned word-end needles at the preceding word's `offsetLeft`, which drew the "end of first word" needle at the same x as "start of first word" — the reported "first word ignored" bug. The right-edge rule is the fix and is locked by regression tests at both the pure-function seam and the component seam (offsets stubbed via `Object.defineProperty`).

### Highlighting

- Committed snippet words: `withAlpha(snippet.color, 0.3)`; live preview words: `withAlpha(color, 0.2)`.
- **Whitespace tokens are highlighted too** when fully inside the effective range — everything between the two needles is highlighted, including spaces between words. Spaces outside the range (including the trimmed leading space) are not.
- Live resize preview: while a resize drag is active, highlights follow the effective (clamped + trimmed) range, not just the committed one.
- `user-select: none` on the view container disables the browser's native selection highlight under the needles.

---

## 4. Styling

- Root: design.md card — 0.75rem radius, 1px divider border, `0 2px 12px rgba(0,0,0,0.06)` shadow, paper background.
- Input mode: MUI `TextField` (multiline, rows 4) with 2px accent focus ring; counter `"{used}/{max}"` bottom-right (0.875rem, secondary text).
- View mode: `white-space: pre-wrap`, `touch-action: none`, `user-select: none`, line-height 1.8.
- Needle: 4px × 1.5em vertical bar, `ew-resize` cursor, invisible `::before` hit area (±6px horizontal). Dynamic colors are inline styles (prop-driven); everything else uses MUI palette tokens.

## 5. i18n

`textInput.placeholder`, `textInput.counterLabel`, `textInput.emptyView`, `textInput.needleHover`, `textInput.needleStart`, `textInput.needleEnd` — added to both `en-US.json` and `pt-BR.json`.

---

## 6. Testing strategy

- jsdom has no layout: `offsetLeft/offsetWidth` are 0 and `offsetX` is undefined, so the suite pins interaction behavior through `data-*` attributes (`data-word-start`, `data-role`, `data-boundary`, `data-token-start`) and `fireEvent.pointer*` (bubbles to the window commit listener).
- Position-dependent behavior (needle x-coordinates) is tested by stubbing offsets with `Object.defineProperty` on rendered word spans plus a pure-function unit suite for `computeNeedlePosition`.
- Fixture text `"alpha beta gamma"` / `"alpha beta gamma delta"` with known char ranges; the jsdom half-heuristic makes drags resolve to word END boundaries, so expected indices are fully deterministic.
- Verification: `npx vitest run` (34/34 green), `npm run lint` (oxlint, clean), `npx tsc -b` (clean).

---

## 7. Deviations from spec.md

The spec predates implementation; the component was built to the roadmap and then adjusted through user feedback. Functional deltas (all deliberate, verified by tests unless noted):

| Area | Spec | Implemented | Reason |
| ---- | ---- | ----------- | ------ |
| Default highlight | `#FF1493` (Magenta) | `#0080FF` (Electric Blue) | design.md lists Electric Blue as the accent highlight; user approved during review |
| Color prop | `highlightColor` | `color` | Simpler contract; value captured per snippet |
| Text control | controlled `value` + `onValueChange` | uncontrolled `initialText` + `onTextChange` | Task 1 needs no parent text ownership; Task 5 only flips `mode` |
| Word unit | Unicode letter/number runs; punctuation is its own stop (`Hello, world` → stops `0,5,6,7,12`) | maximal non-whitespace runs (`Hello,` is one token; stops `0,5,7,12`) | Whitespace split is simpler and matches the merge use case; revisit if punctuation-level stops are requested |
| Snippet removal | click/tap the highlight body | drag a resize needle until the range collapses (zero width removes) | Chosen during implementation; click-to-delete not built |
| Zero-length resize | snap back to previous range | collapse removes the snippet | Removal needs an affordance; collapse doubles as delete |
| Resize needles visibility | persist at both ends after commit | shown while hovering the snippet | Less visual noise; same capability |
| Create gesture | pointerdown only on the hovered needle | also starts on pointerdown over any free word | More forgiving hit target |
| Clearing snippets | mode switch `view → input` clears | cleared when the text is edited (typing), not on mode flip | Mode flips alone don't invalidate indices |
| View-mode empty value | render empty text, no needles | translated empty-state message | Clearer UX |
| Counter | remaining `500 - length` | used/max `"{used}/{max}"` | Convention picked during implementation |
| Snippet id | UUID | `snippet-<timestamp36>-<random36>` | No `crypto.randomUUID` dependency in jsdom; uniqueness sufficient |
| Touch reveal | 400ms press-and-hold reveals nearest needle | not implemented | Pointer Events unify mouse/touch for drag; the hold-to-reveal gesture is deferred |
| Coarse-pointer hit target | ≥44px | needle hit area ±6px (~16px) | Deferred with touch work |
| Overlap reject | silent: create adds nothing / resize snaps back | silent: drags clamp live at blocking snippet edges | Same outcome (never persists overlap), better feedback |

## 8. Post-implementation fix log

Bugs found in review/user testing, each locked by a red-then-green regression test:

1. **Overlap clamp off-by-one** — create-drag right clamp used `s.startIndex > anchor`; a drag starting exactly at a snippet's start boundary could still create an overlapping snippet. Fixed to `>=`.
2. **Needle hover flicker** — `pointermove` over a needle cleared hover state (needles carry no `data-word-start`), making needles vanish when grabbed. Move handler now ignores needle targets while idle.
3. **No live resize preview** — highlights only followed committed ranges; `getWordStyle` now applies the effective range during resize drags.
4. **Word-end needles drawn at the wrong x** (reported as "first word ignored") — needles at word-end boundaries were positioned at the preceding word's left edge instead of its right edge, so "end of The" and "start of The" needles drew at the same pixel. Fixed in `computeNeedlePosition`.
5. **Whitespace not highlighted** — only word spans were styled; whitespace tokens now share `getWordStyle` so everything between the needles is highlighted.
6. **Native selection highlight** — browser text selection showed under the needles; `user-select: none` added to the view container.
7. **Leading whitespace in snippets** (user request) — `trimRangeStart` advances the snippet start past whitespace in both the live preview and the commit (create and start-edge resize).
8. **First word unselectable / no needle at index 0** (user report) — `getBoundaryFromEvent` used `e.nativeEvent.offsetX < el.offsetWidth / 2` for the half-word test, but Chromium reports `offsetX/offsetY` for `display: inline` targets relative to the target's **offsetParent** (the view container), not the element itself (verified in a real browser: hovering the left quarter of the first word reported `offsetX ≈ 104` against a 39px word). The test therefore evaluated `false` for every word, so only word-end boundaries were ever produced. This is invisible mid-text (word-end of word N sits at the same pixel as word-start of word N+1) but at index 0 the needle never appears and a drag back over the first word stays anchored at its end (zero width, no snippet). Fixed by testing `e.clientX` against `el.getBoundingClientRect()` (viewport coordinates, immune to the inline-offset quirk). Verified in a real Chromium via a Playwright harness: hover left half → needle at boundary 0; drag back → snippet `[0, 5]`. Locked by regression tests stubbing `getBoundingClientRect` with `Object.defineProperty`.

## 9. Known gaps / deferred

- Touch press-and-hold needle reveal and 44px coarse-pointer hit targets (TXTIN-30–33) — pointer events work on touch, but the dedicated touch affordances are not built.
- Click/tap-the-highlight-to-delete (TXTIN-23/24) — removal currently only via resize collapse.
- Keyboard needle navigation — out of scope per context.md.
- Snippet state is component-owned; the snippets context (Task 3) aggregates it via `onChange`.
