# Spec: Tools Adjustments - Refine Existing Tool Behavior

## Overview

This task refines the behavior of three existing tools in the Preview Toolbar: **CopyMergedTextButton**, **TextEditingToggle**, and **PreviewModal** (open button). The improvements add tooltips with consistent positioning, keyboard shortcuts for two actions, and a centralized shortcuts configuration file.

## Requirements

### 1. Copy Button (CopyMergedTextButton)
- **Tooltip**: Add a tooltip positioned on the right side (`anchorOrigin={{vertical: 'center', horizontal: 'right'}}`)
- **Tooltip text**: Use existing aria-label translation key `pages.mergeSession.previewArea.copy.button`
- **Keyboard shortcut**: None required

### 2. Text Editing Toggle (TextEditingToggle)
- **Tooltip**: Add a tooltip positioned on the right side
- **Tooltip text**: Use existing aria-label translations:
  - When edit is OFF: `pages.mergeSession.previewArea.editing.toggleOn`
  - When edit is ON: `pages.mergeSession.previewArea.editing.toggleOff`
- **Keyboard shortcut**: **Ctrl/Cmd+E** to toggle edit mode
- **Tooltip with shortcut**: Show shortcut inside braces (e.g., "Enable text editing (Ctrl+E)")

### 3. Preview Modal (PreviewModal open button)
- **Tooltip**: Add a tooltip positioned on the right side (for the open button)
- **Tooltip text**: Use existing aria-label translation `pages.mergeSession.previewArea.modal.open`
- **Keyboard shortcut**: **Ctrl/Cmd+M** to open modal
- **Tooltip with shortcut**: Show shortcut inside braces (e.g., "Open preview in a bigger view (Ctrl+M)")

### 4. Centralized Shortcuts Configuration
- Create a JSON/TypeScript file at `src/utils/shortcuts.ts` (or `.json`) that centralizes all keyboard shortcuts used in the app
- Define all shortcuts with their key combinations, descriptions, and associated actions
- Components should import shortcuts from this centralized location
- Include at minimum:
  - `toggleEditMode`: Ctrl/Cmd+E
  - `openPreviewModal`: Ctrl/Cmd+M

## Acceptance Criteria

### CopyMergedTextButton
- [ ] Tooltip appears on hover/focus positioned to the right of the button
- [ ] Tooltip text matches the translation for `pages.mergeSession.previewArea.copy.button`
- [ ] No keyboard shortcut is added

### TextEditingToggle
- [ ] Tooltip appears on hover/focus positioned to the right of the button
- [ ] Tooltip text changes based on edit state (toggleOn/toggleOff translations)
- [ ] Pressing **Ctrl+E** (Windows/Linux) or **Cmd+E** (Mac) toggles edit mode
- [ ] Tooltip displays shortcut in format: "{translation} (Ctrl+E)" or "{translation} (Cmd+E)"

### PreviewModal
- [ ] Tooltip appears on hover/focus positioned to the right of the open button
- [ ] Tooltip text matches the translation for `pages.mergeSession.previewArea.modal.open`
- [ ] Pressing **Ctrl+M** (Windows/Linux) or **Cmd+M** (Mac) opens the preview modal
- [ ] Tooltip displays shortcut in format: "{translation} (Ctrl+M)" or "{translation} (Cmd+M)"

### Centralized Shortcuts
- [ ] File `src/utils/shortcuts.ts` exists and exports shortcut definitions
- [ ] All keyboard shortcuts used in the app are defined in this file
- [ ] TextEditingToggle imports and uses the centralized shortcut for toggleEditMode
- [ ] PreviewModal imports and uses the centralized shortcut for openPreviewModal
- [ ] Shortcuts correctly handle platform differences (Ctrl vs Cmd)

## Technical Design

### Tooltip Implementation
Use MUI's `Tooltip` component with the following props:
```tsx
<Tooltip
  title={tooltipText}
  anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
  transformOrigin={{ vertical: 'center', horizontal: 'left' }}
  placement="right"
>
  {/* Button component */}
</Tooltip>
```

### Keyboard Shortcut Implementation
Create a custom hook `useKeyboardShortcut` in `src/hooks/useKeyboardShortcut.ts`:
- Accepts a shortcut definition from the centralized config
- Handles platform-specific key detection (Ctrl vs Meta/Cmd)
- Attaches global keydown listener when component mounts
- Cleans up listener on unmount
- Prevents default browser behavior for registered shortcuts

