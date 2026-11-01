/**
 * Custom hook for handling keyboard shortcuts
 * @module useKeyboardShortcut
 */

import { useCallback, useEffect } from 'react';
import type { KeyboardShortcut } from '@utils/shortcuts';
import { matchesShortcut } from '@utils/shortcuts';

/**
 * Options for the useKeyboardShortcut hook
 */
export interface UseKeyboardShortcutOptions {
  /** The shortcut definition to listen for */
  shortcut: KeyboardShortcut;
  /** Callback when the shortcut is triggered */
  onTrigger: () => void;
  /** Whether the shortcut is enabled (default: true) */
  enabled?: boolean;
  /** Target element to attach the listener to (default: window) */
  target?: EventTarget | null;
  /** Whether to prevent default browser behavior (default: true) */
  preventDefault?: boolean;
  /** Whether to stop propagation (default: false) */
  stopPropagation?: boolean;
}

/**
 * Hook for registering a keyboard shortcut
 * Handles platform-aware modifier keys (Ctrl on Windows/Linux, Meta/Cmd on Mac)
 * 
 * @param options - Configuration options for the keyboard shortcut
 * 
 * @example
 * ```tsx
 * useKeyboardShortcut({
 *   shortcut: SHORTCUTS.TOGGLE_EDITING,
 *   onTrigger: handleToggle,
 *   enabled: true,
 * });
 * ```
 */
export function useKeyboardShortcut({
  shortcut,
  onTrigger,
  enabled = true,
  target = typeof window !== 'undefined' ? window : null,
  preventDefault = true,
  stopPropagation = false,
}: UseKeyboardShortcutOptions): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) {
        return;
      }

      if (matchesShortcut(event, shortcut)) {
        if (preventDefault) {
          event.preventDefault();
        }
        if (stopPropagation) {
          event.stopPropagation();
        }
        onTrigger();
      }
    },
    [shortcut, onTrigger, enabled, preventDefault, stopPropagation]
  );

  useEffect(() => {
    if (!target || !enabled) {
      return;
    }

    target.addEventListener('keydown', handleKeyDown as EventListener);

    return () => {
      target.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [target, handleKeyDown, enabled]);
}