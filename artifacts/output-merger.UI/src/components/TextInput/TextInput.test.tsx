import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { I18nextProvider } from 'react-i18next';
import { theme } from '../../theme';
import i18n from '../../i18n';
import TextInput from './TextInput';
import {
  tokenize,
  withAlpha,
  computeNeedlePosition,
  computeSegments,
  findWordTokenAt,
  resolveBoundaryAt,
} from './TextInput.hook';
import { caretIndexFromPoint, rectForRange } from './TextInput.geometry';
import { type Snippet, type TextInputProps } from './TextInput.types';

vi.mock('./TextInput.geometry', () => ({
  caretIndexFromPoint: vi.fn(),
  rectForRange: vi.fn(),
}));

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
      const index = Math.floor(x / 10);
      return index >= 0 && index < TEXT.length && /\S/.test(TEXT[index]) ? index : null;
    });
  vi.mocked(rectForRange)
    .mockReset()
    .mockImplementation((_root: HTMLElement, start: number, end: number) =>
      defaultRect(start, end)
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
    vi.mocked(rectForRange).mockImplementation((_root, start, end) => {
      if (start >= 11 && end <= 16) {
        return {
          left: 100 + (start - 11) * 10,
          top: 0,
          right: 100 + (end - 11) * 10,
          bottom: 19,
          width: (end - start) * 10,
          height: 19,
        };
      }
      return defaultRect(start, end);
    });

    hoverAt(65);
    const endNeedle = getNeedleByRole('snippet-end');

    expect(endNeedle).toHaveAttribute('data-boundary', '16');
    expect(endNeedle).toHaveStyle({ left: '150px' });
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

  it('should find the word token containing a char index', () => {
    const tokens = tokenize(TEXT);
    expect(findWordTokenAt(0, tokens)?.value).toBe('alpha');
    expect(findWordTokenAt(4, tokens)?.value).toBe('alpha');
    expect(findWordTokenAt(5, tokens)).toBeUndefined();
    expect(findWordTokenAt(6, tokens)?.value).toBe('beta');
    expect(findWordTokenAt(22, tokens)).toBeUndefined();
  });

  it('should resolve boundaries only for pointers inside the word line box', () => {
    const tokens = tokenize(TEXT);
    const rectFor = (start: number, end: number) => defaultRect(start, end);

    expect(resolveBoundaryAt(null, 65, 5, tokens, rectFor)).toBeUndefined();
    expect(resolveBoundaryAt(5, 55, 5, tokens, rectFor)).toBeUndefined();
    expect(resolveBoundaryAt(6, 95, 40, tokens, rectFor)).toBeUndefined();
    expect(resolveBoundaryAt(6, 240, 5, tokens, rectFor)).toBeUndefined();
  });

  it('should resolve word start on the left half and word end on the right half', () => {
    const tokens = tokenize(TEXT);
    const rectFor = (start: number, end: number) => defaultRect(start, end);

    const left = resolveBoundaryAt(6, 65, 5, tokens, rectFor);
    expect(left?.token.value).toBe('beta');
    expect(left?.boundary).toBe(6);

    const right = resolveBoundaryAt(9, 95, 5, tokens, rectFor);
    expect(right?.token.value).toBe('beta');
    expect(right?.boundary).toBe(10);
  });

  it('should position needles at word left edge for word-start boundaries and right edge for word-end boundaries', () => {
    const tokens = tokenize('alpha beta');
    const rectFor = (start: number, end: number) => ({
      left: start * 10,
      top: start < 5 ? 0 : 20,
      right: end * 10,
      bottom: start < 5 ? 19 : 39,
    });
    const origin = { left: 0, top: 0 };

    expect(computeNeedlePosition(0, tokens, rectFor, origin)).toEqual({ left: 0, top: 0 });
    expect(computeNeedlePosition(5, tokens, rectFor, origin)).toEqual({ left: 50, top: 0 });
    expect(computeNeedlePosition(6, tokens, rectFor, origin)).toEqual({ left: 60, top: 20 });
    expect(computeNeedlePosition(11, tokens, rectFor, origin)).toEqual({ left: 110, top: 20 });
  });

  it('should position needles relative to the given origin and handle missing rects', () => {
    const tokens = tokenize(TEXT);
    const rectFor = () => undefined;
    expect(computeNeedlePosition(0, tokens, rectFor, { left: 0, top: 0 })).toBeUndefined();

    const rectFor2 = (start: number, end: number) => defaultRect(start, end);
    expect(computeNeedlePosition(5, tokens, rectFor2, { left: 41, top: 4 })).toEqual({
      left: 9,
      top: -4,
    });
  });
});
