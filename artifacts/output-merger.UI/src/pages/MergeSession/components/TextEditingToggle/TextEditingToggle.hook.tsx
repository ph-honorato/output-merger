import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnippets } from '../../../../context/SnippetsContext';
import { useKeyboardShortcut } from '@hooks/useKeyboardShortcut';
import { SHORTCUTS } from '@utils/shortcuts';
import { createTooltipWithShortcut } from '@utils/shortcutDisplay';

const TOGGLE_KEYS = {
  on: 'pages.mergeSession.previewArea.editing.toggleOn',
  off: 'pages.mergeSession.previewArea.editing.toggleOff',
} as const;

/**
 * Self-contained edit-text toggle: reads
 * and writes the ONE session-level `editEnabled` flag in
 * SnippetsContext — no props, exactly like CopyMergedTextButton, so
 * every instance (the PreviewToolbar button and the modal's tools
 * rail button) reflects and controls the same state. The toggle
 * gates text editing only; dragging stays always live in both
 * modes.
 */
export function useTextEditingToggle() {
  const { t } = useTranslation();
  const { editEnabled, setEditEnabled } = useSnippets();

  const handleToggle = useCallback(() => {
    setEditEnabled(!editEnabled);
  }, [editEnabled, setEditEnabled]);

  // Keyboard shortcut: Ctrl/Cmd+E to toggle editing
  useKeyboardShortcut({
    shortcut: SHORTCUTS.TOGGLE_EDITING,
    onTrigger: handleToggle,
  });

  // The label names the action the button will perform: enabling
  // while editing is off, disabling while it is on. Includes shortcut.
  const baseLabel = t(editEnabled ? TOGGLE_KEYS.off : TOGGLE_KEYS.on);
  const ariaLabel = createTooltipWithShortcut(baseLabel, SHORTCUTS.TOGGLE_EDITING);

  return {
    editEnabled,
    ariaLabel,
    handleToggle,
  };
}
