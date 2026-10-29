import { useEffect } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@translation';
import { theme } from '../../../../theme';
import { SnippetsProvider, useSnippets } from '../../../../context/SnippetsContext';
import { serialize } from '@utils/previewDocument';
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

const chipToken = (tokenId: string, text: string, edited = false): PreviewToken => ({
  kind: 'snippet',
  tokenId,
  sourceSnippetId: tokenId.split(':')[1] ?? tokenId,
  sourceId: tokenId.split(':')[0] ?? tokenId,
  color: '#0080FF',
  text,
  edited,
});

// Renders the live serialized document (the model truth) beside the
// button and hands the token array to the test — the visible-text side
// of the copy contract, and the reference pin for the no-mutation
// assertion. The data attribute surfaces the store's case-fix
// language — the copy memo's key.
const DocumentProbe = ({
  onDocument,
}: {
  onDocument?: (tokens: PreviewToken[]) => void;
}) => {
  const { document, caseFixLanguage } = useSnippets();
  useEffect(() => {
    onDocument?.(document);
  }, [document, onDocument]);
  return (
    <span
      data-testid="harness-document-probe"
      data-case-fix-language={caseFixLanguage}
      style={{ display: 'none' }}
      aria-hidden="true"
    >
      {serialize(document)}
    </span>
  );
};

