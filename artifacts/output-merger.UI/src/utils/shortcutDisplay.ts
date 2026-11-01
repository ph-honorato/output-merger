/**
 * Utility for platform-aware keyboard shortcut display
 * Shows Cmd on Mac, Ctrl on Windows/Linux
 * @module shortcutDisplay
 */

import type { KeyboardShortcut } from './shortcuts';

/**
 * Detect if the current platform is Mac
 * Uses navigator.platform for SSR-safe detection
 */
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  // Modern way: check for Mac platform
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

/**
 * Get the platform-appropriate modifier key label
 * Returns 'Cmd' on Mac, 'Ctrl' on Windows/Linux
 */
export function getModifierLabel(): string {
  return isMacPlatform() ? 'Cmd' : 'Ctrl';
}

/**
 * Get the platform-appropriate modifier key symbol
 * Returns '⌘' on Mac, 'Ctrl' on Windows/Linux
 */
export function getModifierSymbol(): string {
  return isMacPlatform() ? '⌘' : 'Ctrl';
}

/**
 * Format a keyboard shortcut for display
 * e.g., "Cmd+E" on Mac, "Ctrl+E" on Windows/Linux
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const modifier = getModifierLabel();
  const key = shortcut.key.toUpperCase();
  return `${modifier}+${key}`;
}

/**
 * Format a keyboard shortcut with symbol for display
 * e.g., "⌘E" on Mac, "Ctrl+E" on Windows/Linux
 */
export function formatShortcutWithSymbol(shortcut: KeyboardShortcut): string {
  const modifier = getModifierSymbol();
  const key = shortcut.key.toUpperCase();
  return isMacPlatform() ? `${modifier}${key}` : `${modifier}+${key}`;
}

/**
 * Create a tooltip text that includes the shortcut
 * e.g., "Enable text editing (Cmd+E)" on Mac
 */
export function createTooltipWithShortcut(
  baseText: string,
  shortcut: KeyboardShortcut
): string {
  if (!baseText) return '';
  const formattedShortcut = formatShortcut(shortcut);
  return `${baseText} (${formattedShortcut})`;
}

/**
 * Hook to get platform-aware modifier label
 * Useful for components that need reactive platform detection
 */
export function useModifierLabel(): string {
  // This is a simple utility, no need for useState since platform doesn't change at runtime
  return getModifierLabel();
}