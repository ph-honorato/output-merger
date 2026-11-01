/**
 * Centralized keyboard shortcut definitions
 * @module shortcuts
 */

/**
 * Platform-aware modifier key names
 * On Mac: 'Meta' (Cmd), on Windows/Linux: 'Control' (Ctrl)
 */
export type ModifierKey = 'Control' | 'Meta';

/**
 * Keyboard shortcut definition
 */
export interface KeyboardShortcut {
  /** The key that triggers the shortcut (e.g., 'KeyE', 'KeyM') */
  key: string;
  /** The code of the key (e.g., 'KeyE', 'KeyM') */
  code: string;
  /** Whether Ctrl/Cmd is required */
  metaKey: boolean;
  /** Whether Shift is required */
  shiftKey?: boolean;
  /** Whether Alt is required */
  altKey?: boolean;
  /** Human-readable description of the action */
  description: string;
  /** Translation key for the action description */
  translationKey?: string;
}

/**
 * Predefined shortcuts for the application
 */
export const SHORTCUTS = {
  /** Toggle text editing mode (Ctrl/Cmd + E) */
  TOGGLE_EDITING: {
    key: 'e',
    code: 'KeyE',
    metaKey: true,
    description: 'Toggle text editing',
    translationKey: 'shortcuts.toggleEditing',
  },
  /** Open preview modal (Ctrl/Cmd + M) */
  OPEN_PREVIEW_MODAL: {
    key: 'm',
    code: 'KeyM',
    metaKey: true,
    description: 'Open preview modal',
    translationKey: 'shortcuts.openPreviewModal',
  },
} as const satisfies Record<string, KeyboardShortcut>;

/**
 * Type for shortcut names
 */
export type ShortcutName = keyof typeof SHORTCUTS;

/**
 * Get a shortcut by name
 */
export function getShortcut(name: ShortcutName): KeyboardShortcut {
  return SHORTCUTS[name];
}

/**
 * Check if a keyboard event matches a shortcut
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) {
    return false;
  }
  if (shortcut.metaKey && !event.metaKey && !event.ctrlKey) {
    return false;
  }
  if (shortcut.shiftKey !== undefined && event.shiftKey !== shortcut.shiftKey) {
    return false;
  }
  if (shortcut.altKey !== undefined && event.altKey !== shortcut.altKey) {
    return false;
  }
  return true;
}