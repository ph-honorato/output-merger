# Spec: Mobile Adjustments - TextInput Mobile Behaviors

## Overview

Task 6.6 introduces mobile-specific behaviors for the `TextInput` component. The scope is intentionally limited to `TextInput`: a compact mobile header with a minimize toggle, a touch-friendly snippet creation flow based on long-press, persistent resize handles for committed snippets, larger touch targets, and vertical scroll support in view mode. Desktop behavior remains unchanged.

Breakpoint gate: `theme.breakpoints.down('md')` (below 900px), consistent with the rest of the app (e.g. `PreviewModal`).

## Requirements

### 1. Mobile Header with Minimize Toggle

- Add an optional `inputNumber?: number` prop to `TextInputProps`.
- On mobile (below `md`), render a header row above the body containing:
  - A title: `t('textInput.header', { number: inputNumber })` -> "Text {{number}}" (en-US) / "Texto {{number}}" (pt-BR).
  - A minimize chevron `IconButton` (MUI `ExpandMore`/`ExpandLess`) that toggles local `minimized` state.
- The header replaces the existing `Label` on mobile; desktop keeps rendering `Label` and has no header.
- `minimized` defaults to `false` (expanded). When minimized, hide the body (textarea/view container + counter/empty state); the header stays visible. Snippets are preserved because component state is not unmounted.
- `minimized` state resets on remount and resets to `false` when the viewport switches from mobile to desktop (uncollapse).
- Chevron accessibility:
  - `aria-expanded={!minimized}`
  - `aria-label={t(minimized ? 'textInput.expand' : 'textInput.minimize')}` (action-oriented).
  - Icon flips `ExpandMore` (expanded) / `ExpandLess` (minimized) — or the reverse consistent with "collapse" semantics; tests assert the flip.

### 2. Mobile Touch Flow for Snippet Creation

- Below `md`, replace the existing pointer flow with a long-press flow:
  - Pointer down on a word starts a ~400ms timer. No drag is created yet.
  - If the pointer moves beyond a small threshold before the timer fires, cancel the timer (allow scrolling).
  - When the timer fires, start a create drag anchored at that word and allow pointer move to extend it.
  - Pointer up commits only if a drag is active; a plain tap (no long-press) does not create a snippet.
  - Handle/needle pointer down always takes priority and resizes immediately (no long-press).
- Desktop and coarse-pointer (>= md) keep the existing flow unchanged.

### 3. Persistent Resize Handles on Mobile

- On mobile, committed snippets always render both resize handles (`snippet-start` and `snippet-end`) regardless of hover. Desktop keeps hover-only behavior.
- Touch targets for handles must be at least 44px (expand the needle hit area via `::before`/padding on mobile).
- Resize priority: handle drag > word-hold drag. If a pointer down lands on a handle, resize that edge; otherwise the long-press/word flow applies.

### 4. Secondary Resize via Word Hold

- On mobile, in addition to dragging persistent handles, a user can hold the first/last word of a committed snippet and drag to resize that edge.
- Handle drag takes priority when both are possible.

### 5. Vertical Scroll in View Mode

- Mobile view mode container uses `touch-action: pan-y` to allow vertical panning while still permitting horizontal drag after long-press.
- Desktop keeps `touch-action: none`.

## i18n Additions

Add to both `en-US.json` and `pt-BR.json`:

- `textInput.header`: "Text {{number}}" / "Texto {{number}}"
- `textInput.minimize`: "Minimize" / "Minimizar"
- `textInput.expand`: "Expand" / "Expandir"

## Acceptance Criteria

### Mobile Header
- [ ] Below `md`, `TextInput` renders a header with text "Text n" (when `inputNumber` is provided) instead of the `Label`.
- [ ] Above `md`, no header is rendered and `Label` renders as before.
- [ ] Minimize toggle hides the body (textarea/view + counter) while keeping the header.
- [ ] Minimized state resets on remount.
- [ ] Switching from mobile to desktop while minimized uncollapses (`minimized` becomes `false`).
- [ ] Chevron has `aria-expanded` reflecting expanded state and an `aria-label` of "Minimize"/"Expand" (translated).

### Touch Flow
- [ ] A ~400ms long-press on a word then drag creates a snippet on mobile.
- [ ] A plain tap on a word does not create a snippet.
- [ ] Existing desktop pointer flow is unchanged (existing tests pass untouched).

### Handles
- [ ] On mobile, committed snippets always show both resize handles.
- [ ] Handle touch targets are at least 44px.
- [ ] Handle drag takes priority over word-hold resize.

