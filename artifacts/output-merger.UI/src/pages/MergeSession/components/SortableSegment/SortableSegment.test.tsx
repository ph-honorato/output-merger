import { render, screen } from '@testing-library/react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@translation';
import { theme } from '../../../../theme';
import type { OrderedSnippet } from '../../../../context/SnippetsContext';
import SortableSegment from './SortableSegment';

const makeOrderedSnippet = (): OrderedSnippet => ({
  id: 'a1',
  text: 'Hello',
  startIndex: 0,
  endIndex: 5,
  color: '#0080FF',
  sourceId: 'text-1',
  order: 1,
});

const renderSegment = (snippet: OrderedSnippet, sortableId: string) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MuiThemeProvider theme={theme}>
        <StyledThemeProvider theme={theme}>
          <DndContext sensors={[]} collisionDetection={closestCenter}>
            <SortableContext items={[sortableId]} strategy={rectSortingStrategy}>
              <SortableSegment snippet={snippet} sortableId={sortableId} />
            </SortableContext>
          </DndContext>
        </StyledThemeProvider>
      </MuiThemeProvider>
    </I18nextProvider>,
  );

describe('SortableSegment', () => {
  it('renders the snippet text on the sortable element with its tint', () => {
    renderSegment(makeOrderedSnippet(), 'text-1:a1');

    const segment = screen.getByTestId('preview-snippet');
    expect(segment).toHaveTextContent('Hello');
    expect(segment).toHaveStyle({
      backgroundColor: 'rgba(0, 128, 255, 0.3)',
    });
  });

  it('applies the dnd-kit sortable semantics: focusable button with instruction linkage', () => {
    renderSegment(makeOrderedSnippet(), 'text-1:a1');

    const segment = screen.getByTestId('preview-snippet');
    expect(segment).toHaveAttribute('role', 'button');
    expect(segment).toHaveAttribute('tabindex', '0');
    expect(segment).toHaveAttribute('aria-roledescription', 'sortable');
    expect(segment.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('applies the drag affordance styles on the chip', () => {
    renderSegment(makeOrderedSnippet(), 'text-1:a1');

    const segment = screen.getByTestId('preview-snippet');
    expect(segment).toHaveStyle({ cursor: 'grab' });
    expect(segment).toHaveStyle({ 'user-select': 'none' });
    expect(segment).toHaveStyle({ 'touch-action': 'none' });
  });

  it('ships a focus ring rule for keyboard focus', () => {
    renderSegment(makeOrderedSnippet(), 'text-1:a1');

    const css = Array.from(document.querySelectorAll('style'))
      .map((style) => style.textContent)
      .join('');
    expect(css).toContain(':focus-visible');
  });

  it('deepens its hover tint to the snippet color', () => {
    renderSegment({ ...makeOrderedSnippet(), color: '#FF1493' }, 'text-1:a1');

    const css = Array.from(document.querySelectorAll('style'))
      .map((style) => style.textContent)
      .join('');
    expect(css).toContain('background-color:rgba(255, 20, 147, 0.4)');
  });
});