// Seeds sources AND/OR a parsed document (own text, line breaks) so the
// gating matrix and the serialization payloads can be exercised
// through the provider.
const Harness = ({
  updates,
  document: parsed,
  enableEditing,
  onDocument,
}: {
  updates: Array<[string, Snippet[]]>;
  document?: PreviewToken[];
  enableEditing?: boolean;
  onDocument?: (tokens: PreviewToken[]) => void;
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
  return (
    <>
      <DocumentProbe onDocument={onDocument} />
      <CopyMergedTextButton />
    </>
  );
};

const renderWithProviders = (
  updates: Array<[string, Snippet[]]>,
  options: {
    document?: PreviewToken[];
    enableEditing?: boolean;
    onDocument?: (tokens: PreviewToken[]) => void;
  } = {},
) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MuiThemeProvider theme={theme}>
        <StyledThemeProvider theme={theme}>
          <SnippetsProvider>
            <Harness
              updates={updates}
              document={options.document}
              enableEditing={options.enableEditing}
              onDocument={options.onDocument}
            />
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

  it('copies the case-fixed serialized document on click (mid-sentence chips read lowercase-first)', async () => {
    renderWithProviders([
      ['text-1', [makeSnippet('a1', 'Hello')]],
      ['text-2', [makeSnippet('b1', 'Alpha')]],
    ]);
    fireEvent.click(screen.getByTestId('preview-copy-button'));
    await act(() => writeText.mock.results[0]?.value ?? Promise.resolve());
    expect(writeText).toHaveBeenCalledWith('Hello alpha');
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

  it('writes the fully corrected payload while the visible document holds stale case (the copy closes the stale window)', async () => {
    // Mid-typing shape: an unedited chip sits lowercase at the document
    // start — the per-input sync never corrects while the surface
    // owns its DOM, so the visible document is stale-cased.
    renderWithProviders(
      [],
      {
        document: [
          chipToken('text-1:a1', 'hello and more'),
          ownText(' tail'),
        ],
      },
    );
    expect(screen.getByTestId('harness-document-probe').textContent).toBe(
      'hello and more tail',
    );

    fireEvent.click(screen.getByTestId('preview-copy-button'));
    await act(() => writeText.mock.results[0]?.value ?? Promise.resolve());
    expect(writeText).toHaveBeenCalledWith('Hello and more tail');

    // Copying never mutates the context document: the visible text
    // keeps the stale case until the next trigger.
    expect(screen.getByTestId('harness-document-probe').textContent).toBe(
      'hello and more tail',
    );
  });

  it('never mutates the context document on copy — the token array and objects keep their references', async () => {
    const holder: { tokens: PreviewToken[] | null } = { tokens: null };
    renderWithProviders(
      [],
      {
        document: [chipToken('text-1:a1', 'hello'), ownText(' world')],
        onDocument: (document) => {
          holder.tokens = document;
        },
      },
    );
    const before = holder.tokens;
    expect(before).not.toBeNull();
    const beforeSerialized = serialize(before!);

    fireEvent.click(screen.getByTestId('preview-copy-button'));
    await act(() => writeText.mock.results[0]?.value ?? Promise.resolve());
    expect(writeText).toHaveBeenCalledWith('Hello world');

    // The same array reference, the same token objects, the same
    // content — the pass ran over a transformed copy.
    expect(holder.tokens).toBe(before);
    expect(serialize(holder.tokens!)).toBe(beforeSerialized);
    holder.tokens!.forEach((token, index) => {
      expect(token).toBe(before![index]);
    });
  });

  it('writes the fully settled payload while the visible document holds stale spacing (the copy closes the stale window)', async () => {
    // Mid-typing shape: a punctuation-ending chip glued to word
    // content plus doubled/trailing spaces — the per-input sync never
    // corrects while the focused surface owns its DOM, so the visible
    // document is stale-spaced.
    renderWithProviders(
      [],
      {
        document: [
          chipToken('text-1:a1', 'Hello,'),
          ownText('world'),
          ownText(' tail  end '),
        ],
      },
    );
    expect(screen.getByTestId('harness-document-probe').textContent).toBe(
      'Hello,world tail  end ',
    );

    fireEvent.click(screen.getByTestId('preview-copy-button'));
    await act(() => writeText.mock.results[0]?.value ?? Promise.resolve());
    // The composed pass inserts the space after ",", collapses the
    // doubled run, and trims the trailing edge.
    expect(writeText).toHaveBeenCalledWith('Hello, world tail end');

    // Copying never mutates the context document: the visible text
    // keeps the stale spacing until the next trigger.
    expect(screen.getByTestId('harness-document-probe').textContent).toBe(
      'Hello,world tail  end ',
    );
  });

  it('never mutates the context document when the copy applies spacing corrections', async () => {
    const holder: { tokens: PreviewToken[] | null } = { tokens: null };
    renderWithProviders(
      [],
      {
        document: [chipToken('text-1:a1', 'Hello,'), ownText('world')],
        onDocument: (document) => {
          holder.tokens = document;
        },
      },
    );
    const before = holder.tokens;
    expect(before).not.toBeNull();
    const beforeSerialized = serialize(before!);

    fireEvent.click(screen.getByTestId('preview-copy-button'));
    await act(() => writeText.mock.results[0]?.value ?? Promise.resolve());
    expect(writeText).toHaveBeenCalledWith('Hello, world');

    // The pass prepends the space to a transformed copy of the
    // follower — the context tokens keep their references and text.
    expect(holder.tokens).toBe(before);
    expect(serialize(holder.tokens!)).toBe(beforeSerialized);
    holder.tokens!.forEach((token, index) => {
      expect(token).toBe(before![index]);
    });
  });

  it("re-derives the corrected payload when the UI language changes — the memo keyed on the store's language field (the rule sets are content-identical today)", async () => {
    renderWithProviders(
      [],
      {
        document: [chipToken('text-1:a1', 'hello'), ownText(' world')],
      },
    );
    // The seeded sync keeps stale case: the visible document and the
    // store's language field start apart from any copy-time
    // correction.
    expect(screen.getByTestId('harness-document-probe').textContent).toBe(
      'hello world',
    );
    expect(screen.getByTestId('harness-document-probe')).toHaveAttribute(
      'data-case-fix-language',
      'en-US',
    );
    fireEvent.click(screen.getByTestId('preview-copy-button'));
    await act(() => writeText.mock.results[0]?.value ?? Promise.resolve());
    expect(writeText).toHaveBeenCalledWith('Hello world');

    // The switch dispatches the store's language (the provider's
    // languageChanged subscription); the document re-derives under
    // the same field the copy memo keys on, so display and
    // clipboard stay on one rule set.
    await act(async () => {
      await i18n.changeLanguage('pt');
    });
    expect(screen.getByTestId('harness-document-probe')).toHaveAttribute(
      'data-case-fix-language',
      'pt',
    );
    expect(screen.getByTestId('harness-document-probe').textContent).toBe(
      'Hello world',
    );
    fireEvent.click(screen.getByTestId('preview-copy-button'));
    await act(() => writeText.mock.results[1]?.value ?? Promise.resolve());
    expect(writeText).toHaveBeenLastCalledWith('Hello world');

    await act(async () => {
      await i18n.changeLanguage('en-US');
    });
  });

  it('renders a tooltip with the copy button label', () => {
    renderWithProviders([['text-1', [makeSnippet('a1', 'Hello')]]]);
    // Tooltip is rendered by MUI, we verify the title prop is passed
    const button = screen.getByTestId('preview-copy-button');
    expect(button).toHaveAttribute('aria-label', 'Copy merged text to clipboard');
  });
});
