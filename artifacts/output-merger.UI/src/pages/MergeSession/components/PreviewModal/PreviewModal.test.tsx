import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { I18nextProvider } from 'react-i18next';
import { i18n, enUS, ptBR } from '@translation';
import { theme } from '../../../../theme';
import {
  SnippetsProvider,
  useSnippets,
} from '../../../../context/SnippetsContext';
import type { Snippet } from '@components';
import type { PreviewToken } from '../../../../context/SnippetsContext';
import type {
  DragCancelEvent,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { PreviewArea, PreviewToolbar, CopyMergedTextButton, TextEditingToggle } from '../';
import { usePreviewArea } from '../PreviewArea/PreviewArea.hook';
import PreviewModal from './PreviewModal';

const makeSnippet = (id: string, text: string, color = '#0080FF'): Snippet => ({
  id,
  text,
  startIndex: 0,
  endIndex: text.length,
  color,
});

// Mirrors the page composition: the inline preview plus the toolbar
// (copy button + the modal's own trigger + the edit-text toggle) — so
// the suite exercises the real duplicate-testid situation
// and its within(dialog) scoping, exactly like the page integration
// does.
const Harness = ({
  updates,
  document: parsed,
}: {
  updates: Array<[string, Snippet[]]>;
  document?: PreviewToken[];
}) => {
  const { setSourceSnippets, syncDocument } = useSnippets();
  useEffect(() => {
    updates.forEach(([sourceId, snippets]) =>
      setSourceSnippets(sourceId, snippets),
    );
  }, [updates, setSourceSnippets]);
  useEffect(() => {
    if (parsed) {
      syncDocument(parsed);
    }
  }, [parsed, syncDocument]);
  return (
    <>
      <PreviewArea />
      <PreviewToolbar>
        <CopyMergedTextButton />
        <PreviewModal />
        <TextEditingToggle />
      </PreviewToolbar>
    </>
  );
};

const renderWithProviders = (
  updates: Array<[string, Snippet[]]>,
  options: { document?: PreviewToken[] } = {},
) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MuiThemeProvider theme={theme}>
        <StyledThemeProvider theme={theme}>
          <SnippetsProvider>
            <Harness updates={updates} document={options.document} />
          </SnippetsProvider>
        </StyledThemeProvider>
      </MuiThemeProvider>
    </I18nextProvider>,
  );

const seedInterleaved = (): Array<[string, Snippet[]]> => [
  ['text-1', [makeSnippet('a1', 'Alpha')]],
  ['text-2', [makeSnippet('b1', 'Beta')]],
  ['text-1', [makeSnippet('a1', 'Alpha'), makeSnippet('a2', 'Gamma')]],
];

const seedTwoSources = (): Array<[string, Snippet[]]> => [
  ['text-1', [makeSnippet('a1', 'Hello')]],
  ['text-2', [makeSnippet('b1', 'Alpha')]],
];

const clipboardWriteText = vi.fn().mockResolvedValue(undefined);

// vi.restoreAllMocks() (afterEach) also blanks the setup file's bare
// vi.fn mocks — they have no original implementation to restore — so
// the default matchMedia behavior (matches: false for every query =
// viewport md+) is re-established for every test. The clipboard mock
// gets its resolved value re-established the same way.
const installDefaultMatchMedia = () => {
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

beforeEach(() => {
  clipboardWriteText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: clipboardWriteText },
    configurable: true,
  });
});

afterEach(async () => {
  await i18n.changeLanguage('en-US');
  vi.restoreAllMocks();
  installDefaultMatchMedia();
});

// The exact media string useMediaQuery(theme.breakpoints.down('md'))
// subscribes to (MUI strips the '@media ' prefix before matchMedia).
const BELOW_MD_MEDIA = theme.breakpoints.down('md').replace(/^@media\s*/, '');

/**
 * Replaces window.matchMedia with a mutable mock: belowMd sets the
 * initial matches, setBelowMd flips it and notifies the subscribed
 * change listeners (the viewport resize edge). The `matches` value
 * is exposed through a live getter so useSyncExternalStore's
 * getSnapshot observes the flip.
 */
const installViewport = (belowMd: boolean) => {
  const listeners = new Set<(event: { matches: boolean }) => void>();
  let matches = belowMd;
  const spy = vi
    .spyOn(window, 'matchMedia')
    .mockImplementation((query: string) => {
      const isBelowMdQuery = query === BELOW_MD_MEDIA;
      return {
        get matches() {
          return isBelowMdQuery ? matches : false;
        },
        media: query,
        onchange: null,
        addListener: (listener: unknown) =>
          listeners.add(listener as (event: { matches: boolean }) => void),
        removeListener: (listener: unknown) =>
          listeners.delete(listener as (event: { matches: boolean }) => void),
        addEventListener: (_: string, listener: unknown) =>
          listeners.add(listener as (event: { matches: boolean }) => void),
        removeEventListener: (_: string, listener: unknown) =>
          listeners.delete(listener as (event: { matches: boolean }) => void),
        dispatchEvent: () => false,
      } as MediaQueryList;
    });
  return {
    setBelowMd(next: boolean) {
      matches = next;
      listeners.forEach((listener) => listener({ matches: next }));
    },
    restore: () => spy.mockRestore(),
  };
};

interface SegmentRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  x: number;
  y: number;
}

