import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { I18nextProvider } from 'react-i18next';
import { theme } from '../../theme';
import i18n from '../../i18n';
import TextInput from './TextInput';
import { tokenize, withAlpha, computeNeedlePosition } from './TextInput.hook';
import { type Snippet, type TextInputProps } from './TextInput.types';

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

const dragCreate = (fromWord: string, toWord: string) => {
  fireEvent.pointerMove(screen.getByText(fromWord), {});
  fireEvent.pointerDown(screen.getByText(fromWord), {});
  fireEvent.pointerMove(screen.getByText(toWord), {});
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

const applyRect = (el: HTMLElement, left: number, width: number) => {
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({
      left,
      top: 0,
      right: left + width,
      bottom: 19,
      width,
      height: 19,
      x: left,
      y: 0,
      toJSON: () => ({}),
    }),
    configurable: true,
  });
};

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
    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.queryByTestId('text-input-textarea')).not.toBeInTheDocument();

    setup({ mode: 'view', initialText: '   ' });
    expect(screen.getByTestId('text-input-empty')).toBeInTheDocument();
    expect(screen.getByText('No text added yet.')).toBeInTheDocument();
  });

  it('should show a hover needle when moving the pointer over a word in view mode', () => {
    setup({ mode: 'view' });
    fireEvent.pointerMove(screen.getByText('beta'), {});
    const needle = getNeedleByRole('hover');
    expect(needle).toBeInTheDocument();
    expect(needle).toHaveAttribute('data-boundary', '10');
  });

  it('should create a snippet from a drag and highlight its words', () => {
    const onChange = vi.fn();
    setup({ mode: 'view', onChange });

    dragCreate('alpha', 'gamma');

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

    expect(screen.getByText('beta')).toHaveStyle({
      backgroundColor: withAlpha('#0080FF', 0.3),
    });
    expect(screen.getByText('gamma')).toHaveStyle({
      backgroundColor: withAlpha('#0080FF', 0.3),
    });
  });

  it('should use the color prop for created snippets', () => {
    const onChange = vi.fn();
    setup({ mode: 'view', color: '#FF1493', onChange });

    dragCreate('alpha', 'gamma');

    const snippets = onChange.mock.calls[0][0] as Snippet[];
    expect(snippets[0].color).toBe('#FF1493');
    expect(screen.getByText('beta')).toHaveStyle({
      backgroundColor: withAlpha('#FF1493', 0.3),
    });
  });

  it('should not create a snippet for a zero-width drag', () => {
    const onChange = vi.fn();
    setup({ mode: 'view', onChange });

    fireEvent.pointerMove(screen.getByText('alpha'), {});
    fireEvent.pointerDown(screen.getByText('alpha'), {});
    fireEvent.pointerUp(window);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('beta')).not.toHaveStyle({
      backgroundColor: withAlpha('#0080FF', 0.3),
    });
  });

  it('should support multiple snippets created sequentially', () => {
    const onChange = vi.fn();
    setup({ mode: 'view', onChange });

    dragCreate('alpha', 'beta');
    dragCreate('gamma', 'delta');

    expect(onChange).toHaveBeenCalledTimes(2);
    const snippets = onChange.mock.calls[1][0] as Snippet[];
    expect(snippets).toHaveLength(2);
    expect(snippets[0]).toMatchObject({ text: 'beta', startIndex: 6, endIndex: 10 });
    expect(snippets[1]).toMatchObject({ text: 'delta', startIndex: 17, endIndex: 22 });
  });

  it('should prevent creating an overlapping snippet from inside an existing snippet', () => {
    const onChange = vi.fn();
    setup({ mode: 'view', onChange });

    dragCreate('alpha', 'gamma');
    expect(onChange).toHaveBeenCalledTimes(1);

    fireEvent.pointerMove(screen.getByText('beta'), {});
    fireEvent.pointerDown(screen.getByText('beta'), {});
    fireEvent.pointerMove(screen.getByText('delta'), {});
    fireEvent.pointerUp(window);

    expect(onChange).toHaveBeenCalledTimes(1);
    const snippets = onChange.mock.calls[0][0] as Snippet[];
    expect(snippets).toHaveLength(1);
  });

  it('should prevent creating an overlapping snippet when dragging from a boundary that touches an existing snippet', () => {
    const onChange = vi.fn();
    setup({ mode: 'view', onChange });

    dragCreate('alpha', 'gamma');
    expect(onChange).toHaveBeenCalledTimes(1);

    fireEvent.pointerMove(screen.getByText('alpha'), {});
    fireEvent.pointerDown(screen.getByText('alpha'), {});
    fireEvent.pointerMove(screen.getByText('delta'), {});
    fireEvent.pointerUp(window);

    expect(onChange).toHaveBeenCalledTimes(1);
    const snippets = onChange.mock.calls[0][0] as Snippet[];
    expect(snippets).toHaveLength(1);
    expect(snippets[0]).toMatchObject({ startIndex: 6, endIndex: 16 });
  });

  it('should keep snippet needles visible while hovering them', () => {
    setup({ mode: 'view' });

    dragCreate('alpha', 'gamma');
    fireEvent.pointerMove(screen.getByText('beta'), {});
    expect(screen.getAllByTestId('text-input-needle')).toHaveLength(2);

    fireEvent.pointerMove(getNeedleByRole('snippet-end'), {});
    expect(screen.getAllByTestId('text-input-needle')).toHaveLength(2);
  });

  it('should resize a snippet by dragging its end needle', () => {
    const onChange = vi.fn();
    setup({ mode: 'view', onChange });

    dragCreate('alpha', 'gamma');

    fireEvent.pointerMove(screen.getByText('beta'), {});
    const endNeedle = getNeedleByRole('snippet-end');
    fireEvent.pointerDown(endNeedle, {});
    fireEvent.pointerMove(screen.getByText('delta'), {});

    expect(screen.getByText('beta')).toHaveStyle({
      backgroundColor: withAlpha('#0080FF', 0.3),
    });
    expect(screen.getByText('delta')).toHaveStyle({
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

    dragCreate('alpha', 'gamma');

    fireEvent.pointerMove(screen.getByText('beta'), {});
    const startNeedle = getNeedleByRole('snippet-start');
    fireEvent.pointerDown(startNeedle, {});
    fireEvent.pointerMove(screen.getByText('gamma'), {});
    fireEvent.pointerUp(window);

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('should clear all snippets when the text is edited in input mode', () => {
    const onChange = vi.fn();
    const { rerenderWithProps } = setup({ mode: 'view', onChange });

    dragCreate('alpha', 'gamma');
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

    dragCreate('alpha', 'gamma');
    const gamma = screen.getByText('gamma');
    Object.defineProperty(gamma, 'offsetLeft', { value: 100, configurable: true });
    Object.defineProperty(gamma, 'offsetWidth', { value: 50, configurable: true });

    fireEvent.pointerMove(screen.getByText('beta'), {});
    const endNeedle = getNeedleByRole('snippet-end');

    expect(endNeedle).toHaveAttribute('data-boundary', '16');
    expect(endNeedle).toHaveStyle({ left: '150px' });
  });

  it('should highlight whitespace between words inside a snippet', () => {
    setup({ mode: 'view' });

    dragCreate('alpha', 'gamma');

    const spaceBetweenWords = screen
      .getAllByTestId('text-input-whitespace')
      .find((el) => el.getAttribute('data-token-start') === '10');
    const spaceAfterAlpha = screen
      .getAllByTestId('text-input-whitespace')
      .find((el) => el.getAttribute('data-token-start') === '5');
    const spaceAfterGamma = screen
      .getAllByTestId('text-input-whitespace')
      .find((el) => el.getAttribute('data-token-start') === '16');

    expect(spaceBetweenWords).toHaveStyle({
      backgroundColor: withAlpha('#0080FF', 0.3),
    });
    expect(spaceAfterAlpha).not.toHaveStyle({
      backgroundColor: withAlpha('#0080FF', 0.3),
    });
    expect(spaceAfterGamma).not.toHaveStyle({
      backgroundColor: withAlpha('#0080FF', 0.3),
    });
  });

  it('should ignore the leading whitespace while dragging and in the committed snippet', () => {
    const onChange = vi.fn();
    setup({ mode: 'view', onChange });

    fireEvent.pointerMove(screen.getByText('alpha'), {});
    fireEvent.pointerDown(screen.getByText('alpha'), {});
    fireEvent.pointerMove(screen.getByText('gamma'), {});

    const spaceAfterAlpha = screen
      .getAllByTestId('text-input-whitespace')
      .find((el) => el.getAttribute('data-token-start') === '5');
    expect(spaceAfterAlpha).not.toHaveStyle({
      backgroundColor: withAlpha('#0080FF', 0.2),
    });
    expect(screen.getByText('beta')).toHaveStyle({
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

  it('should show the hover needle at the word start when hovering the left half of a word', () => {
    setup({ mode: 'view' });
    const alpha = screen.getByText('alpha');
    const beta = screen.getByText('beta');
    applyRect(alpha, 94, 39);
    applyRect(beta, 178, 31);

    fireEvent.pointerMove(alpha, { clientX: 104 });
    expect(getNeedleByRole('hover')).toHaveAttribute('data-boundary', '0');

    fireEvent.pointerMove(beta, { clientX: 188 });
    expect(getNeedleByRole('hover')).toHaveAttribute('data-boundary', '6');
  });

  it('should create a snippet covering the first word when dragging back from the needle after it', () => {
    const onChange = vi.fn();
    setup({ mode: 'view', onChange });
    const alpha = screen.getByText('alpha');
    applyRect(alpha, 94, 39);

    fireEvent.pointerMove(alpha, { clientX: 125 });
    const hoverNeedle = getNeedleByRole('hover');
    expect(hoverNeedle).toHaveAttribute('data-boundary', '5');

    fireEvent.pointerDown(hoverNeedle, {});
    fireEvent.pointerMove(alpha, { clientX: 104 });

    expect(getNeedleByRole('current')).toHaveAttribute('data-boundary', '0');
    expect(alpha).toHaveStyle({ backgroundColor: withAlpha('#0080FF', 0.2) });

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

  it('should position needles at word left edge for word-start boundaries and right edge for word-end boundaries', () => {
    const elements = new Map([
      [0, { offsetLeft: 0, offsetWidth: 30, offsetTop: 0 }],
      [4, { offsetLeft: 40, offsetWidth: 30, offsetTop: 20 }],
    ]);

    expect(computeNeedlePosition(0, elements)).toEqual({ left: 0, top: 0 });
    expect(computeNeedlePosition(4, elements)).toEqual({ left: 40, top: 20 });
    expect(computeNeedlePosition(3, elements)).toEqual({ left: 30, top: 0 });
    expect(computeNeedlePosition(7, elements)).toEqual({ left: 70, top: 20 });
  });
});
