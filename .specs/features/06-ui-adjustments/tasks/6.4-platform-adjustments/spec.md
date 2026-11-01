# Task 6.4: Platform Adjustments - Cross-platform/browser consistency

## Overview
Two sub-tasks for UI/UX improvements:
1. Adjust toast (Snackbar) position to upper right corner
2. Replace globe icon with configuration/settings icon in Header, opening a dropdown with language selector and dark mode toggle

## Current State
- MUI Snackbar used for copy toast notifications (in CopyMergedTextButton)
- Header has globe icon (Public) with dropdown for language selection
- Dark theme exists in theme/index.ts but no toggle UI
- Theme is hardcoded to light mode in main.tsx

## Requirements

### 1. Toast Position Adjustment
- Move Snackbar from default position to top-right corner
- Use MUI Snackbar's `anchorOrigin` prop
- Should apply to all Snackbar instances (currently only copy toast)

### 2. Configuration Dropdown in Header
- Replace globe icon (Public) with Settings icon
- Dropdown menu should contain:
  - Language selector (existing functionality, moved from globe dropdown)
  - Dark mode toggle (new functionality)
- Dark mode toggle:
  - Switch between light/dark theme
  - Persist preference to localStorage
  - Apply immediately without page reload
  - Use existing darkTheme from @theme

## Technical Details

### Toast Position
```tsx
<Snackbar
  anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
  ...
/>
```

### Dark Mode Implementation
- Create ThemeContext to manage theme state
- Wrap app with ThemeProvider that uses dynamic theme
- Persist theme preference to localStorage
- Toggle in Header dropdown updates context

### Header Changes
- Replace `Public` icon with `Settings` icon
- Dropdown menu structure:
  - Language section with current options
  - Divider
  - Dark mode toggle with icon (Brightness4 for dark, LightMode for light)
- Mobile menu should also include these options

## Acceptance Criteria
1. Toast appears in top-right corner on copy action
2. Header shows Settings icon instead of globe
3. Clicking Settings opens dropdown with language options
4. Language selection works as before
5. Dark mode toggle switches theme immediately
6. Dark mode preference persists across page reloads
7. Mobile menu includes both language and dark mode options
8. All translations updated for new UI text