const SEGMENT_RECTS: Record<string, SegmentRect> = {
  Alpha: { left: 0, top: 0, right: 100, bottom: 24, width: 100, height: 24, x: 0, y: 0 },
  Beta: { left: 120, top: 0, right: 220, bottom: 24, width: 100, height: 24, x: 120, y: 0 },
  Gamma: { left: 240, top: 0, right: 340, bottom: 24, width: 100, height: 24, x: 240, y: 0 },
};

const ZERO_RECT: SegmentRect = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };

// Landing anchors sit at the droppable word boundaries / token gaps of
// the seeded layout (same convention as the PreviewArea suite —
// keyed by the data-landing id).
const LANDING_X: Record<string, number> = {
  'preview-landing:g:0': -4,
  'preview-landing:s:1:0': 104,
  'preview-landing:s:1:1': 110,
  'preview-landing:s:3:0': 224,
  'preview-landing:s:3:1': 230,
  // The words document (the second separator rewritten into
  // " text entered_by_user "): the word anchors sit between Beta
  // (ends 220) and Gamma (starts 240).
  'preview-landing:s:3:5': 230,
  'preview-landing:s:3:21': 232,
  'preview-landing:s:3:22': 234,
  'preview-landing:g:5': 344,
};

// jsdom computes no layout: give the segment chips deterministic
// rects so dnd-kit's rect-based collision detection works in tests.
const installSegmentRects = () =>
  vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: Element) {
      const landingId = (this as HTMLElement).dataset?.landing;
      if (landingId !== undefined) {
        const x = LANDING_X[landingId] ?? 0;
        // REAL-BROWSER GEOMETRY:
        // the landing anchors are zero-footprint spans — a true 0x0
        // rect at the text baseline (top === bottom), matching the
        // real browser exactly.
        return {
          left: x,
          right: x,
          top: 18,
          bottom: 18,
          width: 0,
          height: 0,
          x,
          y: 18,
        } as DOMRect;
      }
      const text = (this as HTMLElement).textContent ?? '';
      return { ...(SEGMENT_RECTS[text] ?? ZERO_RECT) } as DOMRect;
    });

const KEY_FOR_CODE: Record<string, string> = {
  Space: ' ',
  Escape: 'Escape',
  ArrowRight: 'ArrowRight',
};

