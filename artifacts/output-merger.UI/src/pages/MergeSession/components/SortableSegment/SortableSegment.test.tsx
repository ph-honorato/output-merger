import { render, screen } from '@testing-library/react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@translation';
import { theme } from '@theme';
import type { SnippetToken } from '../../../../context/SnippetsContext';
import SortableSegment from './SortableSegment';

const makeSnippetToken = (tokenId: string, text: string, color = '#0080FF'): SnippetToken => ({
  kind: 'snippet',
  tokenId,
  sourceSnippetId: tokenId.split(':')[1] ?? tokenId,
  sourceId: tokenId.split(':')[0] ?? tokenId,
  color,
  text,
  edited: false,
});

const renderSegment = (token: SnippetToken) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MuiThemeProvider theme={theme}>
        <StyledThemeProvider theme={theme}>
          <DndContext sensors={[]} collisionDetection={closestCenter}>
            <SortableContext items={[token.tokenId]} strategy={rectSortingStrategy}>
              <SortableSegment token={token} />
            </SortableContext>
          </DndContext>
        </StyledThemeProvider>
      </MuiThemeProvider>
    </I18nextProvider>,
  );

describe('SortableSegment', () => {
  it('renders the snippet text on the sortable element with its tint and token id', () => {
    renderSegment(makeSnippetToken('text-1:a1', 'Hello'));

    const segment = screen.getByTestId('preview-snippet');
    expect(segment).toHaveTextContent('Hello');
    expect(segment).toHaveStyle({
      backgroundColor: 'rgba(0, 128, 255, 0.3)',
    });
    expect(segment).toHaveAttribute('data-token-id', 'text-1:a1');
  });

  it('applies the dnd-kit sortable semantics: focusable button with instruction linkage', () => {
    renderSegment(makeSnippetToken('text-1:a1', 'Hello'));

    const segment = screen.getByTestId('preview-snippet');
    expect(segment).toHaveAttribute('role', 'button');
    expect(segment).toHaveAttribute('tabindex', '0');
    expect(segment).toHaveAttribute('aria-roledescription', 'sortable');
    expect(segment.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('applies the drag affordance styles on the chip', () => {
    renderSegment(makeSnippetToken('text-1:a1', 'Hello'));

    const segment = screen.getByTestId('preview-snippet');
    expect(segment).toHaveStyle({ cursor: 'grab' });
    expect(segment).toHaveStyle({ 'user-select': 'none' });
    expect(segment).toHaveStyle({ 'touch-action': 'none' });
  });

  it('ships a focus ring rule for keyboard focus', () => {
    renderSegment(makeSnippetToken('text-1:a1', 'Hello'));

    const css = Array.from(document.querySelectorAll('style'))
      .map((style) => style.textContent)
      .join('');
    expect(css).toContain(':focus-visible');
  });

  it('deepens its hover tint to the snippet color', () => {
    renderSegment(makeSnippetToken('text-2:b1', 'Alpha', '#FF1493'));

    const css = Array.from(document.querySelectorAll('style'))
      .map((style) => style.textContent)
      .join('');
    expect(css).toContain('background-color:rgba(255, 20, 147, 0.4)');
  });
});
