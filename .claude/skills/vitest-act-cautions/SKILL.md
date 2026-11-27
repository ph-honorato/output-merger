---
name: vitest-act-cautions
description: Cautions when writing Vitest + React Testing Library tests in this project to avoid "not wrapped in act(...)" warnings. Use when creating or editing *.test.tsx files under artifacts/output-merger.UI/src.
metadata:
  author: ph-honorato
  version: '1.0.0'
---

# Vitest + React Testing Library — act() Cautions

These rules prevent the noisy `An update to X inside a test was not wrapped in act(...)` warnings that make `npm run test` output unreadable. They come from state updates escaping React's `act()` boundary.

## 1. Wrap `render` in `act()`

Every `render(...)` (and `renderHook`) call that mounts a component subscribing to external state (context, i18n, media queries) must be wrapped:

```tsx
const renderWithProviders = (updates) => {
  let rendered!: ReturnType<typeof render>;
  act(() => {
    rendered = render(<... />);
  });
  return rendered;
};
```

Returning the render result from inside `act` keeps `rerender`/`unmount`/`container` available.

## 2. Wrap `rerender` and `unmount`-triggering updates too

State updates fired by `rerender(...)` (e.g. a `SeedUpdates` effect calling `setSourceSnippets`) also escape `act`. Wrap them:

```tsx
act(() => {
  rerender(<... />);
});
```

## 3. Wrap `afterEach` / `beforeEach` resets that touch i18n

`i18n.changeLanguage(...)` dispatches into `SnippetsProvider` (which mirrors the language). Always:

```tsx
afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage('en-US');
  });
  vi.restoreAllMocks();
});
```

## 4. Wrap direct state-triggering interactions

- `fireEvent.click(...)` / `userEvent.click(...)` that flip shared context state: wrap in `act(() => { fireEvent.click(...); })` when the component re-rend is not automatically covered.
- `i18n.changeLanguage(...)` inside a test body: always `await act(async () => { await i18n.changeLanguage('pt'); })`.
- `vi.advanceTimersByTime(...)` (fake timers): wrap in `act(() => { vi.advanceTimersByTime(n); })`.
- `viewport.setBelowMd(...)` / media-query listener notifications: wrap in `act(...)`.

## 5. Wrap `act(async () => {})` flushes after async events

After `fireEvent.pointerUp`, `fireEvent.keyDown` that trigger async state updates, flush with:

```tsx
await act(async () => {});
// or
await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
```

## 6. Do NOT suppress the warning globally

Do not add a `console.error` filter in `src/test/setup.ts` that silences "not wrapped in act". Fix the tests instead. The only acceptable suppression is for warnings that originate inside third-party libraries (e.g. dnd-kit's `DndContext` / `AnimationManager`) and cannot be wrapped from test code — and even then, prefer leaving them visible.

## 7. Verify

Run the single test file with `--reporter=verbose` and confirm no "not wrapped in act" lines remain (aside from the dnd-kit internals noted above).

```bash
npx vitest run src/.../Foo.test.tsx --reporter=verbose
```