### Scroll
- [ ] Mobile view mode container has `touch-action: pan-y`.
- [ ] Desktop view mode container keeps `touch-action: none`.

### Tests
- [ ] New file `src/components/TextInput/TextInput.mobile.test.tsx` covers: mobile header render/minimize toggle, minimized hides body, chevron `aria-expanded`, mobile snippet creation via long-press, persistent handles, resize.
- [ ] Existing `TextInput.test.tsx` remains untouched and passing.

## Technical Design

### Props

```ts
// TextInput.types.ts
export interface TextInputProps extends EntranceAnimationProps {
  // ...existing...
  inputNumber?: number;
}
```

### Component (TextInput.tsx)

```tsx
const theme = useTheme();
const isMobile = useMediaQuery(theme.breakpoints.down('md'));
const [minimized, setMinimized] = useState(false);

useEffect(() => {
  if (!isMobile) setMinimized(false);
}, [isMobile]);

// pass isMobile into the hook
const { ... } = useTextInput({ ...props, maxCharacters, isMobile });

// render
{isMobile ? (
  <S.Header>
    <S.HeaderTitle>{t('textInput.header', { number: inputNumber })}</S.HeaderTitle>
    <S.MinimizeButton
      onClick={() => setMinimized((v) => !v)}
      aria-expanded={!minimized}
      aria-label={t(minimized ? 'textInput.expand' : 'textInput.minimize')}
    >
      {minimized ? <ExpandLess /> : <ExpandMore />}
    </S.MinimizeButton>
  </S.Header>
) : (
  label ? <S.Label>{label}</S.Label> : null
)}
{!minimized && (/* existing body */)}
```

### Hook (TextInput.hook.tsx)

```ts
export const useTextInput = (props: TextInputProps & { maxCharacters: number; isMobile: boolean }) => {
  const { ..., isMobile } = props;
  // long-press timer ref + pending anchor
  // mobile branch in handlePointerDown / handlePointerMove
  // getNeedles: if isMobile, include all committed snippet handles
};
```

Long-press constants: `MOBILE_LONG_PRESS_MS = 400`, movement threshold ~8px.

### Styles (TextInput.styles.ts)

- Add `Header`, `HeaderTitle`, `MinimizeButton` (or reuse MUI IconButton).
- Needle touch targets: on mobile (`@media (max-width: 899px)` or theme breakpoint), expand `::before` to at least 44x44px.
- `TextViewContainer`: default `touch-action: none`; mobile media query `touch-action: pan-y`.

### MergeSession wiring

Pass `inputNumber={1}` and `inputNumber={2}` to the two `TextInput` instances in `MergeSessionPage.tsx`.

## Files to Modify/Create

### Modified Files
1. `src/components/TextInput/TextInput.types.ts` — add `inputNumber?: number`.
2. `src/components/TextInput/TextInput.tsx` — mobile header, minimize state, `isMobile`, pass to hook, conditional body.
3. `src/components/TextInput/TextInput.hook.tsx` — mobile long-press flow, persistent needles on mobile, priority handling.
4. `src/components/TextInput/TextInput.styles.ts` — header styles, touch targets, `touch-action` media query.
5. `src/i18n/resources/en-US.json` — new keys.
6. `src/i18n/resources/pt-BR.json` — new keys.
7. `src/pages/MergeSession/MergeSessionPage.tsx` — pass `inputNumber`.

### New Files
1. `src/components/TextInput/TextInput.mobile.test.tsx` — mobile-focused tests.

### Files to Reference (No Changes)
- `src/theme/index.ts` — breakpoints.
- `src/components/TextInput/TextInput.test.tsx` — existing desktop tests (must remain untouched).

## Testing Strategy

### New Mobile Test File (`TextInput.mobile.test.tsx`)
- Mock viewport below `md` using the same `installViewport` pattern as `PreviewModal.test.tsx`.
- Mobile header renders "Text 1"/"Text 2" and no `Label`.
- Minimize toggle hides body; chevron `aria-expanded` flips; aria-label switches Minimize/Expand.
- Minimized state resets on remount.
- Long-press (~400ms, use fake timers) then drag creates a snippet; plain tap does not.
- Committed snippets show both handles on mobile.
- Resize via handle works.
- View container `touch-action: pan-y` on mobile.

### Existing Tests
- `TextInput.test.tsx` must remain untouched and pass (desktop behavior unchanged).

## Dependencies
- MUI `useMediaQuery`, `IconButton`, icons `ExpandMore`/`ExpandLess` (already available).
- react-i18next (already in project).
- Vitest fake timers for long-press tests.