// Dispatches a keydown and lets the sensor's zero-delay listener
// attachment (setTimeout 0) flush before the next key.
const pressKey = async (target: Element | Document, code: string) => {
  await act(async () => {
    fireEvent.keyDown(target, { code, key: KEY_FOR_CODE[code] ?? code });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const openDialog = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByTestId('preview-modal-open-button'));
  return screen.getByRole('dialog', { name: 'Preview' });
};

const stylesText = () =>
  Array.from(document.querySelectorAll('style'))
    .map((style) => style.textContent)
    .join('');

describe('PreviewModal', () => {
  it('renders the trigger inside the toolbar, below the copy button, translated and enabled', () => {
    renderWithProviders(seedInterleaved());

    const trigger = screen.getByTestId('preview-modal-open-button');
    const toolbar = screen.getByTestId('preview-toolbar');
    expect(toolbar).toContainElement(trigger);
    expect(trigger).toBeEnabled();
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

  it('keeps the trigger disabled while the preview is empty', () => {
    renderWithProviders([]);
    expect(screen.getByTestId('preview-modal-open-button')).toBeDisabled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders nothing below md while closed (mobile layout)', () => {
    const viewport = installViewport(true);
    renderWithProviders(seedInterleaved());

    expect(screen.queryByTestId('preview-modal-open-button')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();

    viewport.restore();
  });

  it('ships the three modal keys verbatim in both en-US and pt-BR resources', () => {
    expect(enUS).toHaveProperty(
      'pages.mergeSession.previewArea.modal.name',
      'Preview',
    );
    expect(enUS).toHaveProperty(
      'pages.mergeSession.previewArea.modal.open',
      'Open preview in a bigger view',
    );
    expect(enUS).toHaveProperty(
      'pages.mergeSession.previewArea.modal.close',
      'Close preview',
    );
    expect(ptBR).toHaveProperty(
      'pages.mergeSession.previewArea.modal.name',
      'Prévia',
    );
    expect(ptBR).toHaveProperty(
      'pages.mergeSession.previewArea.modal.open',
      'Abrir prévia em visualização ampliada',
    );
    expect(ptBR).toHaveProperty(
      'pages.mergeSession.previewArea.modal.close',
      'Fechar prévia',
    );
  });

  it('follows the active language for the trigger label, dialog name, and close label', async () => {
    renderWithProviders(seedInterleaved());
    await act(async () => {
      await i18n.changeLanguage('pt');
    });

    const trigger = screen.getByTestId('preview-modal-open-button');
    expect(trigger).toHaveAttribute(
      'aria-label',
      'Abrir prévia em visualização ampliada',
    );

    const user = userEvent.setup();
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Prévia' });
    expect(
      within(dialog).getByTestId('preview-modal-close-button'),
    ).toHaveAttribute('aria-label', 'Fechar prévia');
  });
});

describe('PreviewModal dialog', () => {
  it('opens a dialog named Preview with a visually hidden title and md sizing', async () => {
    renderWithProviders(seedInterleaved());
    const dialog = await openDialog();

    // Accessible name auto-wired by the hidden DialogTitle (a plain
    // aria-label on the Dialog would NOT name it).
    expect(dialog).toBeInTheDocument();
    const hiddenTitle = within(dialog).getByText('Preview');
    expect(hiddenTitle).toHaveStyle({ position: 'absolute' });
    expect(hiddenTitle).toHaveStyle({ width: '1px' });
    expect(hiddenTitle).toHaveStyle({ height: '1px' });
    expect(hiddenTitle).toHaveStyle({ overflow: 'hidden' });

    // md sizing: maxWidth md + fullWidth + the fixed ~90dvh layout.
    expect(dialog.className).toContain('MuiDialog-paperWidthMd');
    expect(dialog.className).toContain('MuiDialog-paperFullWidth');
    expect(stylesText()).toContain('height:90dvh');
  });

  it('renders the same preview content in context order, scoped to the dialog, with the inline instance mounted and the background aria-hidden', async () => {
    renderWithProviders(seedInterleaved());
    const dialog = await openDialog();

    expect(
      within(dialog).getAllByTestId('preview-snippet').map((s) => s.textContent),
    ).toEqual(['Alpha', 'beta', 'gamma']);
    // Byte-identity with the old join for an unedited session
    // (model-migration parity assertion).
    expect(within(dialog).getByTestId('preview-segment-flow')).toHaveTextContent(
      'Alpha beta gamma',
    );

    // Duplicate data-testids exist by design while open:
    // the inline preview stays mounted alongside the modal's copy.
    const areas = screen.getAllByTestId('preview-area');
    expect(areas).toHaveLength(2);
    // MUI keeps the app behind the dialog aria-hidden, so assistive
    // tech encounters exactly one preview.
    expect(areas[0].closest('[aria-hidden="true"]')).not.toBeNull();
    expect(areas[1].closest('[aria-hidden="true"]')).toBeNull();
  });

  it('lays the paper out as a row: centered preview zone plus a bare rail with copy, close, the edit toggle, and the char counter in order', async () => {
    renderWithProviders(seedInterleaved());
    const dialog = await openDialog();

    const closeButton = within(dialog).getByTestId('preview-modal-close-button');
    const copyButton = within(dialog).getByTestId('preview-copy-button');
    const editToggle = within(dialog).getByTestId('preview-edit-toggle');
    const counter = within(dialog).getByTestId('preview-char-count');
    const rail = closeButton.parentElement;
    expect(rail).not.toBeNull();
    expect(rail).toContainElement(copyButton);
    expect(rail).toContainElement(editToggle);
    expect(rail).toContainElement(closeButton);
    expect(rail).toContainElement(counter);
    // Rail order: copy on top, close under it, the edit toggle, and
    // the document char counter LAST (the lowest part of the rail) —
    // all direct children of the rail.
    expect(
      copyButton.compareDocumentPosition(closeButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      closeButton.compareDocumentPosition(editToggle) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      editToggle.compareDocumentPosition(counter) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // The rail's counter is the number-only variant: the limit
    // suffix is hidden on modal view.
    expect(counter.textContent).not.toContain('/');
    // The card's own counter row is suppressed inside the modal —
    // the rail's counter is the only one, outside the card.
    const card = within(dialog).getByTestId('preview-area');
    expect(card.contains(counter)).toBe(false);
    expect(copyButton.parentElement).toBe(rail);
    expect(editToggle.parentElement).toBe(rail);
    expect(closeButton.parentElement).toBe(rail);

    // The rail is a new bare strip, NOT the PreviewToolbar component.
    expect(within(dialog).queryByTestId('preview-toolbar')).toBeNull();

    // Row layout with a centered, flex:1 preview zone and the top-
    // aligned, right-inset rail.
    const css = stylesText();
    expect(css).toContain('flex-direction:row');
    expect(css).toContain('flex:1 1 auto');
    expect(css).toContain('align-items:center');
    expect(css).toContain('flex-direction:column');
    expect(css).toContain('margin:16px 16px 0 0');
  });

  it('copies the byte-identical merged text from inside the dialog and shows the toast within it', async () => {
    // fireEvent only: userEvent.setup() would replace the clipboard
    // with its own stub (before any click), hiding the writeText
    // calls from the mock.
    renderWithProviders(seedTwoSources());
    fireEvent.click(screen.getByTestId('preview-modal-open-button'));
    const dialog = screen.getByRole('dialog', { name: 'Preview' });

    fireEvent.click(within(dialog).getByTestId('preview-copy-button'));
    await act(() => clipboardWriteText.mock.results[0]?.value ?? Promise.resolve());
    expect(clipboardWriteText).toHaveBeenCalledWith('Hello alpha');

    const toast = await within(dialog).findByTestId('preview-copy-toast');
    expect(toast).toHaveTextContent('Text copied to clipboard');
  });

  it('writes the fully corrected payload from inside the dialog while both surfaces hold stale case (the shared copy fix)', async () => {
    // A mid-typing document: the unedited chip sits lowercase at the
    // document start — the per-input sync never corrects it, so both
    // the inline flow and the modal's flow render the stale case.
    renderWithProviders([], {
      document: [
        {
          kind: 'snippet',
          tokenId: 'text-1:a1',
          sourceSnippetId: 'a1',
          sourceId: 'text-1',
          color: '#0080FF',
          text: 'hello and more',
          edited: false,
        },
      ],
    });
    fireEvent.click(screen.getByTestId('preview-modal-open-button'));
    const dialog = screen.getByRole('dialog', { name: 'Preview' });
    const inlineFlow = screen.getAllByTestId('preview-segment-flow').find(
      (flow) => !dialog.contains(flow),
    );
    expect(inlineFlow?.textContent).toBe('hello and more');
    expect(
      within(dialog).getByTestId('preview-segment-flow').textContent,
    ).toBe('hello and more');

    // The modal's copy button (the rail instance of the one shared
    // component) writes the pass-corrected serialization.
    fireEvent.click(within(dialog).getByTestId('preview-copy-button'));
    await act(() => clipboardWriteText.mock.results[0]?.value ?? Promise.resolve());
    expect(clipboardWriteText).toHaveBeenCalledWith('Hello and more');

    // Copying never mutates the shared document: both surfaces keep
    // the stale case until the next trigger.
    expect(inlineFlow?.textContent).toBe('hello and more');
    expect(
      within(dialog).getByTestId('preview-segment-flow').textContent,
    ).toBe('hello and more');
  });

  it('closes via the rail close button, unmounting the content and restoring focus to the trigger', async () => {
    renderWithProviders(seedInterleaved());
    const trigger = screen.getByTestId('preview-modal-open-button');
    const user = userEvent.setup();
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Preview' });

    await user.click(
      within(dialog).getByTestId('preview-modal-close-button'),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    // No keepMounted: the modal's content unmounts and only the
    // inline preview instance remains.
    expect(screen.getAllByTestId('preview-area')).toHaveLength(1);
    // MUI's default focus restore returns focus to the trigger.
    expect(trigger).toHaveFocus();
  });

  it('closes on backdrop click', async () => {
    renderWithProviders(seedInterleaved());
    const dialog = await openDialog();

    const container = dialog.parentElement as HTMLElement;
    fireEvent.mouseDown(container);
    fireEvent.click(container);

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('closes on Escape when no drag is active', async () => {
    renderWithProviders(seedInterleaved());
    const dialog = await openDialog();

    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('cancels only the drag on Escape mid-keyboard-drag, then closes on the next Escape', async () => {
    installSegmentRects();
    renderWithProviders(seedInterleaved());
    const dialog = await openDialog();

    const [alpha] = within(dialog).getAllByTestId('preview-snippet');
    alpha.focus();
    await pressKey(alpha, 'Space');
    expect(
      within(dialog).getByTestId('preview-snippet-overlay'),
    ).toBeInTheDocument();

    // Escape during the active drag: the drag cancels and the
    // dialog stays open.
    await pressKey(alpha, 'Escape');
    expect(
      within(dialog).queryByTestId('preview-snippet-overlay'),
    ).toBeNull();
    expect(
      within(dialog).getAllByTestId('preview-snippet').map((s) => s.textContent),
    ).toEqual(['Alpha', 'beta', 'gamma']);
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'Snippet reorder cancelled.',
    );
    expect(screen.getByRole('dialog', { name: 'Preview' })).toBeInTheDocument();

    // The guard resets with the drag: plain Escape closes now.
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('survives a viewport shrink below md while open by switching to fullScreen, and returns to md sizing on grow', async () => {
    const viewport = installViewport(false);
    try {
      renderWithProviders(seedInterleaved());
      const dialog = await openDialog();
      expect(dialog.className).toContain('MuiDialog-paperWidthMd');
      expect(screen.getByTestId('preview-modal-open-button')).toBeInTheDocument();

      act(() => viewport.setBelowMd(true));

      // The open dialog stays mounted and switches to fullScreen; the
      // trigger hides below md; the rail stays reachable.
      const fullScreenDialog = screen.getByRole('dialog', {
        name: 'Preview',
      });
      expect(fullScreenDialog.className).toContain('MuiDialog-paperFullScreen');
      expect(
        within(fullScreenDialog).getByTestId('preview-modal-close-button'),
      ).toBeInTheDocument();
      expect(screen.queryByTestId('preview-modal-open-button')).toBeNull();

      act(() => viewport.setBelowMd(false));

      const mdDialog = screen.getByRole('dialog', { name: 'Preview' });
      expect(mdDialog.className).toContain('MuiDialog-paperWidthMd');
      expect(mdDialog.className).not.toContain('MuiDialog-paperFullScreen');
      expect(screen.getByTestId('preview-modal-open-button')).toBeInTheDocument();
    } finally {
      viewport.restore();
    }
  });

  it('reopens cleanly after a close: the content remounts from the shared context', async () => {
    renderWithProviders(seedInterleaved());
    const user = userEvent.setup();
    await user.click(screen.getByTestId('preview-modal-open-button'));
    expect(screen.getByRole('dialog', { name: 'Preview' })).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Preview' }), {
      key: 'Escape',
    });
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    await user.click(screen.getByTestId('preview-modal-open-button'));
    const reopened = screen.getByRole('dialog', { name: 'Preview' });
    expect(
      within(reopened).getByTestId('preview-segment-flow'),
    ).toHaveTextContent('Alpha beta gamma');
  });
});

describe('PreviewModal escape guard wiring (additive onActiveDragChange)', () => {
  const SeedUpdates = ({
    updates,
  }: {
    updates: Array<[string, Snippet[]]>;
  }) => {
    const { setSourceSnippets } = useSnippets();
    useEffect(() => {
      updates.forEach(([sourceId, snippets]) =>
        setSourceSnippets(sourceId, snippets),
      );
    }, [updates, setSourceSnippets]);
    return null;
  };

  const wrapper =
    (updates: Array<[string, Snippet[]]>) =>
    ({ children }: { children?: React.ReactNode }) => (
      <I18nextProvider i18n={i18n}>
        <MuiThemeProvider theme={theme}>
          <StyledThemeProvider theme={theme}>
            <SnippetsProvider>
              <SeedUpdates updates={updates} />
              {children}
            </SnippetsProvider>
          </StyledThemeProvider>
        </MuiThemeProvider>
      </I18nextProvider>
    );

  it('fires true on drag start and false on drag end and drag cancel, on every path', () => {
    const onActiveDragChange = vi.fn();
    const { result } = renderHook(() => usePreviewArea(onActiveDragChange), {
      wrapper: wrapper(seedInterleaved()),
    });

    act(() => {
      result.current.handleDragStart({
        active: { id: 'text-1:a1' },
      } as unknown as DragStartEvent);
    });
    expect(onActiveDragChange).toHaveBeenLastCalledWith(true);

    // Drag end: false fires even on the discard paths (no target).
    act(() => {
      result.current.handleDragEnd({
        active: { id: 'text-1:a1' },
        over: null,
      } as unknown as DragEndEvent);
    });
    expect(onActiveDragChange).toHaveBeenLastCalledWith(false);

    act(() => {
      result.current.handleDragStart({
        active: { id: 'text-1:ghost' },
      } as unknown as DragStartEvent);
    });
    expect(onActiveDragChange).toHaveBeenLastCalledWith(true);

    // Drag cancel resets the guard too.
    act(() => {
      result.current.handleDragCancel({
        active: { id: 'text-1:ghost' },
      } as unknown as DragCancelEvent);
    });
    expect(onActiveDragChange).toHaveBeenLastCalledWith(false);
    expect(onActiveDragChange).toHaveBeenCalledTimes(4);
  });

  it('stays purely additive: the hook without a callback behaves exactly as before', () => {
    const { result } = renderHook(() => usePreviewArea(), {
      wrapper: wrapper(seedInterleaved()),
    });

    const snippetTokenIds = () =>
      result.current.document
        .filter((token) => token.kind === 'snippet')
        .map((token) => token.tokenId);
    expect(result.current.document.filter((token) => token.kind === 'snippet')).toHaveLength(3);
    act(() => {
      result.current.handleDragStart({
        active: { id: 'text-1:a1' },
      } as unknown as DragStartEvent);
      result.current.handleDragEnd({
        active: { id: 'text-1:a1' },
        over: { id: 'text-2:b1' },
      } as unknown as DragEndEvent);
    });
    expect(snippetTokenIds()).toEqual(['text-2:b1', 'text-1:a1', 'text-1:a2']);
    expect(result.current.activeSnippet).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Editable preview text inside the modal: the
// gating matrix on the trigger, the shared toggle pair, and the
// inline ↔ modal typing sync. Typing is simulated with direct DOM
// mutation + dispatched input events (jsdom's caret simulation is
// the spec's flagged fallback).
// ---------------------------------------------------------------------------

describe('PreviewModal edit gating and inline↔modal typing sync', () => {
  const typeInto = (flow: HTMLElement, text: string) => {
    act(() => {
      flow.focus();
    });
    flow.appendChild(document.createTextNode(text));
    fireEvent.input(flow);
  };

  const inlineFlow = (dialog: HTMLElement) => {
    const flows = screen.getAllByTestId('preview-segment-flow');
    const inline = flows.find((flow) => !dialog.contains(flow));
    expect(inline).toBeDefined();
    return inline as HTMLElement;
  };

  it('enables the open trigger on an empty document while edit is ON (gating matrix)', () => {
    renderWithProviders([]);
    expect(screen.getByTestId('preview-modal-open-button')).toBeDisabled();

    fireEvent.click(screen.getByTestId('preview-edit-toggle'));

    expect(screen.getByTestId('preview-modal-open-button')).toBeEnabled();
  });

  it('opens the editable empty editor inside the dialog: placeholder hint, no empty-state block, copy enabled', async () => {
    renderWithProviders([]);
    fireEvent.click(screen.getByTestId('preview-edit-toggle'));
    const dialog = await openDialog();

    const flow = within(dialog).getByTestId('preview-segment-flow');
    expect(flow).toHaveAttribute('contenteditable', 'true');
    expect(flow).toHaveAttribute(
      'data-placeholder',
      'Type here to add your own text',
    );
    expect(within(dialog).queryByTestId('preview-empty')).toBeNull();
    expect(within(dialog).getByTestId('preview-copy-button')).toBeEnabled();
    // Identical quadrants inline: the inline instance is the same
    // editable editor, not the empty-state block.
    expect(inlineFlow(dialog)).toHaveAttribute('contenteditable', 'true');
    expect(screen.queryByTestId('preview-empty')).toBeNull();
  });

  it('shares one edit state between the toolbar toggle and the rail toggle', async () => {
    renderWithProviders(seedInterleaved());
    const dialog = await openDialog();

    const [toolbarToggle] = screen.getAllByTestId('preview-edit-toggle');
    const railToggle = within(dialog).getByTestId('preview-edit-toggle');
    expect(toolbarToggle).not.toBe(railToggle);
    expect(toolbarToggle).toHaveAttribute('aria-pressed', 'false');
    expect(railToggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(railToggle);

    expect(railToggle).toHaveAttribute('aria-pressed', 'true');
    expect(toolbarToggle).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(toolbarToggle);

    expect(railToggle).toHaveAttribute('aria-pressed', 'false');
    expect(toolbarToggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('syncs typing in the modal editor to the inline flow live', async () => {
    renderWithProviders([['text-1', [makeSnippet('a1', 'Alpha')]]]);
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByTestId('preview-edit-toggle'));

    typeInto(within(dialog).getByTestId('preview-segment-flow'), ' own');

    expect(within(dialog).getByTestId('preview-segment-flow').textContent).toBe(
      'Alpha own',
    );
    expect(inlineFlow(dialog).textContent).toBe('Alpha own');
  });

  it('syncs typing inline to the modal flow live (both directions)', async () => {
    renderWithProviders([['text-1', [makeSnippet('a1', 'Alpha')]]]);
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByTestId('preview-edit-toggle'));

    // MUI's focus trap confines real focus to the dialog while it is
    // open (manual-pass item), so the inline edit is simulated the
    // jsdom way — DOM mutation + input event, no focus handoff. The
    // per-input sync is what keeps the blurred twin (the dialog's
    // flow) truthful; the inline node itself would be frozen if it
    // owned the focus, so only the dialog side is asserted here.
    const inline = inlineFlow(dialog);
    inline.appendChild(document.createTextNode(' typed inline'));
    fireEvent.input(inline);

    expect(within(dialog).getByTestId('preview-segment-flow').textContent).toBe(
      'Alpha typed inline',
    );
  });

  it('loses nothing when Escape closes the dialog mid-typing', async () => {
    renderWithProviders([['text-1', [makeSnippet('a1', 'Alpha')]]]);
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByTestId('preview-edit-toggle'));

    typeInto(within(dialog).getByTestId('preview-segment-flow'), ' kept');
    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('preview-segment-flow').textContent).toBe(
      'Alpha kept',
    );
    expect(screen.getAllByTestId('preview-area')).toHaveLength(1);
  });

  // -----------------------------------------------------------------
  // Keyboard sorting via
  // Ctrl+Space while editing — inside the modal it must compose with
  // the Escape guard (Escape cancels ONLY the sort) and with the
  // shared document (the inline twin reflects the drop).
  // -----------------------------------------------------------------

  describe('keyboard sorting via Ctrl+Space', () => {
    beforeEach(() => {
      installSegmentRects();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    const setCaretInNode = (node: Node, offset: number) => {
      const range = document.createRange();
      range.setStart(node, offset);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    };

    const hostKey = (flow: HTMLElement, key: string, code: string) => {
      const keydown = new KeyboardEvent('keydown', {
        key,
        code,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        flow.dispatchEvent(keydown);
      });
      return keydown;
    };

    const flush = async () => {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    };

    const liftAtCaret = (flow: HTMLElement, chip: HTMLElement, offset: number) => {
      act(() => {
        flow.focus();
      });
      setCaretInNode(chip.firstChild as Text, offset);
      const keydown = new KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        flow.dispatchEvent(keydown);
      });
    };

    it('Escape during an in-modal Ctrl+Space sort cancels ONLY the sort (the guard)', async () => {
      renderWithProviders(seedInterleaved());
      const dialog = await openDialog();
      fireEvent.click(within(dialog).getByTestId('preview-edit-toggle'));

      const flow = within(dialog).getByTestId('preview-segment-flow');
      const [alpha] = within(dialog).getAllByTestId('preview-snippet');
      liftAtCaret(flow, alpha, 2);
      expect(
        within(dialog).getByTestId('preview-snippet-overlay'),
      ).toBeInTheDocument();
      await flush();

      // Arrows move the raised snippet inside the dialog…
      hostKey(flow, 'ArrowRight', 'ArrowRight');
      // …Escape cancels ONLY the drag: the dialog stays open (the
      // veto + re-dispatch guard) and the order is unchanged.
      hostKey(flow, 'Escape', 'Escape');
      await flush();

      expect(
        within(dialog).queryByTestId('preview-snippet-overlay'),
      ).toBeNull();
      expect(
        within(dialog)
          .getAllByTestId('preview-snippet')
          .map((chip) => chip.textContent),
      ).toEqual(['Alpha', 'beta', 'gamma']);
      expect(screen.getByRole('dialog', { name: 'Preview' })).toBeInTheDocument();
    });

    it('Enter drops the raised snippet inside the modal and the inline twin reflects it', async () => {
      renderWithProviders(seedInterleaved());
      const dialog = await openDialog();
      fireEvent.click(within(dialog).getByTestId('preview-edit-toggle'));

      const flow = within(dialog).getByTestId('preview-segment-flow');
      const [alpha] = within(dialog).getAllByTestId('preview-snippet');
      liftAtCaret(flow, alpha, 2);
      await flush();

      // reaching the Beta chip takes three hops — the
      // arrows walk through the separator's edge anchors first.
      hostKey(flow, 'ArrowRight', 'ArrowRight');
      hostKey(flow, 'ArrowRight', 'ArrowRight');
      hostKey(flow, 'ArrowRight', 'ArrowRight');
      hostKey(flow, 'Enter', 'Enter');
      await flush();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // The dialog's flow shows the new order…
      expect(
        within(dialog)
          .getAllByTestId('preview-snippet')
          .map((chip) => chip.textContent),
      ).toEqual(['Beta', 'alpha', 'gamma']);
      // …and so does the INLINE twin (the shared document).
      expect(inlineFlow(dialog).textContent).toBe('Beta alpha gamma');
    });

    it('drops the raised snippet at a word boundary inside the modal and the inline twin reflects it', async () => {
      renderWithProviders(seedInterleaved());
      const dialog = await openDialog();
      fireEvent.click(within(dialog).getByTestId('preview-edit-toggle'));

      // Rewrite the second separator into the user's own words:
      // [Alpha, " ", Beta, " text entered_by_user ", Gamma].
      const flow = within(dialog).getByTestId('preview-segment-flow');
      act(() => {
        flow.focus();
      });
      const separators = Array.from(flow.childNodes).filter(
        (node) => node.nodeType === Node.TEXT_NODE,
      ) as Text[];
      separators[1].data = ' text entered_by_user ';
      fireEvent.input(flow);

      // The focused surface is frozen with the seeded anchors (ADR
      // 0004): thaw and re-focus so the words anchors render before
      // lifting (the blur remounts the flow — re-query the live
      // node).
      act(() => {
        fireEvent.blur(flow);
      });
      const liveFlow = within(dialog).getByTestId('preview-segment-flow');
      act(() => {
        liveFlow.focus();
      });

      // Lift Beta and walk into the words: right after Beta (the
      // text's leading edge), then between the words.
      const [, beta] = within(dialog).getAllByTestId('preview-snippet');
      liftAtCaret(liveFlow, beta, 2);
      await flush();

      hostKey(liveFlow, 'ArrowRight', 'ArrowRight'); // s:3:0
      hostKey(liveFlow, 'ArrowRight', 'ArrowRight'); // s:3:5 — the word gap
      hostKey(liveFlow, 'Enter', 'Enter');
      await flush();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // The chip landed BETWEEN the words (the carried separator
      // re-planted on the left, the boundary's own run on the right —
      // zero characters added or removed)…
      expect(inlineFlow(dialog).textContent).toBe(
        'Alpha text beta entered_by_user gamma',
      );
      // …and the modal's own flow shows the same shared document.
      expect(
        within(dialog).getByTestId('preview-segment-flow').textContent,
      ).toBe('Alpha text beta entered_by_user gamma');
    });
  });
});

// ---------------------------------------------------------------------------
// "I want you to auto position the
// caret on the last position of the text in preview area when enabling
// edit text mode" — the modal composition: the rail toggle must leave
// the MODAL's editor focused (the visible surface wins), and opening
// the modal mid-edit keeps today's click-to-focus (the transition-only
// scope).
// ---------------------------------------------------------------------------

describe('edit-toggle caret auto-positioning', () => {
  const inlineFlowOf = (dialog: HTMLElement) =>
    screen
      .getAllByTestId('preview-segment-flow')
      .find((flow) => !dialog.contains(flow)) as HTMLElement;

  it('the rail toggle focuses the MODAL editor with the caret at its end (the visible surface wins)', async () => {
    renderWithProviders(seedInterleaved());
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByTestId('preview-edit-toggle'));

    const modalFlow = within(dialog).getByTestId('preview-segment-flow');
    expect(document.activeElement).toBe(modalFlow);
    // The caret at the text's end: the document ends with the Gamma
    // chip, so inside its last text child at the end (the
    // click-at-end browser behavior).
    const [, , gamma] = within(dialog).getAllByTestId('preview-snippet');
    const range = window.getSelection()?.getRangeAt(0);
    expect(range?.startContainer).toBe(gamma.firstChild);
    expect(range?.startOffset).toBe(5);
    // The inline twin flashed focus first (every surface reacts) but
    // the modal's host is the one that ends up focused — React runs
    // the toggle effect in tree order, so the modal's portal-subtree
    // effect focuses last (the documented mechanism, pinned here).
    expect(document.activeElement).not.toBe(inlineFlowOf(dialog));
  });

  it('opening the modal while already editing keeps click-to-focus (the transition-only scope)', async () => {
    renderWithProviders(seedInterleaved());
    // The toolbar toggle: the inline editor auto-focuses.
    fireEvent.click(screen.getByTestId('preview-edit-toggle'));
    expect(document.activeElement).toBe(
      screen.getByTestId('preview-segment-flow'),
    );

    const dialog = await openDialog();
    // The modal's editor mounted with edit already ON: NO transition,
    // NO auto-focus — today's click-to-focus behavior.
    const modalFlow = within(dialog).getByTestId('preview-segment-flow');
    expect(document.activeElement).not.toBe(modalFlow);
    // The manual path is unchanged: clicking into it focuses.
    act(() => {
      modalFlow.focus();
    });
    expect(document.activeElement).toBe(modalFlow);
  });
});

// ---------------------------------------------------------------------------
// Bounded card height inside the modal: the layout tweak lifts the
// shared root's viewport-share cap to the zone bounds; and the shared
// document limit caps the modal's editor exactly like the inline one
// (the limit measures the ONE document both surfaces render).
// ---------------------------------------------------------------------------

describe('bounded height and the document limit inside the modal', () => {
  it("the modal tweak fills its zone and WINS over the shared fixed height regardless of injection order", async () => {
    renderWithProviders(seedInterleaved());
    const dialog = await openDialog();
    const area = within(dialog).getByTestId('preview-area');
    // The ModalPreviewArea class merges into the shared root's class
    // (the as={PreviewArea} pattern): the tweak's zone-relative
    // height + cap ship under a DOUBLED selector (.cls.cls —
    // specificity 0,2,0), so they beat the shared fixed height and
    // any single-class rule unconditionally — not by injection-order
    // luck. The bigger view fills its definite-height zone (the 90dvh
    // stretch row) and its flow area scrolls internally.
    const css = stylesText();
    expect(css).toContain('height:400px');
    const doubled = new RegExp(
      '\\.([A-Za-z0-9_-]+)\\.\\1\\{height:100%;max-height:100%;?\\}',
    );
    const match = doubled.exec(css);
    expect(match).not.toBeNull();
    // The doubled-selector rule is the modal tweak's own class — the
    // same class the rendered area carries.
    expect(area.className).toContain(match![1]);
  });

  it('forwards its tunneled props with NO styled-components or React prop warnings', async () => {
    // The styled interface's non-transient props (onActiveDragChange,
    // showCharCount) are TYPE TUNNELS: styled-components forwards
    // them to the resolved `as` COMPONENT (PreviewArea), which
    // consumes them — nothing reaches the DOM, so neither
    // styled-components' unknown-prop warning nor React's
    // unrecognized-prop error may ever fire.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      renderWithProviders(seedInterleaved());
      const dialog = await openDialog();
      fireEvent.click(within(dialog).getByTestId('preview-edit-toggle'));

      const warnings = warnSpy.mock.calls
        .map((call) => String(call[0]))
        .filter((message) =>
          /unknown prop|not recognized|forwarded to the DOM|Warning: Received/.test(
            message,
          ),
        );
      const errors = errorSpy.mock.calls
        .map((call) => String(call[0]))
        .filter((message) =>
          /unknown prop|not recognized|React does not recognize/.test(message),
        );
      expect(warnings).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('renders exactly ONE counter in the modal — the rail number-only one, never a second in-card instance', async () => {
    renderWithProviders(seedInterleaved());
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByTestId('preview-edit-toggle'));

    // Scoped INSIDE the dialog: exactly one counter (the rail's). The
    // inline twin card (outside the dialog, default view) keeps its
    // own count/limit counter — the two placements never collide.
    const dialogCounters = within(dialog).getAllByTestId(
      'preview-char-count',
    );
    expect(dialogCounters).toHaveLength(1);
    const rail = within(dialog).getByTestId('preview-edit-toggle')
      .parentElement;
    expect(rail).toContainElement(dialogCounters[0]);
    expect(dialogCounters[0].textContent).not.toContain('/');
    const inlineCounter = screen
      .getAllByTestId('preview-char-count')
      .find((counter) => !dialog.contains(counter));
    expect(inlineCounter).toBeDefined();
    expect(inlineCounter!.textContent).toContain('/');
  });

  it('clamps a composition commit at the cap inside the modal (the shared hook), and the inline twin reflects it', async () => {
    renderWithProviders(seedInterleaved());
    fireEvent.click(screen.getByTestId('preview-edit-toggle'));
    const inlineFlow = screen.getByTestId('preview-segment-flow');
    // "Alpha beta gamma" serializes to 16 characters.
    inlineFlow.appendChild(
      document.createTextNode('x'.repeat(2000 - 'Alpha beta gamma'.length)),
    );
    fireEvent.input(inlineFlow);
    fireEvent.click(screen.getByTestId('preview-edit-toggle')); // OFF — commit

    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByTestId('preview-edit-toggle'));
    const modalFlow = within(dialog).getByTestId('preview-segment-flow');
    expect(document.activeElement).toBe(modalFlow);

    // The composition stream: the emoji lands over cap, the commit
    // clamp trims it back to exactly the limit, and the re-rendered
    // modal flow matches the shared document.
    const tail = Array.from(modalFlow.childNodes)
      .reverse()
      .find(
        (child) => child.nodeType === Node.TEXT_NODE && (child as Text).data !== '',
      ) as Text;
    act(() => {
      modalFlow.dispatchEvent(
        new CompositionEvent('compositionstart', { bubbles: true }),
      );
      tail.insertData(tail.data.length, '\ud83d\ude00');
      const input = new window.InputEvent('input', {
        bubbles: true,
        inputType: 'insertCompositionText',
        data: '\ud83d\ude00',
      });
      Object.defineProperty(input, 'isComposing', { value: true });
      modalFlow.dispatchEvent(input);
      modalFlow.dispatchEvent(
        new CompositionEvent('compositionend', { bubbles: true }),
      );
    });
    // The inline twin renders the same shared document: exactly at
    // the limit, and the re-rendered modal flow matches it.
    const flows = screen.getAllByTestId('preview-segment-flow');
    const inline = flows.find((candidate) => !dialog.contains(candidate));
    expect(inline?.textContent).toHaveLength(2000);
    const liveModalFlow = within(dialog).getByTestId('preview-segment-flow');
    expect(liveModalFlow.textContent).toBe(inline?.textContent);
  });

  it('the shared document limit caps the modal editor: the next printable keystroke is prevented at 2000', async () => {
    renderWithProviders(seedInterleaved());
    // Build the shared document to exactly 2000 characters inline
    // ("Alpha beta gamma" serializes to 16).
    fireEvent.click(screen.getByTestId('preview-edit-toggle'));
    const inlineFlow = screen.getByTestId('preview-segment-flow');
    inlineFlow.appendChild(
      document.createTextNode('x'.repeat(2000 - 'Alpha beta gamma'.length)),
    );
    fireEvent.input(inlineFlow);
    fireEvent.click(screen.getByTestId('preview-edit-toggle')); // OFF — commit
    expect(screen.getByTestId('preview-segment-flow')).not.toBe(
      document.activeElement,
    );

    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByTestId('preview-edit-toggle'));
    const modalFlow = within(dialog).getByTestId('preview-segment-flow');
    expect(document.activeElement).toBe(modalFlow);

    // At the limit the next printable keystroke is prevented — the
    // same guard the inline editor runs, over the same document.
    const event = new KeyboardEvent('keydown', {
      key: 'a',
      code: 'KeyA',
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      modalFlow.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);

    const flows = screen.getAllByTestId('preview-segment-flow');
    const probe = flows.find((flow) => !dialog.contains(flow));
    expect(probe).toBeDefined();
    expect(within(dialog).getByTestId('preview-segment-flow')).toHaveTextContent(
      `Alpha beta gamma${'x'.repeat(2000 - 'Alpha beta gamma'.length)}`,
    );
  });
});
