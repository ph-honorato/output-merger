# Subtasks for Task 5.1: Return Button

**Implementation Path:** `.specs/features/05-actions-bar-extensions/tasks/5.1-return-button/`

## Subtasks

- [x] **Task 5.1.1:** Add merge mode state to track whether merge has started (derived from inputs in view mode)
- [x] **Task 5.1.2:** Conditionally render "Return" button (with MUI KeyboardReturn icon) instead of "Start Merge" when in merge mode
- [x] **Task 5.1.3:** Create ReturnConfirmationModal component (MUI Dialog) in MergeSession/components/ with:
  - Warning message about snippet removal and preview reset
  - Checkbox "Don't show this again" (persisted to localStorage key: output-merger.return-confirmation-dismissed)
  - Confirm/Cancel buttons with translations (en-US/pt-BR)
- [x] **Task 5.1.4:** Implement return logic on confirmation:
  - Dispatch RESET_ALL reducer action to clear all snippets/tokens (without resetting editEnabled)
  - Reset inputs to input mode (editable textareas)
  - Replace preview area content with plain merged text (follows editEnabled state)
  - Switch ActionsBar back to showing "Start Merge" button
- [x] **Task 5.1.5:** Wire modal open/close state to Return button click (disable button while modal open)
- [x] **Task 5.1.6:** Add localStorage persistence for "don't show again" preference
- [x] **Task 5.1.7:** Tests: modal open/close, confirmation flow, localStorage persistence, state reset

## Planned Future Tasks (No Implementation Yet)

- **Task 5.2:** "Start Over" Button — Reset page without reload (to be planned later)
- **Task 5.3:** "Add Text" Button — Add new text input, up to 4 total (to be planned later)