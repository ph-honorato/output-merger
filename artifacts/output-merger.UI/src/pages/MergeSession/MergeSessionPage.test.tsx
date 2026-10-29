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

// The virtual monospace layout shared by the return-flow tests: 10px
// per char, line box from 0 to 19 (the TextInput geometry mock the
// needle drags resolve against), so source selections create real
// snippets through the actual page UI.
const installVirtualLayout = (text: string) => {
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
};

const dragFromTo = (view: HTMLElement, from: number, to: number) => {
  fireEvent.pointerMove(view, { clientX: from, clientY: 5 });
  fireEvent.pointerDown(view, { clientX: from, clientY: 5 });
  fireEvent.pointerMove(view, { clientX: to, clientY: 5 });
  fireEvent.pointerUp(window);
};

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
      'Open preview in a bigger view (Ctrl+M)',
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
    expect(toggle).toHaveAttribute('aria-label', 'Enable text editing (Ctrl+E)');
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
    // editor with the placeholder hint and the gates open.
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
      'Beta gamma beta',
    );

    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Preview' });

    // Duplicate data-testids by design while open: the
    // inline preview stays mounted alongside the modal's instance.
    expect(screen.getAllByTestId('preview-area')).toHaveLength(2);

    // jsdom computes no layout: give the two segment chips
    // deterministic rects so the keyboard drag reorders — the
    // landing anchors resolve by their data-landing id.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: Element) {
        const landingId = (this as HTMLElement).dataset?.landing;
        if (landingId !== undefined) {
          const landingX: Record<string, number> = {
            'preview-landing:g:0': -4,
            'preview-landing:s:1:0': 104,
            'preview-landing:s:1:1': 110,
            'preview-landing:g:3': 224,
          };
          const x = landingX[landingId] ?? 0;
          // REAL-BROWSER GEOMETRY:
          // the landing anchors are zero-footprint spans — a true 0x0
          // rect at the text baseline (top === bottom).
          return { left: x, right: x, top: 18, bottom: 18, width: 0, height: 0, x, y: 18 } as DOMRect;
        }
        const rects: Record<string, object> = {
          // The case-fix pass capitalizes the document-start chip, so
          // both casings resolve to their geometry.
          'beta gamma': { left: 0, top: 0, right: 100, bottom: 24, width: 100, height: 24, x: 0, y: 0 },
          'Beta gamma': { left: 0, top: 0, right: 100, bottom: 24, width: 100, height: 24, x: 0, y: 0 },
          'beta': { left: 120, top: 0, right: 220, bottom: 24, width: 100, height: 24, x: 120, y: 0 },
          'Beta': { left: 120, top: 0, right: 220, bottom: 24, width: 100, height: 24, x: 120, y: 0 },
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

    // Keyboard-sort the first snippet inside the modal: reaching
    // the second chip takes three hops — the arrows
    // walk through the separator's edge anchors first.
    const [first] = within(dialog).getAllByTestId('preview-snippet');
    expect(first).toHaveTextContent('Beta gamma');
    first.focus();
    await pressKey(first, 'Space');
    await pressKey(document, 'ArrowRight');
    await pressKey(document, 'ArrowRight');
    await pressKey(document, 'ArrowRight');
    await pressKey(document, 'Space');

    // The shared-context proof: both surfaces render the new order.
    const flows = screen.getAllByTestId('preview-segment-flow');
    const inlineFlow = flows.find((flow) => !dialog.contains(flow));
    expect(inlineFlow).toBeDefined();
    expect(within(dialog).getByTestId('preview-segment-flow')).toHaveTextContent(
      'Beta beta gamma',
    );
    expect(inlineFlow).toHaveTextContent('Beta beta gamma');

    await user.click(
      within(dialog).getByTestId('preview-modal-close-button'),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    // Only the inline instance remains, showing the reordered text.
    expect(screen.getAllByTestId('preview-area')).toHaveLength(1);
    expect(screen.getByTestId('preview-segment-flow')).toHaveTextContent(
      'Beta beta gamma',
    );
  });

  it('the toolbar edit toggle auto-positions the caret at the end of the inline preview', async () => {
    // The same virtual monospace seeding as the modal-integration
    // test (the preview's chips come from TextInput selections).
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
    await user.type(screen.getAllByTestId('text-input-textarea')[0], text);
    await user.type(screen.getAllByTestId('text-input-textarea')[1], text);
    await user.click(screen.getByTestId('merge-session-start-button'));

    const views = screen.getAllByTestId('text-input-view');
    const dragFromTo = (view: HTMLElement, from: number, to: number) => {
      fireEvent.pointerMove(view, { clientX: from, clientY: 5 });
      fireEvent.pointerDown(view, { clientX: from, clientY: 5 });
      fireEvent.pointerMove(view, { clientX: to, clientY: 5 });
      fireEvent.pointerUp(window);
    };
    dragFromTo(views[0], 41, 151); // 'beta gamma' (text-1)
    dragFromTo(views[1], 41, 95); // 'beta' (text-2)
    expect(screen.getByTestId('preview-segment-flow')).toHaveTextContent(
      'Beta gamma beta',
    );

    // The OFF->ON toggle: the inline editor ends up focused with the
    // caret at the text's end (ready to type — no manual click).
    fireEvent.click(screen.getByTestId('preview-edit-toggle'));
    const flow = screen.getByTestId('preview-segment-flow');
    expect(document.activeElement).toBe(flow);
    const chips = screen.getAllByTestId('preview-snippet');
    const range = window.getSelection()?.getRangeAt(0);
    // The document ends with the 'beta' chip: the caret inside its
    // text at the end (the click-at-end browser behavior).
    expect(range?.startContainer).toBe(chips[1].firstChild);
    expect(range?.startOffset).toBe(4);

    // The first keystroke appends right there.
    (chips[1].firstChild as Text).insertData(4, '!');
    act(() => {
      flow.dispatchEvent(
        new window.InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: '!',
        }),
      );
    });
    expect(flow.textContent).toBe('Beta gamma beta!');

    // The in-card counter (the default view's placement) shows the
    // maximum allowed characters: count/limit, live. The pin renders
    // outside the flow area, anchored to the card root.
    const card = flow.closest('[data-testid="preview-area"]');
    expect(card).not.toBeNull();
    const inCardCounter = card!.querySelector(
      '[data-testid="preview-char-count"]',
    );
    expect(inCardCounter).not.toBeNull();
    expect(inCardCounter!.textContent).toBe('16/2000');
  });

  it('the in-card counter shows n/max even on an empty document with editing on', () => {
    renderPage();

    fireEvent.click(screen.getByTestId('preview-edit-toggle'));
    const inCardCounter = document.querySelector(
      '[data-testid="preview-char-count"]',
    );
    expect(inCardCounter).not.toBeNull();
    expect(inCardCounter!.textContent).toBe('0/2000');
  });

  it('renders the Return button only in merge mode, with the icon and label, always enabled', async () => {
    renderPage();
    const user = userEvent.setup();

    // The input/compose state: Start Merge present, Return absent.
    expect(screen.getByTestId('merge-session-start-button')).toBeInTheDocument();
    expect(screen.queryByTestId('merge-session-return-button')).toBeNull();

    await user.type(screen.getAllByTestId('text-input-textarea')[0], 'Hello world');
    await user.click(screen.getByTestId('merge-session-start-button'));

    const returnButton = screen.getByTestId('merge-session-return-button');
    expect(returnButton).toBeEnabled();
    expect(returnButton).toHaveTextContent('Return');
    expect(returnButton.querySelector('svg')).toBeInTheDocument();
    expect(screen.queryByTestId('merge-session-start-button')).toBeNull();
  });

  it('opens the confirmation dialog on Return click and closes it as a cancel without resetting or persisting', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getAllByTestId('text-input-textarea')[0], 'Hello world');
    await user.click(screen.getByTestId('merge-session-start-button'));

    const returnButton = screen.getByTestId('merge-session-return-button');
    await user.click(returnButton);

    const dialog = screen.getByTestId('return-confirmation-dialog');
    expect(within(dialog).getByText('Return to inputs?')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'This will remove all selected snippets from the inputs. Your actual inputs and preview texts are kept as plain texts.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Don't show this again")).toBeInTheDocument();
    expect(
      within(dialog).getByTestId('return-confirmation-checkbox'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('checkbox')).not.toBeChecked();
    expect(
      within(dialog).getByTestId('return-confirmation-confirm-button'),
    ).toHaveTextContent('Return');
    expect(
      within(dialog).getByTestId('return-confirmation-cancel-button'),
    ).toHaveTextContent('Cancel');
    expect(returnButton).toBeDisabled();
    expect(
      window.localStorage.getItem('output-merger.return-confirmation-dismissed'),
    ).toBeNull();

    await user.click(
      within(dialog).getByTestId('return-confirmation-cancel-button'),
    );

    await waitFor(() =>
      expect(screen.queryByTestId('return-confirmation-dialog')).toBeNull(),
    );
    // Still in merge mode: no reset ran and nothing persisted.
    expect(screen.getByTestId('merge-session-return-button')).toBeEnabled();
    expect(screen.queryByTestId('merge-session-start-button')).toBeNull();
    expect(screen.queryByTestId('text-input-textarea')).toBeNull();
    expect(
      window.localStorage.getItem('output-merger.return-confirmation-dismissed'),
    ).toBeNull();
    // Focus lands back on the Return button after the dismissal.
    expect(screen.getByTestId('merge-session-return-button')).toHaveFocus();
  });

  it('closes the dialog as a cancel through the Escape key and the backdrop click without resetting or persisting', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getAllByTestId('text-input-textarea')[0], 'Hello world');
    await user.click(screen.getByTestId('merge-session-start-button'));

    // Escape closes the dialog like a cancel.
    await user.click(screen.getByTestId('merge-session-return-button'));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByTestId('return-confirmation-dialog')).toBeNull(),
    );
    expect(screen.getByTestId('merge-session-return-button')).toBeEnabled();

    // The backdrop click (the container area around the paper) does too.
    await user.click(screen.getByTestId('merge-session-return-button'));
    const container = document.querySelector('.MuiDialog-container');
    expect(container).not.toBeNull();
    fireEvent.mouseDown(container!);
    fireEvent.click(container!);
    await waitFor(() =>
      expect(screen.queryByTestId('return-confirmation-dialog')).toBeNull(),
    );
    expect(screen.getByTestId('merge-session-return-button')).toBeEnabled();

    expect(
      window.localStorage.getItem('output-merger.return-confirmation-dismissed'),
    ).toBeNull();
    expect(screen.queryByTestId('merge-session-start-button')).toBeNull();
    expect(screen.queryByTestId('text-input-textarea')).toBeNull();
  });

  it('returns through Confirm: sources editable with preserved texts, highlights cleared, preview re-seeded, re-merge appends after the seed', async () => {
    // fireEvent only: userEvent.setup() would replace the clipboard
    // with its own stub for the whole environment, hiding the
    // writeText calls from the mock (the editing-flow test pattern).
    const text = 'alpha beta gamma delta';
    installVirtualLayout(text);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    renderPage();

    fireEvent.change(screen.getAllByTestId('text-input-textarea')[0], {
      target: { value: text },
    });
    fireEvent.click(screen.getByTestId('merge-session-start-button'));

    const views = screen.getAllByTestId('text-input-view');
    dragFromTo(views[0], 41, 151); // 'beta gamma'
    expect(screen.getByTestId('preview-segment-flow')).toHaveTextContent(
      'Beta gamma',
    );
    expect(screen.getAllByTestId('preview-snippet')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('merge-session-return-button'));
    fireEvent.click(screen.getByTestId('return-confirmation-confirm-button'));

    await waitFor(() =>
      expect(screen.queryByTestId('return-confirmation-dialog')).toBeNull(),
    );

    // Sources: editable textareas holding the preserved texts — the
    // remount cleared the internal highlights.
    const textareas = screen.getAllByTestId('text-input-textarea');
    expect(textareas).toHaveLength(2);
    expect(textareas[0]).toHaveValue(text);
    expect(screen.queryByTestId('text-input-view')).toBeNull();

    // The ActionsBar swapped back: Start Merge present and enabled
    // (the preserved texts satisfy the gating); Return gone.
    expect(screen.getByTestId('merge-session-start-button')).toBeEnabled();
    expect(screen.queryByTestId('merge-session-return-button')).toBeNull();

    // The preview shows the plain seeded text with no chips; copy
    // stays enabled and writes the seeded text.
    const flow = screen.getByTestId('preview-segment-flow');
    expect(flow).toHaveTextContent('Beta gamma');
    expect(screen.queryByTestId('preview-snippet')).toBeNull();
    expect(screen.getByTestId('preview-copy-button')).toBeEnabled();
    fireEvent.click(screen.getByTestId('preview-copy-button'));
    const pendingCopy = writeText.mock.results[0]?.value ?? Promise.resolve();
    await act(async () => {
      await pendingCopy;
    });
    expect(writeText).toHaveBeenCalledWith('Beta gamma');
    expect(
      window.localStorage.getItem('output-merger.return-confirmation-dismissed'),
    ).toBeNull();

    // Re-merge: the new selection lands AFTER the seeded text with a
    // separator between — and only the NEW snippet commits (the
    // cleared highlights never re-emit into the preview).
    fireEvent.click(screen.getByTestId('merge-session-start-button'));
    const viewsAgain = screen.getAllByTestId('text-input-view');
    dragFromTo(viewsAgain[0], 41, 151);
    expect(screen.getByTestId('preview-segment-flow')).toHaveTextContent(
      'Beta gamma beta gamma',
    );
    expect(screen.getAllByTestId('preview-snippet')).toHaveLength(1);
  });

  it('persists the preference only on confirm with the checkbox and skips the dialog on the next Return click', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getAllByTestId('text-input-textarea')[0], 'Hello world');
    await user.click(screen.getByTestId('merge-session-start-button'));

    // Confirming without the checkbox proceeds but persists nothing.
    await user.click(screen.getByTestId('merge-session-return-button'));
    await user.click(screen.getByTestId('return-confirmation-confirm-button'));
    await waitFor(() =>
      expect(screen.queryByTestId('return-confirmation-dialog')).toBeNull(),
    );
    expect(
      window.localStorage.getItem('output-merger.return-confirmation-dismissed'),
    ).toBeNull();

    // Re-enter merge mode and confirm WITH the checkbox.
    await user.click(screen.getByTestId('merge-session-start-button'));
    await user.click(screen.getByTestId('merge-session-return-button'));
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByTestId('return-confirmation-confirm-button'));
    await waitFor(() =>
      expect(screen.queryByTestId('return-confirmation-dialog')).toBeNull(),
    );
    expect(
      window.localStorage.getItem('output-merger.return-confirmation-dismissed'),
    ).toBe('true');

    // The stored preference makes the next Return click skip the
    // dialog entirely and reset immediately.
    await user.click(screen.getByTestId('merge-session-start-button'));
    await user.click(screen.getByTestId('merge-session-return-button'));
    expect(screen.queryByTestId('return-confirmation-dialog')).toBeNull();
    expect(screen.getAllByTestId('text-input-textarea')).toHaveLength(2);
    expect(screen.getByTestId('merge-session-start-button')).toBeEnabled();
  });

  it('keeps the edit-text toggle ON across a return: the seeded text renders editable and copy stays enabled', async () => {
    const text = 'alpha beta gamma delta';
    installVirtualLayout(text);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    renderPage();

    fireEvent.change(screen.getAllByTestId('text-input-textarea')[0], {
      target: { value: text },
    });
    fireEvent.click(screen.getByTestId('merge-session-start-button'));

    const views = screen.getAllByTestId('text-input-view');
    dragFromTo(views[0], 41, 151);

    fireEvent.click(screen.getByTestId('preview-edit-toggle'));
    expect(screen.getByTestId('preview-segment-flow')).toHaveAttribute(
      'contenteditable',
      'true',
    );

    fireEvent.click(screen.getByTestId('merge-session-return-button'));
    fireEvent.click(screen.getByTestId('return-confirmation-confirm-button'));
    await waitFor(() =>
      expect(screen.queryByTestId('return-confirmation-dialog')).toBeNull(),
    );

    // The toggle keeps its ON state: the seeded text is the editable
    // surface and copy stays enabled, writing the seeded text.
    const flow = screen.getByTestId('preview-segment-flow');
    expect(flow).toHaveAttribute('contenteditable', 'true');
    expect(flow).toHaveTextContent('Beta gamma');
    expect(screen.queryByTestId('preview-snippet')).toBeNull();
    expect(screen.getByTestId('preview-copy-button')).toBeEnabled();
    fireEvent.click(screen.getByTestId('preview-copy-button'));
    const pendingCopy = writeText.mock.results[0]?.value ?? Promise.resolve();
    await act(async () => {
      await pendingCopy;
    });
    expect(writeText).toHaveBeenCalledWith('Beta gamma');
  });

  it('shows the empty state and the disabled copy button after returning an empty merged text with the toggle off', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getAllByTestId('text-input-textarea')[0], 'abc');
    await user.click(screen.getByTestId('merge-session-start-button'));

    await user.click(screen.getByTestId('merge-session-return-button'));
    await user.click(screen.getByTestId('return-confirmation-confirm-button'));
    await waitFor(() =>
      expect(screen.queryByTestId('return-confirmation-dialog')).toBeNull(),
    );

    expect(screen.getByTestId('preview-empty')).toBeInTheDocument();
    expect(screen.getByTestId('preview-copy-button')).toBeDisabled();
    expect(screen.getByTestId('preview-modal-open-button')).toBeDisabled();
    expect(screen.getAllByTestId('text-input-textarea')[0]).toHaveValue('abc');
    expect(screen.getByTestId('merge-session-start-button')).toBeEnabled();
  });

  it('keeps an open preview modal open across a confirmed return, rendering the seeded document', async () => {
    const text = 'alpha beta gamma delta';
    installVirtualLayout(text);

    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getAllByTestId('text-input-textarea')[0], text);
    await user.click(screen.getByTestId('merge-session-start-button'));

    const views = screen.getAllByTestId('text-input-view');
    dragFromTo(views[0], 41, 151);

    await user.click(screen.getByTestId('preview-modal-open-button'));
    const previewDialog = screen.getByRole('dialog', { name: 'Preview' });

    await user.click(screen.getByTestId('merge-session-return-button'));
    const confirmDialog = screen.getByTestId('return-confirmation-dialog');
    await user.click(
      within(confirmDialog).getByTestId('return-confirmation-confirm-button'),
    );
    await waitFor(() =>
      expect(screen.queryByTestId('return-confirmation-dialog')).toBeNull(),
    );

    // The preview modal stays open and renders the reset document —
    // the same seeded text as the inline preview (shared context).
    expect(previewDialog).toBeInTheDocument();
    expect(
      within(previewDialog).getByTestId('preview-segment-flow'),
    ).toHaveTextContent('Beta gamma');
    expect(
      within(previewDialog).queryByTestId('preview-snippet'),
    ).toBeNull();
    const flows = screen.getAllByTestId('preview-segment-flow');
    const inlineFlow = flows.find((flow) => !previewDialog.contains(flow));
    expect(inlineFlow).toBeDefined();
    expect(inlineFlow!).toHaveTextContent('Beta gamma');
  });

  it('does not replay entrance animations on TextInputs and PreviewArea after a confirmed return', async () => {
    const text = 'alpha beta gamma delta';
    installVirtualLayout(text);

    renderPage();
    const user = userEvent.setup();

    // Type text and start merge
    await user.type(screen.getAllByTestId('text-input-textarea')[0], text);
    await user.click(screen.getByTestId('merge-session-start-button'));

    const views = screen.getAllByTestId('text-input-view');
    dragFromTo(views[0], 41, 151);

    // Confirm return
    await user.click(screen.getByTestId('merge-session-return-button'));
    await user.click(screen.getByTestId('return-confirmation-confirm-button'));
    await waitFor(() =>
      expect(screen.queryByTestId('return-confirmation-dialog')).toBeNull(),
    );

    // After return: inputs are back in input mode (textareas visible)
    const textareas = screen.getAllByTestId('text-input-textarea');
    expect(textareas).toHaveLength(2);

    // The TextInput roots should NOT have the entrance animation (opacity: 1, no animation)
    // They remount with a new key but without $entranceDelay, so they appear instantly
    const inputRoots = screen.getAllByTestId('text-input-root');
    for (const root of inputRoots) {
      expect(root).toHaveStyle({ opacity: '1' });
      // The animation should not be present since $entranceDelay is undefined on return
      expect(root).not.toHaveStyle({ animationName: 'slideUpFadeIn' });
    }

    // PreviewArea should also not animate on return
    const previewArea = screen.getByTestId('preview-area');
    expect(previewArea).toHaveStyle({ opacity: '1' });
    expect(previewArea).not.toHaveStyle({ animationName: 'slideUpFadeIn' });
  });
});
