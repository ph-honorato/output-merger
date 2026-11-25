# Subtasks for Task 6.6: Mobile Adjustments

**Implementation Path:** `.specs/features/06-ui-ux-adjustments/tasks/6.6-mobile-adjustments/`

## Subtasks

- [ ] **Task 6.6.1: TextInput mobile header & minimize** — Add `inputNumber` prop, mobile header with "Text {{number}}" title, local `minimized` state, chevron toggle (ExpandMore/ExpandLess), aria-expanded/aria-label, reset on remount and on desktop switch; pass `inputNumber` from MergeSessionPage.
- [ ] **Task 6.6.2: Mobile long-press snippet creation** — Replace pointer flow below `md` with ~400ms long-press then drag; cancel on movement; tap does not create; keep desktop/coarse flow unchanged.
- [ ] **Task 6.6.3: Persistent resize handles & touch targets** — Always render both snippet handles on mobile; expand touch targets to >=44px; handle drag priority over word-hold resize.
- [ ] **Task 6.6.4: Secondary resize & vertical scroll** — Allow resizing by holding first/last word and dragging on mobile; set view container `touch-action: pan-y` on mobile (desktop `none`).
- [ ] **Task 6.6.5: i18n & mobile tests** — Add `textInput.header`, `textInput.minimize`, `textInput.expand` keys (en-US/pt-BR); create `TextInput.mobile.test.tsx` covering header/minimize/aria-expanded, long-press creation, persistent handles, resize; keep existing desktop tests untouched.