import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { I18nextProvider } from 'react-i18next';
import { theme } from '../../theme';
import { i18n } from '@translation';
import { withAlpha } from '../../utils/color';
import TextInput from './TextInput';
import {
  tokenize,
  computeNeedlePosition,
  computeSegments,
  findTokenAt,
  resolvePointerAt,
} from './TextInput.hook';
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
        <StyledThemeProvider theme={theme}>
          {component}
        </StyledThemeProvider>
      </MuiThemeProvider>
    </I18nextProvider>
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
        </I18nextProvider>
      ),
  };
};

/**
 * Virtual monospace layout: 10px per char, line box from 0 to 19
 */
const defaultRect = (start: number, end: number) => ({
  left: start * 10,
  top: 0,
  right: end * 10,
  bottom: 19,
  width: (end - start) * 10,
  height: 19,
});

beforeEach(() => {
  vi.mocked(caretIndexFromPoint)
    .mockReset()
    .mockImplementation((x: number) => {
      // mirrors browsers: the caret resolves to the char boundary closest to
      // the pointer, so the right half of a char yields the position after it
      const charIndex = Math.max(0, Math.min(TEXT.length - 1, Math.floor(x / 10)));
      const localX = x - charIndex * 10;
      return localX < 5 ? charIndex : charIndex + 1;
    });
  vi.mocked(rectForRange)
    .mockReset()
    .mockImplementation((_root: HTMLElement, range: CharRange) =>
      defaultRect(range.start, range.end)
    );
});

const hoverAt = (clientX: number) => {
  fireEvent.pointerMove(screen.getByTestId('text-input-view'), { clientX, clientY: 5 });
};

const pointerDownAt = (clientX: number) => {
  fireEvent.pointerDown(screen.getByTestId('text-input-view'), { clientX, clientY: 5 });
};

const dragFromTo = (fromClientX: number, toClientX: number) => {
  hoverAt(fromClientX);
  pointerDownAt(fromClientX);
  hoverAt(toClientX);
  fireEvent.pointerUp(window);
};

const getNeedleByRole = (role: string): HTMLElement => {
  const needle = screen
    .getAllByTestId('text-input-needle')
    .find((el) => el.getAttribute('data-role') === role);
  if (!needle) {
    throw new Error(`Needle with data-role="${role}" not found`);
  }
  return needle;
};

const getHighlightSegments = (): HTMLElement[] => screen.getAllByTestId('text-input-segment-highlight');
const getPlainSegments = (): HTMLElement[] => screen.getAllByTestId('text-input-segment');

