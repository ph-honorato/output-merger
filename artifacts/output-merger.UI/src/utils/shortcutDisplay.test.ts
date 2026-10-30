/**
 * Tests for the shortcut display utilities
 */

import {
  isMacPlatform,
  getModifierLabel,
  getModifierSymbol,
  formatShortcut,
  formatShortcutWithSymbol,
  createTooltipWithShortcut,
} from './shortcutDisplay';
import type { KeyboardShortcut } from './shortcuts';

// Mock navigator.platform
const originalNavigator = global.navigator;

describe('shortcutDisplay', () => {
  beforeEach(() => {
    // Reset navigator mock
    Object.defineProperty(global, 'navigator', {
      value: { platform: 'Win32' },
      configurable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      configurable: true,
    });
  });

  describe('isMacPlatform', () => {
    it('returns true for Mac platforms', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'MacIntel' },
        configurable: true,
      });
      expect(isMacPlatform()).toBe(true);
    });

    it('returns true for iOS platforms', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'iPhone' },
        configurable: true,
      });
      expect(isMacPlatform()).toBe(true);
    });

    it('returns false for Windows platforms', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'Win32' },
        configurable: true,
      });
      expect(isMacPlatform()).toBe(false);
    });

    it('returns false for Linux platforms', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'Linux x86_64' },
        configurable: true,
      });
      expect(isMacPlatform()).toBe(false);
    });

    it('returns false when navigator is undefined', () => {
      Object.defineProperty(global, 'navigator', {
        value: undefined,
        configurable: true,
      });
      expect(isMacPlatform()).toBe(false);
    });
  });

  describe('getModifierLabel', () => {
    it('returns "Cmd" on Mac', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'MacIntel' },
        configurable: true,
      });
      expect(getModifierLabel()).toBe('Cmd');
    });

    it('returns "Ctrl" on Windows', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'Win32' },
        configurable: true,
      });
      expect(getModifierLabel()).toBe('Ctrl');
    });

    it('returns "Ctrl" on Linux', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'Linux x86_64' },
        configurable: true,
      });
      expect(getModifierLabel()).toBe('Ctrl');
    });
  });

  describe('getModifierSymbol', () => {
    it('returns "⌘" on Mac', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'MacIntel' },
        configurable: true,
      });
      expect(getModifierSymbol()).toBe('⌘');
    });

    it('returns "Ctrl" on Windows', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'Win32' },
        configurable: true,
      });
      expect(getModifierSymbol()).toBe('Ctrl');
    });
  });

  describe('formatShortcut', () => {
    const shortcut: KeyboardShortcut = {
      key: 'e',
      code: 'KeyE',
      metaKey: true,
      description: 'Test',
    };

    it('formats as "Cmd+E" on Mac', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'MacIntel' },
        configurable: true,
      });
      expect(formatShortcut(shortcut)).toBe('Cmd+E');
    });

    it('formats as "Ctrl+E" on Windows', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'Win32' },
        configurable: true,
      });
      expect(formatShortcut(shortcut)).toBe('Ctrl+E');
    });

    it('uppercases the key', () => {
      const shortcutLower: KeyboardShortcut = { ...shortcut, key: 'm' };
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'Win32' },
        configurable: true,
      });
      expect(formatShortcut(shortcutLower)).toBe('Ctrl+M');
    });
  });

  describe('formatShortcutWithSymbol', () => {
    const shortcut: KeyboardShortcut = {
      key: 'e',
      code: 'KeyE',
      metaKey: true,
      description: 'Test',
    };

    it('formats as "⌘E" on Mac', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'MacIntel' },
        configurable: true,
      });
      expect(formatShortcutWithSymbol(shortcut)).toBe('⌘E');
    });

    it('formats as "Ctrl+E" on Windows', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'Win32' },
        configurable: true,
      });
      expect(formatShortcutWithSymbol(shortcut)).toBe('Ctrl+E');
    });
  });

  describe('createTooltipWithShortcut', () => {
    const shortcut: KeyboardShortcut = {
      key: 'e',
      code: 'KeyE',
      metaKey: true,
      description: 'Test',
    };

    it('creates tooltip with base text and formatted shortcut on Mac', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'MacIntel' },
        configurable: true,
      });
      expect(createTooltipWithShortcut('Enable editing', shortcut)).toBe('Enable editing (Cmd+E)');
    });

    it('creates tooltip with base text and formatted shortcut on Windows', () => {
      Object.defineProperty(global, 'navigator', {
        value: { platform: 'Win32' },
        configurable: true,
      });
      expect(createTooltipWithShortcut('Enable editing', shortcut)).toBe('Enable editing (Ctrl+E)');
    });
  });
});