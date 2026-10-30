/**
 * Tests for the useKeyboardShortcut hook
 */

import { act, renderHook } from '@testing-library/react';
import { useKeyboardShortcut } from './useKeyboardShortcut';
import { SHORTCUTS } from '@utils/shortcuts';

describe('useKeyboardShortcut', () => {
  const mockOnTrigger = vi.fn();

  beforeEach(() => {
    mockOnTrigger.mockClear();
  });

  it('registers and triggers shortcut on keydown', () => {
    renderHook(() =>
      useKeyboardShortcut({
        shortcut: SHORTCUTS.TOGGLE_EDITING,
        onTrigger: mockOnTrigger,
      })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, code: 'KeyE' }));
    });

    expect(mockOnTrigger).toHaveBeenCalledTimes(1);
  });

  it('does not trigger when shortcut is disabled', () => {
    renderHook(() =>
      useKeyboardShortcut({
        shortcut: SHORTCUTS.TOGGLE_EDITING,
        onTrigger: mockOnTrigger,
        enabled: false,
      })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, code: 'KeyE' }));
    });

    expect(mockOnTrigger).not.toHaveBeenCalled();
  });

  it('does not trigger when metaKey is missing', () => {
    renderHook(() =>
      useKeyboardShortcut({
        shortcut: SHORTCUTS.TOGGLE_EDITING,
        onTrigger: mockOnTrigger,
      })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', code: 'KeyE' }));
    });

    expect(mockOnTrigger).not.toHaveBeenCalled();
  });

  it('does not trigger when key is different', () => {
    renderHook(() =>
      useKeyboardShortcut({
        shortcut: SHORTCUTS.TOGGLE_EDITING,
        onTrigger: mockOnTrigger,
      })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', ctrlKey: true, code: 'KeyM' }));
    });

    expect(mockOnTrigger).not.toHaveBeenCalled();
  });

  it('prevents default by default', () => {
    renderHook(() =>
      useKeyboardShortcut({
        shortcut: SHORTCUTS.TOGGLE_EDITING,
        onTrigger: mockOnTrigger,
      })
    );

    const event = new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, code: 'KeyE', cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
  });

  it('does not prevent default when preventDefault is false', () => {
    renderHook(() =>
      useKeyboardShortcut({
        shortcut: SHORTCUTS.TOGGLE_EDITING,
        onTrigger: mockOnTrigger,
        preventDefault: false,
      })
    );

    const event = new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, code: 'KeyE', cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
  });

  it('stops propagation when stopPropagation is true', () => {
    const stopPropagationMock = vi.fn();
    const event = new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, code: 'KeyE' });
    event.stopPropagation = stopPropagationMock;

    renderHook(() =>
      useKeyboardShortcut({
        shortcut: SHORTCUTS.TOGGLE_EDITING,
        onTrigger: mockOnTrigger,
        stopPropagation: true,
      })
    );

    act(() => {
      window.dispatchEvent(event);
    });

    expect(stopPropagationMock).toHaveBeenCalled();
  });

  it('cleans up event listener on unmount', () => {
    const { unmount } = renderHook(() =>
      useKeyboardShortcut({
        shortcut: SHORTCUTS.TOGGLE_EDITING,
        onTrigger: mockOnTrigger,
      })
    );

    unmount();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, code: 'KeyE' }));
    });

    expect(mockOnTrigger).not.toHaveBeenCalled();
  });

  it('works with metaKey (Mac)', () => {
    renderHook(() =>
      useKeyboardShortcut({
        shortcut: SHORTCUTS.TOGGLE_EDITING,
        onTrigger: mockOnTrigger,
      })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', metaKey: true, code: 'KeyE' }));
    });

    expect(mockOnTrigger).toHaveBeenCalledTimes(1);
  });

  it('supports custom target element', () => {
    const customTarget = document.createElement('div');
    document.body.appendChild(customTarget);

    renderHook(() =>
      useKeyboardShortcut({
        shortcut: SHORTCUTS.TOGGLE_EDITING,
        onTrigger: mockOnTrigger,
        target: customTarget,
      })
    );

    act(() => {
      customTarget.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, code: 'KeyE' }));
    });

    expect(mockOnTrigger).toHaveBeenCalledTimes(1);

    // Event on window should not trigger
    mockOnTrigger.mockClear();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, code: 'KeyE' }));
    });
    expect(mockOnTrigger).not.toHaveBeenCalled();

    document.body.removeChild(customTarget);
  });
});