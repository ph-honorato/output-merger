/**
 * Tests for the centralized shortcuts system
 */

import {
  SHORTCUTS,
  getShortcut,
  matchesShortcut,
  type KeyboardShortcut,
  type ShortcutName,
} from './shortcuts';

describe('shortcuts', () => {
  describe('SHORTCUTS', () => {
    it('defines TOGGLE_EDITING with correct properties', () => {
      expect(SHORTCUTS.TOGGLE_EDITING).toEqual({
        key: 'e',
        code: 'KeyE',
        metaKey: true,
        description: 'Toggle text editing',
        translationKey: 'shortcuts.toggleEditing',
      });
    });

    it('defines OPEN_PREVIEW_MODAL with correct properties', () => {
      expect(SHORTCUTS.OPEN_PREVIEW_MODAL).toEqual({
        key: 'm',
        code: 'KeyM',
        metaKey: true,
        description: 'Open preview modal',
        translationKey: 'shortcuts.openPreviewModal',
      });
    });

    it('has correct type for ShortcutName', () => {
      const names: ShortcutName[] = ['TOGGLE_EDITING', 'OPEN_PREVIEW_MODAL'];
      expect(names).toHaveLength(2);
    });
  });

  describe('getShortcut', () => {
    it('returns the correct shortcut for TOGGLE_EDITING', () => {
      const shortcut = getShortcut('TOGGLE_EDITING');
      expect(shortcut).toBe(SHORTCUTS.TOGGLE_EDITING);
    });

    it('returns the correct shortcut for OPEN_PREVIEW_MODAL', () => {
      const shortcut = getShortcut('OPEN_PREVIEW_MODAL');
      expect(shortcut).toBe(SHORTCUTS.OPEN_PREVIEW_MODAL);
    });
  });

  describe('matchesShortcut', () => {
    const shortcut: KeyboardShortcut = {
      key: 'e',
      code: 'KeyE',
      metaKey: true,
      description: 'Test shortcut',
    };

    it('matches when key and metaKey are correct', () => {
      const event = new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, code: 'KeyE' });
      expect(matchesShortcut(event, shortcut)).toBe(true);
    });

    it('matches when key and metaKey (Mac) are correct', () => {
      const event = new KeyboardEvent('keydown', { key: 'e', metaKey: true, code: 'KeyE' });
      expect(matchesShortcut(event, shortcut)).toBe(true);
    });

    it('does not match when key is different', () => {
      const event = new KeyboardEvent('keydown', { key: 'm', ctrlKey: true, code: 'KeyM' });
      expect(matchesShortcut(event, shortcut)).toBe(false);
    });

    it('does not match when metaKey is missing', () => {
      const event = new KeyboardEvent('keydown', { key: 'e', code: 'KeyE' });
      expect(matchesShortcut(event, shortcut)).toBe(false);
    });

    it('is case-insensitive for key', () => {
      const event = new KeyboardEvent('keydown', { key: 'E', ctrlKey: true, code: 'KeyE' });
      expect(matchesShortcut(event, shortcut)).toBe(true);
    });

    it('respects shiftKey when specified', () => {
      const shortcutWithShift: KeyboardShortcut = {
        ...shortcut,
        shiftKey: true,
      };
      const eventWithShift = new KeyboardEvent('keydown', {
        key: 'e',
        ctrlKey: true,
        shiftKey: true,
        code: 'KeyE',
      });
      const eventWithoutShift = new KeyboardEvent('keydown', {
        key: 'e',
        ctrlKey: true,
        shiftKey: false,
        code: 'KeyE',
      });
      expect(matchesShortcut(eventWithShift, shortcutWithShift)).toBe(true);
      expect(matchesShortcut(eventWithoutShift, shortcutWithShift)).toBe(false);
    });

    it('respects altKey when specified', () => {
      const shortcutWithAlt: KeyboardShortcut = {
        ...shortcut,
        altKey: true,
      };
      const eventWithAlt = new KeyboardEvent('keydown', {
        key: 'e',
        ctrlKey: true,
        altKey: true,
        code: 'KeyE',
      });
      const eventWithoutAlt = new KeyboardEvent('keydown', {
        key: 'e',
        ctrlKey: true,
        altKey: false,
        code: 'KeyE',
      });
      expect(matchesShortcut(eventWithAlt, shortcutWithAlt)).toBe(true);
      expect(matchesShortcut(eventWithoutAlt, shortcutWithAlt)).toBe(false);
    });
  });
});