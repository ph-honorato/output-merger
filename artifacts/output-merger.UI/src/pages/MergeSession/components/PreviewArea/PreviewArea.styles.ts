import styled from 'styled-components';
import type { DefaultTheme } from 'styled-components';
import type { Theme } from '@mui/material/styles';

type StyledTheme = DefaultTheme & Theme;

export const PreviewAreaRoot = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  min-height: 400px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: auto;
  padding: ${({ theme }) => (theme as StyledTheme).spacing(2)};
  background-color: ${({ theme }) =>
    (theme as StyledTheme).palette.background.paper};
  border: 1px solid ${({ theme }) => (theme as StyledTheme).palette.divider};
  border-radius: 0.75rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
`;

export const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => (theme as StyledTheme).spacing(1)};
  color: ${({ theme }) => (theme as StyledTheme).palette.text.secondary};
`;

export const SegmentFlow = styled.div`
  display: block;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  text-align: left;
`;

export const OverlayChip = styled.span`
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
  color: ${({ theme }) => (theme as StyledTheme).palette.text.primary};
  white-space: pre-wrap;
  cursor: grabbing;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
`;

/**
 * Drop-indicator needle rendered between segments while a drag is
 * active, at the landing slot of the dragged snippet. The anchor is a
 * zero-width, zero-height inline-block: it participates in the flow's
 * inline wrapping (at a line-wrap boundary it stays at the end of the
 * earlier line, like any inline content) but takes no space, so it
 * cannot perturb dnd-kit's measured sortable rects or the
 * rectSortingStrategy sibling transforms while it appears, moves, or
 * disappears mid-drag.
 */
export const DropIndicator = styled.span`
  display: inline-block;
  position: relative;
  width: 0px;
  height: 0px;
  pointer-events: none;
`;

/**
 * Visible needle bar, absolutely positioned inside the zero-size
 * anchor: the TextInput needle's shape language (4px wide, 1.5em tall,
 * 2px radius, left edge at the insertion point) in the theme's neutral
 * text.secondary — never a snippet color, never the primary accent.
 * The 1.5em bar spans the flow's 1.6 body line-height (the empty
 * anchor's box sits on the text baseline), with no animation: it
 * appears and disappears instantly.
 */
export const DropIndicatorBar = styled.span`
  position: absolute;
  top: -1.1em;
  left: 0;
  width: 4px;
  height: 1.5em;
  border-radius: 2px;
  background-color: ${({ theme }) =>
    (theme as StyledTheme).palette.text.secondary};
`;
