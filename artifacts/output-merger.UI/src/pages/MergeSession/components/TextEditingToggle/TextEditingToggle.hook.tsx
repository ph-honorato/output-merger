import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnippets } from '../../../../context/SnippetsContext';

const TOGGLE_KEYS = {
  on: 'pages.mergeSession.previewArea.editing.toggleOn',
  off: 'pages.mergeSession.previewArea.editing.toggleOff',
} as const;

/**
 * Self-contained edit-text toggle (roadmap 3.3, deviation a): reads
 * and writes the ONE session-level `editEnabled` flag in
 * SnippetsContext — no props, exactly like CopyMergedTextButton, so
 * every instance (the PreviewToolbar button and the modal's tools
 * rail button) reflects and controls the same state. The toggle
 * gates text editing only; dragging stays always live in both
 * modes (F1).
 */
export function useTextEditingToggle() {
  const { t } = useTranslation();
  const { editEnabled, setEditEnabled } = useSnippets();

  const handleToggle = useCallback(() => {
    setEditEnabled(!editEnabled);
  }, [editEnabled, setEditEnabled]);

  return {
    t,
    editEnabled,
    // The label names the action the button will perform: enabling
    // while editing is off, disabling while it is on.
    ariaLabel: t(editEnabled ? TOGGLE_KEYS.off : TOGGLE_KEYS.on),
    handleToggle,
  };
}
