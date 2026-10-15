# Sorting Drop Indicator Implementation

**Implemented:** 2026-10-15
**Spec:** `.specs/features/preview-area-tools/tasks/sorting-drop-indicator/spec.md`
**Context:** `.specs/features/preview-area-tools/tasks/sorting-drop-indicator/context.md`
**Code:** `artifacts/output-merger.UI/src/`
**Status:** Implemented — Feature 3, Task 1.6 (roadmap "Add user feedback while sorting") complete; verified by 15 new automated tests (169 total), oxlint, `tsc -b`

---

## 1. Deliverables

| File | Role |
| ---- | ---- |
| `src/pages/MergeSession/components/PreviewArea/PreviewArea.hook.tsx` | Modified: pure `computeNeedleIndex(fromIndex, overIndex)` exported beside `buildSortableId` (codebase precedent); `dropIndicatorIndex: number \| null` state; needle set at the origin slot in `handleDragStart`, recomputed on every `onDragOver` (new `handleDragOver`, wired into DndContext), cleared in the same lifecycle step as the overlay state in `handleDragEnd` and `handleDragCancel` |
| `src/pages/MergeSession/components/PreviewArea/PreviewArea.styles.ts` | Modified: two new styled components — `DropIndicator` (zero-width, zero-height `inline-block` anchor, `position: relative`, `pointer-events: none`) and `DropIndicatorBar` (absolutely positioned inside the anchor: 4px × 1.5em, 2px radius, `palette.text.secondary`) |
| `src/pages/MergeSession/components/PreviewArea/PreviewArea.tsx` | Modified: `onDragOver={handleDragOver}` on the per-instance `DndContext`; the needle (`data-testid="preview-drop-indicator"`, `aria-hidden`, bar child) renders exactly once at the landing slot — before the segment currently occupying the slot (before its separator), or after the last segment for the trailing slot |
| `src/pages/MergeSession/components/PreviewArea/PreviewArea.test.tsx` | +15 tests in a new `PreviewArea drop indicator` suite: helper units (placement branches, hiding, moveSnippet agreement), i18n zero-new-keys, empty state, keyboard presence/hop/lifecycle/parity/flow-integrity/single-snippet/appearance, pointer presence/hop/lifecycle/Escape/backward/trailing, hook-level vanish/no-target/stability |
| `.specs/features/preview-area-tools/tasks/sorting-drop-indicator/implementation.md` | This record |

No backend files, no i18n resources, no `SnippetsContext`, no routes, no barrel, no new ADR/GLOSSARY entries, and no roadmap changes. The page components barrel (`components/index.ts`) was not touched because no new component folder was created (§3).

---

## 2. Behavior (as implemented)

```ts
// PreviewArea.hook.tsx — the placement rule (agent default per spec)
export const computeNeedleIndex = (
  fromIndex: number,
  overIndex: number | null
): number | null => {
  if (overIndex === null || fromIndex < 0 || overIndex < 0) {
    return null;
  }
  return fromIndex < overIndex ? overIndex + 1 : overIndex;
};
```

```tsx
// PreviewArea.tsx — one needle, at the landing slot in the flow
<S.SegmentFlow data-testid="preview-segment-flow">
  {snippets.map((snippet, index) => (
    <Fragment key={sortableIds[index]}>
      {renderDropIndicator(index)}   {/* before the separator that precedes segment `index` */}
      {index > 0 ? ' ' : null}
      <SortableSegment snippet={snippet} sortableId={sortableIds[index]} />
    </Fragment>
  ))}
  {renderDropIndicator(snippets.length)}  {/* the trailing slot n */}
</S.SegmentFlow>
```

