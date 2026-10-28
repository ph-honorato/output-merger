import { render, screen } from '@testing-library/react';
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
import { PREVIEW_DOCUMENT_MAX_LENGTH } from '@utils/previewDocument';
import PreviewCharCount from './PreviewCharCount';

const makeSnippet = (id: string, text: string): Snippet => ({
  id,
  text,
  startIndex: 0,
  endIndex: text.length,
  color: '#0080FF',
});

const renderCounter = (
  updates: Array<[string, Snippet[]]>,
  ui = <PreviewCharCount />,
) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MuiThemeProvider theme={theme}>
        <StyledThemeProvider theme={theme}>
          <SnippetsProvider>
            {ui}
            <SeedUpdates updates={updates} />
          </SnippetsProvider>
        </StyledThemeProvider>
      </MuiThemeProvider>
    </I18nextProvider>,
  );

const SeedUpdates = ({ updates }: { updates: Array<[string, Snippet[]]> }) => {
  const { setSourceSnippets } = useSnippets();
  useEffect(() => {
    updates.forEach(([sourceId, snippets]) =>
      setSourceSnippets(sourceId, snippets),
    );
  }, [updates, setSourceSnippets]);
  return null;
};

const css = () =>
  Array.from(document.querySelectorAll('style'))
    .map((style) => style.textContent)
    .join('');

describe('PreviewCharCount', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en-US');
  });

  it('renders the default count/limit form — the maximum allowed characters shows', () => {
    renderCounter([
      ['text-1', [makeSnippet('a1', 'Alpha')]],
      ['text-2', [makeSnippet('b1', 'Beta')]],
    ]);
    // "Alpha Beta" serializes to 10 characters: count/limit.
    expect(screen.getByTestId('preview-char-count')).toHaveTextContent(
      `10/${PREVIEW_DOCUMENT_MAX_LENGTH}`,
    );
  });

  it('renders number-only under hideLimit — no slash anywhere', () => {
    renderCounter(
      [
        ['text-1', [makeSnippet('a1', 'Alpha')]],
        ['text-2', [makeSnippet('b1', 'Beta')]],
      ],
      <PreviewCharCount hideLimit />,
    );
    expect(screen.getByTestId('preview-char-count')).toHaveTextContent('10');
    expect(
      screen.getByTestId('preview-char-count').textContent,
    ).not.toContain('/');
  });

  it('updates live as the document changes (a source edit grows the count)', () => {
    const { rerender } = renderCounter([
      ['text-1', [makeSnippet('a1', 'Alpha')]],
    ]);
    expect(screen.getByTestId('preview-char-count')).toHaveTextContent(
      `5/${PREVIEW_DOCUMENT_MAX_LENGTH}`,
    );
    rerender(
      <I18nextProvider i18n={i18n}>
        <MuiThemeProvider theme={theme}>
          <StyledThemeProvider theme={theme}>
            <SnippetsProvider>
              <PreviewCharCount />
              <SeedUpdates
                updates={[['text-1', [makeSnippet('a1', 'Alpha one')]]]}
              />
            </SnippetsProvider>
          </StyledThemeProvider>
        </MuiThemeProvider>
      </I18nextProvider>,
    );
    expect(screen.getByTestId('preview-char-count')).toHaveTextContent(
      `9/${PREVIEW_DOCUMENT_MAX_LENGTH}`,
    );
  });

  it('turns the error red AT the limit in BOTH variants (secondary below it)', () => {
    const { unmount } = renderCounter([
      [
        'text-1',
        [makeSnippet('a1', 'a'.repeat(PREVIEW_DOCUMENT_MAX_LENGTH))],
      ],
    ]);
    const atLimit = screen.getByTestId('preview-char-count');
    expect(atLimit).toHaveTextContent(
      `${PREVIEW_DOCUMENT_MAX_LENGTH}/${PREVIEW_DOCUMENT_MAX_LENGTH}`,
    );
    expect(atLimit).toHaveStyle({ color: theme.palette.error.main });
    unmount();

    const oneBelow = PREVIEW_DOCUMENT_MAX_LENGTH - 1;
    const second = renderCounter([
      ['text-1', [makeSnippet('a1', 'a'.repeat(oneBelow))]],
    ]);
    const below = screen.getByTestId('preview-char-count');
    expect(below).toHaveTextContent(
      `${oneBelow}/${PREVIEW_DOCUMENT_MAX_LENGTH}`,
    );
    expect(below).toHaveStyle({ color: theme.palette.text.secondary });
    second.unmount();

    // The number-only variant shares the color contract.
    renderCounter(
      [
        [
          'text-1',
          [makeSnippet('a1', 'a'.repeat(PREVIEW_DOCUMENT_MAX_LENGTH))],
        ],
      ],
      <PreviewCharCount hideLimit />,
    );
    expect(screen.getByTestId('preview-char-count')).toHaveStyle({
      color: theme.palette.error.main,
    });
  });

  it('carries the translated aria-label and follows the active language', async () => {
    renderCounter([
      ['text-1', [makeSnippet('a1', 'Alpha')]],
    ]);
    const counter = screen.getByTestId('preview-char-count');
    expect(counter).toHaveAttribute('aria-label', 'Character count');
    expect(enUS['pages.mergeSession.previewArea.counterLabel']).toBe(
      'Character count',
    );
    expect(ptBR['pages.mergeSession.previewArea.counterLabel']).toBe(
      'Contagem de caracteres',
    );

    await i18n.changeLanguage('pt');
    expect(
      screen.getByTestId('preview-char-count'),
    ).toHaveAttribute('aria-label', 'Contagem de caracteres');
  });

  it('is styled like the text inputs counter, rail-safe: centered, no right-edge flex-end', () => {
    renderCounter([['text-1', [makeSnippet('a1', 'Alpha')]]]);
    const counter = screen.getByTestId('preview-char-count');
    expect(counter).toHaveStyle({ textAlign: 'center' });
    expect(counter).toHaveStyle({ alignSelf: 'stretch' });
    // The same font size as TextInput's Counter; a right-edge
    // flex-end would widen a vertical rail (the modal's tools rack)
    // past its icon width — it must be gone.
    expect(css()).toContain('font-size:0.875rem');
    expect(css()).not.toContain('align-self:flex-end');
  });
});