describe('TextInput Component', () => {
  it('renders a fixed-height card: the textarea fills it at a fixed row baseline and the counter stays inside', () => {
    setup({});
    const root = screen.getByTestId('text-input-root');
    expect(root).toHaveStyle({ height: '400px' });
    // The textarea no longer auto-grows with its content: it carries
    // the fixed row baseline and fills the card through the input
    // area's CSS instead.
    const textarea = screen.getByTestId('text-input-textarea');
    expect(textarea).toHaveAttribute('rows', '4');
  });

  it('hardens the geometry chain: every region of the fixed card shares it on a content-independent basis ZERO', () => {
    setup({});
    const css = () =>
      Array.from(document.querySelectorAll('style'))
        .map((style) => style.textContent)
        .join('');
    // The card column's regions — the MUI FormControl root (the
    // TextField) and the OutlinedInput inside it, plus the view-mode
    // container — all take basis-zero shares of the fixed card: the
    // typed content never influences the layout, the textarea fills
    // its area and scrolls natively, and the counter stays put.
    expect(css()).toMatch(/\.([\w-]+)\{[^}]*flex:1 1 0[^}]*min-height:0/);
    expect(css()).toContain('flex:1 1 0');
  });

  it('keeps the counter at n/limit and the textarea maxLength at the env-fed default', () => {
    setup({});
    fireEvent.change(screen.getByTestId('text-input-textarea'), {
      target: { value: 'hello' },
    });
    expect(screen.getByTestId('text-input-counter')).toHaveTextContent(
      '5/500',
    );
    expect(screen.getByTestId('text-input-textarea')).toHaveAttribute(
      'maxlength',
      '500',
    );
  });

  it('scrolls the view-mode container inside the fixed card instead of growing it', () => {
    setup({ mode: 'view', initialText: 'line\n'.repeat(200) });
    const root = screen.getByTestId('text-input-root');
    const view = screen.getByTestId('text-input-view');
    expect(root).toHaveStyle({ height: '400px' });
    expect(view).toHaveStyle({ overflow: 'auto' });
  });

  it('should render textarea and counter in input mode and call onTextChange on typing', () => {
    const onTextChange = vi.fn();
    setup({ onTextChange });
    const textarea = screen.getByTestId('text-input-textarea');
    const counter = screen.getByTestId('text-input-counter');

    expect(textarea).toBeInTheDocument();
    expect(counter).toHaveTextContent('22/500');

    fireEvent.change(textarea, { target: { value: 'hello' } });
    expect(counter).toHaveTextContent('5/500');
    expect(onTextChange).toHaveBeenCalledWith('hello');
  });

  it('should enforce the default max of 500 characters', () => {
    setup();
    const textarea = screen.getByTestId('text-input-textarea') as HTMLTextAreaElement;

    expect(textarea).toHaveAttribute('maxlength', '500');

    const longText = 'a'.repeat(600);
    fireEvent.change(textarea, { target: { value: longText } });
    expect(textarea.value).toHaveLength(500);
    expect(screen.getByTestId('text-input-counter')).toHaveTextContent('500/500');
  });

  it('should render plain text without textarea in view mode and show empty state', () => {
    setup({ mode: 'view' });
    expect(screen.getByTestId('text-input-view')).toBeInTheDocument();
    expect(screen.getByTestId('text-input-view')).toHaveTextContent('alpha beta gamma delta');
    expect(screen.queryByTestId('text-input-textarea')).not.toBeInTheDocument();

    setup({ mode: 'view', initialText: '   ' });
    expect(screen.getByTestId('text-input-empty')).toBeInTheDocument();
    expect(screen.getByText('No text added yet.')).toBeInTheDocument();
  });

  it('should show a hover needle when moving the pointer over a word in view mode', () => {
    setup({ mode: 'view' });
    hoverAt(95);
    const needle = getNeedleByRole('hover');
    expect(needle).toBeInTheDocument();
    expect(needle).toHaveAttribute('data-boundary', '10');
  });

  it('should not show a hover needle when the pointer is outside the word line box', () => {
    setup({ mode: 'view' });
    fireEvent.pointerMove(screen.getByTestId('text-input-view'), { clientX: 95, clientY: 40 });
    expect(screen.queryAllByTestId('text-input-needle')).toHaveLength(0);

    fireEvent.pointerMove(screen.getByTestId('text-input-view'), { clientX: 240, clientY: 5 });
    expect(screen.queryAllByTestId('text-input-needle')).toHaveLength(0);
  });

  it('should create a snippet from a drag and highlight its words', () => {
    const onChange = vi.fn();
    setup({ mode: 'view', onChange });

    dragFromTo(41, 151);

    expect(onChange).toHaveBeenCalledTimes(1);
    const snippets = onChange.mock.calls[0][0] as Snippet[];
    expect(snippets).toHaveLength(1);
    expect(snippets[0]).toMatchObject({
      text: 'beta gamma',
      startIndex: 6,
      endIndex: 16,
      color: '#0080FF',
    });
    expect(snippets[0].id).toBeTruthy();

    const highlights = getHighlightSegments();
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toHaveTextContent('beta gamma');
    expect(highlights[0]).toHaveStyle({
      backgroundColor: withAlpha('#0080FF', 0.3),
    });
    expect(getPlainSegments().map((el) => el.textContent)).toEqual(['alpha ', ' delta']);
  });

  it('should use the color prop for created snippets', () => {
    const onChange = vi.fn();
    setup({ mode: 'view', color: '#FF1493', onChange });

    dragFromTo(41, 151);

    const snippets = onChange.mock.calls[0][0] as Snippet[];
    expect(snippets[0].color).toBe('#FF1493');
    expect(getHighlightSegments()[0]).toHaveStyle({
      backgroundColor: withAlpha('#FF1493', 0.3),
    });
  });

  it('should not create a snippet for a zero-width drag', () => {
    const onChange = vi.fn();
    setup({ mode: 'view', onChange });

    dragFromTo(41, 41);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryAllByTestId('text-input-segment-highlight')).toHaveLength(0);
  });

  it('should support multiple snippets created sequentially', () => {
    const onChange = vi.fn();
    setup({ mode: 'view', onChange });

    dragFromTo(41, 95);
    dragFromTo(151, 211);

    expect(onChange).toHaveBeenCalledTimes(2);
    const snippets = onChange.mock.calls[1][0] as Snippet[];
    expect(snippets).toHaveLength(2);
    expect(snippets[0]).toMatchObject({ text: 'beta', startIndex: 6, endIndex: 10 });
    expect(snippets[1]).toMatchObject({ text: 'delta', startIndex: 17, endIndex: 22 });
  });

  it('should prevent creating an overlapping snippet from inside an existing snippet', () => {
    const onChange = vi.fn();
    setup({ mode: 'view', onChange });

    dragFromTo(41, 151);
    expect(onChange).toHaveBeenCalledTimes(1);

    hoverAt(95);
    pointerDownAt(95);
    hoverAt(211);
    fireEvent.pointerUp(window);

    expect(onChange).toHaveBeenCalledTimes(1);
    const snippets = onChange.mock.calls[0][0] as Snippet[];
    expect(snippets).toHaveLength(1);
  });

  it('should prevent creating an overlapping snippet when dragging from a boundary that touches an existing snippet', () => {
    const onChange = vi.fn();
    setup({ mode: 'view', onChange });

    dragFromTo(41, 151);
    expect(onChange).toHaveBeenCalledTimes(1);

    dragFromTo(41, 211);

    expect(onChange).toHaveBeenCalledTimes(1);
    const snippets = onChange.mock.calls[0][0] as Snippet[];
    expect(snippets).toHaveLength(1);
    expect(snippets[0]).toMatchObject({ startIndex: 6, endIndex: 16 });
  });

  it('should keep snippet needles visible while hovering them', () => {
    setup({ mode: 'view' });

    dragFromTo(41, 151);
    hoverAt(65);
    expect(screen.getAllByTestId('text-input-needle')).toHaveLength(2);

    fireEvent.pointerMove(getNeedleByRole('snippet-end'), {});
    expect(screen.getAllByTestId('text-input-needle')).toHaveLength(2);
  });

  it('should keep snippet needles visible while hovering whitespace inside the snippet', () => {
    setup({ mode: 'view' });

    dragFromTo(41, 151);
    hoverAt(65);
    expect(screen.getAllByTestId('text-input-needle')).toHaveLength(2);

    hoverAt(101);
    expect(screen.getAllByTestId('text-input-needle')).toHaveLength(2);
    expect(getNeedleByRole('snippet-start')).toBeInTheDocument();
    expect(getNeedleByRole('snippet-end')).toBeInTheDocument();

    hoverAt(161);
    expect(screen.queryAllByTestId('text-input-needle')).toHaveLength(0);
  });

  it('should not start a create drag when pressing down on whitespace inside a snippet', () => {
    const onChange = vi.fn();
    setup({ mode: 'view', onChange });

    dragFromTo(41, 151);
    expect(onChange).toHaveBeenCalledTimes(1);

    hoverAt(101);
    pointerDownAt(101);
    hoverAt(211);
    fireEvent.pointerUp(window);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getAllByTestId('text-input-segment-highlight')).toHaveLength(1);
  });

  it('should keep snippet needles while hovering the line break inside a snippet', () => {
    const onChange = vi.fn();
    const text = 'alpha beta\ngamma delta';
    setup({ mode: 'view', initialText: text, onChange });

    // two-line virtual layout: line 1 = chars 0-9 (y 0-19), char 10 = '\n'
    // (zero-width rect at x=100), line 2 = chars 11-21 (y 19-38)
    vi.mocked(caretIndexFromPoint).mockImplementation((x: number, y: number) => {
      if (y >= 19) {
        const charIndex = 11 + Math.max(0, Math.min(10, Math.floor(x / 10)));
        const localX = x - Math.floor(x / 10) * 10;
        return localX < 5 ? Math.min(charIndex, 21) : Math.min(charIndex + 1, 22);
      }
      const charIndex = Math.max(0, Math.min(10, Math.floor(x / 10)));
      const localX = x - Math.floor(x / 10) * 10;
      return localX < 5 ? charIndex : Math.min(charIndex + 1, 10);
    });
    vi.mocked(rectForRange).mockImplementation((_root: HTMLElement, range: CharRange) => {
      if (range.start >= 11) {
        return { left: (range.start - 11) * 10, top: 19, right: (range.end - 11) * 10, bottom: 38, width: (range.end - range.start) * 10, height: 19 };
      }
      if (range.start === 10) {
        return { left: 100, top: 0, right: 100, bottom: 19, width: 0, height: 19 };
      }
      return { left: range.start * 10, top: 0, right: range.end * 10, bottom: 19, width: (range.end - range.start) * 10, height: 19 };
    });

    // drag from beta start (line 1) to gamma end (line 2)
    hoverAt(65);
    pointerDownAt(65);
    fireEvent.pointerMove(screen.getByTestId('text-input-view'), { clientX: 45, clientY: 30 });
    fireEvent.pointerUp(window);

    expect(onChange).toHaveBeenCalledTimes(1);
    const snippets = onChange.mock.calls[0][0] as Snippet[];
    expect(snippets[0]).toMatchObject({
      text: 'beta\ngamma',
      startIndex: 6,
      endIndex: 16,
    });

    hoverAt(75);
    expect(screen.getAllByTestId('text-input-needle')).toHaveLength(2);

    // hovering the zero-width line break (right of beta, same line) keeps the needles
    fireEvent.pointerMove(screen.getByTestId('text-input-view'), { clientX: 105, clientY: 5 });
    expect(screen.getAllByTestId('text-input-needle')).toHaveLength(2);
    expect(getNeedleByRole('snippet-start')).toBeInTheDocument();
    expect(getNeedleByRole('snippet-end')).toBeInTheDocument();

    // hovering the empty trailing area of line 1 inside the snippet keeps the needles
    fireEvent.pointerMove(screen.getByTestId('text-input-view'), { clientX: 250, clientY: 5 });
    expect(screen.getAllByTestId('text-input-needle')).toHaveLength(2);

    // hovering the space after alpha (outside the snippet) clears them
    hoverAt(52);
    expect(screen.queryAllByTestId('text-input-needle')).toHaveLength(0);
  });

  it('should show the word-end hover needle when hovering the right edge of a word', () => {
    setup({ mode: 'view' });

    hoverAt(49);
    expect(getNeedleByRole('hover')).toHaveAttribute('data-boundary', '5');
  });

  it('should start a create drag from the right edge of a word', () => {
    const onChange = vi.fn();
    setup({ mode: 'view', onChange });

    hoverAt(49);
    pointerDownAt(49);
    hoverAt(151);
    fireEvent.pointerUp(window);

    expect(onChange).toHaveBeenCalledTimes(1);
    const snippets = onChange.mock.calls[0][0] as Snippet[];
    expect(snippets[0]).toMatchObject({ text: 'beta gamma', startIndex: 6, endIndex: 16 });
  });

  it('should resize a snippet by dragging its end needle', () => {
    const onChange = vi.fn();
    setup({ mode: 'view', onChange });

    dragFromTo(41, 151);

    hoverAt(65);
    const endNeedle = getNeedleByRole('snippet-end');
    fireEvent.pointerDown(endNeedle, {});
    hoverAt(211);

    const highlights = getHighlightSegments();
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toHaveTextContent('beta gamma delta');
    expect(highlights[0]).toHaveStyle({
      backgroundColor: withAlpha('#0080FF', 0.3),
    });

    fireEvent.pointerUp(window);

    expect(onChange).toHaveBeenCalledTimes(2);
    const snippets = onChange.mock.calls[1][0] as Snippet[];
    expect(snippets).toHaveLength(1);
    expect(snippets[0]).toMatchObject({
      text: 'beta gamma delta',
      startIndex: 6,
      endIndex: 22,
    });
  });

  it('should clamp an end-edge resize at the start of the following snippet', () => {
    const onChange = vi.fn();
    setup({ mode: 'view', onChange });

    dragFromTo(41, 95);
    dragFromTo(151, 211);
    expect(onChange).toHaveBeenCalledTimes(2);

    hoverAt(65);
    const endNeedle = getNeedleByRole('snippet-end');
    fireEvent.pointerDown(endNeedle, {});
    hoverAt(211);

    const highlights = getHighlightSegments();
    expect(highlights).toHaveLength(2);
    expect(highlights[0].textContent).toBe('beta gamma ');
    expect(highlights[1].textContent).toBe('delta');

    fireEvent.pointerUp(window);

    expect(onChange).toHaveBeenCalledTimes(3);
    const snippets = onChange.mock.calls[2][0] as Snippet[];
    expect(snippets[0]).toMatchObject({ text: 'beta gamma ', startIndex: 6, endIndex: 17 });
    expect(snippets[1]).toMatchObject({ text: 'delta', startIndex: 17, endIndex: 22 });
    expect(snippets[0].endIndex).toBeLessThanOrEqual(snippets[1].startIndex);
  });

  it('should remove a snippet when a resize collapses it to zero width', () => {
    const onChange = vi.fn();
    setup({ mode: 'view', onChange });

    dragFromTo(41, 151);

    hoverAt(65);
    const startNeedle = getNeedleByRole('snippet-start');
    fireEvent.pointerDown(startNeedle, {});
    hoverAt(151);
    fireEvent.pointerUp(window);

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('should clear all snippets when the text is edited in input mode', () => {
    const onChange = vi.fn();
    const { rerenderWithProps } = setup({ mode: 'view', onChange });

    dragFromTo(41, 151);
    expect(onChange).toHaveBeenCalledTimes(1);

    rerenderWithProps({ mode: 'input' });
    const textarea = screen.getByTestId('text-input-textarea');
    fireEvent.change(textarea, { target: { value: 'brand new text' } });

    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.getByTestId('text-input-counter')).toHaveTextContent('14/500');
  });

  it('should not render needles in input mode', () => {
    setup();
    expect(screen.queryAllByTestId('text-input-needle')).toHaveLength(0);
  });

  it('should position a word-end boundary needle at the preceding word right edge', () => {
    setup({ mode: 'view' });

    dragFromTo(41, 151);
    vi.mocked(rectForRange).mockImplementation((_root: HTMLElement, range: CharRange) => {
      if (range.start >= 11 && range.end <= 16) {
        return {
          left: 100 + (range.start - 11) * 10,
          top: 0,
          right: 100 + (range.end - 11) * 10,
          bottom: 19,
          width: (range.end - range.start) * 10,
          height: 19,
        };
      }
      return defaultRect(range.start, range.end);
    });

    hoverAt(65);
    const endNeedle = getNeedleByRole('snippet-end');

    expect(endNeedle).toHaveAttribute('data-boundary', '16');
    expect(endNeedle).toHaveStyle({ left: '150px' });
  });

  it('compensates the view scroll offset when positioning needles inside the scrollable container', () => {
    setup({ mode: 'view' });
    const view = screen.getByTestId('text-input-view');
    vi.spyOn(view, 'getBoundingClientRect').mockReturnValue({
      x: 100,
      y: 50,
      width: 200,
      height: 200,
      top: 50,
      right: 300,
      bottom: 250,
      left: 100,
      toJSON: () => ({}),
    } as DOMRect);
    Object.defineProperty(view, 'scrollTop', { value: 30, configurable: true });
    Object.defineProperty(view, 'scrollLeft', { value: 10, configurable: true });

    hoverAt(65);
    const needle = getNeedleByRole('hover');
    expect(needle).toHaveAttribute('data-boundary', '6');
    // The needle offsets live in the container's content space: the
    // origin is the viewport rect minus the scroll (100-10, 50-30),
    // so the word-start rect at (60, 0) lands at (-30, -20) — glued
    // to its word at any scroll position.
    expect(needle).toHaveStyle({ left: '-30px', top: '-20px' });
  });

  it('should highlight whitespace between words inside a snippet', () => {
    setup({ mode: 'view' });

    dragFromTo(41, 151);

    const highlights = getHighlightSegments();
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toHaveTextContent('beta gamma');
    expect(getPlainSegments().map((el) => el.textContent)).toEqual(['alpha ', ' delta']);
  });

  it('should ignore the leading whitespace while dragging and in the committed snippet', () => {
    const onChange = vi.fn();
    setup({ mode: 'view', onChange });

    hoverAt(41);
    pointerDownAt(41);
    hoverAt(151);

    const highlights = getHighlightSegments();
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toHaveAttribute('data-segment-start', '6');
    expect(highlights[0]).toHaveTextContent('beta gamma');
    expect(highlights[0]).toHaveStyle({
      backgroundColor: withAlpha('#0080FF', 0.2),
    });

    fireEvent.pointerUp(window);

    const snippets = onChange.mock.calls[0][0] as Snippet[];
    expect(snippets[0]).toMatchObject({ text: 'beta gamma', startIndex: 6, endIndex: 16 });
  });

  it('should disable native text selection in view mode', () => {
    setup({ mode: 'view' });
    expect(screen.getByTestId('text-input-view')).toHaveStyle({
      '-webkit-user-select': 'none',
      userSelect: 'none',
    });
  });

  it('should keep view text start-aligned when the page centers content', () => {
    renderWithProviders(
      <div style={{ textAlign: 'center' }}>
        <TextInput initialText={TEXT} mode="view" />
      </div>
    );
    expect(screen.getByTestId('text-input-view')).toHaveStyle({
      textAlign: 'start',
    });
  });

  it('should show a resize cursor while dragging a needle and restore it on release', () => {
    setup({ mode: 'view' });
    const view = screen.getByTestId('text-input-view');
    expect(view).toHaveStyle({ cursor: 'default' });

    hoverAt(41);
    pointerDownAt(41);
    expect(view).toHaveStyle({ cursor: 'ew-resize' });

    hoverAt(65);
    expect(view).toHaveStyle({ cursor: 'ew-resize' });

    fireEvent.pointerUp(window);
    expect(view).toHaveStyle({ cursor: 'default' });
  });

  it('should show the hover needle at the word start when hovering the left half of a word', () => {
    setup({ mode: 'view' });

    hoverAt(11);
    expect(getNeedleByRole('hover')).toHaveAttribute('data-boundary', '0');

    hoverAt(65);
    expect(getNeedleByRole('hover')).toHaveAttribute('data-boundary', '6');
  });

  it('should create a snippet covering the first word when dragging back from the needle after it', () => {
    const onChange = vi.fn();
    setup({ mode: 'view', onChange });

    hoverAt(41);
    const hoverNeedle = getNeedleByRole('hover');
    expect(hoverNeedle).toHaveAttribute('data-boundary', '5');

    fireEvent.pointerDown(hoverNeedle, {});
    hoverAt(11);

    expect(getNeedleByRole('current')).toHaveAttribute('data-boundary', '0');
    const highlights = getHighlightSegments();
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toHaveTextContent('alpha');
    expect(highlights[0]).toHaveStyle({ backgroundColor: withAlpha('#0080FF', 0.2) });

    fireEvent.pointerUp(window);

    expect(onChange).toHaveBeenCalledTimes(1);
    const snippets = onChange.mock.calls[0][0] as Snippet[];
    expect(snippets[0]).toMatchObject({ text: 'alpha', startIndex: 0, endIndex: 5 });
  });
});

