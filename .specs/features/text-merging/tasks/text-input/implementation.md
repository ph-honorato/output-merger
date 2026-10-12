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
- `getBoundaryFromEvent` resolves the hovered word from caret geometry: `caretIndexFromPoint` (feature-detected `document.caretRangeFromPoint` / `caretPositionFromPoint`, Chromium's inline-`offsetX` quirk makes raw `offsetX` unusable — see fix log #8) → token containing the char index (`resolvePointerAt`) → the pointer must sit inside the token's line-box rect (matching the old per-word-span hit boxes: leading gaps and empty space past the last word resolve to nothing) → half rule `clientX < rect.left + width/2` picks start vs end boundary. Carets resolved past a word (right half of its last char, or text end) are attributed back to the preceding word when the pointer is inside its rect (fix log #11); whitespace tokens resolve without a boundary so snippet hover survives over the spaces inside a snippet (fix log #10).

### View rendering (refactored: segment-based)

The per-word-span DOM was replaced to scale toward a future 5000-char limit (~2500 token spans → O(snippets)):

- `computeSegments(text, snippets, drag, color)` merges committed snippets and the live drag range into disjoint `{ start, end, color?, alpha? }` segments; the component renders one `<span data-segment-start>` per segment (plain or highlighted). Node count is O(snippets), independent of word count.
- Segment boundaries always fall on token boundaries (snippet indices are word-aligned), so words are never split across a plain/highlight edge; each segment has a single text node and `data-segment-start` maps local caret offsets to global char indices.
- Highlight spans use `box-decoration-break: clone` so wrapped lines get per-line backgrounds.

### Drag state machine (hook)

```
drag =
  | { type: 'create'; anchor: number; current: number }
  | { type: 'resize'; snippetId: string; edge: 'start' | 'end'; boundary: number }
  | null
```

- `pointermove` (idle): hovering a free word sets `hoverBoundary` (single hover needle); hovering a highlighted word **or the whitespace inside a snippet** sets `hoverSnippetId` (two snippet needles). Moving over a needle element is ignored (prevents the needle from erasing its own hover state — the flicker bug).
- `pointerdown`: on a snippet needle → resize drag for that edge; on the hover needle **or any free word** → create drag anchored at the resolved boundary. Pointerdown on a highlighted word body or on whitespace (inside or outside a snippet) does nothing.
- `pointerup`: committed via a `window` listener (registered only while dragging) so drags end even if the pointer leaves the container.
- All needles get `pointer-events: none` while dragging so they never block word hit-testing.

### Commit rules

- **Create**: range = `[min(anchor, current), max(anchor, current))`, start trimmed past leading whitespace (`trimRangeStart`). Zero width → no snippet, no callback. Otherwise append `{ id: generateId(), text, startIndex, endIndex, color }` and call `onChange` with the full array.
- **Resize**: boundary clamped to the opposite edge and against neighbor snippets (`clampResizeBoundary`); start edge additionally trimmed past whitespace. If the range collapses (`start === end`) the snippet is **removed**; otherwise `text` is recomputed. `onChange` always fires with the full array.
- **Overlap prevention** (silent, no errors): create drags clamp at the nearest existing snippet edge (`s.startIndex >= anchor` when dragging right; largest `s.endIndex <= anchor` when dragging left); resize clamps against neighbors. Pointerdown on a word inside a snippet never starts a create.
- **Text edit**: typing truncates to `maxCharacters`, calls `onTextChange`, and clears all snippets (indices invalidated) → `onChange([])` if any existed.

### Needle positioning — `computeNeedlePosition`

Pure function mapping a boundary char index to a container-relative `{ left, top }` via an injected char-rect provider (`TextInput.geometry.ts` `rectForRange`, built on DOM `Range` rects):

- word-start boundary → left edge of the word's first char rect
- word-end / text-end boundary → right edge of the preceding char rect
- positions are computed in a `useLayoutEffect` after commit (text nodes change identity per render, so positions cannot be read during render) and written directly to the needle elements; `root.getBoundingClientRect()` supplies the origin

History: the first implementation used `offsetLeft/offsetWidth` word maps, with the "preceding word right edge" rule fixing the "first word ignored" bug (word-end needles drawn at the preceding word's left edge). The Range-based rewrite keeps that rule at the char-rect level and is locked by pure-function tests with injected rects plus a real-browser Playwright pass.

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

- jsdom has neither caret APIs nor Range geometry, so `TextInput.geometry.ts` (`caretIndexFromPoint`, `rectForRange`) is the testing seam: the suite `vi.mock`s it with a virtual monospace layout (10px per char, line box 0–19) and drives interactions with `clientX/clientY`, exercising the real caret→word→half-rule logic. Pure helpers (`computeSegments`, `findWordTokenAt`, `resolveBoundaryAt`, `computeNeedlePosition`) are unit-tested directly with injected rects.
- The suite pins interaction behavior through `data-*` attributes (`data-segment-start`, `data-role`, `data-boundary`) and `fireEvent.pointer*` (bubbles to the window commit listener).
- Fixture text `"alpha beta gamma delta"` with known char ranges; boundary x-coordinates map deterministically to word halves.
- Real-browser verification (Playwright + installed Chromium, dev server): every fix-log bug re-checked live — boundary-0 needle, drag-back snippet `[0,5]`, start alignment, mid-drag cursor, resize drag, preview flow — plus a 5000-char stress page (`maxCharacters` prop override, temporary harness, not shipped): 5000 chars render as **1 segment node**, hover/drag/commit work, drag steps stay interactive.
- Verification: `npx vitest run` (36 TextInput tests, full suite green), `npm run lint` (oxlint, clean), `npx tsc -b` (clean).

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
| Cursor during needle drag | unspecified | container cursor switches to `ew-resize` while a drag is active (`$dragging` on the view container) | Needles are `pointer-events: none` mid-drag, so the container must carry the resize cursor for continuous feedback |
| View DOM model | unspecified | one span per text segment (plain or highlighted), O(snippets) nodes instead of one span per word/whitespace token | Scales to the planned 5000-char limit; hit-testing via caret geometry + line-box clamp preserves the old span hit behavior |
| View text alignment | unspecified | `text-align: start` on the view container | The MergeSession wrapper centers page content; the component must not inherit it (fix log #9) |

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
9. **View-mode text centered after Start Merge** (user report) — the MergeSession page wrapper sets `text-align: center`, which inherits into the view-mode token spans; the input-mode `<textarea>` keeps its own UA default alignment, so the text visually "jumps to the middle" when the mode flips. The `TextViewContainer` now declares `text-align: start` so the component owns its content alignment and is immune to page-level centering. Verified in a real Chromium: computed `textAlign: start`, first word at container `offsetLeft: 0`. Locked by a regression test rendering the component inside a centered parent.
10. **Snippet needles vanish when hovering the whitespace inside a snippet** (user report, surfaced by the span-free refactor) — resolution only matched word tokens, so a caret landing on whitespace cleared `hoverSnippetId`. `resolvePointerAt` now resolves whitespace tokens too (with `boundary: null`): idle hover keeps snippet needles alive over any char inside the snippet, while pointerdown on whitespace still starts nothing and drags still ignore whitespace. Whitespace outside snippets keeps clearing hover, except where the needles' own ±6px hitboxes cover the gap (anti-flicker early-return keeps the needles visible there — desirable). Verified in a real Chromium.
11. **Word-end boundary unreachable in the right half of a word's last char** (found while verifying #10) — browsers resolve `caretRangeFromPoint` to the char boundary nearest the pointer, so the right half of a word's last char yields the caret position *after* the word (the following whitespace start, or text end); resolution then found the whitespace token instead of the word, hiding the hover needle and blocking drags from that sliver (present since the refactor; masked by the virtual-layout test mock). `resolvePointerAt` now attributes such carets back to the preceding word whenever the pointer lies inside that word's rect (token rects are contiguous, so the box test is unambiguous), and also attributes a caret at text end to the last token. The test mock now mirrors the real half-resolved caret (`localX < half → charStart : charStart + 1`), and the attribution is locked by pure and component regression tests, verified in a real Chromium (hover and full drag from the word's right edge).
12. **Needles vanish over line breaks inside a snippet** (user follow-up to #10) — whitespace tokens use a vertical-only line-box clamp in `resolvePointerAt`. Line-break tokens have **zero-width rects** (left == right at the line end) and every pointer in the trailing empty area of a line resolves its caret to the line break, so the horizontal containment test could never pass and the hover cleared. The vertical test still rejects pointers in the leading between lines (keeping decision "as today"), and free whitespace outside snippets still clears. Locked by pure tests (zero-width rect resolves anywhere on its line, vertical rejection) and a multi-line component test with a two-line virtual layout; verified in a real Chromium across all hover regions of a snippet spanning a line break.

## 9. Known gaps / deferred

- Touch press-and-hold needle reveal and 44px coarse-pointer hit targets (TXTIN-30–33) — pointer events work on touch, but the dedicated touch affordances are not built.
- Click/tap-the-highlight-to-delete (TXTIN-23/24) — removal currently only via resize collapse.
- Keyboard needle navigation — out of scope per context.md.
- Snippet state is component-owned; the snippets context (Task 3) aggregates it via `onChange`.
