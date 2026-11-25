import { act, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { I18nextProvider } from 'react-i18next';
import { theme } from '@theme';
import { i18n } from '@translation';
import TextInput from './TextInput';
import { caretIndexFromPoint, rectForRange } from './TextInput.geometry';
import { type CharRange, type Snippet, type TextInputProps } from './TextInput.types';

vi.mock('./TextInput.geometry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./TextInput.geometry')>();
  return {
    ...actual,
    caretIndexFromPoint: vi.fn(),
    rectForRange: vi.fn(),
  };
});

const TEXT = 'alpha beta gamma delta';

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <I18nextProvider i18n={i18n}>
      <MuiThemeProvider theme={theme}>
        <StyledThemeProvider theme={theme}>{component}</StyledThemeProvider>
      </MuiThemeProvider>
    </I18nextProvider>,
  );
};

const setup = (props: Partial<TextInputProps> = {}) => {
  const initialText = props.initialText ?? TEXT;
  const helpers = renderWithProviders(<TextInput initialText={initialText} {...props} />);
  return {
    ...helpers,
    rerenderWithProps: (next: Partial<TextInputProps>) =>
      helpers.rerender(
        <I18nextProvider i18n={i18n}>
          <MuiThemeProvider theme={theme}>
            <StyledThemeProvider theme={theme}>
              <TextInput initialText={initialText} {...props} {...next} />
            </StyledThemeProvider>
          </MuiThemeProvider>
        </I18nextProvider>,
      ),
  };
};

const defaultRect = (start: number, end: number) => ({
  left: start * 10,
  top: 0,
  right: end * 10,
  bottom: 19,
  width: (end - start) * 10,
  height: 19,
});

const BELOW_MD_MEDIA = theme.breakpoints.down('md').replace(/^@media\s*/, '');