- **Slot semantics**: the needle slot is a gap in the *current* render order `0..n` (the dragged chip still renders — dimmed — at its origin). `slot = from < to ? to + 1 : to`; self-hover (including the pickup instant) → the origin slot; `over === null` or an unresolved id (−1) → hidden. The slot is exactly the gap `moveSnippet(fromIndex, toIndex)` drops the chip into: splicing out at `from` and re-inserting at `to` puts the chip after the hovered item when moving forward, before it when moving backward — pinned by a 9-pair unit test against the reducer's splice model and by every integration drop outcome.
- **Lifecycle**: `handleDragStart` derives the origin slot; every `onDragOver` (pointer and keyboard drive the same DndContext path) re-resolves both ids against the live context array and recomputes; `handleDragEnd`/`handleDragCancel` clear the needle in the same event that clears the overlay chip (same render commit). A vanished active or hovered snippet yields −1 → hidden, mirroring Task 1's discard path.
- **Rendering**: the needle renders exactly once — inside the Fragment of the segment occupying the slot, immediately **after the preceding chip and before its separator** (so at a line-wrap boundary it stays on the earlier line, per the spec's wrap edge case), or after the last segment for the trailing slot `n`. It renders no text (`textContent` parity holds mid-drag) and is `aria-hidden`.
- **Complement, not replacement**: `rectSortingStrategy` shifts, the `DragOverlay` chip (zIndex 200, `dropAnimation={null}`), the 0.4 dimmed origin, the five `sorting.*` announcements, and the instructions element are unchanged — asserted explicitly while the needle is visible.

---

## 3. Key implementation decisions (the spec's flagged calls, plus agent defaults within its latitude)

- **Structural call (spec row "Component structure")**: styled spans in `PreviewArea.styles.ts` rendered inline between sortable items, **not** a new 6-file page sub-component. Rationale: the needle is purely presentational — no props, no hooks, no logic (all logic lives in `computeNeedleIndex` and the hook state); this mirrors the existing `OverlayChip` precedent (a styled span in `PreviewArea.styles.ts` rendered by `PreviewArea.tsx`); a 6-file split would create six near-empty files for a ~10-line element. AGENTS.md's component rules are satisfied: no new component folder → no new barrel export; the pure helper is exported from the hook file and barrel-imported nowhere else, per the `buildSortableId` precedent. Both options were explicitly sanctioned by the spec ("developer's structural call").
- **Layout footprint (spec's flagged warning, recommended option taken)**: a **zero-width AND zero-height** inline-block anchor (`width: 0; height: 0`) with the visible bar absolutely positioned inside it. A 0×0 inline-level box can never extend any line box or take any horizontal space, so dnd-kit's measured sortable rects and the `rectSortingStrategy` transforms cannot be perturbed while the needle appears, moves, or disappears mid-drag — regardless of the flow's line-height (verified: the flow inherits body1's 1.6 line-height from `CssBaseline → body → …` in `main.tsx`, but the anchor does not depend on it). The spec's fallback (a plain 4px inline element) was not needed. jsdom cannot observe real layout, so DROP-21's "no sibling jump" rests on this by-construction footprint plus the unchanged pointer suite (§6 lists the dev-server check).
- **Bar as a real child element, not a `::before` pseudo-element**: identical layout behavior (absolutely positioned, out of flow — the anchor never gains in-flow content, keeping the CSS 2.1 "baseline of an empty inline-block is its bottom margin edge" rule stable), but a real span is directly assertable via `toHaveStyle`/`getComputedStyle` in jsdom instead of requiring CSS-text parsing. The anchor element carries the testid and `aria-hidden`; the bar is decorative by inheritance.
- **DOM placement relative to separators**: the needle renders immediately after the preceding chip and *before* the space separator (inside the next segment's Fragment, as its first child). This is what makes the spec's wrap edge case hold by construction: the soft wrap happens at the separator, and content before it — including the needle — stays on the earlier line. It also matches the origin-slot wording ("between its preceding neighbor and the dragged chip"). The trailing slot `n` renders as the last child of the `SegmentFlow` (no trailing separator exists today, so the bar sits flush at the flow end; the separator appears only after the drop).
- **Vertical bar offset (`top: -1.1em`)**: the empty 0×0 anchor sits with its box on the text baseline, so the 1.5em bar spans from 1.1em above the baseline to 0.4em below — approximating the flow's 1.6em line box (ascent + half-leading ≈ 1.14em above, descent + half-leading ≈ 0.46em below for the Inter/Roboto stack), i.e. "the bar spans the reading line" per the spec's shape row. This em-offset is font-metric-approximate by nature → flagged for the dev-server pass (§6); it is a pure visual constant (DROP-15 pins 4px/1.5em/2px, which are asserted exactly).
- **Horizontal convention (`left: 0`)**: the bar's left edge sits exactly at the insertion point and extends 4px right — the TextInput needle's own convention (`left = char-boundary coordinate`, 4px wide), keeping the shape language consistent rather than centering the bar on the gap.
- **Neutral color verification (spec's flagged row)**: `background-color` reads `palette.text.secondary` through the styled-components theme object (no hex literal in the styles file); the test asserts the computed color equals `theme.palette.text.secondary` (`#64748b` light — the active theme) and explicitly *not* `theme.palette.primary.main` nor the dragged snippet's tint `rgba(0, 128, 255, 0.3)`. Visibility of a 4px `#64748b` bar on the white paper remains a dev-server item, as the spec flagged.
- **No-target (`over === null`)**: hidden, per the spec's documented pick (a no-target drop announces "cancelled" today). Under `closestCenter` a pointer drag almost always resolves *some* droppable, so this branch is defensive/transient (e.g. during fast moves before collision recompute) — pinned at the hook level.
- **i18n**: zero new keys — asserted by a key-set test (the `sorting.*` namespace contains exactly the five Task 1 keys in both languages; no key matching `/drop|indicator/i` exists in either resource). No aria attributes were added beyond `aria-hidden` (a boolean, not a string), so the "unavoidable aria need" clause never triggered and no translation files were touched.

---

## 4. Testing strategy

All new tests live in `PreviewArea.test.tsx` under `describe("PreviewArea drop indicator")`, reusing the file's existing harness (`renderWithProviders`, `seedInterleaved`, `installSegmentRects`, `pressKey`, fake-timer pointer helpers).

- **Pure helper units (+3)**: every placement branch (forward ×2, backward ×2, self ×2, forward-past-last → trailing slot, backward-onto-first → leading slot); hiding on null target / vanished active (−1) / vanished hovered (−1); a 9-pair exhaustive agreement test computing `moveSnippet`'s splice landing for all `(from, over)` in a 3-item order and asserting the needle slot equals the landing gap in the current render order (the test models the landing as "before the current item that follows the dropped chip in the final order, else the end").
- **Resources / empty state (+2)**: `sorting.*` key-set equality for both languages + no drop/indicator key anywhere; empty preview renders no needle and no drag wiring (no live region).
- **Keyboard drags (+5, mocked rects)**: pickup shows the needle at the origin slot (precedes the dragged chip), hops after Beta / before Gamma on ArrowRight, returns to the origin slot on ArrowLeft (self-hover), removed on Escape with the order unchanged; keyboard-vs-pointer parity — the same (Alpha over Beta) pair via both sensors renders the needle at the identical DOM position (keyboard phase, then a fresh unmounted/render for the pointer phase with a real-timer 50ms hold); flow integrity with wrap-capable long snippets — the needle is an inline-block `SPAN` child of the `SegmentFlow`, in-flow (`position: relative`, not coordinate-positioned against the container), sitting between the two chips, `textContent` empty, flow text equal to `buildMergedText` mid-drag (local rect mock gives the two long texts distinct rects so the pickup collision resolves to the dragged chip — jsdom computes no layout); single-snippet inert drag — arrows leave the needle at the origin slot, Space drops and clears it; appearance — `aria-hidden`, no role/tabIndex/aria-roledescription/aria-describedby, `pointer-events: none`, zero-size anchor (width/height 0), bar positioned absolute with width 4px, height 1.5em (24px computed at jsdom's 16px root; raw rule asserts `height:1.5em`), border-radius 2px, computed background = `theme.palette.text.secondary` (≠ primary, ≠ snippet tint), `animationName: none` / `transitionDuration: 0s`.
- **Pointer drags (+4, fake timers + mocked rects)**: full lifecycle — hidden before activation (25ms), origin slot at 50ms activation with overlay chip present and origin dimmed to 0.4, hops after Beta on the same drag (with the sibling transform still applied while the needle is visible), removed together with the overlay in one step on drop, and the drop lands exactly at the needle-marked slot (`[Beta, Alpha, Gamma]`); Escape cancels — needle + overlay removed, order unchanged; backward drag (Gamma over Beta) — needle precedes Beta, drop yields `[Alpha, Gamma, Beta]`; forward past the last snippet (Alpha over Gamma) — needle trails Gamma at the end of the flow with `textContent` parity mid-drag, drop yields `[Beta, Gamma, Alpha]`.
- **Hook-level lifecycle (+1)**: vanished active id at pickup → hidden; pickup → origin slot 0; over Beta → slot 2, stable across repeated identical events (idempotency); hovered snippet vanished → hidden without crash; `over: null` → hidden; drag end clears the needle with the overlay state and discards the reorder (Task 1 path, order unchanged).
- **All pre-existing suites pass unchanged** (154 tests; zero edits to existing tests) — the full pointer/keyboard/affordance/reducer/provider/tutorial contracts from Task 1 are intact.
- Verification: `npx vitest run` — **169/169 green across 12 files**; `npm run lint` (oxlint) — clean; `npx tsc -b` — clean (exit 0).

---

## 5. Per-requirement outcomes

| ID | Outcome | Note |
| -- | ------ | ---- |
| DROP-01 | Verified | Pointer lifecycle test: needle with `preview-drop-indicator` renders inside the flow while the drag is active and a target resolves |
| DROP-02 | Verified | Needle absent with no drag (pointer + keyboard tests) and below the 50ms hold (25ms check); renders only during the drag |
| DROP-03 | Verified | Hook test: `handleDragOver` with `over: null` → `dropIndicatorIndex` null; helper unit returns null |
| DROP-04 | Verified | Drop (pointer lifecycle, backward, trailing tests) and cancel (pointer + keyboard Escape) all remove the needle in the same lifecycle step as the overlay chip — both asserted null after one act tick |
| DROP-05 | Verified | While the needle is visible the overlay chip is in the document and the origin is dimmed to 0.4 (pointer lifecycle test); overlay/instructions wiring untouched in code |
| DROP-06 | Verified | Forward move: needle after Beta, before Gamma — pointer lifecycle + keyboard hop tests |
| DROP-07 | Verified | Backward move: needle before Beta — pointer backward test (drop outcome `[Alpha, Gamma, Beta]` matches) |
| DROP-08 | Verified | Pickup instant and self-hover both land at the origin slot — pointer lifecycle (activation), keyboard pickup + ArrowLeft-return, hook test |
| DROP-09 | Verified | Forward over the last snippet: needle after Gamma at the end of the flow (trailing slot `n`); drop lands Alpha last |
| DROP-10 | Verified | 9-pair splice-agreement unit test (all `(from, over)` in a 3-item order) + every integration drop lands exactly where the needle pointed |
| DROP-11 | Verified | Needle hops on the `onDragOver` that changes the hover (pointer move, keyboard arrow); repeated identical events keep the slot stable (hook test idempotency) |
| DROP-12 | Verified | Keyboard needle appears at pickup and updates through the same `handleDragOver` path (keyboard tests; `onDragOver` wired once on DndContext for both sensors) |
| DROP-13 | Verified | Parity test: the same (Alpha, Beta) pair via keyboard and via pointer renders the needle at the identical DOM position (`true:true` before-Gamma/after-Beta signature) |
| DROP-14 | Verified | Keyboard Escape: needle removed, merge order unchanged (keyboard lifecycle test) |
| DROP-15 | Verified | Bar: width 4px, height 1.5em (24px computed at 16px root; raw rule asserts `height:1.5em`), border-radius 2px — computed + generated-CSS assertions |
| DROP-16 | Verified | Computed background = `theme.palette.text.secondary` (`#64748b`); asserted ≠ `primary.main` and ≠ the snippet tint `rgba(0, 128, 255, 0.3)`; color read via the theme object, no literal in styles |
| DROP-17 | Verified | `aria-hidden="true"`; no role/tabIndex/aria-roledescription/aria-describedby; `pointer-events: none`; never in `SortableContext` items (rendered outside the sortable wrappers, has no id) |
| DROP-18 | Verified | No transition/animation declarations; computed `animationName: none`, `transitionDuration: 0s`; appear/disappear is a plain state flip (no entry/exit animation path exists) |
| DROP-19 | Verified | Mid-drag `flow.textContent` equals `buildMergedText` (flow-integrity test) and the literal merged string (pointer trailing test); needle `textContent` empty |
| DROP-20 | Verified | Needle is an `inline-block` SPAN, direct child of the `SegmentFlow`, in-flow (`position: relative`, not absolute against the container); DOM placement before the separator keeps it on the earlier line at wrap boundaries (by construction — jsdom does not compute layout; dev-server item §6) |
| DROP-21 | Verified | Zero-width, zero-height anchor (style assertions: width/height 0px) + absolute bar — cannot perturb measured rects/transforms by construction; sibling transform still applies while the needle is visible (pointer lifecycle test); all existing pointer tests green with no rect-jitter flakiness |
| DROP-22 | Verified | Hook test: vanished active (−1 at pickup) and vanished hovered (ghost id) hide the needle with no crash; drag end discards the reorder with the order unchanged (Task 1 discard path) |
| DROP-23 | Verified | Single-snippet keyboard drag: needle at the origin slot only, survives arrow moves (inert drag), cleared on drop |
| DROP-24 | Verified | Empty preview: no needle, no drag wiring (no live region) |
| DROP-25 | Verified | Key-set test: `sorting.*` namespace is exactly the five Task 1 keys in BOTH languages; no `/drop\|indicator/i` key in either resource; zero i18n file changes in the diff; the pre-existing verbatim-copy test keeps passing |

**25 total: 25 Verified, 0 Deviated, 0 Deferred.**

---

## 6. Deviations from spec.md

None — no requirement Deviated or Deferred, and every agent-default row of the spec's assumptions table was implemented as written. The judgment calls below are *within* the spec's own latitude (each is a choice the spec explicitly delegated); recorded here because two of them were flagged for implementation review:

- **Structural call**: styled spans in `PreviewArea.styles.ts` + inline rendering (the spec's first listed option) instead of a 6-file sub-component — see §3.
- **Footprint**: the spec's *recommended* zero-width inline anchor was taken, hardened to zero-height as well, with the bar as a real absolutely-positioned child instead of a pseudo-element (testability; identical layout semantics) — see §3.
- **Neutral color**: `palette.text.secondary` confirmed by computed-style assertions; the flagged dev-server visibility check remains (§7).
- **`top: -1.1em`** on the bar is a new visual constant (the spec pins the shape 4px/1.5em/2px, not the baseline offset); approximation reasoning in §3, dev-server check in §7.

---

## 7. Known gaps / deferred

jsdom computes no layout and renders nothing — these need a dev-server pass by the user (the spec flagged items 1 and 2):

1. **Neutral color visibility** — the `#64748b` (`text.secondary`) 4px bar against the white paper: clearly visible but not loud; confirm it does not read as content or a selection color.
2. **Vertical span of the bar** — `top: -1.1em` should center the 1.5em bar on the reading line (1.6 line-height); check it neither pokes into the previous line nor falls short of the glyph height.
3. **Horizontal placement** — the bar starts at the insertion point and extends 4px right (TextInput convention): check it reads well in the ~4px separator gap and against chip edges at the first slot and the trailing slot.
4. **Wrap boundary** — drag over a wrapped multi-line flow: the needle should sit at the end of the earlier line (guaranteed by DOM order; needs eyes).
5. **No sibling jump** — appear/move/disappear while siblings shift: zero-footprint by construction, but a real browser with live rect re-measurement is the only true confirmation.
6. **Complement interplay** — while the needle is visible, the overlay chip should keep following the pointer, the origin keep dimming, and the shifts keep opening the hole exactly as Task 1 shipped.

Deferred by spec (not gaps): strategy swap (the sibling shifts stay — user decision), direction-aware announcement copy, cross-instance needles, preview modal re-mount (Task 2), editable surface (Task 3), any animation for the needle.
