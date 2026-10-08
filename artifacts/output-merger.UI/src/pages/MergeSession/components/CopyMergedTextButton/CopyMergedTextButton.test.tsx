import { useEffect } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../../i18n';
import { theme } from '../../../../theme';
import { SnippetsProvider, useSnippets } from '../../../../context/SnippetsContext';
import type { Snippet } from '@components/TextInput';
import CopyMergedTextButton from './CopyMergedTextButton';
import { buildMergedText } from './CopyMergedTextButton.hook';

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
});

const makeSnippet = (id: string, text: string): Snippet => ({ id, text, startIndex: 0, endIndex: text.length, color: '#0080FF' });

const Harness = ({ updates }: { updates: Array<[string, Snippet[]]> }) => {
  const { setSourceSnippets } = useSnippets();
  useEffect(() => {
    updates.forEach(([sourceId, snippets]) => setSourceSnippets(sourceId, snippets));
  }, [updates, setSourceSnippets]);
  return <CopyMergedTextButton />;
};

const renderWithProviders = (updates: Array<[string, Snippet[]]>) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MuiThemeProvider theme={theme}>
        <StyledThemeProvider theme={theme}>
          <SnippetsProvider>
            <Harness updates={updates} />
          </SnippetsProvider>
        </StyledThemeProvider>
      </MuiThemeProvider>
    </I18nextProvider>
  );

describe('CopyMergedTextButton', () => {
  it('renders an icon button with the copy aria-label', () => {
    renderWithProviders([]);
    const button = screen.getByTestId('preview-copy-button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Copy merged text to clipboard');
  });

  it('is disabled while there are zero snippets', () => {
    renderWithProviders([]);
    expect(screen.getByTestId('preview-copy-button')).toBeDisabled();
  });

  it('is enabled when snippets exist', () => {
    renderWithProviders([['text-1', [makeSnippet('a1', 'Hello')]]]);
    expect(screen.getByTestId('preview-copy-button')).toBeEnabled();
  });

  it('copies the space-joined merged text on click', async () => {
    renderWithProviders([
      ['text-1', [makeSnippet('a1', 'Hello')]],
      ['text-2', [makeSnippet('b1', 'Alpha')]],
    ]);
    fireEvent.click(screen.getByTestId('preview-copy-button'));
    await act(() => writeText.mock.results[0]?.value ?? Promise.resolve());
    expect(writeText).toHaveBeenCalledWith('Hello Alpha');
  });

  it('shows the toast after a successful copy', async () => {
    renderWithProviders([['text-1', [makeSnippet('a1', 'Hello')]]]);
    fireEvent.click(screen.getByTestId('preview-copy-button'));
    const toast = await screen.findByTestId('preview-copy-toast');
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveTextContent('Text copied to clipboard');
  });

  it('does not throw or show the toast when the clipboard rejects', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    renderWithProviders([['text-1', [makeSnippet('a1', 'Hello')]]]);
    fireEvent.click(screen.getByTestId('preview-copy-button'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.queryByTestId('preview-copy-toast')).not.toBeInTheDocument();
  });

  it('builds the merged text as a single-space join', () => {
    expect(buildMergedText([])).toBe('');
    expect(
      buildMergedText([
        { ...makeSnippet('a1', 'Hello'), sourceId: 'text-1', order: 1 },
        { ...makeSnippet('b1', 'Alpha'), sourceId: 'text-2', order: 2 },
        { ...makeSnippet('c1', 'world'), sourceId: 'text-3', order: 3 },
      ])
    ).toBe('Hello Alpha world');
  });
});