const installViewport = (belowMd: boolean) => {
  const listeners = new Set<(event: { matches: boolean }) => void>();
  let matches = belowMd;
  const spy = vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
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

beforeEach(() => {
  vi.mocked(caretIndexFromPoint)
    .mockReset()
    .mockImplementation((x: number) => {
      const charIndex = Math.max(0, Math.min(TEXT.length - 1, Math.floor(x / 10)));
      const localX = x - charIndex * 10;
      return localX < 5 ? charIndex : charIndex + 1;
    });
  vi.mocked(rectForRange)
    .mockReset()
    .mockImplementation((_root: HTMLElement, range: CharRange) => defaultRect(range.start, range.end));
});

describe('TextInput mobile', () => {
  it('renders mobile header with Text n and no Label below md', () => {
    const viewport = installViewport(true);
    setup({ inputNumber: 1, label: 'My Label' });
    expect(screen.getByText('Text 1')).toBeInTheDocument();
    expect(screen.queryByText('My Label')).not.toBeInTheDocument();
    viewport.restore();
  });

  it('renders Label and no header above md', () => {
    const viewport = installViewport(false);
    setup({ inputNumber: 1, label: 'My Label' });
    expect(screen.queryByText('Text 1')).not.toBeInTheDocument();
    expect(screen.getByText('My Label')).toBeInTheDocument();
    viewport.restore();
  });

  it('minimize toggle hides body and flips aria-expanded / aria-label', () => {
    const viewport = installViewport(true);
    setup({ inputNumber: 1, mode: 'input' });
    const button = screen.getByLabelText('Minimize');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('text-input-textarea')).toBeInTheDocument();
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-label', 'Expand');
    expect(screen.queryByTestId('text-input-textarea')).not.toBeInTheDocument();
    expect(screen.getByText('Text 1')).toBeInTheDocument();
    viewport.restore();
  });

  it('minimized state resets on remount', () => {
    const viewport = installViewport(true);
    const { unmount } = setup({ inputNumber: 1, mode: 'input' });
    fireEvent.click(screen.getByLabelText('Minimize'));
    expect(screen.queryByTestId('text-input-textarea')).not.toBeInTheDocument();
    unmount();
    setup({ inputNumber: 1, mode: 'input' });
    expect(screen.getByTestId('text-input-textarea')).toBeInTheDocument();
    viewport.restore();
  });

  it('uncollapses when switching from mobile to desktop while minimized', () => {
    const viewport = installViewport(true);
    setup({ inputNumber: 1, mode: 'input' });
    fireEvent.click(screen.getByLabelText('Minimize'));
    expect(screen.queryByTestId('text-input-textarea')).not.toBeInTheDocument();
    act(() => {
      viewport.setBelowMd(false);
    });
    expect(screen.getByTestId('text-input-textarea')).toBeInTheDocument();
    viewport.restore();
  });

  it('creates a snippet via long-press then drag on mobile', () => {
    vi.useFakeTimers();
    const viewport = installViewport(true);
    const onChange = vi.fn();
    setup({ mode: 'view', onChange });
    const view = screen.getByTestId('text-input-view');
    fireEvent.pointerDown(view, { clientX: 41, clientY: 5 });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    fireEvent.pointerMove(view, { clientX: 151, clientY: 5 });
    fireEvent.pointerUp(window);
    expect(onChange).toHaveBeenCalled();
    const snippets = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Snippet[];
    expect(snippets).toHaveLength(1);
    vi.useRealTimers();
    viewport.restore();
  });

  it('does not create a snippet on a plain tap', () => {
    vi.useFakeTimers();
    const viewport = installViewport(true);
    const onChange = vi.fn();
    setup({ mode: 'view', onChange });
    const view = screen.getByTestId('text-input-view');
    fireEvent.pointerDown(view, { clientX: 41, clientY: 5 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.pointerUp(window);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onChange).not.toHaveBeenCalled();
    vi.useRealTimers();
    viewport.restore();
  });

  it('shows both handles for committed snippets on mobile', () => {
    vi.useFakeTimers();
    const viewport = installViewport(true);
    setup({ mode: 'view' });
    const view = screen.getByTestId('text-input-view');
    fireEvent.pointerDown(view, { clientX: 41, clientY: 5 });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    fireEvent.pointerMove(view, { clientX: 151, clientY: 5 });
    fireEvent.pointerUp(window);
    // no hover needed
    expect(screen.getAllByTestId('text-input-needle')).toHaveLength(2);
    vi.useRealTimers();
    viewport.restore();
  });

  it('resizes via handle on mobile', () => {
    vi.useFakeTimers();
    const viewport = installViewport(true);
    const onChange = vi.fn();
    setup({ mode: 'view', onChange });
    const view = screen.getByTestId('text-input-view');
    fireEvent.pointerDown(view, { clientX: 41, clientY: 5 });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    fireEvent.pointerMove(view, { clientX: 151, clientY: 5 });
    fireEvent.pointerUp(window);
    expect(onChange).toHaveBeenCalled();

    const endNeedle = screen
      .getAllByTestId('text-input-needle')
      .find((el) => el.getAttribute('data-role') === 'snippet-end')!;
    fireEvent.pointerDown(endNeedle, {});
    fireEvent.pointerMove(view, { clientX: 211, clientY: 5 });
    fireEvent.pointerUp(window);
    expect(onChange).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
    viewport.restore();
  });

  const stylesText = () =>
    Array.from(document.querySelectorAll('style'))
      .map((style) => style.textContent)
      .join('');

  it('view container has touch-action pan-y on mobile', () => {
    const viewport = installViewport(true);
    setup({ mode: 'view' });
    expect(stylesText()).toContain('pan-y');
    viewport.restore();
  });

  it('view container keeps touch-action none on desktop', () => {
    const viewport = installViewport(false);
    setup({ mode: 'view' });
    expect(stylesText()).toContain('touch-action:none');
    viewport.restore();
  });
});