### Centralized Shortcuts File
Create `src/utils/shortcuts.ts`:
```ts
export interface ShortcutDefinition {
  id: string;
  key: string;           // e.g., 'e', 'm'
  ctrlKey: boolean;      // true for Ctrl/Cmd
  shiftKey?: boolean;
  altKey?: boolean;
  descriptionKey: string; // i18n key for description
  action: () => void;    // placeholder, components provide actual action
}

export const shortcuts = {
  toggleEditMode: {
    id: 'toggleEditMode',
    key: 'e',
    ctrlKey: true,
    descriptionKey: 'shortcuts.toggleEditMode',
  },
  openPreviewModal: {
    id: 'openPreviewModal',
    key: 'm',
    ctrlKey: true,
    descriptionKey: 'shortcuts.openPreviewModal',
  },
} as const;

export type ShortcutId = keyof typeof shortcuts;
```

Add translation keys to both `en-US.json` and `pt-BR.json`:
```json
{
  "shortcuts": {
    "toggleEditMode": "Toggle text editing",
    "openPreviewModal": "Open preview modal"
  }
}
```

### Platform-Aware Shortcut Display
Create a utility function `getShortcutDisplay(shortcut: ShortcutDefinition): string` that:
- Detects platform (Mac vs Windows/Linux)
- Returns formatted string: "Ctrl+E" or "Cmd+E"
- Used in tooltip text composition

## Files to Modify/Create

### New Files
1. `src/utils/shortcuts.ts` - Centralized shortcut definitions
2. `src/hooks/useKeyboardShortcut.ts` - Custom hook for keyboard shortcuts
3. `src/utils/shortcutDisplay.ts` - Utility for platform-aware shortcut display (optional, could be in shortcuts.ts)

### Modified Files
1. `src/pages/MergeSession/components/CopyMergedTextButton/CopyMergedTextButton.tsx` - Add Tooltip wrapper
2. `src/pages/MergeSession/components/TextEditingToggle/TextEditingToggle.tsx` - Add Tooltip wrapper + keyboard shortcut
4. `src/pages/MergeSession/components/TextEditingToggle/TextEditingToggle.hook.tsx` - Add keyboard shortcut logic (or use new hook)
5. `src/pages/MergeSession/components/PreviewModal/PreviewModal.tsx` - Add Tooltip wrapper + keyboard shortcut for open button
6. `src/i18n/resources/en-US.json` - Add shortcut translation keys
7. `src/i18n/resources/pt-BR.json` - Add shortcut translation keys

### Files to Reference (No Changes)
- `src/pages/MergeSession/components/PreviewToolbar/PreviewToolbar.tsx` - Contains the toolbar where these buttons render
- `src/pages/MergeSession/MergeSessionPage.tsx` - Page composition

## Testing Strategy

### Unit Tests
1. **CopyMergedTextButton**
   - Render with Tooltip wrapper
   - Verify tooltip appears on hover with correct text
   - Verify no keyboard listener attached

2. **TextEditingToggle**
   - Render with Tooltip wrapper
   - Verify tooltip text changes with edit state
   - Verify Ctrl+E / Cmd+E triggers toggle
   - Verify tooltip displays shortcut correctly for platform

3. **PreviewModal**
   - Render open button with Tooltip wrapper
   - Verify tooltip appears with correct text
   - Verify Ctrl+M / Cmd+M opens modal
   - Verify tooltip displays shortcut correctly for platform

4. **useKeyboardShortcut hook**
   - Test listener attachment/detachment
   - Test platform-specific key detection
   - Test preventDefault behavior
   - Test cleanup on unmount

5. **shortcuts.ts**
   - Verify all shortcut definitions exported
   - Verify type safety

### Integration Tests
1. **PreviewToolbar with all three buttons**
   - All tooltips render correctly
   - Keyboard shortcuts work when toolbar is focused/visible
   - No shortcut conflicts

2. **PreviewModal open/close cycle**
   - Open via keyboard shortcut
   - Close via keyboard (Escape handled by MUI Dialog)
   - Toolbar shortcuts still work when modal open

### Manual Verification
1. Hover each button → tooltip appears on right with correct text
2. Press Ctrl/Cmd+E → edit mode toggles
3. Press Ctrl/Cmd+M → modal opens
4. Verify Mac shows "Cmd", Windows/Linux shows "Ctrl" in tooltips
5. Verify translations work for both English and Portuguese

## Dependencies
- MUI Tooltip component (already in project)
- react-i18next for translations (already in project)
- SnippetsContext for state management (already in project)