import { useEffect } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@translation';
import { theme } from '../../../../theme';
import { SnippetsProvider, useSnippets } from '../../../../context/SnippetsContext';
import type { PreviewToken } from '../../../../context/SnippetsContext';
import type { Snippet } from '@components';
import CopyMergedTextButton from './CopyMergedTextButton';

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
});

const makeSnippet = (id: string, text: string): Snippet => ({ id, text, startIndex: 0, endIndex: text.length, color: '#0080FF' });

const ownText = (text: string): PreviewToken => ({
  kind: 'text',
  tokenId: `own-${Math.random().toString(36).slice(2, 8)}`,
  text,
});

// Seeds sources AND/OR a parsed document (own text, line breaks) so the
// gating matrix and the serialization payloads can be exercised
// through the provider.
const Harness = ({
  updates,
  document: parsed,
  enableEditing,
}: {
  updates: Array<[string, Snippet[]]>;
  document?: PreviewToken[];
  enableEditing?: boolean;
}) => {
  const { setSourceSnippets, syncDocument, setEditEnabled } = useSnippets();
  useEffect(() => {
    updates.forEach(([sourceId, snippets]) => setSourceSnippets(sourceId, snippets));
  }, [updates, setSourceSnippets]);
  useEffect(() => {
    if (parsed) {
      syncDocument(parsed);
    }
  }, [parsed, syncDocument]);
  useEffect(() => {
    if (enableEditing) {
      setEditEnabled(true);
    }
  }, [enableEditing, setEditEnabled]);
  return <CopyMergedTextButton />;
};

const renderWithProviders = (
  updates: Array<[string, Snippet[]]>,
  options: { document?: PreviewToken[]; enableEditing?: boolean } = {},
) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MuiThemeProvider theme={theme}>
        <StyledThemeProvider theme={theme}>
          <SnippetsProvider>
            <Harness updates={updates} document={options.document} enableEditing={options.enableEditing} />
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

  it('is disabled while edit is OFF and the document is empty (today\'s behavior)', () => {
    renderWithProviders([]);
    expect(screen.getByTestId('preview-copy-button')).toBeDisabled();
  });

  it('is enabled when snippets exist (edit OFF)', () => {
    renderWithProviders([['text-1', [makeSnippet('a1', 'Hello')]]]);
    expect(screen.getByTestId('preview-copy-button')).toBeEnabled();
  });

  it('is enabled while edit is ON even on an empty document (gating matrix)', () => {
    renderWithProviders([], { enableEditing: true });
    expect(screen.getByTestId('preview-copy-button')).toBeEnabled();
  });

  it('is enabled for an own-text-only document', () => {
    renderWithProviders([], { document: [ownText('just my words')] });
    expect(screen.getByTestId('preview-copy-button')).toBeEnabled();
  });

  it('copies the serialized document on click, byte-identical to the old join for unedited sessions', async () => {
    renderWithProviders([
      ['text-1', [makeSnippet('a1', 'Hello')]],
      ['text-2', [makeSnippet('b1', 'Alpha')]],
    ]);
    fireEvent.click(screen.getByTestId('preview-copy-button'));
    await act(() => writeText.mock.results[0]?.value ?? Promise.resolve());
    expect(writeText).toHaveBeenCalledWith('Hello Alpha');
  });

  it('copies own text, line breaks, and integrated snippet text exactly as serialized', async () => {
    renderWithProviders(
      [['text-1', [makeSnippet('a1', 'Alpha')]]],
      {
        document: [
          {
            kind: 'snippet',
            tokenId: 'text-1:a1',
            sourceSnippetId: 'a1',
            sourceId: 'text-1',
            color: '#0080FF',
            text: 'Alpha!',
            edited: true,
          },
          ownText(' then'),
          { kind: 'line-break', tokenId: 'br-1' },
          ownText('more'),
        ],
      },
    );
    fireEvent.click(screen.getByTestId('preview-copy-button'));
    await act(() => writeText.mock.results[0]?.value ?? Promise.resolve());
    expect(writeText).toHaveBeenCalledWith('Alpha! then\nmore');
  });

  it('writes the empty string and shows the toast on an empty document while edit is ON', async () => {
    renderWithProviders([], { enableEditing: true });
    fireEvent.click(screen.getByTestId('preview-copy-button'));
    await act(() => writeText.mock.results[0]?.value ?? Promise.resolve());
    expect(writeText).toHaveBeenCalledWith('');
    const toast = await screen.findByTestId('preview-copy-toast');
    expect(toast).toBeInTheDocument();
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
});
