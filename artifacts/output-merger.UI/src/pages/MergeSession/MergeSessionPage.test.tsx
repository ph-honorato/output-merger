import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@translation';
import { theme } from '../../theme';
import {
  caretIndexFromPoint,
  rectForRange,
} from '../../components/TextInput/TextInput.geometry';
import type { CharRange } from '../../components/TextInput/TextInput.types';
import MergeSessionPage from './MergeSessionPage';

// jsdom has no caret-range API and computes no layout: the TextInput
// geometry is mocked with a virtual monospace layout (10px per char,
// line box from 0 to 19) so needle drags can create real snippets
// through the actual page UI in the modal-integration test below.
vi.mock('../../components/TextInput/TextInput.geometry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../components/TextInput/TextInput.geometry')>();
  return {
    ...actual,
    caretIndexFromPoint: vi.fn(),
    rectForRange: vi.fn(),
  };
});

const renderPage = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <MuiThemeProvider theme={theme}>
        <StyledThemeProvider theme={theme}>
          <MergeSessionPage />
        </StyledThemeProvider>
      </MuiThemeProvider>
    </I18nextProvider>
  );

describe('MergeSessionPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders both sources in input mode with a disabled start button', () => {
    renderPage();

    expect(screen.getAllByTestId('text-input-textarea')).toHaveLength(2);
    expect(screen.getByTestId('merge-session-start-button')).toBeDisabled();
  });

  it('enables the start button once a source has text', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getAllByTestId('text-input-textarea')[0], 'Hello world');

    expect(screen.getByTestId('merge-session-start-button')).toBeEnabled();
  });

  it('does not enable the start button for whitespace-only text', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getAllByTestId('text-input-textarea')[0], '   ');

    expect(screen.getByTestId('merge-session-start-button')).toBeDisabled();
  });

  it('enters merge mode on click: button hidden, sources in view mode, text preserved', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getAllByTestId('text-input-textarea')[0], 'Hello world');
    await user.click(screen.getByTestId('merge-session-start-button'));

    expect(screen.queryByTestId('merge-session-start-button')).toBeNull();
    expect(screen.queryByTestId('text-input-textarea')).toBeNull();
    expect(screen.getByTestId('text-input-view')).toHaveTextContent('Hello world');
    expect(screen.getByTestId('text-input-empty')).toBeInTheDocument();
    expect(screen.getByTestId('actions-bar-root')).toBeInTheDocument();
    expect(screen.getByTestId('preview-area')).toBeInTheDocument();
  });

  it('runs the full tutorial lifecycle: render, dismiss, persist, reopen via help, re-dismiss', async () => {
    const { unmount } = renderPage();
    const user = userEvent.setup();

    const banner = screen.getByTestId('merge-session-tutorial');
    expect(banner).toBeInTheDocument();
    expect(screen.getByText('How it works')).toBeInTheDocument();
    expect(banner.querySelectorAll('ol li')).toHaveLength(6);
    expect(screen.queryByTestId('merge-session-help-button')).toBeNull();

    await user.click(screen.getByTestId('tutorial-dismiss-button'));

    expect(screen.queryByTestId('merge-session-tutorial')).toBeNull();
    expect(
      window.localStorage.getItem('output-merger.tutorial.dismissed')
    ).toBe('true');
    expect(screen.getByTestId('merge-session-help-button')).toBeInTheDocument();

    unmount();
    renderPage();

    expect(screen.queryByTestId('merge-session-tutorial')).toBeNull();
    expect(screen.getByTestId('merge-session-help-button')).toBeInTheDocument();

    await user.click(screen.getByTestId('merge-session-help-button'));

    expect(screen.getByTestId('merge-session-tutorial')).toBeInTheDocument();
    expect(screen.queryByTestId('merge-session-help-button')).toBeNull();

    await user.click(screen.getByTestId('tutorial-dismiss-button'));

    expect(screen.queryByTestId('merge-session-tutorial')).toBeNull();
    expect(
      window.localStorage.getItem('output-merger.tutorial.dismissed')
    ).toBe('true');
    expect(screen.getByTestId('merge-session-help-button')).toBeInTheDocument();
  });

  it('treats a throwing localStorage as not dismissed and never crashes', async () => {
    const localStorageSpy = vi
      .spyOn(window, 'localStorage', 'get')
      .mockImplementation(() => {
        throw new Error('storage denied');
      });
    const { unmount } = renderPage();
    const user = userEvent.setup();

    expect(screen.getByTestId('merge-session-tutorial')).toBeInTheDocument();

    await user.click(screen.getByTestId('tutorial-dismiss-button'));

    expect(screen.queryByTestId('merge-session-tutorial')).toBeNull();

    unmount();
    renderPage();

    expect(screen.getByTestId('merge-session-tutorial')).toBeInTheDocument();

    localStorageSpy.mockRestore();
  });

  it('renders the preview modal trigger inside the toolbar, below the copy button', () => {
    renderPage();

    const toolbar = screen.getByTestId('preview-toolbar');
    const trigger = screen.getByTestId('preview-modal-open-button');
    expect(toolbar).toContainElement(trigger);
    // No snippets yet: the trigger is present but disabled.
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute(
      'aria-label',
      'Open preview in a bigger view',
    );
    const copyButton = screen.getByTestId('preview-copy-button');
    expect(
      copyButton.compareDocumentPosition(trigger) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('renders the edit-text toggle in the toolbar under the modal-open trigger, off by default', () => {
    renderPage();

    const toolbar = screen.getByTestId('preview-toolbar');
    const toggle = screen.getByTestId('preview-edit-toggle');
    expect(toolbar).toContainElement(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveAttribute('aria-label', 'Enable text editing');
    const trigger = screen.getByTestId('preview-modal-open-button');
    expect(
      trigger.compareDocumentPosition(toggle) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('runs the editing flow end to end: toggle on, type own text, copy serializes the document', async () => {
    // fireEvent only: userEvent.setup() would replace the clipboard
    // with its own stub for the whole environment, hiding the
    // writeText calls from the mock (CopyMergedTextButton pattern).
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    renderPage();

    fireEvent.change(screen.getAllByTestId('text-input-textarea')[0], {
      target: { value: 'alpha beta' },
    });
    fireEvent.click(screen.getByTestId('merge-session-start-button'));

    // Edit OFF + empty: today's gating (copy disabled, empty state).
    expect(screen.getByTestId('preview-empty')).toBeInTheDocument();
    expect(screen.getByTestId('preview-copy-button')).toBeDisabled();

    // Toggle editing on: the empty preview becomes the editable
    // editor with the placeholder hint (F3) and the gates open.
    fireEvent.click(screen.getByTestId('preview-edit-toggle'));
    const flow = screen.getByTestId('preview-segment-flow');
    expect(flow).toHaveAttribute('contenteditable', 'true');
    expect(flow).toHaveAttribute(
      'data-placeholder',
      'Type here to add your own text',
    );
    expect(screen.queryByTestId('preview-empty')).toBeNull();
    expect(screen.getByTestId('preview-copy-button')).toBeEnabled();

    // Type own text (jsdom simulation: DOM mutation + input event).
    act(() => {
      flow.focus();
    });
    flow.appendChild(document.createTextNode('my own words'));
    fireEvent.input(flow);

    expect(flow.textContent).toBe('my own words');
    // Copy serializes the document — own text included.
    fireEvent.click(screen.getByTestId('preview-copy-button'));
    const pendingCopy =
      writeText.mock.results[0]?.value ?? Promise.resolve();
    await act(async () => {
      await pendingCopy;
    });
    expect(writeText).toHaveBeenCalledWith('my own words');
    const toast = await screen.findByTestId('preview-copy-toast');
    expect(toast).toBeInTheDocument();
  });

  it('keeps the inline preview mounted while the modal is open and syncs an inside-modal reorder to the inline flow', async () => {
    // Virtual monospace layout: 10px per char (mirrors browsers: the
    // caret resolves to the boundary closest to the pointer).
    const text = 'alpha beta gamma delta';
    vi.mocked(caretIndexFromPoint).mockImplementation((x: number) => {
      const charIndex = Math.max(0, Math.min(text.length - 1, Math.floor(x / 10)));
      const localX = x - charIndex * 10;
      return localX < 5 ? charIndex : charIndex + 1;
    });
    vi.mocked(rectForRange).mockImplementation(
      (_root: HTMLElement, range: CharRange) => ({
        left: range.start * 10,
        top: 0,
        right: range.end * 10,
        bottom: 19,
        width: (range.end - range.start) * 10,
        height: 19,
      }),
    );

    const user = userEvent.setup();
    renderPage();

    // Two sources with the same text: 'beta gamma' (text-1) then
    // 'beta' (text-2) — merge order 'beta gamma beta'.
    await user.type(screen.getAllByTestId('text-input-textarea')[0], text);
    await user.type(screen.getAllByTestId('text-input-textarea')[1], text);
    await user.click(screen.getByTestId('merge-session-start-button'));

    const views = screen.getAllByTestId('text-input-view');
    expect(views).toHaveLength(2);
    const dragFromTo = (view: HTMLElement, from: number, to: number) => {
      fireEvent.pointerMove(view, { clientX: from, clientY: 5 });
      fireEvent.pointerDown(view, { clientX: from, clientY: 5 });
      fireEvent.pointerMove(view, { clientX: to, clientY: 5 });
      fireEvent.pointerUp(window);
    };
    dragFromTo(views[0], 41, 151); // 'beta gamma' (text-1)
    dragFromTo(views[1], 41, 95); // 'beta' (text-2)

    const trigger = screen.getByTestId('preview-modal-open-button');
    expect(trigger).toBeEnabled();
    expect(screen.getByTestId('preview-segment-flow')).toHaveTextContent(
      'beta gamma beta',
    );

    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Preview' });

    // Duplicate data-testids by design while open (ADR 0003): the
    // inline preview stays mounted alongside the modal's instance.
    expect(screen.getAllByTestId('preview-area')).toHaveLength(2);

    // jsdom computes no layout: give the two segment chips
    // deterministic rects so the keyboard drag reorders.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: Element) {
        const gapSlot = (this as HTMLElement).dataset?.gapSlot;
        if (gapSlot !== undefined) {
          const gapX: Record<string, number> = { '0': -4, '1': 110, '2': 230 };
          const x = gapX[gapSlot] ?? 0;
          return { left: x, right: x, top: 0, bottom: 24, width: 0, height: 24, x, y: 0 } as DOMRect;
        }
        const rects: Record<string, object> = {
          'beta gamma': { left: 0, top: 0, right: 100, bottom: 24, width: 100, height: 24, x: 0, y: 0 },
          'beta': { left: 120, top: 0, right: 220, bottom: 24, width: 100, height: 24, x: 120, y: 0 },
        };
        return { ...(rects[(this as HTMLElement).textContent ?? ''] ?? { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 }) } as DOMRect;
      },
    );

    const pressKey = async (target: Element | Document, code: string) => {
      await act(async () => {
        fireEvent.keyDown(target, { code, key: code === 'Space' ? ' ' : code });
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    };

    // Keyboard-sort the first snippet inside the modal.
    const [first] = within(dialog).getAllByTestId('preview-snippet');
    expect(first).toHaveTextContent('beta gamma');
    first.focus();
    await pressKey(first, 'Space');
    await pressKey(document, 'ArrowRight');
    await pressKey(document, 'Space');

    // The shared-context proof: both surfaces render the new order.
    const flows = screen.getAllByTestId('preview-segment-flow');
    const inlineFlow = flows.find((flow) => !dialog.contains(flow));
    expect(inlineFlow).toBeDefined();
    expect(within(dialog).getByTestId('preview-segment-flow')).toHaveTextContent(
      'beta beta gamma',
    );
    expect(inlineFlow).toHaveTextContent('beta beta gamma');

    await user.click(
      within(dialog).getByTestId('preview-modal-close-button'),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    // Only the inline instance remains, showing the reordered text.
    expect(screen.getAllByTestId('preview-area')).toHaveLength(1);
    expect(screen.getByTestId('preview-segment-flow')).toHaveTextContent(
      'beta beta gamma',
    );
  });
});