describe('TextInput helpers', () => {
  it('should tokenize text into words and whitespace with start offsets', () => {
    const tokens = tokenize(TEXT);
    expect(tokens.map((token) => token.value)).toEqual([
      'alpha',
      ' ',
      'beta',
      ' ',
      'gamma',
      ' ',
      'delta',
    ]);
    expect(tokens.map((token) => token.isWord)).toEqual([
      true,
      false,
      true,
      false,
      true,
      false,
      true,
    ]);
    expect(tokens.map((token) => token.start)).toEqual([0, 5, 6, 10, 11, 16, 17]);
  });

  it('should convert 3 and 6 digit hex colors to rgba', () => {
    expect(withAlpha('#0080FF', 0.3)).toBe('rgba(0, 128, 255, 0.3)');
    expect(withAlpha('#F0A', 0.5)).toBe('rgba(255, 0, 170, 0.5)');
  });

  it('should produce a single plain segment when there are no snippets or drags', () => {
    expect(computeSegments(TEXT, [], null, '#0080FF')).toEqual([
      { start: 0, end: 22 },
    ]);
  });

  it('should alternate plain and highlighted segments around committed snippets', () => {
    const snippets: Snippet[] = [
      { id: 's1', text: 'beta gamma', startIndex: 6, endIndex: 16, color: '#0080FF' },
    ];
    expect(computeSegments(TEXT, snippets, null, '#0080FF')).toEqual([
      { start: 0, end: 6 },
      { start: 6, end: 16, color: '#0080FF', alpha: 0.3 },
      { start: 16, end: 22 },
    ]);
  });

  it('should build the live create-drag preview with trimmed leading whitespace', () => {
    const drag = { type: 'create' as const, anchor: 5, current: 16 };
    expect(computeSegments(TEXT, [], drag, '#0080FF')).toEqual([
      { start: 0, end: 6 },
      { start: 6, end: 16, color: '#0080FF', alpha: 0.2 },
      { start: 16, end: 22 },
    ]);

    const reversed = { type: 'create' as const, anchor: 16, current: 5 };
    expect(computeSegments(TEXT, [], reversed, '#0080FF')[1]).toEqual({
      start: 6,
      end: 16,
      color: '#0080FF',
      alpha: 0.2,
    });
  });

  it('should keep committed snippets highlighted during a create drag', () => {
    const snippets: Snippet[] = [
      { id: 's1', text: 'beta gamma', startIndex: 6, endIndex: 16, color: '#0080FF' },
    ];
    const drag = { type: 'create' as const, anchor: 17, current: 22 };
    expect(computeSegments(TEXT, snippets, drag, '#0080FF')).toEqual([
      { start: 0, end: 6 },
      { start: 6, end: 16, color: '#0080FF', alpha: 0.3 },
      { start: 16, end: 17 },
      { start: 17, end: 22, color: '#0080FF', alpha: 0.2 },
    ]);
  });

  it('should show the live resize range instead of the dragged snippet', () => {
    const snippets: Snippet[] = [
      { id: 's1', text: 'beta gamma', startIndex: 6, endIndex: 16, color: '#0080FF' },
    ];
    const growEnd = { type: 'resize' as const, snippetId: 's1', edge: 'end' as const, boundary: 22 };
    expect(computeSegments(TEXT, snippets, growEnd, '#0080FF')).toEqual([
      { start: 0, end: 6 },
      { start: 6, end: 22, color: '#0080FF', alpha: 0.3 },
    ]);

    const shrinkStart = {
      type: 'resize' as const,
      snippetId: 's1',
      edge: 'start' as const,
      boundary: 11,
    };
    expect(computeSegments(TEXT, snippets, shrinkStart, '#0080FF')).toEqual([
      { start: 0, end: 11 },
      { start: 11, end: 16, color: '#0080FF', alpha: 0.3 },
      { start: 16, end: 22 },
    ]);
  });

  it('should find the token containing a char index', () => {
    const tokens = tokenize(TEXT);
    expect(findTokenAt(0, tokens)?.value).toBe('alpha');
    expect(findTokenAt(4, tokens)?.value).toBe('alpha');
    expect(findTokenAt(5, tokens)?.value).toBe(' ');
    expect(findTokenAt(6, tokens)?.value).toBe('beta');
    expect(findTokenAt(22, tokens)).toBeUndefined();
  });

  it('should resolve pointers only inside the token line box', () => {
    const tokens = tokenize(TEXT);
    const rectFor = ({ start, end }: CharRange) => defaultRect(start, end);

    expect(resolvePointerAt(null, { clientX: 65, clientY: 5, tokens, rectFor })).toBeUndefined();
    expect(resolvePointerAt(6, { clientX: 65, clientY: 40, tokens, rectFor })).toBeUndefined();
    expect(resolvePointerAt(6, { clientX: 240, clientY: 5, tokens, rectFor })).toBeUndefined();
  });

  it('should resolve word start on the left half and word end on the right half', () => {
    const tokens = tokenize(TEXT);
    const rectFor = ({ start, end }: CharRange) => defaultRect(start, end);

    const left = resolvePointerAt(6, { clientX: 65, clientY: 5, tokens, rectFor });
    expect(left?.token.value).toBe('beta');
    expect(left?.boundary).toBe(6);

    const right = resolvePointerAt(9, { clientX: 95, clientY: 5, tokens, rectFor });
    expect(right?.token.value).toBe('beta');
    expect(right?.boundary).toBe(10);
  });

  it('should resolve whitespace tokens without a boundary', () => {
    const tokens = tokenize(TEXT);
    const rectFor = ({ start, end }: CharRange) => defaultRect(start, end);

    const whitespace = resolvePointerAt(10, { clientX: 101, clientY: 5, tokens, rectFor });
    expect(whitespace?.token.value).toBe(' ');
    expect(whitespace?.token.start).toBe(10);
    expect(whitespace?.boundary).toBeNull();

    expect(
      resolvePointerAt(10, { clientX: 101, clientY: 40, tokens, rectFor })
    ).toBeUndefined();
  });

  it('should resolve zero-width line-break whitespace anywhere on its line', () => {
    const text = 'alpha beta\ngamma';
    const tokens = tokenize(text);
    const rectFor = ({ start, end }: CharRange) => {
      if (start >= 11) {
        return { left: 0, top: 19, right: (end - 11) * 10, bottom: 38 };
      }
      if (start === 10) {
        return { left: 100, top: 0, right: 100, bottom: 19 };
      }
      return { left: start * 10, top: 0, right: end * 10, bottom: 19 };
    };

    const lineBreak = resolvePointerAt(10, { clientX: 117, clientY: 5, tokens, rectFor });
    expect(lineBreak?.token.value).toBe('\n');
    expect(lineBreak?.boundary).toBeNull();

    const trailing = resolvePointerAt(10, { clientX: 175, clientY: 5, tokens, rectFor });
    expect(trailing?.token.value).toBe('\n');
    expect(trailing?.boundary).toBeNull();

    expect(
      resolvePointerAt(10, { clientX: 117, clientY: 40, tokens, rectFor })
    ).toBeUndefined();
  });

  it('should attribute right-half-of-last-char carets to the preceding word', () => {
    const tokens = tokenize(TEXT);
    const rectFor = ({ start, end }: CharRange) => defaultRect(start, end);

    const attributed = resolvePointerAt(10, { clientX: 95, clientY: 5, tokens, rectFor });
    expect(attributed?.token.value).toBe('beta');
    expect(attributed?.boundary).toBe(10);

    const atTextEnd = resolvePointerAt(TEXT.length, {
      clientX: 215,
      clientY: 5,
      tokens,
      rectFor,
    });
    expect(atTextEnd?.token.value).toBe('delta');
    expect(atTextEnd?.boundary).toBe(22);

    const beyondText = resolvePointerAt(TEXT.length, {
      clientX: 240,
      clientY: 5,
      tokens,
      rectFor,
    });
    expect(beyondText).toBeUndefined();
  });

  it('should position needles at word left edge for word-start boundaries and right edge for word-end boundaries', () => {
    const tokens = tokenize('alpha beta');
    const rectFor = ({ start, end }: CharRange) => ({
      left: start * 10,
      top: start < 5 ? 0 : 20,
      right: end * 10,
      bottom: start < 5 ? 19 : 39,
    });
    const origin = { left: 0, top: 0 };

    expect(computeNeedlePosition(0, { tokens, rectFor }, origin)).toEqual({ left: 0, top: 0 });
    expect(computeNeedlePosition(5, { tokens, rectFor }, origin)).toEqual({ left: 50, top: 0 });
    expect(computeNeedlePosition(6, { tokens, rectFor }, origin)).toEqual({ left: 60, top: 20 });
    expect(computeNeedlePosition(11, { tokens, rectFor }, origin)).toEqual({ left: 110, top: 20 });
  });

  it('should position needles relative to the given origin and handle missing rects', () => {
    const tokens = tokenize(TEXT);
    const rectFor = () => undefined;
    expect(
      computeNeedlePosition(0, { tokens, rectFor }, { left: 0, top: 0 })
    ).toBeUndefined();

    const rectFor2 = ({ start, end }: CharRange) => defaultRect(start, end);
    expect(
      computeNeedlePosition(5, { tokens, rectFor: rectFor2 }, { left: 41, top: 4 })
    ).toEqual({
      left: 9,
      top: -4,
    });
  });
});
